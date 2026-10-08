from enum import Enum
from importlib import resources
from itertools import islice
import json
import logging
from pathlib import Path
import re
import sys
from typing import Optional

import appdirs
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import typer

from google_books_highlights_export.googledrive import get_credentials, iter_files
from google_books_highlights_export.notes import iter_notes
from google_books_highlights_export.jsonwriter import JsonWriter
from google_books_highlights_export.markdown import MarkdownWriter

logger = logging.getLogger(__name__)

user_cache_path = Path(appdirs.user_cache_dir("google-books-highlights-export", "amagee"))


class Format(str, Enum):
    json = "json"
    markdown = "markdown"


def export(
    folder: str = typer.Argument(
        ...,
        metavar="FOLDER_ID",
        help=(
            "ID of your Play Books Notes folder in Google Drive (the xxxxxxxxx in "
            "https://drive.google.com/drive/folders/xxxxxxxxx). This is not a local "
            "path; use -o to choose where output is written."
        ),
    ),
    output: Path = typer.Option(
        ...,
        "-o",
        help=(
            "Where to write the export: a file for --format json, "
            "or a directory for --format markdown."
        ),
    ),
    client_config_file: Optional[typer.FileText] = typer.Option(
        None,
        "--client-config",
        help="Google OAuth client config JSON. Defaults to the one bundled with this tool.",
    ),
    token_file_path: Path = typer.Option(str(user_cache_path / "token.json")),
    limit: Optional[int] = typer.Option(None, "--limit", help="Stop after reading this many files."),
    format: Format = typer.Option(Format.json, "--format", help="Output format."),
):
    """
    Download all the files in the Google Drive folder FOLDER_ID, extract the
    Google Books highlights from the files, and write them as text files.
    """

    if client_config_file is None:
        client_config = json.loads(
            resources.files(__package__).joinpath("clientconfig.json").read_text()
        )
    else:
        client_config = json.load(client_config_file)
    creds = get_credentials(
        client_config=client_config,
        token_file_path=token_file_path,
        scopes=[
            # "https://www.googleapis.com/auth/drive.readonly"
            "https://www.googleapis.com/auth/drive.file"
        ]
    )

    service = build('drive', 'v3', credentials=creds)

    if format == Format.json:
        output.parent.mkdir(parents=True, exist_ok=True)
        writer = JsonWriter(output)
    else:
        output.mkdir(parents=True, exist_ok=True)
        writer = MarkdownWriter(output)

    try:
        items = list(islice(iter_files(service, folder), limit))
    except HttpError as e:
        if e.resp.status != 404:
            raise
        typer.echo(
            f"Couldn't find a Google Drive folder with ID {folder!r}.\n"
            "FOLDER_ID should be the ID from your Play Books Notes folder's URL "
            "(https://drive.google.com/drive/folders/<FOLDER_ID>), not a local path. "
            "Use -o to set the output directory.",
            err=True,
        )
        raise typer.Exit(1)

    filenames = []
    for item in items:
        logger.info("Reading %s", item['name'])
        filename = re.match('Notes from "(.*)"', item['name']).groups()[0]
        filenames.append(filename)
        htmlfile = service.files().export_media(
            fileId=item['id'],
            mimeType="text/html"
        ).execute()
        writer.write_file(filename, iter_notes(htmlfile))
    writer.write_index(filenames)


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
    typer.run(export)


if __name__ == '__main__':
    main()

