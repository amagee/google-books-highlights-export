/* global gapi, google */

const clientId =
  "547492225553-o8355p9i7sp3vh8v1fkrhp58tidhaj8k.apps.googleusercontent.com";
const appId = "547492225553";
const scope = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let oauthToken;
// Settles the promise returned by the in-flight `getToken` call.
let pendingAuth;

export class AuthError extends Error {
  constructor(code, details) {
    super(details || code);
    this.code = code;
    this.details = details;
  }
}

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

let loading;

// Google API Loader (for the Picker) and Google Identity Services (for sign-in).
// Memoised so React's double-run effects don't load the scripts twice.
export function loadGoogle() {
  loading ??= (async () => {
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
      callback: (authResult) => {
        if (authResult && !authResult.error) {
          oauthToken = authResult.access_token;
          pendingAuth?.resolve(oauthToken);
        } else {
          pendingAuth?.reject(
            new AuthError(
              authResult && authResult.error,
              authResult && authResult.error_description,
            ),
          );
        }
        pendingAuth = null;
      },
      // Pop-up closed or blocked; these never reach `callback`.
      error_callback: (err) => {
        pendingAuth?.reject(new AuthError(err.type, err.message));
        pendingAuth = null;
      },
    });
  })();
  return loading;
}

// Must be called synchronously from a click, or the browser blocks the
// sign-in pop-up.
export function getToken() {
  if (oauthToken) {
    return Promise.resolve(oauthToken);
  }
  return new Promise((resolve, reject) => {
    pendingAuth = { resolve, reject };
    tokenClient.requestAccessToken();
  });
}

// Shows the Picker; resolves to the chosen folder, or null if cancelled.
export function pickFolder(token) {
  return new Promise((resolve) => {
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
      .setOAuthToken(token)
      .addView(view)
      .addView(new google.picker.DocsUploadView())
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const { id, name } = data.docs[0];
          resolve({ id, name });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

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

export async function getHtml(fileId) {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/html`,
  );
  return await response.text();
}

// Lists every file in the folder, following pagination.
export async function listFiles(folderId) {
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
