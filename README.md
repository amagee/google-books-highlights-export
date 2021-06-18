# Google Books Highlights Export

This is a tool to export your highlights from Google Books into a relatively
convenient format.

By default Google Books is able to sync your highlights to a folder in your
Google Drive account, but extracting these highlights to a more useful form
does not appear to be supported.

Given the folder ID of your "Play Books Notes" folder in Google Drive, this tool
can extract all your highlights and save them to text files, including links back to 
the original sections in your books.

It currently uses [VimWiki](https://github.com/vimwiki/vimwiki) syntax, but is easy
to patch to output in whatever form you want.

## Setup

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

### Getting your folder ID

You will also need to find the folder ID for your Play Books notes. To do this,
navigate to your Play Books notes folder in Google Drive, and take the folder
ID from the URL. The URL should look like
https://drive.google.com/drive/folders/xxxxxxxxx; the folder ID is `xxxxxxxxx`.

## Installing the tool

    pip install google-books-highlights-export

## Running

You are then ready to run

    $ google-drive-export <FOLDER ID>

The script will output:

* One file per file in the specified Google Drive folder. Google Play Books
  creates one file per book you take notes in, so this means the script will
  generate one file per book. Each file will contain the text for all your highlights
  for that book, and each highlight will have an associated URL that will open
  the highlighted section of the book in the web reader.
* An index file, linking to all the generated files.

By default it will output in the current directory; you can set the output
directory with the `-o` parameter.


