"""Preflight all identity datasets, then train all four tasks with unchanged evaluation gates."""
import argparse
from collections import Counter
from pathlib import Path
from types import SimpleNamespace
from app.training.train import load_manifest, train
from app.models.network import TASKS
from app.services.identity import IdentityModels


def preflight(directory):
    problems=[]
    for task in TASKS:
        manifest=directory/f"{task}.jsonl"
        if not manifest.is_file():
            problems.append(f"{task}: missing {manifest}");continue
        try:
            rows=load_manifest(manifest,task)
            for split in ('validation','test'):
                examples=[row for row in rows if row['split']==split]
                if task=='ocr':
                    if len(examples)<100:raise ValueError(f"{split} needs at least 100 OCR examples")
                elif any(count<100 for count in Counter(row['label'] for row in examples).values()):
                    raise ValueError(f"{split} needs at least 100 examples per class")
            print(f"{task}: {len(rows)} labelled examples; split/leakage/count checks passed",flush=True)
        except (ValueError,KeyError,TypeError) as error:problems.append(f"{task}: {error}")
    if problems:raise ValueError("Identity data is not ready:\n"+"\n".join(problems))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',type=Path,default=Path('data'))
    parser.add_argument('--output',type=Path,default=Path('artifacts/identity'))
    parser.add_argument('--epochs',type=int,default=20)
    parser.add_argument('--batch-size',type=int,default=32)
    parser.add_argument('--learning-rate',type=float,default=.001)
    parser.add_argument('--device',default='cpu')
    parser.add_argument('--seed',type=int,default=42)
    parser.add_argument('--check-only',action='store_true')
    args=parser.parse_args()
    try:preflight(args.data)
    except ValueError as error:parser.exit(2,str(error)+'\n')
    if args.check_only:return
    if any((args.output/task/'weights.pt').exists() for task in TASKS):
        parser.exit(2,'Choose a new output directory to preserve existing artifacts.\n')
    for task in TASKS:
        print(f"Starting {task} training",flush=True)
        values=vars(args).copy();values.update(task=task,manifest=args.data/f'{task}.jsonl',output=args.output/task)
        train(SimpleNamespace(**values))
    models=IdentityModels(args.output)
    if not models.ready:parser.exit(2,'Training finished, but evaluation gates did not pass for every task. Models remain unavailable.\n')
    print('All four artifacts loaded after evaluation checks. Full recording acceptance is still required.',flush=True)

if __name__=='__main__':main()
