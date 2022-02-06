from pathlib import Path
import json
from typing import Iterable, List

from .notes import Note


class JsonWriter:
    dir: Path

    def __init__(self, dir: Path):
        self.dir = dir
        self.books = []

    def write_file(self, filename: str, notes: Iterable[Note]):
        print("Reading", filename)
        self.books.append({
            "title": filename,
            "notes": notes
        })

    def write_index(self, filenames: List[str]):
        file_path = str(self.dir / "books.json")
        print("Writing", file_path)
        with open(file_path, "w+") as books_f:
            json.dump(
                [
                    {
                        "asin": None,
                        "title": b["title"],
                        "notes": [n.content for n in b["notes"]]
                    }
                    for b in self.books
                ],
                books_f
            )
