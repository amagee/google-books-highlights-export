export function parseNotes(html, book) {
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

export function toCsv(notes) {
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

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
