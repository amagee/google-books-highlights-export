from pathlib import Path
import json
from typing import Iterable, List

from .notes import Note


class JsonWriter:
    path: Path

    def __init__(self, path: Path):
        self.path = path
        self.books = []

    def write_file(self, filename: str, notes: Iterable[Note]):
        self.books.append({
            "title": filename,
            "notes": notes
        })

    def write_index(self, filenames: List[str]):
        with open(self.path, "w+") as books_f:
            json.dump(
                [
                    {
                        "title": b["title"],
                        "notes": [n.to_json() for n in b["notes"]]
                    }
                    for b in self.books
                ],
                books_f
            )
