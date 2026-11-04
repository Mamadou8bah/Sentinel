"""Public component-benchmark acquisition. Never creates KYC acceptance reports."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# Original, unaligned RGB images: detection/alignment must remain part of SFace testing.
# URLs and SHA-256 are published by scikit-learn's official LFW loader.
LFW = {
    'lfw.tgz': ('https://ndownloader.figshare.com/files/5976018', '055f7d9c632d7370e6fb4afc7468d40f970c34a80d4c6f50ffec63f5a8d536c0'),
    'pairs.txt': ('https://ndownloader.figshare.com/files/5976006', 'ea42330c62c92989f9d7c03237ed5d591365e89b3e649747777b70e692dc1592'),
}


def checksum(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as source:
        while chunk := source.read(1024 * 1024):
            result.update(chunk)
    return result.hexdigest()


def download(url, target, digest, limit=250_000_000):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and checksum(target) == digest:
        print(f'{target.name}: cached and verified', flush=True)
        return
    temporary = target.with_suffix(target.suffix + '.part')
    for attempt in range(5):
        offset = temporary.stat().st_size if temporary.exists() else 0
        request = urllib.request.Request(url, headers={'Range': f'bytes={offset}-'} if offset else {})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                append = offset > 0 and response.status == 206
                if append and not response.headers.get('Content-Range', '').startswith(f'bytes {offset}-'):
                    raise ValueError('Invalid resumed download range')
                size = offset if append else 0
                if size + int(response.headers.get('Content-Length', 0)) > limit:
                    raise ValueError('Dataset download exceeds size limit')
                print(f'{target.name}: downloading from {size / 1e6:.1f} MB', flush=True)
                last_progress = size
                with temporary.open('ab' if append else 'wb') as output:
                    while chunk := response.read(256 * 1024):
                        size += len(chunk)
                        if size > limit:
                            raise ValueError('Dataset download exceeds size limit')
                        output.write(chunk)
                        if size - last_progress >= 5_000_000:
                            print(f'  {size / 1e6:.1f} MB received', flush=True)
                            last_progress = size
            break
        except (OSError, TimeoutError):
            if attempt == 4:
                raise
            print('Download interrupted; retrying with resume', flush=True)
            time.sleep(1)
    if checksum(temporary) != digest:
        temporary.unlink()
        raise ValueError('Dataset checksum mismatch; downloaded file discarded')
    temporary.replace(target)
    print(f'{target.name}: checksum verified', flush=True)


def extract_lfw(archive, output):
    root = Path(output).resolve()
    count, total = 0, 0
    with tarfile.open(archive, 'r:gz') as source:
        for member in source:
            name = PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts or member.issym() or member.islnk():
                raise ValueError('Unsafe dataset archive member')
            if member.isdir():
                continue
            if not member.isfile() or not re.fullmatch(r'lfw/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+_\d{4}\.jpg', member.name):
                raise ValueError('Unexpected LFW archive member')
            total += member.size
            if member.size > 5_000_000 or total > 500_000_000 or count >= 20_000:
                raise ValueError('Expanded dataset exceeds extraction limits')
            target = (root / member.name).resolve()
            if not target.is_relative_to(root):
                raise ValueError('Dataset path escapes output directory')
            data = source.extractfile(member).read()
            if target.exists() and target.read_bytes() != data:
                raise ValueError('Refusing to replace a different existing dataset image')
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(data)
            count += 1
    print(f'Extracted/verified {count} original LFW images', flush=True)


def download_parallel(url, target, digest):
    """Resume the archive with bounded range requests, verifying the full pinned hash."""
    target = Path(target)
    if target.is_file() and checksum(target) == digest:
        print(f'{target.name}: cached and verified', flush=True)
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=0-0'}), timeout=30) as response:
        match = re.fullmatch(r'bytes 0-0/(\d+)', response.headers.get('Content-Range', ''))
        if response.status != 206 or not match:
            return download(url, target, digest)
        size = int(match[1])
    if size > 250_000_000:
        raise ValueError('Dataset archive exceeds size limit')
    temporary = target.with_suffix(target.suffix + '.part')
    offset = temporary.stat().st_size if temporary.exists() else 0
    if offset > size:
        raise ValueError('Partial archive exceeds expected size')
    cache = target.parent / (target.name + '.chunks')
    cache.mkdir(exist_ok=True)
    chunk_size = 1024 * 1024
    starts = list(range(offset, size, chunk_size))
    print(f'{target.name}: resuming at {offset / 1e6:.1f}/{size / 1e6:.1f} MB with 8 connections', flush=True)
    def part(start):
        end = min(start + chunk_size, size) - 1
        path = cache / str(start)
        if path.is_file() and path.stat().st_size == end - start + 1:
            return path
        for attempt in range(4):
            try:
                request = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}'})
                with urllib.request.urlopen(request, timeout=45) as response:
                    if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{size}':
                        raise ValueError('Invalid dataset range response')
                    data = response.read(end - start + 2)
                if len(data) != end - start + 1:
                    raise OSError('Incomplete dataset range')
                path.write_bytes(data)
                return path
            except (OSError, TimeoutError):
                if attempt == 3: raise
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(part, start) for start in starts]
        for completed, future in enumerate(as_completed(futures), 1):
            future.result()
            if completed % 8 == 0 or completed == len(starts):
                received = offset + sum((cache / str(start)).stat().st_size for start in starts if (cache / str(start)).exists())
                print(f'  {received / 1e6:.1f}/{size / 1e6:.1f} MB received', flush=True)
    if temporary.exists() and temporary.stat().st_size != offset:
        raise ValueError('Another download changed the partial archive')
    with temporary.open('ab') as output:
        for start in starts:
            output.write((cache / str(start)).read_bytes())
    if checksum(temporary) != digest:
        temporary.unlink()
        for start in starts: (cache / str(start)).unlink(missing_ok=True)
        raise ValueError('Dataset archive checksum mismatch')
    temporary.replace(target)
    for start in starts: (cache / str(start)).unlink(missing_ok=True)
    if not any(cache.iterdir()): cache.rmdir()
    print(f'{target.name}: full archive checksum verified', flush=True)


def lfw_pairs(root):
    root = Path(root)
    lines = (root / 'pairs.txt').read_text(encoding='utf-8-sig').splitlines()
    header = lines.pop(0).split()
    if len(header) != 2:
        raise ValueError('Expected official ten-fold LFW pairs protocol')
    folds, each_class = map(int, header)
    if min(folds, each_class) <= 0 or len(lines) != folds * each_class * 2:
        raise ValueError('LFW pair count does not match protocol header')
    rows = []
    def image(person, index):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', person) or not index.isdigit():
            raise ValueError('Invalid LFW identity/image index')
        path = f'lfw/{person}/{person}_{int(index):04d}.jpg'
        if not (root / path).is_file():
            raise ValueError('LFW image missing: ' + path)
        return path
    for index, line in enumerate(lines):
        fields = line.split()
        label = 1 if index % (2 * each_class) < each_class else 0
        if label and len(fields) == 3:
            first, second = image(fields[0], fields[1]), image(fields[0], fields[2])
            subjects = [fields[0]]
        elif not label and len(fields) == 4:
            first, second = image(fields[0], fields[1]), image(fields[2], fields[3])
            subjects = [fields[0], fields[2]]
            if fields[0] == fields[2]:
                raise ValueError('Nonmatching pair contains the same identity')
        else:
            raise ValueError('LFW row does not match official fold/class ordering')
        rows.append({'split': 'benchmark', 'fold': index // (2 * each_class), 'subjects': subjects,
                     'images': [first, second], 'label': label})
    return rows


def install_lfw(output):
    output = Path(output)
    for filename, (url, digest) in LFW.items():
        (download_parallel if filename.endswith('.tgz') else download)(url, output / filename, digest)
    extract_lfw(output / 'lfw.tgz', output)
    rows = lfw_pairs(output)
    (output / 'face-pairs.jsonl').write_text('\n'.join(json.dumps(row) for row in rows) + '\n', encoding='utf-8')
    (output / 'provenance.json').write_text(json.dumps({
        'dataset': 'LFW original RGB / official ten-fold pairs', 'files': {name: sha for name, (_url, sha) in LFW.items()},
        'source': 'https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/datasets/_lfw.py',
        'scope': 'component-benchmark-only', 'grantsKycAcceptance': False,
        'pretrainedTrainingOverlap': 'unknown', 'subjectDisjointFolds': False}, indent=2), encoding='utf-8')
    print(f'Prepared {len(rows)} labelled pairs at {output / "face-pairs.jsonl"}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('data/public/lfw'))
    args = parser.parse_args()
    try:
        install_lfw(args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\nRerun this command to resume an interrupted download.\n')
