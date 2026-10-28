"""Generate cut-out icons with Higgsfield (GPT Image 2.5, transparent background).

usage: python3 scripts/art/hf-gen.py <prompts.jsonl> <raw_dir> [name ...]

Each line is {"name", "subject"}; the subject is wrapped in one shared style
prompt and the existing apple is passed as a style reference, so every icon
matches the fruit art. Skips names whose raw PNG already exists (resumable).
"""
import json
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

STYLE = (
    'A single game UI icon: {subject}. Same art style as the reference image: soft matte 3D clay render, '
    'rounded chunky shapes, gentle studio lighting, subtle soft shadow on the object only, no glow, no text '
    'unless described, no outline. Centered, fills about 85% of the frame, isolated on a transparent background.'
)
REF = 'public/art/fruit/apple.png'
WORKERS = 4


def generate(item, raw: Path):
    out = raw / f"{item['name']}.png"
    if out.exists():
        return item['name'], 'cached'
    cmd = [
        'higgsfield', 'generate', 'create', 'gpt_image_2_5',
        '--prompt', item.get('prompt') or STYLE.format(subject=item['subject']),
        '--background', item.get('background', 'transparent'), '--quality', 'high',
        '--resolution', item.get('resolution', '1k'),
        '--aspect_ratio', item.get('aspect', '1:1'), '--wait', '--json',
    ]
    if item.get('ref', True):
        cmd[4:4] = ['--image', item.get('ref_path', REF)]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if res.returncode != 0:
        return item['name'], f'failed: {res.stderr.strip()[-300:]}'
    job = json.loads(res.stdout)[0]
    url = job.get('result_url')
    if not url:
        return item['name'], f"no result ({job.get('status')})"
    urllib.request.urlretrieve(url, out)
    return item['name'], 'ok'


def main():
    prompts, raw = Path(sys.argv[1]), Path(sys.argv[2])
    only = set(sys.argv[3:])
    raw.mkdir(parents=True, exist_ok=True)
    items = [json.loads(line) for line in prompts.read_text().splitlines() if line.strip()]
    items = [i for i in items if not only or i['name'] in only]
    with ThreadPoolExecutor(WORKERS) as pool:
        for name, status in pool.map(lambda i: generate(i, raw), items):
            print(f'{name}: {status}', flush=True)


if __name__ == '__main__':
    main()
