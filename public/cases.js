// The test-case sheet: the TestRail conversion of a request's result CSV.
//
// Title, Steps, Expected Result, Platform, Criticality, Case Type and Priority
// save back into the source CSV. The other TestRail columns are derived on load
// (Section, Automation Status, Created by AI, …) and are not independently saved.

import {
  mountRail,
  mountFilterBar,
  loadRequests,
  listChrome,
  renderNoMatch,
  clearFacets,
  wirePopover,
  closePopover,
  copyText,
  toast,
  VIEWS,
} from "./shell.js";
import { createLedger } from "./ledger.js";
import { openUploadDialog, renderUploadBadge } from "./upload-dialog.js";
import { openShareP0, mountShareBar } from "./share-p0.js";

// The rail replaces this page's own back link, so draw it before anything else
// and never let a failed count fetch leave the page without navigation.
mountRail({ view: "cases" });

const el = (id) => document.getElementById(id);
const titleEl = el("c-title");
const subEl = el("c-sub");
const crumbCurrent = el("c-crumb-current");
const statsEl = el("c-stats");
const sourceEl = el("c-source");
const pathEl = el("c-path");
const copyBtn = el("c-copy");
const stateEl = el("c-state");
const saveBtn = el("c-save");
const downloadBtn = el("c-download");
const uploadBtn = el("c-upload");
const shareBtn = el("c-share");
const alertEl = el("c-alert");
const toolbarEl = el("c-toolbar");
const searchInput = el("ct-q");
const filtersContainer = el("ct-filters");
const groupSelect = el("ct-group");
const tallyEl = el("ct-tally");
const toggleContainer = el("ct-toggle");
const addBtnToolbar = el("ct-add");
const bodyEl = el("c-body");
const wrap = el("c-grid-wrap");
const grid = el("c-grid");
const colgroup = el("c-colgroup");
const thead = el("c-thead");
const tbody = el("c-tbody");
const listEl = el("c-list");
const emptyEl = el("c-empty");
const picker = el("c-picker");
const panel = el("c-panel");
const panelBody = el("cp-body");
const panelNum = el("cp-num");
const panelClose = el("cp-close");
const panelPrev = el("cp-prev");
const panelNext = el("cp-next");
const panelDelete = el("cp-delete");
const panelDone = el("cp-done");
const headEl = document.querySelector(".c-head");

const GUTTER_WIDTH = 52;
const DEFAULT_WIDTH = 180;
const PRIORITIES = ["p0", "p1", "p2", "p3"];
const CRITICALITIES = ["critical", "high", "medium", "low"];
const DERIVED = "Derived — edit the source fields";
const COLUMN_WIDTHS = {
  section: 220,
  "section description": 240,
  title: 300,
  steps: 320,
  "expected result": 380,
  reference: 110,
  "automation status": 130,
  "automation type": 120,
  platform: 110,
  criticality: 110,
  "created by ai": 110,
  "test case status": 130,
  type: 160,
  "case type": 130,
  priority: 90,
};

const LOCK_ICON =
  '<svg class="c-lock" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<rect x="3.5" y="7" width="9" height="6.5" rx="1.25"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>';
const DOTS_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">' +
  '<circle cx="3.5" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="12.5" cy="8" r="1.25"/></svg>';

let requestId = null;
let columns = [];
let rows = [];
let rowKeys = [];
let editableColumns = null;
let baseline = "[]";
let outputFile = null;
let lastSavedAt = null;
let saving = false;
let saveFailed = false;

let sel = null;
let editor = null;
let choice = null;
let panelIndex = null;
let panelOpener = null;
let closingIndex = null;
let viewMode = sessionStorage.getItem("cases-view-mode") === "sheet" ? "sheet" : "list";
let listQuery = "";
// The chip row filters by one field at a time; the select beside it picks which.
const FILTER_FIELDS = { priority: "Priority", platform: "Platform", type: "Case type" };
let filterField = FILTER_FIELDS[sessionStorage.getItem("cases-filter-field")]
  ? sessionStorage.getItem("cases-filter-field")
  : "priority";
let listFilter = new Set();
const FILTER_HUES = ["blue", "purple", "green", "amber", "orange", "red"];
const FILTER_TONES = {
  responsive: "blue",
  "android app": "green",
  "ios app": "neutral",
  backend: "purple",
  api: "orange",
  "panel - dweb": "amber",
  specific: "blue",
  e2e: "green",
  "e2e - regression": "purple",
};

// --- Plumbing ---

async function getJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

function say(message, tone = "info") {
  alertEl.textContent = message;
  alertEl.dataset.tone = tone;
  alertEl.setAttribute("role", tone === "error" ? "alert" : "status");
  alertEl.hidden = false;
}

function hideAlert() {
  alertEl.hidden = true;
}

function clockTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function columnIndex(name) {
  return columns.findIndex((c) => c.toLowerCase() === name);
}

function titleColumn() {
  const idx = columnIndex("title");
  return idx >= 0 ? idx : columnIndex("case");
}

function isEditableColumn(c) {
  if (!editableColumns) return true;
  return editableColumns.has(columns[c]);
}

function firstEditableColumn() {
  const idx = columns.findIndex((_, c) => isEditableColumn(c));
  return idx >= 0 ? idx : 0;
}

// Priority and Criticality take a fixed vocabulary, in the sheet and the drawer alike.
function choicesFor(c) {
  const lower = (columns[c] || "").toLowerCase();
  if (lower === "priority") return PRIORITIES;
  if (lower === "criticality") return CRITICALITIES;
  return null;
}

function chipFor(value, c) {
  const chip = document.createElement("span");
  const key = String(value || "").toLowerCase().trim();
  chip.className = "chip";
  chip.dataset.tone = key;
  chip.textContent = choicesFor(c) === PRIORITIES ? key.toUpperCase() : key;
  return chip;
}

// --- State ---

function isDirty() {
  return JSON.stringify(rows) !== baseline;
}

function syncState() {
  const dirty = isDirty();
  saveBtn.disabled = saving || !dirty;

  if (saving) {
    stateEl.textContent = "Saving…";
    stateEl.className = "c-state";
  } else if (dirty && saveFailed) {
    stateEl.textContent = "Not saved";
    stateEl.className = "c-state failed";
  } else if (dirty) {
    stateEl.textContent = "Unsaved changes";
    stateEl.className = "c-state dirty";
  } else if (lastSavedAt) {
    stateEl.textContent = `Saved · ${clockTime(lastSavedAt)}`;
    stateEl.className = "c-state saved";
  } else {
    stateEl.textContent = "";
    stateEl.className = "c-state";
  }
  renderStats();
}

// The header's one meta line: count · priority chips · source path.
function describe() {
  subEl.textContent = plural(rows.length, "case");
  if (!sourceEl) return;
  sourceEl.hidden = false;
  if (outputFile) {
    pathEl.textContent = `output/${outputFile}`;
    pathEl.title = "Saves also write this file";
    copyBtn.hidden = false;
  } else {
    pathEl.textContent = "queue copy only";
    pathEl.title = "No matching file in output/ — saves stay in the queue copy";
    copyBtn.hidden = true;
  }
}

function priorityCounts() {
  const priCol = columnIndex("priority");
  const counts = Object.fromEntries(PRIORITIES.map((priority) => [priority, 0]));
  for (const row of rows) {
    const priority = (row[priCol] || "").toLowerCase().trim();
    if (PRIORITIES.includes(priority)) counts[priority]++;
  }
  return counts;
}

function renderStats() {
  renderTally();
  if (!statsEl) return;
  statsEl.textContent = "";
  const counts = priorityCounts();
  const present = Object.entries(counts).filter(([, n]) => n > 0);
  statsEl.hidden = !present.length;
  if (!present.length) return;

  const sep = document.createElement("span");
  sep.className = "sep";
  sep.setAttribute("aria-hidden", "true");
  statsEl.appendChild(sep);
  for (const [key, n] of present) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.dataset.tone = key;
    chip.textContent = `${key.toUpperCase()} · ${n}`;
    statsEl.appendChild(chip);
  }
}

function renderTally() {
  if (!tallyEl) return;
  const shown = visibleRows().length;
  tallyEl.textContent =
    listQuery || listFilter.size ? `Showing ${shown} of ${rows.length}` : "";
}

// --- Filtering ---

function typeColumn() {
  const idx = columnIndex("case type");
  return idx >= 0 ? idx : columnIndex("type");
}

// The values a row files under for a field, as { key, label }. A case can list
// several platforms ("Responsive, Android App"), so it counts under each.
function filterValues(row, field) {
  const c = field === "type" ? typeColumn() : columnIndex(field);
  const raw = c >= 0 ? String(row[c] || "") : "";
  const parts = field === "platform" ? raw.split(",") : [raw];
  const seen = new Map();
  for (const part of parts) {
    const label = part.trim();
    const key = label.toLowerCase();
    if (!key || seen.has(key)) continue;
    if (field === "priority" && !PRIORITIES.includes(key)) continue;
    seen.set(key, { key, label: field === "priority" ? key.toUpperCase() : label });
  }
  return [...seen.values()];
}

// Priorities keep their fixed order; other fields list the most common first.
function filterCounts() {
  const counts = new Map();
  if (filterField === "priority") {
    for (const p of PRIORITIES) counts.set(p, { label: p.toUpperCase(), n: 0 });
  }
  for (const row of rows) {
    for (const { key, label } of filterValues(row, filterField)) {
      if (!counts.has(key)) counts.set(key, { label, n: 0 });
      counts.get(key).n++;
    }
  }
  const entries = [...counts.entries()];
  if (filterField !== "priority") {
    entries.sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label));
  }
  return entries;
}

// Search and the chip filter apply to both views. Each entry keeps the row's real
// index, which is what every edit, delete and drawer works with.
function visibleRows() {
  const titleIdx = titleColumn();
  return rows
    .map((row, i) => ({ row, index: i }))
    .filter(({ row }) => {
      if (listQuery) {
        const title = titleIdx >= 0 ? (row[titleIdx] || "").toLowerCase() : "";
        if (!title.includes(listQuery)) return false;
      }
      if (listFilter.size) {
        if (!filterValues(row, filterField).some(({ key }) => listFilter.has(key))) return false;
      }
      return true;
    });
}

function renderGroupSelect() {
  if (!groupSelect || groupSelect.dataset.ready) return;
  groupSelect.dataset.ready = "1";
  for (const [value, label] of Object.entries(FILTER_FIELDS)) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    o.selected = value === filterField;
    groupSelect.appendChild(o);
  }
  groupSelect.addEventListener("change", () => {
    filterField = groupSelect.value;
    sessionStorage.setItem("cases-filter-field", filterField);
    listFilter.clear();
    renderFilters();
    renderCurrentView();
  });
}

function renderFilters() {
  if (!filtersContainer) return;
  renderGroupSelect();
  filtersContainer.textContent = "";
  filtersContainer.setAttribute("aria-label", `Filter by ${FILTER_FIELDS[filterField].toLowerCase()}`);
  const entries = filterCounts();
  // Keep active filters available to clear after deleting or reclassifying cases.
  for (const key of listFilter) {
    if (!entries.some(([k]) => k === key)) entries.push([key, { label: key, n: 0 }]);
  }

  for (const [key, { label, n }] of entries) {
    if (n === 0 && !listFilter.has(key)) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ct-filter";
    btn.dataset.key = key;
    if (filterField === "priority") btn.dataset.priority = key;
    if (filterField === "priority") btn.dataset.tone = key;
    else {
      // Known values get fixed colours; anything else hashes to a stable one.
      const hue = FILTER_TONES[key] ||
        FILTER_HUES[[...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % FILTER_HUES.length];
      btn.style.setProperty("--tone", `var(--${hue})`);
      btn.style.setProperty("--tone-bg", `var(--${hue}-bg)`);
    }
    btn.setAttribute("aria-pressed", String(listFilter.has(key)));
    btn.textContent = `${label} `;
    const count = document.createElement("span");
    count.className = "ct-filter-n";
    count.textContent = String(n);
    btn.appendChild(count);
    btn.addEventListener("click", () => {
      if (listFilter.has(key)) listFilter.delete(key);
      else listFilter.add(key);
      renderFilters();
      renderCurrentView();
    });
    filtersContainer.appendChild(btn);
  }
}

function clearFilters() {
  listQuery = "";
  if (searchInput) searchInput.value = "";
  listFilter.clear();
  renderFilters();
}

// --- View Mode & Toggle ---

function setViewMode(mode) {
  if (editor) endEdit(true);
  closeChoice();
  viewMode = mode;
  sessionStorage.setItem("cases-view-mode", mode);
  renderCurrentView();
  renderToggle();
}

function renderToggle() {
  if (!toggleContainer) return;
  toggleContainer.textContent = "";
  for (const mode of ["list", "sheet"]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.mode = mode;
    btn.setAttribute("aria-pressed", String(mode === viewMode));
    btn.textContent = mode === "list" ? "List" : "Sheet";
    btn.addEventListener("click", () => setViewMode(mode));
    toggleContainer.appendChild(btn);
  }
}

function renderCurrentView() {
  const visible = visibleRows();
  renderEmpty(visible);
  const showing = visible.length > 0;
  wrap.hidden = !showing || viewMode !== "sheet";
  listEl.hidden = !showing || viewMode !== "list";
  if (viewMode === "sheet") {
    renderHead();
    renderBody();
  } else {
    renderListView();
  }
  renderStats();
}

// Two different nothings: a sheet with no cases, and filters that match none.
function renderEmpty(visible) {
  if (!emptyEl) return;
  emptyEl.hidden = visible.length > 0;
  if (visible.length) return;
  emptyEl.textContent = "";

  const title = document.createElement("p");
  title.className = "empty-title";
  const text = document.createElement("p");
  text.className = "empty-text";
  const cta = document.createElement("p");
  cta.className = "empty-cta";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";

  if (!rows.length) {
    title.textContent = "No cases yet";
    text.textContent = "Add the first case, or rerun the request from the queue.";
    btn.textContent = "Add case";
    btn.addEventListener("click", addRow);
  } else {
    title.textContent = "No cases match";
    text.textContent = listQuery
      ? `Nothing matches “${listQuery}” under the current ${FILTER_FIELDS[filterField].toLowerCase()} filter.`
      : `None of the cases have the selected ${FILTER_FIELDS[filterField].toLowerCase()}.`;
    btn.textContent = "Clear search and filters";
    btn.addEventListener("click", () => {
      clearFilters();
      renderCurrentView();
    });
  }
  cta.appendChild(btn);
  emptyEl.append(title, text, cta);
}

// --- Case List View ---

function renderListView() {
  if (!listEl) return;
  listEl.textContent = "";
  const visible = visibleRows();

  const titleCol = titleColumn();
  const priCol = columnIndex("priority");
  const typeCol = typeColumn();
  const platCol = columnIndex("platform");
  const critCol = columnIndex("criticality");

  visible.forEach(({ row, index }) => {
    const rowEl = document.createElement("div");
    rowEl.className = panelIndex === index ? "case-row is-selected" : "case-row";
    rowEl.setAttribute("role", "listitem");
    rowEl.dataset.index = String(index);
    rowEl.tabIndex = 0;

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(index + 1);

    const body = document.createElement("div");
    body.className = "case-row-body";
    const title = document.createElement("span");
    title.className = "case-row-title";
    title.textContent = (titleCol >= 0 && row[titleCol]) || "Untitled case";
    const metaParts = [typeCol, platCol, critCol]
      .filter((c) => c >= 0 && row[c])
      .map((c) => row[c]);
    const meta = document.createElement("span");
    meta.className = "case-row-meta";
    meta.textContent = metaParts.join(" · ");
    body.append(title, meta);

    const priVal = priCol >= 0 ? (row[priCol] || "").trim() : "";
    const chip = priVal ? chipFor(priVal, priCol) : document.createElement("span");
    if (!priVal) {
      chip.className = "chip";
      chip.textContent = "No priority";
    }

    rowEl.append(num, body, chip, rowMenu(index));

    rowEl.addEventListener("click", (e) => {
      if (e.target.closest(".menu-wrap")) return;
      openPanel(index);
    });
    rowEl.addEventListener("keydown", (e) => {
      if (e.target !== rowEl) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPanel(index);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = e.key === "ArrowDown" ? rowEl.nextElementSibling : rowEl.previousElementSibling;
        if (next) next.focus();
      }
    });

    listEl.appendChild(rowEl);
  });
}

function rowMenu(index) {
  const group = document.createElement("div");
  group.className = "menu-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn";
  btn.setAttribute("aria-label", `Actions for case ${index + 1}`);
  btn.innerHTML = DOTS_ICON;

  const pop = document.createElement("div");
  pop.className = "popover popover-right case-row-menu";
  pop.hidden = true;
  const open = document.createElement("button");
  open.type = "button";
  open.className = "menu-item";
  open.textContent = "Open";
  open.addEventListener("click", () => {
    closePopover();
    openPanel(index);
  });
  const del = document.createElement("button");
  del.type = "button";
  del.className = "menu-item menu-item-danger";
  del.textContent = "Delete";
  del.addEventListener("click", () => {
    closePopover();
    deleteRow(index);
  });
  pop.append(open, del);
  group.append(btn, pop);
  // Shared helpers are absent when the page's handlers run under the unit tests.
  if (typeof wirePopover === "function") wirePopover(group, btn, pop);
  return group;
}

// --- Detail drawer ---

function makeSelect(options, current, capitalize = false) {
  const select = document.createElement("select");
  select.className = "select";
  const normalized = (current || "").toLowerCase().trim();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Not set";
  blank.selected = !current;
  select.appendChild(blank);
  let matched = false;
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = capitalize
      ? opt.charAt(0).toUpperCase() + opt.slice(1)
      : opt.toUpperCase();
    if (opt.toLowerCase() === normalized) {
      o.selected = true;
      matched = true;
    }
    select.appendChild(o);
  }
  if (!matched && current) {
    const o = document.createElement("option");
    o.value = current;
    o.textContent = current;
    o.selected = true;
    select.appendChild(o);
  }
  return select;
}

// Older CSVs keep numbered lists on one line. Format only these two fields,
// and require consecutive markers so decimals and ordinary numbers stay intact.
function readableCell(value, column) {
  const text = String(value || "");
  if (!["steps", "expected result"].includes(column.toLowerCase())) return text;
  if (!/^\s*1[.)]\s+/.test(text)) return text;
  let next = 2;
  return text.replace(/(\s+)(\d+)([.)])(?=[ \t]+\S)/g, (match, space, number, punctuation) => {
    if (Number(number) !== next) return match;
    next++;
    return `${space.includes("\n") ? space : "\n"}${number}${punctuation}`;
  });
}

// The drawer works from both views. Opening it again while it is open swaps the
// case in place, so ↑/↓ keep the original opener for focus to return to.
function openPanel(rowIndex) {
  if (!rows[rowIndex]) return;
  if (panelIndex == null) panelOpener = document.activeElement;
  panelIndex = rowIndex;
  panelNum.textContent = `Case ${rowIndex + 1}`;
  panelBody.textContent = "";

  columns.forEach((name, c) => {
    const field = document.createElement("div");
    field.className = "cp-field";

    const label = document.createElement("label");
    label.className = "cp-label";
    label.textContent = name;

    if (isEditableColumn(c)) {
      const lower = name.toLowerCase();
      const choices = choicesFor(c);
      if (choices) {
        const isPriority = choices === PRIORITIES;
        const select = makeSelect(choices, rows[rowIndex][c], !isPriority);
        select.addEventListener("change", () => {
          setCell(rowIndex, c, select.value);
          renderListView();
          renderFilters();
        });
        label.setAttribute("for", (select.id = `cp-f-${c}`));
        field.append(label, select);
      } else {
        const input = document.createElement("textarea");
        input.className = "textarea cp-textarea";
        input.rows = lower === "steps" || lower === "expected result" ? 6 : 2;
        input.value = readableCell(rows[rowIndex][c], name);
        input.addEventListener("input", () => {
          setCell(rowIndex, c, input.value);
          if (c === titleColumn()) {
            const title = listEl.querySelector(`.case-row[data-index="${rowIndex}"] .case-row-title`);
            if (title) title.textContent = input.value || "Untitled case";
          }
        });
        label.setAttribute("for", (input.id = `cp-f-${c}`));
        field.append(label, input);
      }
    } else {
      field.className = "cp-field cp-locked";
      const text = document.createElement("span");
      text.textContent = name;
      const note = document.createElement("span");
      note.className = "cp-derived";
      note.textContent = "derived from the source";
      label.innerHTML = LOCK_ICON;
      label.append(text, note);
      const value = document.createElement("div");
      value.className = "cp-value";
      value.title = DERIVED;
      value.textContent = rows[rowIndex][c] || "—";
      field.append(label, value);
    }

    panelBody.appendChild(field);
  });

  const { prev, next } = panelNeighbours();
  if (panelPrev) panelPrev.disabled = prev == null;
  if (panelNext) panelNext.disabled = next == null;

  if (typeof panel.showModal === "function" && !panel.open) panel.showModal();
  const first = panelBody.querySelector("textarea, select");
  if (first) first.focus();
  if (panelBody.scrollTop) panelBody.scrollTop = 0;

  document.querySelectorAll(".case-row").forEach((r) => {
    r.classList.toggle("is-selected", r.dataset.index === String(rowIndex));
  });
}

// ↑/↓ step through the cases the current filters show, in sheet order.
function panelNeighbours() {
  const shown = visibleRows().map((v) => v.index);
  let prev = null;
  let next = null;
  for (const i of shown) {
    if (i < panelIndex) prev = i;
    else if (i > panelIndex && next == null) next = i;
  }
  return { prev, next };
}

// The dialog's close event arrives a task later, so the index is released now;
// callers such as deleteRow go on to renumber rows straight away.
function closePanel() {
  if (panelIndex != null) closingIndex = panelIndex;
  panelIndex = null;
  if (panel.open && typeof panel.close === "function") {
    panel.close(); // the close event finishes up
    return;
  }
  panelClosed();
}

// Also reached directly when Esc closes the dialog natively.
function panelClosed() {
  const index = panelIndex != null ? panelIndex : closingIndex;
  panelIndex = null;
  closingIndex = null;
  panelBody.textContent = "";
  renderCurrentView();

  // The opener can be gone (a menu item, a re-rendered row): fall back to the
  // case the drawer showed, so focus never drops to the top of the page.
  let target = panelOpener && panelOpener.isConnected ? panelOpener : null;
  panelOpener = null;
  if (!target && index != null) {
    target = viewMode === "sheet" && sel
      ? cellAt(sel.r, sel.c)
      : listEl.querySelector(`.case-row[data-index="${index}"]`);
  }
  if (target) target.focus();
}

// --- Spreadsheet Rendering ---

function widthFor(name) {
  return COLUMN_WIDTHS[name.toLowerCase()] || DEFAULT_WIDTH;
}

function renderHead() {
  colgroup.textContent = "";
  thead.textContent = "";

  const gutterCol = document.createElement("col");
  gutterCol.style.width = `${GUTTER_WIDTH}px`;
  colgroup.appendChild(gutterCol);

  const tr = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "c-corner";
  corner.scope = "col";
  corner.innerHTML = '<span class="sr-only">Case</span>';
  tr.appendChild(corner);

  let total = GUTTER_WIDTH;
  columns.forEach((name, c) => {
    const width = widthFor(name);
    total += width;

    const col = document.createElement("col");
    col.style.width = `${width}px`;
    colgroup.appendChild(col);

    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = name;
    th.title = name;
    if (!isEditableColumn(c)) {
      th.className = "c-derived";
      th.title = `${name} · ${DERIVED}`;
      th.insertAdjacentHTML("beforeend", `${LOCK_ICON}<span class="sr-only"> (derived, read-only)</span>`);
    }
    tr.appendChild(th);
  });

  thead.appendChild(tr);
  // A fixed layout needs the table to be as wide as its columns, otherwise it
  // shrinks to the viewport and every column is squeezed.
  grid.style.width = `${total}px`;
}

function fillCell(td, value, c) {
  td.textContent = "";
  if (choicesFor(c) && String(value || "").trim()) {
    td.appendChild(chipFor(value, c));
    return;
  }
  const text = document.createElement("div");
  text.className = "c-cell-text";
  text.textContent = readableCell(value, columns[c]);
  td.appendChild(text);
}

function renderRow(row, r) {
  const tr = document.createElement("tr");
  tr.className = "c-row";
  tr.dataset.row = String(r);

  const gutter = document.createElement("th");
  gutter.className = "c-gutter";
  gutter.scope = "row";

  const open = document.createElement("button");
  open.type = "button";
  open.className = "c-open";
  open.tabIndex = -1;
  open.textContent = String(r + 1);
  open.title = "Open this case";
  open.setAttribute("aria-label", `Open case ${r + 1}`);
  gutter.appendChild(open);
  tr.appendChild(gutter);

  columns.forEach((_, c) => {
    const td = document.createElement("td");
    td.setAttribute("role", "gridcell");
    td.className = isEditableColumn(c) ? "c-cell" : "c-cell c-readonly";
    td.tabIndex = -1;
    td.dataset.r = String(r);
    td.dataset.c = String(c);
    td.setAttribute("aria-selected", "false");
    if (!isEditableColumn(c)) {
      td.title = DERIVED;
      td.setAttribute("aria-readonly", "true");
    }
    fillCell(td, row[c], c);
    tr.appendChild(td);
  });

  return tr;
}

function renderBody() {
  const wanted = sel;
  tbody.textContent = "";
  sel = null;

  const visible = visibleRows();
  visible.forEach(({ row, index }) => tbody.appendChild(renderRow(row, index)));
  if (!visible.length) return;

  // Rebuilding the body throws away the selected element, so put the selection
  // back on the same case, or the nearest one the filters still show.
  if (wanted) {
    const near = visible.find((v) => v.index >= wanted.r) || visible[visible.length - 1];
    select(near.index, Math.min(wanted.c, columns.length - 1), { focus: false });
  }
  // Roving tabindex: exactly one cell is in the tab order, so Tab enters the grid.
  if (!sel) {
    const first = cellAt(visible[0].index, firstEditableColumn());
    if (first) first.tabIndex = 0;
  }
}

// --- Selection ---

function cellAt(r, c) {
  return tbody.querySelector(`.c-cell[data-r="${r}"][data-c="${c}"]`);
}

function select(r, c, { focus = true } = {}) {
  if (r < 0 || c < 0 || r >= rows.length || c >= columns.length) return;

  const td = cellAt(r, c);
  if (!td) return;

  tbody.querySelectorAll('.c-cell[tabindex="0"], .c-cell[aria-selected="true"]').forEach((cell) => {
    cell.tabIndex = -1;
    cell.setAttribute("aria-selected", "false");
  });

  sel = { r, c };
  td.tabIndex = 0;
  td.setAttribute("aria-selected", "true");
  if (focus) td.focus({ preventScroll: true });
  td.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// Moves run through the rows the filters show. Tab runs off the end of a row
// into the next one, the way a spreadsheet does, and out of the grid at its ends.
function shownIndexes() {
  return visibleRows().map((v) => v.index);
}

function stepped(r, c, delta) {
  const shown = shownIndexes();
  const pos = shown.indexOf(r) * columns.length + c + delta;
  if (pos < 0 || pos >= shown.length * columns.length) return null;
  return { r: shown[Math.floor(pos / columns.length)], c: pos % columns.length };
}

function verticalStep(r, delta) {
  const shown = shownIndexes();
  const next = shown[shown.indexOf(r) + delta];
  return next == null ? r : next;
}

// --- Editing ---

function setCell(r, c, value) {
  if (rows[r][c] === value) return;
  rows[r][c] = value;
  const td = cellAt(r, c);
  if (td) fillCell(td, value, c);
  syncState();
}

function autoGrow(ta) {
  ta.style.height = "auto";
  // scrollHeight leaves out the border, which a border-box height has to carry.
  ta.style.height = `${Math.max(ta.scrollHeight + 4, ta.dataset.minHeight)}px`;
}

// Where an overlay sits so it covers (or hangs under) a cell inside the scroller.
function overlayBox(td) {
  const wrapBox = wrap.getBoundingClientRect();
  const cellBox = td.getBoundingClientRect();
  return {
    left: cellBox.left - wrapBox.left + wrap.scrollLeft,
    top: cellBox.top - wrapBox.top + wrap.scrollTop,
    width: cellBox.width,
    height: cellBox.height,
  };
}

// The editor floats over its cell instead of stretching the row, so a 900-character
// expected result opens at full height without shoving the rest of the sheet down.
function beginEdit(seed) {
  if (!sel || editor || choice) return;
  if (!isEditableColumn(sel.c)) {
    toast(DERIVED, { timeout: 3000 });
    return;
  }

  const td = cellAt(sel.r, sel.c);
  if (!td) return;
  if (choicesFor(sel.c)) {
    openChoice(td, sel.r, sel.c);
    return;
  }

  const box = overlayBox(td);
  const ta = document.createElement("textarea");
  ta.className = "c-editor";
  ta.style.left = `${box.left}px`;
  ta.style.top = `${box.top}px`;
  ta.style.width = `${box.width}px`;
  ta.dataset.minHeight = String(box.height);
  ta.value = seed != null ? seed : readableCell(rows[sel.r][sel.c], columns[sel.c]);
  ta.setAttribute("aria-label", columns[sel.c]);
  ta.title = "Enter to commit · Shift+Enter for a new line";

  editor = { ta, r: sel.r, c: sel.c, initialValue: readableCell(rows[sel.r][sel.c], columns[sel.c]) };

  ta.addEventListener("input", () => autoGrow(ta));
  ta.addEventListener("blur", () => endEdit(true));
  ta.addEventListener("keydown", onEditorKey);

  wrap.appendChild(ta);
  autoGrow(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

function endEdit(commit) {
  if (!editor) return;

  const { ta, r, c, initialValue } = editor;
  const value = ta.value;
  editor = null;
  ta.remove();

  if (commit && rows[r] && value !== initialValue) setCell(r, c, value);
}

function onEditorKey(e) {
  const { r, c } = editor;

  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    endEdit(false);
    select(r, c);
  } else if (e.key === "Enter" && !e.shiftKey) {
    // Shift+Enter inserts a newline; the CSV writer quotes multiline fields.
    e.preventDefault();
    endEdit(true);
    select(verticalStep(r, 1), c);
  } else if (e.key === "Tab") {
    e.preventDefault();
    endEdit(true);
    const next = stepped(r, c, e.shiftKey ? -1 : 1) || { r, c };
    select(next.r, next.c);
  }
}

// Priority and Criticality pick from a list, the same values the drawer offers.
function openChoice(td, r, c) {
  closeChoice();
  const current = String(rows[r][c] || "");
  const normalized = current.toLowerCase().trim();
  const values = ["", ...choicesFor(c)];
  if (normalized && !values.includes(normalized)) values.push(current);

  const box = overlayBox(td);
  const pop = document.createElement("div");
  pop.className = "popover c-choice";
  pop.setAttribute("role", "listbox");
  pop.setAttribute("aria-label", columns[c]);
  pop.style.left = `${box.left}px`;
  pop.style.top = `${box.top + box.height}px`;

  for (const value of values) {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "menu-item";
    opt.setAttribute("role", "option");
    const picked = value.toLowerCase() === normalized;
    opt.setAttribute("aria-selected", String(picked));
    if (value) opt.appendChild(chipFor(value, c));
    else opt.innerHTML = '<span class="muted">Not set</span>';
    opt.addEventListener("click", () => {
      closeChoice();
      setCell(r, c, value);
      renderFilters();
      select(r, c);
    });
    pop.appendChild(opt);
  }

  pop.addEventListener("keydown", (e) => {
    const items = [...pop.querySelectorAll(".menu-item")];
    const at = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = items[Math.max(0, Math.min(items.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))];
      next.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeChoice();
      select(r, c);
    } else if (e.key === "Tab") {
      e.preventDefault();
      closeChoice();
      select(r, c);
    }
  });
  // Keep focus in the list on press, so a browser that does not focus clicked
  // buttons (Safari) cannot blur it shut before the click lands.
  pop.addEventListener("mousedown", (e) => e.preventDefault());
  pop.addEventListener("focusout", (e) => {
    if (!pop.contains(e.relatedTarget)) closeChoice();
  });

  choice = pop;
  wrap.appendChild(pop);
  (pop.querySelector('[aria-selected="true"]') || pop.firstElementChild).focus();
}

function closeChoice() {
  if (!choice) return;
  const pop = choice;
  choice = null;
  pop.remove();
}

function onGridKey(e) {
  if (editor || !sel) return;

  const { r, c } = sel;
  if (e.metaKey || e.ctrlKey) return;

  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      return select(verticalStep(r, -1), c);
    case "ArrowDown":
      e.preventDefault();
      return select(verticalStep(r, 1), c);
    case "ArrowLeft":
      e.preventDefault();
      return select(r, c - 1);
    case "ArrowRight":
      e.preventDefault();
      return select(r, c + 1);
    case "Tab": {
      const next = stepped(r, c, e.shiftKey ? -1 : 1);
      if (!next) return; // let focus leave the grid
      e.preventDefault();
      return select(next.r, next.c);
    }
    case "Enter":
    case "F2":
      e.preventDefault();
      return beginEdit();
    case " ":
      e.preventDefault();
      return openPanel(r);
    case "Backspace":
    case "Delete":
      e.preventDefault();
      if (!isEditableColumn(c)) return;
      return setCell(r, c, "");
  }

  if (e.key.length === 1 && !e.altKey) {
    if (!isEditableColumn(c)) return;
    e.preventDefault();
    beginEdit(choicesFor(c) ? undefined : e.key);
  }
}

// --- Rows ---

function addRow() {
  const template = rows[0] || columns.map(() => "");
  const row = columns.map((name, c) => (isEditableColumn(c) ? "" : template[c] || ""));

  rows.push(row);
  rowKeys.push("");
  // A new case has no priority or title yet; filters would hide it on arrival.
  clearFilters();
  sel = { r: rows.length - 1, c: firstEditableColumn() };
  renderCurrentView();
  describe();
  syncState();

  if (viewMode === "sheet") {
    select(rows.length - 1, firstEditableColumn());
  } else {
    openPanel(rows.length - 1);
  }
}

// Deleting is immediate; the toast's Undo puts the case back where it was.
function deleteRow(r) {
  const row = rows[r];
  if (!row) return;

  if (editor) endEdit(false);
  closeChoice();
  if (panelIndex === r) {
    closePanel();
  } else if (panelIndex != null && panelIndex > r) {
    panelIndex--;
    panelNum.textContent = `Case ${panelIndex + 1}`;
  }

  const key = rowKeys[r];
  rows.splice(r, 1);
  rowKeys.splice(r, 1);
  renderCurrentView();
  renderFilters();
  describe();
  syncState();

  const name = String(row[titleColumn()] || "").trim();
  const what = name ? `“${name.slice(0, 60)}${name.length > 60 ? "…" : ""}”` : `case ${r + 1}`;
  if (typeof toast !== "function") return;
  toast(`Deleted ${what}`, {
    action: "Undo",
    timeout: 8000,
    onAction: () => {
      const at = Math.min(r, rows.length);
      rows.splice(at, 0, row);
      rowKeys.splice(at, 0, key);
      if (panelIndex != null && panelIndex >= at) {
        panelIndex++;
        panelNum.textContent = `Case ${panelIndex + 1}`;
      }
      renderCurrentView();
      renderFilters();
      describe();
      syncState();
    },
  });
}

// --- Save ---

async function save() {
  if (saving) return false;
  if (!isDirty()) return true;

  saving = true;
  saveBtn.textContent = "Saving…";
  syncState();

  try {
    const resp = await fetch(`/api/requests/${requestId}/cases`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns, rows, rowKeys }),
    });
    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}));
      throw new Error(detail.error || `Save failed (${resp.status})`);
    }

    const result = await resp.json();
    if (Array.isArray(result.rows)) rows = result.rows;
    if (Array.isArray(result.columns)) columns = result.columns;
    if (Array.isArray(result.rowKeys)) rowKeys = result.rowKeys;
    if (Array.isArray(result.editableColumns)) {
      editableColumns = new Set(result.editableColumns);
    }
    baseline = JSON.stringify(rows);
    lastSavedAt = result.savedAt;
    outputFile = result.outputFile;
    saveFailed = false;
    // The drawer's fields are live controls; re-rendering behind it is enough.
    if (panelIndex == null) renderCurrentView();
    renderFilters();
    describe();
    hideAlert();
    return true;
  } catch (err) {
    saveFailed = true;
    say(`Could not save: ${err.message}`, "error");
    return false;
  } finally {
    saving = false;
    saveBtn.textContent = "Save";
    syncState();
  }
}

async function handleDownload() {
  if (!requestId || saving || downloadBtn.disabled) return;

  // The download reads the saved CSV, so unsaved edits are saved first.
  if (isDirty() && !(await save())) return;

  const originalHtml = downloadBtn.innerHTML;
  downloadBtn.disabled = true;
  downloadBtn.textContent = "Downloading…";

  try {
    const resp = await fetch(`/api/requests/${requestId}/testrail`);
    if (!resp.ok) throw new Error("Download failed");
    const disposition = resp.headers.get("Content-Disposition") || "";
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const ascii = disposition.match(/filename="(.+?)"/);
    const fallback = `${requestId}_testrail.csv`;
    const filename = utf8 ? decodeURIComponent(utf8[1]) : ascii ? ascii[1] : fallback;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    say(`Could not download CSV: ${err.message}`, "error");
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = originalHtml;
  }
}

async function handleUpload() {
  if (!requestId || saving) return;

  // The upload reads the saved CSV, so unsaved edits would silently be left out.
  if (isDirty() && !(await save())) return;

  openUploadDialog(requestId);
}

async function handleShare() {
  if (!requestId || saving) return;
  // Share P0 reads the saved CSV, so unsaved priority changes would be missed.
  if (isDirty() && !(await save())) return;
  openShareP0([requestId]);
}

// --- Boot ---

async function loadRequest(id) {
  const data = await getJSON(`/api/requests/${id}/cases`);

  requestId = data.id;
  columns = data.columns;
  rows = data.rows;
  rowKeys = Array.isArray(data.rowKeys) ? data.rowKeys.slice() : [];
  while (rowKeys.length < rows.length) rowKeys.push("");
  rowKeys.length = rows.length;
  editableColumns = Array.isArray(data.editableColumns)
    ? new Set(data.editableColumns)
    : null;
  baseline = JSON.stringify(rows);
  outputFile = data.outputFile;
  lastSavedAt = data.editedAt;
  renderUploadBadge(data.testrailUploads);

  titleEl.textContent = data.label || outputFile || "Test cases";
  document.title = `${titleEl.textContent} — TC Queue`;
  if (crumbCurrent) {
    crumbCurrent.textContent = data.label || data.id || "…";
  }
  describe();

  if (!columns.length) {
    say("This result file has no header row, so there is nothing to edit.", "warn");
    return;
  }

  downloadBtn.hidden = false;
  uploadBtn.hidden = false;
  shareBtn.hidden = false;
  toolbarEl.hidden = false;
  bodyEl.hidden = false;
  renderToggle();
  renderFilters();
  renderCurrentView();
  syncState();
}

// The index of every sheet: the same ledger, header and search as the Queue, so
// this reads as one of its views rather than a second product. The editor's own
// header steps aside — its title and Save button belong to a sheet, not a list.
function showIndex() {
  headEl.hidden = true;
  toolbarEl.hidden = true;
  bodyEl.hidden = true;
  picker.hidden = false;
  picker.textContent = "";
  document.body.classList.add("is-index");
}

function renderIndexEmpty() {
  showIndex();
  const head = document.createElement("header");
  head.className = "page-head";
  head.innerHTML = '<div class="page-head-main"><h1 class="page-title">Test cases</h1></div>';
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.innerHTML =
    '<p class="empty-title">No test cases yet</p>' +
    '<p class="empty-text">Create or analyze test cases from the queue. ' +
    "Finished sheets show up here to review, edit and sync to TestRail.</p>" +
    '<p class="empty-cta"><a class="btn btn-primary" href="/new">New request</a></p>';
  picker.append(head, empty);
}

function renderPicker(items, all) {
  showIndex();

  const chrome = listChrome({
    mount: picker,
    title: "Test cases",
    placeholder: "Search case sheets",
    onQuery: (value) => {
      ledger.setQuery(value);
      draw();
    },
  });

  const bar = mountFilterBar({ mount: chrome.filters, view: "cases", records: all, onChange: draw });

  const ledger = createLedger({
    mount: chrome.list,
    view: "cases",
    records: items,
    // Every row here is a case sheet, so every row can go into Share P0.
    selectable: () => true,
    onError: (message) => say(message, "error"),
  });
  ledger.setData(items);
  ledger.onSortChange = draw;

  const shareBar = mountShareBar({ mount: chrome.toolbar, onClear: () => ledger.clearSelection() });
  ledger.onSelectionChange = (ids) => shareBar.update(ids);

  function draw() {
    const shown = ledger.render();
    chrome.empty.hidden = shown.length > 0;
    if (!shown.length) {
      renderNoMatch({
        empty: chrome.empty,
        noun: "case sheets",
        query: chrome.search.value.trim(),
        onClear: () => {
          chrome.search.value = "";
          ledger.setQuery("");
          clearFacets();
          bar.render();
          draw();
        },
      });
    }
    chrome.tally.textContent =
      shown.length === items.length
        ? plural(items.length, "sheet")
        : `${shown.length} of ${items.length}`;
  }

  mountRail({ view: "cases", records: all });
  draw();
}

if (addBtnToolbar) addBtnToolbar.addEventListener("click", addRow);
if (saveBtn) saveBtn.addEventListener("click", save);
if (downloadBtn) downloadBtn.addEventListener("click", handleDownload);
if (uploadBtn) uploadBtn.addEventListener("click", handleUpload);
if (shareBtn) shareBtn.addEventListener("click", handleShare);
if (copyBtn) copyBtn.addEventListener("click", () => copyText(pathEl.textContent, "source path"));

if (panel) {
  panelClose.addEventListener("click", closePanel);
  panelDone.addEventListener("click", closePanel);
  panelDelete.addEventListener("click", () => deleteRow(panelIndex));
  panelPrev.addEventListener("click", () => {
    const { prev } = panelNeighbours();
    if (prev != null) openPanel(prev);
  });
  panelNext.addEventListener("click", () => {
    const { next } = panelNeighbours();
    if (next != null) openPanel(next);
  });
  panel.addEventListener("close", panelClosed);
  // A click on the backdrop lands on the dialog itself.
  panel.addEventListener("click", (e) => {
    if (e.target === panel) closePanel();
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    listQuery = searchInput.value.toLowerCase().trim();
    renderCurrentView();
  });
}

tbody.addEventListener("keydown", onGridKey);

tbody.addEventListener("click", (e) => {
  const open = e.target.closest(".c-open");
  if (open) {
    openPanel(Number(open.closest(".c-row").dataset.row));
    return;
  }
  const td = e.target.closest(".c-cell");
  if (!td) return;

  const r = Number(td.dataset.r);
  const c = Number(td.dataset.c);
  // A click on the cell that already has the selection opens it, so a cell can be
  // edited by clicking it twice as well as by typing into it.
  const reselecting = sel && sel.r === r && sel.c === c;
  select(r, c);
  if (reselecting) beginEdit();
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (editor) endEdit(true);
    if (requestId) save();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (!isDirty()) return;
  e.preventDefault();
  e.returnValue = "";
});

(async function boot() {
  const id = new URLSearchParams(location.search).get("id");
  wirePopover(el("ct-keys-wrap"), el("ct-keys"), el("ct-keys-pop"));

  try {
    if (id) {
      await loadRequest(id);
      return;
    }

    // Opened without a request — show the index. Which requests have a sheet is
    // the rail's own Cases predicate, imported rather than restated so the count
    // in the rail can never disagree with the rows in the table.
    const all = await loadRequests();
    const items = all.filter(VIEWS.find((v) => v.id === "cases").match);

    if (!items.length) {
      mountRail({ view: "cases", records: all });
      renderIndexEmpty();
      return;
    }

    renderPicker(items, all);
  } catch (err) {
    subEl.textContent = "";
    say(err.message, "error");
  }
})();
