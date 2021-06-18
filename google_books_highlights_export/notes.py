from typing import Generator

from dataclasses import dataclass
from bs4 import BeautifulSoup


@dataclass
class Note:
    content: str
    link: str


def iter_notes(html_str: str) -> Generator[Note, None, None]:
    """
    When you take notes in Google Books, they are saved to a document in Google
    Drive. These files can be exported to HTML and the notes can be extracted
    from that HTML.

    Note that the HTML generated by the Google Drive API is different from (and
    much worse than) the HTML generated if you export the same file via the web
    UI. In particular, it does not use class names but instead uses inline
    styles for everything. That's why we are selecting elements via their index
    rather than by friendlier selectors.
    """
    soup = BeautifulSoup(html_str, features="html5lib")

    for i, table in enumerate(soup.find_all("table")):
        if i >= 2 and i % 2 == 1:
            tbody = table.contents[0]
            tr = tbody.contents[0]
            content = tr.contents[1].contents[0].contents[0].text
            link = tr.contents[2].contents[0].contents[0].contents[0].get("href")
            yield Note(content, link)

