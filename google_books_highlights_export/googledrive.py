import os.path
from pathlib import Path
from typing import Dict, Generator, List

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import Resource


def iter_files(service: Resource, folder_id: str) -> Generator[Dict, None, None]:
    page_token = None
    while True:
        results = service.files().list(
            fields="nextPageToken, files(id, name)",
            q=f"parents = '{folder_id}'",
            pageToken=page_token,
        ).execute()
        yield from results.get("files", [])
        page_token = results.get("nextPageToken")
        if not page_token:
            break


def get_credentials(client_config: Dict, token_file_path: Path, scopes: List[str]) -> Credentials:
    creds = None

    if os.path.exists(token_file_path):
        creds = Credentials.from_authorized_user_file(token_file_path, scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_config(client_config, scopes)
            creds = flow.run_local_server(port=0)

        token_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(token_file_path, 'w') as token:
            token.write(creds.to_json())

    return creds



