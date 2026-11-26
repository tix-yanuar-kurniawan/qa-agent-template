// The Queue view: the ledger over every request, narrowed by the status pills,
// the filter bar and the search field.
//
// Polling re-renders only when the data actually changed, so a status flipping
// to done swaps in place instead of rebuilding the table under the pointer. The
// rail is mounted once; polls patch its counts.

import {
  mountRail, updateRailCounts, loadRequests, clearFacets, listChrome,
  mountStatusPills, mountFilterBar, renderNoMatch, toast, VIEWS,
} from "./shell.js";
import { createLedger, labelFor } from "./ledger.js";
import { mountShareBar } from "./share-p0.js";

const POLL_MS = 3000;
// How long a deleted row waits for Undo before the files are really removed.
const UNDO_MS = 5000;

const main = document.getElementById("q-main");

// Set when the composer hands back after a submit, so the new row is findable
// in a table of 69 without hunting for it. The tint stays for this visit; the
// query parameter goes, so a reload or a shared link does not replay it.
const highlightId = new URLSearchParams(location.search).get("new");
let highlightHandled = !highlightId;

let records = [];
let signature = "";
let loaded = false;
let polling = false;

// Rows deleted but still inside their Undo window, and rows whose DELETE went
// through but a poll in flight may still report.
const deleting = new Map();
const removed = new Set();

const shown = () => records.filter((r) => !deleting.has(r.id) && !removed.has(r.id));

mountRail({ view: "queue" });

const chrome = listChrome({
  mount: main,
  title: "Queue",
  placeholder: "Search requests",
  onQuery: (value) => {
    ledger.setQuery(value);
    render();
  },
});

// Unreachable server is a standing condition, not an event: it stays up until
// a poll succeeds. Action failures are toasts and polls never touch them.
const offline = document.createElement("div");
offline.className = "alert q-offline";
offline.dataset.tone = "error";
offline.setAttribute("role", "alert");
offline.hidden = true;
offline.textContent = "Can't reach the queue server — retrying";
chrome.list.before(offline);

const ledger = createLedger({
  mount: chrome.list,
  view: "queue",
  expandable: true,
  // Rows with a case sheet can be picked for Share P0.
  selectable: VIEWS.find((v) => v.id === "cases").match,
  onError: (message) => toast(message, { tone: "error" }),
});

const shareBar = mountShareBar({ mount: chrome.toolbar, onClear: () => ledger.clearSelection() });
ledger.onSelectionChange = (ids) => shareBar.update(ids);

const pills = mountStatusPills({ mount: chrome.pills, records: [], onChange: render });
const filters = mountFilterBar({
  mount: chrome.filters,
  view: "queue",
  records: [],
  skip: ["status"],
  onChange: render,
});

// ---- Delete with Undo ----

ledger.setDelete((r) => {
  const timer = setTimeout(() => commitDelete(r.id), UNDO_MS);
  deleting.set(r.id, { record: r, timer });
  apply();
  toast(`Deleted “${labelFor(r)}”`, {
    action: "Undo",
    timeout: UNDO_MS,
    onAction: () => undoDelete(r.id),
  });
  return true;
});

function undoDelete(id) {
  const entry = deleting.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  deleting.delete(id);
  apply();
  main.querySelector(`tr.row[data-id="${CSS.escape(id)}"]`)?.focus();
}

async function commitDelete(id) {
  const entry = deleting.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  try {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    removed.add(id);
    deleting.delete(id);
  } catch {
    deleting.delete(id);
    toast(`Couldn't delete “${labelFor(entry.record)}”. It's back in the queue.`, { tone: "error" });
  }
  apply();
}

// Leaving the page inside the Undo window still deletes: the toast said so.
addEventListener("pagehide", () => {
  for (const id of deleting.keys()) {
    fetch(`/api/requests/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true });
    removed.add(id);
  }
  for (const { timer } of deleting.values()) clearTimeout(timer);
  deleting.clear();
});

// ---- Render ----

function renderNothingYet() {
  chrome.empty.innerHTML =
    '<p class="empty-title">Nothing here yet</p>' +
    '<p class="empty-text">Start a request and it lands in this table. Paste a Jira link to ' +
    "generate test cases, analyze a CSV or capture knowledge.</p>" +
    '<p class="empty-cta"><a class="btn btn-primary" href="/new">New request</a></p>';
}

function stripNewParam() {
  const q = new URLSearchParams(location.search);
  q.delete("new");
  const search = q.toString();
  history.replaceState(null, "", search ? `${location.pathname}?${search}` : location.pathname);
}

function render() {
  const all = shown();
  const items = ledger.render({ highlightId });

  // An empty queue and a filter that matched nothing are different problems
  // and need different recoveries. Before the first good poll it is neither.
  chrome.empty.hidden = !loaded || items.length > 0;
  if (loaded && !items.length) {
    if (!all.length) {
      renderNothingYet();
    } else {
      renderNoMatch({
        empty: chrome.empty,
        noun: "requests",
        query: chrome.search.value.trim(),
        onClear: () => {
          chrome.search.value = "";
          ledger.setQuery("");
          clearFacets();
          pills.update(shown());
          filters.render();
          render();
          chrome.search.focus();
        },
      });
    }
  }

  const total = all.length;
  const pending = all.filter((r) => r.status === "pending").length;
  const bits = loaded
    ? [items.length === total ? `${total} request${total === 1 ? "" : "s"}` : `${items.length} of ${total}`]
    : [];
  if (pending) bits.push(`${pending} pending`);
  chrome.tally.textContent = bits.join(" · ");

  if (loaded && !highlightHandled) {
    highlightHandled = true;
    main.querySelector(".row-new")?.scrollIntoView({ block: "center" });
    stripNewParam();
  }
}

ledger.onSortChange = render;

// Push the current records into everything that counts or lists them.
function apply() {
  const all = shown();
  ledger.setData(all);
  shareBar.update(ledger.selected());
  updateRailCounts(all);
  pills.update(all);
  filters.update(all);
  render();
}

// ---- Polling ----

async function refresh() {
  if (polling) return;
  polling = true;
  try {
    let next;
    try {
      next = await loadRequests({ fresh: true });
    } catch {
      offline.hidden = false;
      return;
    }
    offline.hidden = true;

    const sig = JSON.stringify(next);
    if (loaded && sig === signature) return;
    // An open row menu would be torn down under the pointer; leave the
    // signature stale so the next poll picks the change up instead.
    if (loaded && ledger.isInteracting()) return;

    signature = sig;
    records = next;
    loaded = true;
    for (const id of removed) if (!next.some((r) => r.id === id)) removed.delete(id);
    apply();
  } finally {
    polling = false;
  }
}

await refresh();

setInterval(() => {
  if (!document.hidden) refresh();
}, POLL_MS);

// A tab that was in the background catches up the moment it is looked at.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
