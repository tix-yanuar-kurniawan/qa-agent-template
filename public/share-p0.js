// "Share P0": one dialog for one sheet or many. It previews what goes out and
// whose Google Drive it lands in, creates the spreadsheet, and copies its link.
// When Google cannot be reached it hands over a CSV of the same rows instead.
//
// The dialog builds its own DOM, so any page can open it without markup.

import { esc, copyText, announce, toast } from "./shell.js";

let dialog = null;
let ids = [];
let busy = false;
let mode = "";
// The tab the Apps Script web app runs in, and whether its answer is still awaited.
let scriptTab = null;
let awaiting = false;
// The last preview, and the Drive check for a sheet this selection already has.
let lastPreview = null;
// The saved share the dialog is showing, which the Drive check reports on.
let shown = null;
let checkFrame = null;
let checkTimer = null;
const CHECK_MS = 12000;

const CLOSE_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function build() {
  dialog = document.createElement("dialog");
  dialog.className = "dialog p0-dialog";
  dialog.setAttribute("aria-labelledby", "p0-title");
  dialog.innerHTML =
    '<header class="dialog-head">' +
    '<h2 class="dialog-title" id="p0-title">Share P0 with devs</h2>' +
    `<button class="icon-btn" data-p0="close" type="button" aria-label="Close">${CLOSE_ICON}</button>` +
    "</header>" +
    '<div class="dialog-body p0-body" data-p0="body" aria-live="polite"></div>' +
    '<footer class="dialog-foot" data-p0="foot"></footer>';
  dialog.querySelector('[data-p0="close"]').addEventListener("click", close);
  dialog.addEventListener("close", stopCheck);
  dialog.addEventListener("cancel", (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && !busy) close();
  });
  document.body.appendChild(dialog);
}

function close() {
  if (busy) return;
  dialog.close();
}

const part = (name) => dialog.querySelector(`[data-p0="${name}"]`);

function button(label, { primary = false, onClick, href = null } = {}) {
  const b = document.createElement(href ? "a" : "button");
  b.className = primary ? "btn btn-primary" : "btn";
  b.textContent = label;
  if (href) {
    b.href = href;
    b.target = "_blank";
    b.rel = "noopener";
  } else {
    b.type = "button";
    b.addEventListener("click", onClick);
  }
  return b;
}

function foot(left, right) {
  const f = part("foot");
  f.textContent = "";
  const l = document.createElement("div");
  l.className = "p0-foot-group";
  l.append(...left);
  const r = document.createElement("div");
  r.className = "p0-foot-group";
  r.append(...right);
  f.append(l, r);
}

function loginHelp(command) {
  if (!command) return "";
  return (
    '<p class="p0-note">To let it create spreadsheets, sign gcloud in once with Sheets access ' +
    "(this replaces your current Application Default Credentials, keeping cloud-platform):</p>" +
    `<pre class="p0-cmd"><code>${esc(command)}</code></pre>`
  );
}

function saveCsv(csv, filename) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  announce(`Downloaded ${filename}`);
}

async function downloadCsv() {
  try {
    const res = await fetch("/api/p0/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Download failed");
    const disposition = res.headers.get("Content-Disposition") || "";
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    saveCsv(await res.text(), utf8 ? decodeURIComponent(utf8[1]) : "P0 Devs.csv");
  } catch (err) {
    toast(`Couldn't download the CSV: ${err.message}`, { tone: "error" });
  }
}

function renderPreview(p, { notice = "" } = {}) {
  lastPreview = p;
  stopCheck();
  if (p.existing) return renderExisting(p, p.existing);
  // An earlier spreadsheet made for a bigger selection already holds all of these.
  const covering = (p.related || []).find((r) => r.coversAll);
  if (covering) return renderExisting(p, covering);
  const withP0 = p.perSource.filter((s) => s.cases > 0);
  const without = p.perSource.filter((s) => s.cases === 0);
  const g = p.google || {};

  const sources = withP0
    .map(
      (s) =>
        `<li><span class="p0-src">${esc(s.label || s.id.slice(0, 8))}</span>` +
        `<span class="p0-count">${plural(s.cases, "case")}` +
        (s.rows !== s.cases ? ` → ${plural(s.rows, "row")}` : "") +
        "</span></li>",
    )
    .join("");

  mode = g.mode || "";
  const ready = mode === "apps-script" || (g.account && g.canCreate !== false);
  const account = ready
    ? `<p class="p0-note">Created in ${g.account ? `<strong>${esc(g.account)}</strong>’s` : "your"} Google Drive` +
      (g.shareDomain ? `, viewable by anyone at ${esc(g.shareDomain)} with the link.` : ", private to that account.") +
      "</p>"
    : `<div class="alert" data-tone="warn"><p>Can’t create a Google Sheet yet, so you’ll get a CSV instead.</p>` +
      `<p class="p0-detail">${esc(g.error || "")}</p></div>` +
      loginHelp(g.loginCommand);

  shown = null;
  const partial = (p.related || []).filter((r) => !r.coversAll);
  const overlap = partial.length
    ? '<div class="p0-overlap"><p class="p0-label">Some of these are already shared</p><ul class="p0-sources">' +
      partial
        .map(
          (r) =>
            `<li><span class="p0-src">${r.sharedLabels.map(esc).join(", ")}</span>` +
            `<a class="p0-count" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)} · ${esc(shortWhen(r.createdAt))}</a></li>`,
        )
        .join("") +
      "</ul></div>"
    : "";
  part("body").innerHTML =
    (notice ? `<div class="alert" data-tone="info"><p>${esc(notice)}</p></div>` : "") +
    overlap +
    `<div class="p0-title-line"><span class="p0-label">Spreadsheet</span><strong>${esc(p.title)}</strong></div>` +
    (withP0.length
      ? `<p class="p0-note">${plural(p.rowCount, "row")} — a case on several platforms gets one row per platform.</p>` +
        `<ul class="p0-sources">${sources}</ul>`
      : '<p class="p0-note">None of the selected sheets has a P0 case.</p>') +
    (without.length
      ? `<p class="p0-note">No P0 cases in: ${without.map((s) => esc(s.label || s.id.slice(0, 8))).join(", ")}</p>`
      : "") +
    (withP0.length ? account : "");

  const left = [button("Cancel", { onClick: close })];
  if (!withP0.length) return foot(left, []);
  if (!ready) return foot(left, [button("Download CSV", { primary: true, onClick: downloadCsv })]);
  foot(left, [
    button("Download CSV", { onClick: downloadCsv }),
    button("Create spreadsheet", { primary: true, onClick: create }),
  ]);
}

async function create() {
  // Opened inside the click, before any await, or the browser blocks the popup.
  if (mode === "apps-script") scriptTab = window.open("", "p0-share");
  busy = true;
  part("body").innerHTML = '<p class="p0-note">Creating the spreadsheet…</p>';
  foot([], []);
  let data;
  try {
    const res = await fetch("/api/p0/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't share");
  } catch (err) {
    busy = false;
    part("body").innerHTML = `<div class="alert"><p>${esc(err.message)}</p></div>`;
    foot([button("Close", { onClick: close })], [button("Download CSV", { primary: true, onClick: downloadCsv })]);
    return;
  }
  busy = false;

  if (data.mode === "apps-script") return postToScript(data);

  if (!data.ok) {
    // The fallback: the same rows, as a file.
    saveCsv(data.csv, data.filename);
    part("body").innerHTML =
      `<div class="alert" data-tone="warn"><p>Couldn’t create the spreadsheet, so the CSV was downloaded instead.</p>` +
      `<p class="p0-detail">${esc(data.error)}</p></div>` +
      loginHelp(data.loginCommand);
    foot([button("Close", { onClick: close })], [button("Download again", { onClick: () => saveCsv(data.csv, data.filename) })]);
    return;
  }

  showCreated(data, await copyText(data.url, "spreadsheet link"));
}

// The Apps Script route runs in the browser, which is signed in to Google: the
// rows are form-posted to the web app in its own tab, and the tab posts the
// link back here.
function postToScript(data) {
  if (!scriptTab || scriptTab.closed) {
    part("body").innerHTML =
      '<div class="alert" data-tone="warn"><p>The browser blocked the Share P0 tab. Allow pop-ups for this page and try again.</p></div>';
    foot([button("Close", { onClick: close })], [button("Download CSV", { onClick: downloadCsv }), button("Try again", { primary: true, onClick: create })]);
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = data.scriptUrl;
  form.target = "p0-share";
  const field = document.createElement("input");
  field.type = "hidden";
  field.name = "payload";
  field.value = JSON.stringify({ ...data.payload, origin: location.origin });
  form.appendChild(field);
  document.body.appendChild(form);
  form.submit();
  form.remove();

  awaiting = true;
  part("body").innerHTML =
    '<p class="p0-note">Creating the spreadsheet in the new tab…</p>' +
    '<p class="p0-note">The link shows up here when it’s done. If it doesn’t, copy it from that tab.</p>';
  foot([button("Close", { onClick: close })], [button("Download CSV", { onClick: downloadCsv })]);
}

function fromScript(origin) {
  try {
    const host = new URL(origin).hostname;
    return host.endsWith(".googleusercontent.com") || host === "script.google.com";
  } catch {
    return false;
  }
}

// ---- A selection that was shared before ----

function shortWhen(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// `x` is either this exact selection's share, or a related one (made for a bigger
// selection) that already contains every sheet picked here.
function renderExisting(p, x) {
  const g = p.google || {};
  const related = x !== p.existing;
  shown = x;
  const canCheck = g.mode === "apps-script" && g.scriptUrl && x.spreadsheetId;
  const label = related
    ? `Already included in a spreadsheet shared ${esc(shortWhen(x.createdAt))}`
    : `Already shared ${esc(shortWhen(x.createdAt))}`;
  part("body").innerHTML =
    `<div class="p0-title-line"><span class="p0-label">${label}</span><strong>${esc(x.title)}</strong></div>` +
    (related && x.otherLabels.length
      ? `<p class="p0-note">Shared together with ${x.otherLabels.map((l) => `<strong>${esc(l)}</strong>`).join(", ")}.</p>`
      : "") +
    '<div class="p0-link"><input class="input mono" readonly aria-label="Spreadsheet link"></div>' +
    `<p class="p0-note" data-p0="check">${canCheck ? "Checking it’s still in Drive…" : "This selection already has a spreadsheet."}</p>` +
    (x.changed
      ? '<div class="alert" data-tone="warn"><p>The P0 cases changed since it was made. Create a new one if devs need the update.</p></div>'
      : "");
  const input = part("body").querySelector("input");
  input.value = x.url;
  input.addEventListener("focus", () => input.select());

  foot(
    [button("Close", { onClick: close })],
    [
      button(related ? "Create separate sheet" : "Create new", { onClick: () => renderPreview(dropShare(p, x)) }),
      button("Copy link", { onClick: () => copyText(x.url, "spreadsheet link") }),
      button("Open spreadsheet", { primary: true, href: x.url }),
    ],
  );
  if (canCheck) startCheck(g.scriptUrl, x.spreadsheetId);
}

// Asks the web app, in a hidden frame, whether the sheet is still in Drive. The
// frame needs the browser's Google sign-in; when that is not available nothing
// answers, and the saved link simply stays.
function startCheck(scriptUrl, id) {
  checkFrame = document.createElement("iframe");
  checkFrame.hidden = true;
  checkFrame.title = "Share P0 check";
  const sep = scriptUrl.includes("?") ? "&" : "?";
  checkFrame.src = `${scriptUrl}${sep}check=${encodeURIComponent(id)}&origin=${encodeURIComponent(location.origin)}`;
  document.body.appendChild(checkFrame);
  checkTimer = setTimeout(() => {
    stopCheck();
    const note = part("body").querySelector('[data-p0="check"]');
    if (note) note.textContent = "Couldn’t check Drive from here — if you deleted it, use Create new.";
  }, CHECK_MS);
}

function stopCheck() {
  clearTimeout(checkTimer);
  checkTimer = null;
  checkFrame?.remove();
  checkFrame = null;
}

// The preview without one saved share, so the next view down is shown.
function dropShare(p, x) {
  return {
    ...p,
    existing: p.existing === x ? null : p.existing,
    related: (p.related || []).filter((r) => r !== x),
  };
}

async function onCheck(data) {
  const p = lastPreview;
  const x = shown;
  if (!p || !x || data.id !== x.spreadsheetId) return;
  stopCheck();
  if (data.exists) {
    const note = part("body").querySelector('[data-p0="check"]');
    if (note) note.textContent = "Still in Drive.";
    return;
  }
  await fetch("/api/p0/forget", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // A related share is filed under its own selection, not this one.
    body: JSON.stringify({ ids: x.ids || ids }),
  }).catch(() => {});
  renderPreview(dropShare(p, x), { notice: "The earlier spreadsheet was deleted, so you can create a new one." });
}

function record(data) {
  return fetch("/api/p0/record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, url: data.url, spreadsheetId: data.id, account: data.account }),
  }).catch(() => {});
}

addEventListener("message", (e) => {
  if (fromScript(e.origin) && e.data && e.data.type === "p0-check") {
    onCheck(e.data);
    return;
  }
  if (!awaiting || !fromScript(e.origin) || !e.data || e.data.type !== "p0-share") return;
  awaiting = false;
  if (!dialog.open) dialog.showModal();
  if (!e.data.ok) {
    part("body").innerHTML =
      `<div class="alert"><p>Couldn’t create the spreadsheet.</p><p class="p0-detail">${esc(e.data.error || "")}</p></div>`;
    foot([button("Close", { onClick: close })], [button("Download CSV", { primary: true, onClick: downloadCsv })]);
    return;
  }
  record(e.data);
  // The other tab has focus, so the clipboard usually refuses; Copy link is there.
  navigator.clipboard.writeText(e.data.url).then(
    () => showCreated(e.data, true),
    () => showCreated(e.data, false),
  );
});

function showCreated(data, copied) {
  part("body").innerHTML =
    `<div class="p0-title-line"><span class="p0-label">Created</span><strong>${esc(data.title)}</strong></div>` +
    '<div class="p0-link"><input class="input mono" readonly aria-label="Spreadsheet link"></div>' +
    `<p class="p0-note">${plural(data.rowCount, "row")} in ${data.account ? `<strong>${esc(data.account)}</strong>’s` : "your"} Google Drive. ` +
    (copied ? "Link copied." : "") +
    "</p>" +
    (data.shared
      ? `<p class="p0-note">Anyone at ${esc(data.shared)} with the link can view it.</p>`
      : data.shareError
        ? `<div class="alert" data-tone="warn"><p>It’s private for now — share it from Sheets before sending the link.</p><p class="p0-detail">${esc(data.shareError)}</p></div>`
        : '<p class="p0-note">It’s private — share it from Sheets before sending the link.</p>');
  const input = part("body").querySelector("input");
  input.value = data.url;
  input.addEventListener("focus", () => input.select());

  foot(
    [button("Done", { onClick: close })],
    [
      button("Copy link", { onClick: () => copyText(data.url, "spreadsheet link") }),
      button("Open spreadsheet", { primary: true, href: data.url }),
    ],
  );
}

export async function openShareP0(requestIds) {
  if (!dialog) build();
  stopCheck();
  ids = [...requestIds];
  busy = false;
  awaiting = false;
  part("body").innerHTML = '<p class="p0-note">Collecting P0 cases…</p>';
  foot([button("Cancel", { onClick: close })], []);
  if (!dialog.open) dialog.showModal();

  try {
    const res = await fetch("/api/p0/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't read the sheets");
    renderPreview(data);
  } catch (err) {
    part("body").innerHTML = `<div class="alert"><p>${esc(err.message)}</p></div>`;
  }
}

// The bar a selectable list shows while rows are picked.
export function mountShareBar({ mount, onClear }) {
  const bar = document.createElement("div");
  bar.className = "p0-bar";
  bar.hidden = true;
  bar.innerHTML =
    '<span class="p0-bar-count" aria-live="polite"></span>' +
    '<button class="btn btn-sm" type="button" data-act="clear">Clear</button>' +
    '<button class="btn btn-sm btn-primary" type="button" data-act="share">Share P0</button>';
  let current = [];
  bar.querySelector('[data-act="clear"]').addEventListener("click", onClear);
  bar.querySelector('[data-act="share"]').addEventListener("click", () => openShareP0(current));
  mount.appendChild(bar);

  return {
    update(selectedIds) {
      current = selectedIds;
      bar.hidden = !current.length;
      bar.querySelector(".p0-bar-count").textContent = `${plural(current.length, "sheet")} selected`;
    },
  };
}
