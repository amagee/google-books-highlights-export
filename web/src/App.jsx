import { useEffect, useRef, useState } from "react";
import {
  AuthError,
  getHtml,
  getToken,
  listFiles,
  loadGoogle,
  pickFolder,
} from "./google.js";
import { download, parseNotes, toCsv } from "./notes.js";

const authErrorMessages = {
  popup_closed:
    "The Google sign-in window was closed before you finished. Click the button to try again.",
  popup_failed_to_open:
    "Your browser blocked the Google sign-in window. Allow pop-ups for this site, then click the button again.",
  access_denied:
    "We need permission to read your Drive files to export your highlights. Click the button to try again.",
};

function authErrorView({ code, details }) {
  return {
    kind: "error",
    title: "Couldn't sign in to Google",
    message:
      authErrorMessages[code] ||
      "Something went wrong while signing in to Google. Click the button to try again.",
    technical: [code, details].filter(Boolean).join("\n\n"),
  };
}

const plural = (n, word) => `${n} ${n === 1 ? word : word + "s"}`;

export default function App() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  // One of: null, {kind: "progress"}, {kind: "error"}, {kind: "notes"}.
  const [view, setView] = useState(null);

  useEffect(() => {
    loadGoogle().then(
      () => setReady(true),
      (err) =>
        setView({
          kind: "error",
          title: "Couldn't connect to Google",
          message:
            "We couldn't load Google's sign-in tools. Check your internet connection, " +
            "or try turning off any ad or tracker blockers for this site, then reload the page.",
          technical: err.message,
        }),
    );
  }, []);

  async function handleClick() {
    setView(null);

    let folder;
    try {
      folder = await pickFolder(await getToken());
    } catch (err) {
      if (err instanceof AuthError) {
        setView(authErrorView(err));
        return;
      }
      throw err;
    }
    if (!folder) {
      return;
    }

    setBusy(true);
    try {
      window.folder = folder;
      setView({ kind: "progress", message: "Finding your highlights files…" });
      const files = await listFiles(folder.id);

      if (files.length === 0) {
        setView({
          kind: "error",
          title: "No highlights found",
          message:
            "That folder is empty. Choose the folder where Google Play Books saves your notes " +
            "(usually “Play Books Notes”).",
        });
        return;
      }

      let done = 0;
      const total = files.length;
      const progress = () =>
        setView({
          kind: "progress",
          message: `Downloading highlights: ${done} of ${plural(total, "book")}`,
          done,
          total,
        });
      progress();
      window.htmls = await Promise.all(
        files.map(async (file) => {
          const html = await getHtml(file.id);
          done++;
          progress();
          return html;
        }),
      );

      setView({ kind: "progress", message: "Reading highlights…" });
      window.notes = window.htmls.flatMap((html, i) =>
        parseNotes(html, files[i].name),
      );
      setView({ kind: "notes", folder, notes: window.notes });
    } catch (err) {
      console.error(err);
      setView({
        kind: "error",
        title: "Couldn't get your highlights",
        message:
          "Something went wrong while reading your files from Google Drive. Click the button to try again.",
        technical: err.stack || err.message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="signin"
        disabled={!ready || busy}
        onClick={handleClick}
      >
        Choose highlights folder in Google Drive
      </button>
      {view == null &&
        <section className="instructions">
          <p>
            This is a simple Google Play Books notes exporter. After hitting the button above,
            you will be prompted to authorise this app to read the files you select. Then a Google Drive folder will
            appear and you can select your <em>Play Books Notes</em> folder. Then hit Select and the app will read
            the files in that folder and extract the notes. You will see them on the screen and also be able to export
            them to CSV or JSON.
          </p>
          <p>
            None of your data is persisted to a server anywhere.
          </p>
        </section>
      }
      {view?.kind === "error" && <ErrorBox {...view} />}
      {view?.kind === "progress" && <Progress {...view} />}
      {view?.kind === "notes" && (
        <Notes key={view.folder.id} folder={view.folder} notes={view.notes} />
      )}
    </>
  );
}

function ErrorBox({ title, message, technical }) {
  return (
    <div className="error">
      <h2>{title}</h2>
      <p>{message}</p>
      {technical && (
        <details>
          <summary>Technical details</summary>
          <pre>{technical}</pre>
        </details>
      )}
    </div>
  );
}

function Progress({ message, done, total }) {
  return (
    <div className="status">
      <p>{message}</p>
      {total ? <progress max={total} value={done} /> : <progress />}
    </div>
  );
}

const notesPerPage = 50;

function Notes({ folder, notes }) {
  const [page, setPage] = useState(1);
  const ref = useRef(null);
  const pageCount = Math.max(1, Math.ceil(notes.length / notesPerPage));
  const bookCount = new Set(notes.map((n) => n.book)).size;
  const start = (page - 1) * notesPerPage;

  function goTo(p) {
    setPage(p);
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="notes" ref={ref}>
      <dl className="folder">
        <dt>Folder</dt>
        <dd>{folder.name}</dd>
        <dt>Folder ID</dt>
        <dd className="folder-id">{folder.id}</dd>
      </dl>

      <div className="notes-toolbar">
        <p className="notes-summary">
          {plural(notes.length, "highlight")} from {plural(bookCount, "book")}
        </p>
        <button
          onClick={() =>
            download("google-books-highlights.csv", toCsv(notes), "text/csv")
          }
        >
          Download CSV
        </button>
        <button
          onClick={() =>
            download(
              "google-books-highlights.json",
              JSON.stringify(notes, null, 2),
              "application/json",
            )
          }
        >
          Download JSON
        </button>
      </div>

      <div className="notes-scroll">
        <table className="notes-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Highlight</th>
              <th>Book</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {notes.slice(start, start + notesPerPage).map((note, i) => (
              <tr key={start + i}>
                <td className="num">{start + i + 1}</td>
                <td>{note.content}</td>
                <td className="book">{note.book}</td>
                <td>
                  {note.href && (
                    <a href={note.href} target="_blank" rel="noopener">
                      Open
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className="pagination">
          <button disabled={page === 1} onClick={() => goTo(page - 1)}>
            ← Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button disabled={page === pageCount} onClick={() => goTo(page + 1)}>
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
