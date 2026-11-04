"""Import publisher-labelled PAD/OCR CSV metadata without guessing labels or prompts."""
import argparse
import csv
import json
from pathlib import Path

from app.models.evaluate_public import local_file, load_rows


def convert(source, output, task):
    source, output = Path(source), Path(output)
    rows, skipped = [], 0
    with source.open(encoding='utf-8-sig', newline='') as data:
        reader = csv.DictReader(data)
        required = {'split', 'subject', 'video', 'label'} if task == 'spoof' else {'split', 'subject', 'document', 'expectedText'}
        if not required <= set(reader.fieldnames or []):
            raise ValueError('Required CSV columns: ' + ','.join(sorted(required)))
        for number, row in enumerate(reader, 2):
            if any(row.get(key) is None for key in required):
                raise ValueError(f'CSV line {number}: missing required column value')
            split = row['split'].strip().lower()
            if split == 'train':
                skipped += 1
                continue
            split = {'devel': 'validation', 'dev': 'validation', 'development': 'validation'}.get(split, split)
            if split not in ('benchmark', 'validation', 'test') or not row['subject'].strip():
                raise ValueError(f'CSV line {number}: invalid split or subject identity')
            key = 'video' if task == 'spoof' else 'document'
            path = local_file(source.parent, row[key].strip())
            if not path.is_relative_to(output.resolve().parent):
                raise ValueError('Place the JSONL manifest at the dataset root, above its image/video paths')
            item = {'split': split, 'subjects': [row['subject'].strip()],
                    key: path.relative_to(output.resolve().parent).as_posix()}
            if task == 'spoof':
                label = row['label'].strip()
                if label not in ('0', '1'):
                    raise ValueError(f'CSV line {number}: use 1=genuine/live, 0=photo/screen/spoof')
                item['label'] = int(label)
            else:
                text = row['expectedText'].strip()
                if not 1 <= len(text) <= 1000:
                    raise ValueError(f'CSV line {number}: expectedText must contain 1–1000 characters')
                item['expectedText'] = text
            rows.append(item)
    if not rows:
        raise ValueError('No non-training samples to import')
    if output.exists():
        raise ValueError('Output already exists; choose a new JSONL filename')
    output.parent.mkdir(parents=True, exist_ok=True)
    # Validate paths and disjoint labelled identities before installing metadata.
    temporary = output.with_suffix(output.suffix + '.tmp')
    try:
        temporary.write_text('\n'.join(json.dumps(row) for row in rows) + '\n', encoding='utf-8')
        load_rows(temporary, task)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Imported {len(rows)} labelled {task} examples; excluded {skipped} training examples. No challenge labels were invented.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task', choices=['spoof', 'ocr'], required=True)
    parser.add_argument('--csv', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        convert(args.csv, args.output, args.task)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Import failed: {error}\n')
