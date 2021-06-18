from pathlib import Path
import textwrap
from typing import List, Iterable

from .notes import Note


class VimWikiWriter:
    dir: Path

    def __init__(self, dir: Path):
        self.dir = dir

    def write_file(self, filename: str, notes: Iterable[Note]):
        file_path = str(self.dir / filename) + ".wiki"
        print("Writing", file_path)
        with open(file_path, "w+") as book_f:
            for note in notes:
                book_f.write(note.link + "\n")
                book_f.write(textwrap.indent(textwrap.fill(note.content, width=64), prefix="    "))
                book_f.write("\n\n")

    def write_index(self, filenames: List[str]):
        index_filename = str(self.dir / "index.wiki")
        with open(index_filename, "w+") as index_f:
            for filename in filenames:
                index_f.write(f"* [[{filename}]]\n")
        print("Wrote", index_filename)

