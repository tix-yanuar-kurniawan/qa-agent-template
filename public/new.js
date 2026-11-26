// The composer. Every conditional field and the two drop areas are driven from the
// mode radios. Validation runs here first, field by field, so the server's 400s
// are a backstop rather than the first a user hears of a missing field.

import { mountRail, updateRailCounts, loadRequests, TYPE_ICON } from "./shell.js";

// Draw the rail immediately, then patch in the counts, so navigation is never
// waiting on a fetch and focus in the rail survives the load.
mountRail({ view: null });
loadRequests()
  .then((records) => updateRailCounts(records))
  .catch(() => {});

const $ = (id) => document.getElementById(id);

const form = $("request-form");
const formType = $("form-type");
const errorEl = $("form-error");
const submitBtn = $("submit-btn");
const hintEl = $("composer-hint");
const modeRadios = [...document.querySelectorAll('input[name="mode"]')];

const labelInput = $("form-label");
const descLabel = $("label-description");
const descInput = $("form-description");
const DEFAULT_DESC_PLACEHOLDER = descInput.getAttribute("placeholder");

const csvField = $("field-csv");
const csvInput = $("form-csv");
const csvUploadHint = $("csv-upload-hint");
const csvList = $("csv-list");
const uploadArea = $("upload-area");

const attachmentsField = $("field-attachments");
const toggleAttachments = $("toggle-attachments");
const attachmentsUpload = $("attachments-upload");
const attachmentsArea = $("attachments-area");
const attachmentsInput = $("form-attachments");
const attachmentsList = $("attachments-list");

const MODES = ["create", "analyze", "knowledge"];

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".csv", ".xlsx", ".xls", ".doc", ".docx",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
]);

const FILE_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 2H4.5v12h7V4.5z"/><path d="M9 2v2.5h2.5"/></svg>';

const REMOVE_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';

const MODE_HINT = {
  create: "Writes a CSV and a vault note on /run-it",
  analyze: "Checks each case, then adds what's missing",
  knowledge: "Writes a vault note, no test cases",
};

let currentMode = "create";
let attachedFiles = [];
// The CSV lives here rather than in the input's FileList, so a dropped file and
// a browsed one take the same path and a rejected file never replaces a good one.
let csvFile = null;
let submitting = false;

for (const el of document.querySelectorAll(".mode-icon")) {
  el.innerHTML = TYPE_ICON[el.dataset.tone] || "";
}

if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
  $("hint-mod").textContent = "Ctrl";
}

// ---- Errors ----
//
// Each field owns one message element, already wired to its controls through
// aria-describedby in the markup; showing an error fills it and marks the
// controls invalid. The banner only ever summarises.

const FIELDS = {
  description: { error: "error-description", controls: () => [descInput] },
  attachments: { error: "error-attachments", controls: () => [attachmentsInput] },
  csv: { error: "error-csv", controls: () => [csvInput] },
};

function setFieldError(key, msg) {
  const field = FIELDS[key];
  const p = $(field.error);
  p.textContent = msg || "";
  p.hidden = !msg;
  for (const control of field.controls()) {
    if (msg) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
  }
}

function clearFieldErrors() {
  for (const key of Object.keys(FIELDS)) setFieldError(key, "");
}

function showError(msg, { scroll = true } = {}) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  if (scroll) errorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

// Editing the description clears its own message; the summary goes once nothing is left.
descInput.addEventListener("input", () => {
  setFieldError("description", "");
  if (!form.querySelector('[aria-invalid="true"]')) hideError();
});

// ---- Conditional fields ----

function syncCsvField() {
  csvUploadHint.innerHTML = csvFile
    ? "Drop another CSV to replace it, or <strong>browse</strong>"
    : "Drop a CSV, or <strong>browse</strong>";
}

function syncDescriptionField() {
  let label = "Jira link or description";
  let placeholder = DEFAULT_DESC_PLACEHOLDER;

  if (currentMode === "analyze") {
    label = "Jira link or description to match against";
  } else if (currentMode === "knowledge") {
    label = "Jira, Confluence or Figma links, or notes";
    placeholder =
      "Paste the links and any notes. Each source is fetched and distilled into the knowledge vault.";
  }

  descLabel.textContent = label;
  descInput.placeholder = placeholder;
}

function applyMode() {
  attachmentsField.hidden = !(currentMode === "create" || currentMode === "knowledge");
  csvField.hidden = currentMode !== "analyze";

  syncDescriptionField();
  hintEl.textContent = MODE_HINT[currentMode] || "";
}

function setMode(mode) {
  currentMode = mode;
  formType.value = mode;
  for (const radio of modeRadios) radio.checked = radio.value === mode;

  setCsvFile(null);
  // Messages describe the previous mode's rules; start clean.
  clearFieldErrors();
  hideError();

  applyMode();
}

for (const radio of modeRadios) {
  radio.addEventListener("change", () => {
    if (radio.checked) setMode(radio.value);
  });
}

// ---- File rows ----

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fileRow(file, onRemove) {
  const li = document.createElement("li");
  li.className = "file-row";

  const mark = document.createElement("span");
  mark.className = "file-icon";
  mark.innerHTML = FILE_ICON;

  const name = document.createElement("span");
  name.className = "file-name";
  name.textContent = file.name;
  name.title = file.name;

  const size = document.createElement("span");
  size.className = "file-size";
  size.textContent = formatSize(file.size);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "file-remove";
  remove.setAttribute("aria-label", `Remove ${file.name}`);
  remove.innerHTML = REMOVE_ICON;
  remove.addEventListener("click", onRemove);

  li.append(mark, name, size, remove);
  return li;
}

function wireDrop(area, onFiles) {
  area.addEventListener("dragover", (e) => {
    e.preventDefault();
    area.classList.add("dragover");
  });
  area.addEventListener("dragleave", () => area.classList.remove("dragover"));
  area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.classList.remove("dragover");
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  });
}

// ---- Attachments ----

function isAllowedFile(file) {
  const ext = "." + file.name.split(".").pop().toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

toggleAttachments.addEventListener("change", () => {
  attachmentsUpload.hidden = !toggleAttachments.checked;
  if (!toggleAttachments.checked) {
    attachedFiles = [];
    attachmentsInput.value = "";
    setFieldError("attachments", "");
    renderAttachmentsList();
  }
});

function addFiles(fileList) {
  const rejected = [];
  for (const f of fileList) {
    if (!isAllowedFile(f)) {
      rejected.push(f.name);
      continue;
    }
    const already = attachedFiles.some((e) => e.name === f.name && e.size === f.size);
    if (!already) attachedFiles.push(f);
  }
  setFieldError(
    "attachments",
    rejected.length
      ? `Skipped ${rejected.join(", ")} — only PDF, CSV, Excel, Word and image files are read.`
      : "",
  );
  renderAttachmentsList();
}

function renderAttachmentsList() {
  attachmentsList.innerHTML = "";
  attachedFiles.forEach((f, i) => {
    attachmentsList.appendChild(
      fileRow(f, () => {
        attachedFiles.splice(i, 1);
        renderAttachmentsList();
        attachmentsInput.focus();
      }),
    );
  });
}

attachmentsInput.addEventListener("change", () => {
  addFiles(attachmentsInput.files);
  attachmentsInput.value = "";
});

wireDrop(attachmentsArea, addFiles);

// ---- Test-case CSV ----

function setCsvFile(file) {
  csvFile = file;
  csvInput.value = "";
  csvList.innerHTML = "";
  csvList.hidden = !file;
  if (file) {
    csvList.appendChild(
      fileRow(file, () => {
        setCsvFile(null);
        csvInput.focus();
      }),
    );
  }
  syncCsvField();
}

function takeCsv(files) {
  const file = files[0];
  if (!file) return;
  if (!/\.csv$/i.test(file.name)) {
    setFieldError("csv", `${file.name} isn't a CSV. Export the sheet as .csv and add that.`);
    csvInput.value = "";
    return;
  }
  setFieldError("csv", "");
  if (!form.querySelector('[aria-invalid="true"]')) hideError();
  setCsvFile(file);
}

csvInput.addEventListener("change", () => takeCsv(csvInput.files));
wireDrop(uploadArea, takeCsv);

// ---- Validation ----

/** Mark every invalid field and return their keys in page order. */
function validate() {
  const errors = {};
  const desc = descInput.value.trim();

  // Create and knowledge can work from attached files alone; analyze always
  // needs the requirements to match its CSV against. Mirrors the server rule.
  const hasFiles =
    (currentMode === "create" || currentMode === "knowledge") &&
    toggleAttachments.checked &&
    attachedFiles.length > 0;
  if (!desc && !hasFiles) {
    errors.description =
      currentMode === "analyze"
        ? "Add the Jira link or requirements to check the cases against."
        : "Add a link or a description, or attach files, so Claude has something to read.";
  }
  if (currentMode === "analyze" && !csvFile) {
    errors.csv = "Add the CSV of cases to analyze.";
  }

  clearFieldErrors();
  for (const [key, msg] of Object.entries(errors)) setFieldError(key, msg);

  const first = (key) => FIELDS[key].controls()[0];
  return Object.keys(errors).sort((a, b) =>
    first(a).compareDocumentPosition(first(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

// ---- Submit ----

function buildPayload() {
  const fd = new FormData();
  fd.append("type", currentMode);
  fd.append("description", descInput.value);
  fd.append("label", labelInput.value);

  if (currentMode === "analyze" && csvFile) fd.append("csv", csvFile);
  if ((currentMode === "create" || currentMode === "knowledge") && toggleAttachments.checked) {
    attachedFiles.forEach((f) => fd.append("attachments", f));
  }
  return fd;
}

/** The server's reason for a refusal: its JSON `error`, else plain text, else the status. */
function refusalReason(res, text) {
  try {
    const body = JSON.parse(text);
    if (body && body.error) return body.error;
  } catch {
    // not JSON — Express's default handler (e.g. an upload limit) answers in HTML
  }
  let detail = text.trim();
  if (detail.startsWith("<")) {
    detail = new DOMParser().parseFromString(detail, "text/html").body.textContent.trim();
  }
  detail = detail.replace(/\s+/g, " ").slice(0, 240);
  return detail || `${res.status} ${res.statusText}`.trim();
}

function fail(msg) {
  submitting = false;
  submitBtn.disabled = false;
  submitBtn.textContent = "Add to queue";
  showError(msg);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitting) return;

  const invalid = validate();
  if (invalid.length) {
    const n = invalid.length;
    // Focus moves to the first bad field; scrolling to the banner would fight it.
    showError(`Fix ${n} field${n > 1 ? "s" : ""} before adding to the queue.`, { scroll: false });
    FIELDS[invalid[0]].controls()[0].focus();
    return;
  }
  hideError();

  submitting = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Adding…";

  let res;
  try {
    res = await fetch("/api/requests", { method: "POST", body: buildPayload() });
  } catch (err) {
    fail("Could not reach the server: " + err.message);
    return;
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    fail(`The server refused that request: ${refusalReason(res, text)}`);
    return;
  }

  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // handled below
  }
  if (!body || !body.id) {
    fail("The server accepted the request but sent back no id. Check the queue before trying again.");
    return;
  }
  // Straight back to the queue, with the new row marked. The button stays in
  // its "Adding…" state until the page goes.
  location.href = `/?new=${encodeURIComponent(body.id)}`;
});

// Coming Back from the queue restores this page from the bfcache mid-"Adding…".
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  submitting = false;
  submitBtn.disabled = false;
  submitBtn.textContent = "Add to queue";
});

// ⌘↵ / Ctrl+↵ submits from anywhere on the page.
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// Deep-link a mode: /new?type=analyze
const requested = new URLSearchParams(location.search).get("type");
setMode(MODES.includes(requested) ? requested : "create");
