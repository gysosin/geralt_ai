"""Repository secret hygiene tests."""
import re
from pathlib import Path


def test_no_committed_provider_api_keys():
    repo_root = Path(__file__).resolve().parents[2]
    scan_roots = [
        repo_root / "geralt-ai-fastapi",
        repo_root / "new_ui",
    ]
    ignored_parts = {
        ".pytest_cache",
        "__pycache__",
        "dist",
        "node_modules",
        "venv",
    }
    secret_patterns = [
        re.compile(r"sk-or-v1-[A-Za-z0-9_-]{20,}"),
        re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
        re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
    ]
    matches = []

    for scan_root in scan_roots:
        for path in scan_root.rglob("*"):
            if (
                not path.is_file()
                or path.name.startswith(".env")
                or any(part in ignored_parts for part in path.parts)
            ):
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if any(pattern.search(text) for pattern in secret_patterns):
                matches.append(str(path.relative_to(repo_root)))

    assert matches == []
