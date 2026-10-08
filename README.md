# Google Books Highlights Export

Export your highlights from Google Books into a convenient format.

Google Books is able to sync your highlights to a folder in your Google Drive
account, typically called "Play Books Notes", but extracting these highlights
to a more useful form does not appear to be supported.

Given the folder ID of your "Play Books Notes" folder in Google Drive, this tool
can save your highlights, including links back to the original sections in your
books.

It outputs a single JSON file by default, or Markdown with `--format markdown`
(one `.md` file per book plus an `index.md`).

## Setup

### Getting your folder ID

You will need to find the folder ID for your Play Books notes. To do this,
navigate to your Play Books notes folder in Google Drive, and take the folder
ID from the URL. The URL should look like
https://drive.google.com/drive/folders/xxxxxxxxx; the folder ID is `xxxxxxxxx`.

## Installing the tool

    uv tool install google-books-highlights-export

Or, to run from a checkout of this repo:

    uv run google-books-highlights-export <FOLDER ID>

## Running

You are then ready to run

    $ google-books-highlights-export [--format json|markdown] -o OUTPUT <FOLDER ID>

With the default `--format json`, the script writes all your highlights to a
single JSON file at the path given by `-o`. For example (pretty-printed here;
the file itself is written on one line):

```json
[
  {
    "title": "Pride and Prejudice",
    "notes": [
      {
        "content": "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
        "link": "https://play.google.com/books/reader?id=AAAAAAAAAAAA&pg=GBS.PA1"
      },
      {
        "content": "I could easily forgive his pride, if he had not mortified mine.",
        "link": "https://play.google.com/books/reader?id=AAAAAAAAAAAA&pg=GBS.PA18"
      }
    ]
  },
  {
    "title": "Moby-Dick",
    "notes": [
      {
        "content": "Call me Ishmael.",
        "link": "https://play.google.com/books/reader?id=BBBBBBBBBBBB&pg=GBS.PA1"
      }
    ]
  }
]
```

With `--format markdown`, the script will output:

* One file per file in the specified Google Drive folder. Google Play Books
  creates one file per book you take notes in, so this means the script will
  generate one file per book. Each file will contain the text for all your highlights
  for that book, and each highlight will have an associated URL that will open
  the highlighted section of the book in the web reader.
* An index file, linking to all the generated files.

These go in the directory given by `-o`. For example, `index.md`:

```markdown
# Books

- [Pride and Prejudice](<Pride and Prejudice.md>)
- [Moby-Dick](<Moby-Dick.md>)
```

and `Pride and Prejudice.md`:

```markdown
# Pride and Prejudice

> It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

[Open in Google Books](https://play.google.com/books/reader?id=AAAAAAAAAAAA&pg=GBS.PA1)

> I could easily forgive his pride, if he had not mortified mine.

[Open in Google Books](https://play.google.com/books/reader?id=AAAAAAAAAAAA&pg=GBS.PA18)
```

### Setting up Google Cloud OAuth

To use this utility you will need to set up a Google Cloud project with a
desktop OAuth 2.0 client.

Here's how to do that:

1. Go to Google Drive console: https://console.cloud.google.com/
2. Create a project
3. Go to "Credentials"
4. Hit "Create Credentials" -> "OAuth client ID"
5. Select "Desktop app" as the Application type
6. Hit Create
7. Hit the pen icon associated with the new row under "OAuth 2.0 Client IDs" for the credentials you just created
8. Hit "Download JSON"
9. Save this file as `clientconfig.json`.

When you run Google Drive Exporter, by default it will look for a
`clientconfig.json` file in the current directory. Alternatively you can
specify the path to the config file using the `--client-config` option.

When you run the tool for the first time, it will launch your web browser which
will ask you to authenticate your project against your Google account to access
the files from Google Drive.
