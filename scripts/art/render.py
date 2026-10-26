"""Render the game's generated artwork locally (no API, no upload).

Usage:
  mflux-save --model z-image-turbo --quantize 8 --path /tmp/zimg-q8   # once, ~10 GB
  python3 scripts/art/render.py /tmp/zimg-q8 /tmp/art                  # raw renders -> /tmp/art/raw
  python3 scripts/art/process.py /tmp/art/raw public/art skin_kraken=skin_kraken_b

Prompts and seeds live in prompts.jsonl (same seed + prompt -> same picture).
mflux can exit 0 without writing a file, so success = the output file exists.
Outputs that already exist are skipped, so a stopped run can be resumed.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

MODEL = sys.argv[1]
OUT = Path(sys.argv[2])
jobs = [json.loads(line) for line in (Path(__file__).parent / 'prompts.jsonl').read_text().splitlines() if line.strip()]
failed = []
for job in jobs:
    out = OUT / job['output']
    if out.exists() and out.stat().st_size > 0:
        print(f'skip {out.name}', flush=True)
        continue
    out.parent.mkdir(parents=True, exist_ok=True)
    t = time.time()
    cmd = ['mflux-generate-z-image-turbo', '--model', MODEL, '--base-model', 'z-image-turbo',
           '--seed', str(job['seed']), '--width', '1024', '--height', '1024',
           '--output', str(out), '--prompt', job['prompt']]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if out.exists() and out.stat().st_size > 0:
        print(f'ok   {out.name}  {time.time() - t:.0f}s', flush=True)
    else:
        failed.append(out.name)
        print(f'FAIL {out.name} exit={proc.returncode} {proc.stderr.strip().splitlines()[-1:]}', flush=True)
print(f'done, {len(failed)} failed: {failed}', flush=True)
sys.exit(1 if failed else 0)
