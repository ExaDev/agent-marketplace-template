"""Print the word, line and character counts of the file named on the command line."""

import sys
from pathlib import Path


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: count.py <path>", file=sys.stderr)
        return 2
    text = Path(argv[1]).read_text(encoding="utf-8")
    print(f"words: {len(text.split())}")
    print(f"lines: {len(text.splitlines())}")
    print(f"characters: {len(text)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
