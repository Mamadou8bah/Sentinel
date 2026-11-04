"""Download pinned, checksum-verified weights: python -m app.models.install_pretrained."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request


def install(directory):
    from app.services.pretrained import MANIFEST
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for name, spec in json.loads(MANIFEST.read_text())['models'].items():
        target = directory / spec['file']
        if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == spec['sha256']:
            print(f'{name}: already installed', flush=True)
            continue
        temporary = target.with_suffix(target.suffix + '.download')
        print(f'{name}: downloading pinned weights', flush=True)
        digest, size = hashlib.sha256(), 0
        try:
            with urllib.request.urlopen(spec['url'], timeout=120) as response, temporary.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > 50_000_000:
                        raise ValueError('Model exceeds download size limit')
                    digest.update(chunk); output.write(chunk)
                    print(f'  {size / 1_000_000:.1f} MB', flush=True)
            if digest.hexdigest() != spec['sha256']:
                raise ValueError(f'{name}: model checksum mismatch')
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
        print(f'{name}: checksum verified', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='artifacts/pretrained')
    install(parser.parse_args().output)
