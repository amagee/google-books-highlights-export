import "./style.css";

const clientId =
  "547492225553-o8355p9i7sp3vh8v1fkrhp58tidhaj8k.apps.googleusercontent.com";
const appId = "547492225553";
const scope = "https://www.googleapis.com/auth/drive.file";

const signInButton = document.getElementById("signin");
const result = document.getElementById("result");

let tokenClient;
let oauthToken;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });
}

// Google API Loader (for the Picker) and Google Identity Services (for sign-in).
async function loadGoogle() {
  await Promise.all([
    loadScript("https://apis.google.com/js/api.js").then(
      () =>
        new Promise((resolve) => gapi.load("picker", { callback: resolve })),
    ),
    loadScript("https://accounts.google.com/gsi/client"),
  ]);

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback: handleAuthResult,
    // Pop-up closed or blocked; these never reach `callback`.
    error_callback: (err) =>
      showAuthError({ error: err.type, details: err.message }),
  });
  signInButton.disabled = false;
}

// Must run from a click, or the browser blocks the sign-in pop-up.
function signIn() {
  result.replaceChildren();
  result.className = "";
  if (oauthToken) {
    createPicker();
  } else {
    tokenClient.requestAccessToken();
  }
}

function handleAuthResult(authResult) {
  if (authResult && !authResult.error) {
    oauthToken = authResult.access_token;
    createPicker();
  } else {
    showAuthError({
      error: authResult && authResult.error,
      details: authResult && authResult.error_description,
    });
  }
}

const authErrorMessages = {
  popup_closed:
    "The Google sign-in window was closed before you finished. Click the button to try again.",
  popup_failed_to_open:
    "Your browser blocked the Google sign-in window. Allow pop-ups for this site, then click the button again.",
  access_denied:
    "We need permission to read your Drive files to export your highlights. Click the button to try again.",
};

function showAuthError({ error: code, details: technical }) {
  showError(
    "Couldn't sign in to Google",
    authErrorMessages[code] ||
      "Something went wrong while signing in to Google. Click the button to try again.",
    [code, technical].filter(Boolean).join("\n\n"),
  );
}

function showError(title, message, technical) {
  result.replaceChildren();
  result.className = "error";

  const heading = document.createElement("h2");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = message;
  result.append(heading, text);

  if (technical) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Technical details";
    const pre = document.createElement("pre");
    pre.textContent = technical;
    details.append(summary, pre);
    result.append(details);
  }
}

// Create and render a Picker object for choosing the highlights folder.
function createPicker() {
  const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
  view.setIncludeFolders(true);
  view.setMimeTypes(
    [
      "application/vnd.google-apps.folder",
      "application/vnd.google-apps.file",
      "application/vnd.google-apps.document",
    ].join(","),
  );
  view.setSelectFolderEnabled(true);

  const picker = new google.picker.PickerBuilder()
    .enableFeature(google.picker.Feature.NAV_HIDDEN)
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setAppId(appId)
    .setOAuthToken(oauthToken)
    .addView(view)
    .addView(new google.picker.DocsUploadView())
    .setCallback(pickerCallback)
    .build();
  picker.setVisible(true);
}

window.folder = null;
window.htmls = [];
window.notes = [];

async function driveFetch(url) {
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + oauthToken },
  });
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText} from ${url}\n\n${await response.text()}`,
    );
  }
  return response;
}

async function getHtml(fileId) {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/html`,
  );
  return await response.text();
}

// Lists every file in the folder, following pagination.
async function listFiles(folderId) {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      fields: "nextPageToken, files(id, name)",
      q: `parents = '${folderId}'`,
      pageSize: "1000",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }
    const json = await (
      await driveFetch("https://www.googleapis.com/drive/v3/files?" + params)
    ).json();
    files.push(...json.files);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return files;
}

function parseNotes(html, book) {
  const notes = [];
  const div = document.createElement("div");
  div.innerHTML = html;
  const tables = Array.from(div.querySelectorAll("table"));
  for (let i = 3; i < tables.length; i += 2) {
    const tbody = Array.from(tables[i].children).find(
      (t) => t.nodeName === "TBODY",
    );
    const tr = Array.from(tbody.children).find((t) => t.nodeName === "TR");
    const content = tr.children[1].children[0].children[0].innerText;
    const href = tr.children[2].children[0].children[0].children[0].href;
    notes.push({ content, href, book });
  }
  return notes;
}

function showProgress(message, done, total) {
  result.className = "status";
  const text = document.createElement("p");
  text.textContent = message;
  const bar = document.createElement("progress");
  if (total) {
    bar.max = total;
    bar.value = done;
  }
  result.replaceChildren(text, bar);
}

async function pickerCallback(data) {
  if (data.action !== google.picker.Action.PICKED) {
    return;
  }

  signInButton.disabled = true;
  try {
    const { id, name } = data.docs[0];
    window.folder = { id, name };
    showProgress("Finding your highlights files…");
    const files = await listFiles(id);

    if (files.length === 0) {
      showError(
        "No highlights found",
        "That folder is empty. Choose the folder where Google Play Books saves your notes " +
          "(usually “Play Books Notes”).",
      );
      return;
    }

    let done = 0;
    const plural = files.length === 1 ? "book" : "books";
    showProgress(
      `Downloading highlights: 0 of ${files.length} ${plural}`,
      0,
      files.length,
    );
    window.htmls = await Promise.all(
      files.map(async (file) => {
        const html = await getHtml(file.id);
        done++;
        showProgress(
          `Downloading highlights: ${done} of ${files.length} ${plural}`,
          done,
          files.length,
        );
        return html;
      }),
    );

    showProgress("Reading highlights…");
    window.notes = window.htmls.flatMap((html, i) =>
      parseNotes(html, files[i].name),
    );
    renderNotes(1);
  } catch (err) {
    console.error(err);
    showError(
      "Couldn't get your highlights",
      "Something went wrong while reading your files from Google Drive. Click the button to try again.",
      err.stack || err.message,
    );
  } finally {
    signInButton.disabled = false;
  }
}

const notesPerPage = 50;

function renderNotes(page) {
  const notes = window.notes;
  const pageCount = Math.max(1, Math.ceil(notes.length / notesPerPage));
  page = Math.min(Math.max(page, 1), pageCount);

  result.className = "notes";

  const summary = document.createElement("p");
  summary.className = "notes-summary";
  const bookCount = new Set(notes.map((n) => n.book)).size;
  summary.textContent =
    `${notes.length} ${notes.length === 1 ? "highlight" : "highlights"} from ` +
    `${bookCount} ${bookCount === 1 ? "book" : "books"}`;

  const csvButton = document.createElement("button");
  csvButton.textContent = "Download CSV";
  csvButton.addEventListener("click", () =>
    download("google-books-highlights.csv", toCsv(notes), "text/csv"),
  );

  const jsonButton = document.createElement("button");
  jsonButton.textContent = "Download JSON";
  jsonButton.addEventListener("click", () =>
    download(
      "google-books-highlights.json",
      JSON.stringify(notes, null, 2),
      "application/json",
    ),
  );

  const toolbar = document.createElement("div");
  toolbar.className = "notes-toolbar";
  toolbar.append(summary, csvButton, jsonButton);

  const table = document.createElement("table");
  table.className = "notes-table";

  const headRow = table.createTHead().insertRow();
  for (const heading of ["#", "Highlight", "Book", "Link"]) {
    const th = document.createElement("th");
    th.textContent = heading;
    headRow.append(th);
  }

  const body = table.createTBody();
  const start = (page - 1) * notesPerPage;
  notes.slice(start, start + notesPerPage).forEach((note, i) => {
    const row = body.insertRow();

    const number = row.insertCell();
    number.className = "num";
    number.textContent = start + i + 1;

    row.insertCell().textContent = note.content;

    const book = row.insertCell();
    book.className = "book";
    book.textContent = note.book;

    const linkCell = row.insertCell();
    if (note.href) {
      const link = document.createElement("a");
      link.href = note.href;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Open";
      linkCell.append(link);
    }
  });

  const scroller = document.createElement("div");
  scroller.className = "notes-scroll";
  scroller.append(table);

  result.replaceChildren(renderFolder(window.folder), toolbar, scroller);
  if (pageCount > 1) {
    result.append(renderPagination(page, pageCount));
  }
}

function renderFolder({ id, name }) {
  const folder = document.createElement("dl");
  folder.className = "folder";
  for (const [label, value] of [
    ["Folder", name],
    ["Folder ID", id],
  ]) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    folder.append(dt, dd);
  }
  folder.lastChild.className = "folder-id";
  return folder;
}

function toCsv(notes) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["highlight", "book", "link"],
    ...notes.map((n) => [n.content, n.book, n.href]),
  ];
  // Leading BOM so Excel opens the file as UTF-8.
  return (
    "﻿" + rows.map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n"
  );
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderPagination(page, pageCount) {
  const nav = document.createElement("nav");
  nav.className = "pagination";

  const goTo = (p) => {
    renderNotes(p);
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const prev = document.createElement("button");
  prev.textContent = "← Previous";
  prev.disabled = page === 1;
  prev.addEventListener("click", () => goTo(page - 1));

  const label = document.createElement("span");
  label.textContent = `Page ${page} of ${pageCount}`;

  const next = document.createElement("button");
  next.textContent = "Next →";
  next.disabled = page === pageCount;
  next.addEventListener("click", () => goTo(page + 1));

  nav.append(prev, label, next);
  return nav;
}

signInButton.addEventListener("click", signIn);

loadGoogle().catch((err) =>
  showError(
    "Couldn't connect to Google",
    "We couldn't load Google's sign-in tools. Check your internet connection, " +
      "or try turning off any ad or tracker blockers for this site, then reload the page.",
    err.message,
  ),
);
