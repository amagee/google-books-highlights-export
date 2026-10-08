import logging
from pathlib import Path
from typing import List, Iterable

from .notes import Note

logger = logging.getLogger(__name__)


class MarkdownWriter:
    dir: Path

    def __init__(self, dir: Path):
        self.dir = dir

    def write_file(self, filename: str, notes: Iterable[Note]):
        file_path = str(self.dir / filename) + ".md"
        logger.info("Writing %s", file_path)
        with open(file_path, "w+") as book_f:
            book_f.write(f"# {filename}\n\n")
            for note in notes:
                quoted = "\n".join(f"> {line}".rstrip() for line in note.content.splitlines())
                book_f.write(quoted + "\n\n")
                if note.link:
                    book_f.write(f"[Open in Google Books]({note.link})\n\n")

    def write_index(self, filenames: List[str]):
        index_filename = str(self.dir / "index.md")
        with open(index_filename, "w+") as index_f:
            index_f.write("# Books\n\n")
            for filename in filenames:
                index_f.write(f"- [{filename}](<{filename}.md>)\n")
        logger.info("Wrote %s", index_filename)
