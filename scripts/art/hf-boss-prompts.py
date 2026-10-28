"""Write the Higgsfield prompt list for boss portraits (one per boss model).

usage: python3 scripts/art/hf-boss-prompts.py <ref_dir> > scripts/art/hf-bosses.jsonl

Each boss's own 3D model render (scripts/art/boss-shots.html) is its reference
picture, so the portrait keeps the model's look; only pose and mood change.
"""
import json
import re
import sys
from pathlib import Path

STYLE = (
    'Dramatic video-game boss portrait of {what}, based exactly on the creature in the reference image '
    '(same shape, colours, materials and details). Upper body or full creature filling the frame, seen from a low '
    'heroic angle, leaning toward the viewer in a fierce roaring or attacking pose, menacing but fun for all ages, '
    'not gory. Soft matte 3D clay render, chunky readable shapes, gentle studio lighting, soft shadows on the '
    'creature only, no glow, no bloom, no text, no frame. Isolated on a transparent background.'
)


def words(kind: str) -> str:
    return re.sub(r'(?<!^)(?=[A-Z])', ' ', kind).lower()


def main() -> None:
    refs = Path(sys.argv[1])
    for ref in sorted(refs.glob('*.png')):
        kind = ref.stem
        item = {'name': kind, 'prompt': STYLE.format(what=f'a giant {words(kind)}'), 'ref_path': str(ref)}
        print(json.dumps(item))


if __name__ == '__main__':
    main()
