import json
from pathlib import Path
import re

import appdirs
from googleapiclient.discovery import build
import typer

from google_books_highlights_export.googledrive import get_credentials, iter_files
from google_books_highlights_export.notes import iter_notes
from google_books_highlights_export.vimwiki import VimWikiWriter

user_cache_path = Path(appdirs.user_cache_dir("google-books-highlights-export", "amagee"))

def export(
    folder: str,
    out_dir: Path = typer.Option(".", "-o"),
    client_config_file: typer.FileText = typer.Option("clientconfig.json", "--client-config"),
    token_file_path: Path = typer.Option(str(user_cache_path / "token.json")),
):
    """
    Download all the files in the Google Drive folder FOLDER, extract the
    Google Books highlights from the files, and write them as text files.
    """
    client_config = json.load(client_config_file)
    creds = get_credentials(
        client_config=client_config,
        token_file_path=token_file_path,
        scopes=[
            "https://www.googleapis.com/auth/drive.readonly"
        ]
    )

    service = build('drive', 'v3', credentials=creds)

    out_dir.mkdir(parents=True, exist_ok=True)

    writer = VimWikiWriter(out_dir)

    filenames = []
    for item in iter_files(service, folder):
        filename = re.match('Notes from "(.*)"', item['name']).groups()[0]
        filenames.append(filename)
        htmlfile = service.files().export_media(
            fileId=item['id'],
            mimeType="text/html"
        ).execute()
        writer.write_file(filename, iter_notes(htmlfile))
    writer.write_index(filenames)


def main():
    typer.run(export)


if __name__ == '__main__':
    main()

