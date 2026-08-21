import json
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "progress.json"


def load_progress(path=DEFAULT_PATH):
    path = Path(path)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_progress(progress, path=DEFAULT_PATH):
    path = Path(path)
    with path.open("w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)
