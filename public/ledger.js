// One table, three configurations.
//
// Queue and Cases are the same ruled ledger over the same request index,
// differing only in their predicate and their columns. That is what lets the
// rail's saved views read as places while behaving as filters — and it is why
// none of the three is a grid of cards.

import {
  esc, timeAgo, shortDate, monthKey, monthLabel, applyFacets, readFacets,
  typeChip, statusBadge,
  wirePopover, closePopover, copyText, announce, toast,
} from "./shell.js";
import { openShareP0 } from "./share-p0.js";

const DOTS =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">' +
  '<circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>';

// What the artifacts cell says while there is nothing to open yet.
const WAITING_TEXT = {
  pending: "Waiting for /run-it",
  processing: "Claude is working…",
  error: "No output",
};

// The first eight hex digits of the UUID, git-style: unique across the queue and
// short enough to type after `/run-it`, which accepts any unique prefix.
export function shortId(r) {
  return String(r.id || "").slice(0, 8);
}

export function labelFor(r) {
  return (
    r.label ||
    (r.description || "").slice(0, 80) ||
    (r.attachments && r.attachments[0] && r.attachments[0].originalName) ||
    "Untitled request"
  );
}

// The meta line carries whatever the row's columns do not. `shown` is the set of
// column keys in this view, so a fact that earned a column of its own is not
// also repeated beside the label.
function metaBits(r, shown = new Set()) {
  const parts = [];
  if (r.hasInputCsv) parts.push("CSV");
  if (r.attachments && r.attachments.length) {
    parts.push(`${r.attachments.length} file${r.attachments.length > 1 ? "s" : ""}`);
  }
  if (r.type === "knowledge" && r.knowledgeKey) parts.push(`→ ${r.knowledgeKey}`);
  if (r.casesEditedAt) parts.push("Edited");
  if (r.downloaded) parts.push("Downloaded");
  if (r.caseCount != null) {
    const bits = [`${r.caseCount} case${r.caseCount === 1 ? "" : "s"}`];
    const pc = r.priorityCounts || {};
    for (const key of ["p0", "p1", "p2", "p3"]) {
      if (pc[key]) bits.push(`${pc[key]} ${key.toUpperCase()}`);
    }
    parts.push(bits.join(", "));
  }
  return parts.join(" · ");
}

export function detailFor(r) {
  return r.description || "No description.";
}

// Where a finished request opens: its sheet.
function hrefFor(r) {
  if (r.type === "create" || r.type === "analyze") return `/cases?id=${encodeURIComponent(r.id)}`;
  return null;
}

// Which downloads a finished request offers: a TestRail CSV for create and
// analyze, a markdown note for knowledge.
function downloadsFor(r) {
  if (r.type === "knowledge") {
    return [{ label: "Download note", short: "Note", endpoint: "knowledge", fallback: `${r.id}.md` }];
  }
  return [{ label: "Download TestRail CSV", short: "CSV", endpoint: "testrail", fallback: `${r.id}_testrail.csv` }];
}

// The visible action plus whatever goes behind the ⋯ menu. Opening the sheet
// comes first because that is what a finished row is for; downloads follow.
function actionsFor(r) {
  const actions = [];
  const href = hrefFor(r);
  if (href) actions.push({ label: "Open cases", short: "Cases", href });
  for (const spec of downloadsFor(r)) actions.push({ ...spec, download: true });
  // A sheet whose P0 count is known to be zero has nothing to share.
  if (href && (!r.priorityCounts || r.priorityCounts.p0)) {
    actions.push({ label: "Share P0", short: "P0", run: () => openShareP0([r.id]) });
  }
  return actions;
}

async function download(spec, id, busy, onError) {
  busy.disabled = true;
  busy.classList.add("is-loading");
  busy.setAttribute("aria-busy", "true");
  try {
    const resp = await fetch(`/api/requests/${id}/${spec.endpoint}`);
    if (!resp.ok) throw new Error("Download failed");
    const disposition = resp.headers.get("Content-Disposition") || "";
    // Prefer the RFC 6266 `filename*`, which carries the real UTF-8 name; the
    // plain `filename` is an ASCII fallback with characters replaced.
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const ascii = disposition.match(/filename="(.+?)"/);
    const filename = utf8 ? decodeURIComponent(utf8[1]) : ascii ? ascii[1] : spec.fallback;
    const url = URL.createObjectURL(await resp.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    announce(`Downloaded ${filename}`);
  } catch {
    onError(`Couldn't ${spec.label.toLowerCase()}. The file may no longer be on disk.`);
  } finally {
    busy.disabled = false;
    busy.classList.remove("is-loading");
    busy.removeAttribute("aria-busy");
  }
}

// ---- Cells ----

const cell = {
  status: (r) => statusBadge(r.status),

  // The chip carries a short code in data-short, which is what it falls back to
  // on a phone, where a spelled-out type would cost the label its width.
  type: (r) => typeChip(r.type),

  // A button so it can be copied without expanding the row; the row's toggle
  // ignores clicks that land on a button.
  id: (r, shown, state) =>
    `<button type="button" class="row-id" data-copy="${esc(shortId(r))}" data-focus="id"` +
    (state.copied ? ' data-copied="true"' : "") +
    ` title="Copy ID — run just this request with /run-it ${esc(shortId(r))}">` +
    `${state.copied ? "Copied" : esc(shortId(r))}</button>`,

  // Wrapped in .label-line so the cell itself stays a table cell: a flex cell
  // cannot be vertically centred by `vertical-align`. On Cases the name
  // is a real link, so middle-click and "open in new tab" work.
  label: (r, shown, state) => {
    const meta = metaBits(r, shown);
    const name = state.href
      ? `<a class="row-label" href="${esc(state.href)}" data-focus="label">${esc(labelFor(r))}</a>`
      : `<span class="row-label">${esc(labelFor(r))}</span>`;
    return (
      '<span class="label-line">' +
      name +
      (meta ? `<span class="row-meta">${esc(meta)}</span>` : "") +
      "</span>"
    );
  },

  date: (r) =>
    `<time datetime="${esc(r.createdAt)}" title="${esc(timeAgo(r.createdAt))}">${esc(shortDate(r.createdAt))}</time>`,
};

const COLUMN = {
  status: { key: "status", cls: "col-status", label: "Status", render: cell.status },
  type: { key: "type", cls: "col-type", label: "Type", sortable: true, render: cell.type },
  id: { key: "id", cls: "col-id", label: "ID", render: cell.id },
  label: { key: "label", cls: "col-label", label: "Request", sortable: true, render: cell.label },
  date: { key: "date", cls: "col-date", label: "Added", sortable: true, render: cell.date },
  artifacts: { key: "artifacts", cls: "col-art", label: "Artifacts" },
};

// A column has to earn its width by varying. `only` is the rule: drop the column
// when the data holds one distinct value, because a column of 55 identical
// chips costs the label real width and tells the eye nothing. It is the same
// rule the filter bar uses to hide a single-value facet group.
//
// Status obeys it structurally rather than dynamically: every Cases row
// is finished by definition, so it is never in that view's column set at all.
const only = (fn) => (records) => new Set(records.map(fn).filter(Boolean)).size > 1;

const VIEW_COLUMNS = {
  queue: [COLUMN.status, COLUMN.type, COLUMN.id, COLUMN.label, COLUMN.date, COLUMN.artifacts],
  cases: [
    { ...COLUMN.type, when: only((r) => r.type) },
    { ...COLUMN.label, label: "Sheet" },
    COLUMN.date,
    COLUMN.artifacts,
  ],
};

export function columnsFor(view, records = []) {
  return VIEW_COLUMNS[view].filter((col) => !col.when || col.when(records));
}

// ---- Table ----

// `records` is accepted up front because the column set depends on the data:
// the head is built once, so it has to know what varies before it is drawn.
//
// `selectable` is a predicate: rows it accepts get a checkbox, and the page reads
// the picked IDs through `selected()` (Share P0 works on several sheets at once).
export function createLedger({
  mount, view, onError, expandable = false, records: initial = [], selectable = null,
}) {
  const columns = [
    ...(selectable ? [{ key: "select", cls: "col-select", label: "Select" }] : []),
    ...columnsFor(view, initial),
  ];
  const shown = new Set(columns.map((col) => col.key));
  // The detail row hangs off the request name, so it indents by spanning every
  // column before the label. The table does the arithmetic, at every width.
  const labelIndex = columns.findIndex((col) => col.key === "label");
  const reportError = onError || ((message) => toast(message, { tone: "error" }));

  const wrap = document.createElement("div");
  wrap.className = "ledger-wrap";

  const panel = document.createElement("div");
  panel.className = "panel ledger-panel";

  const table = document.createElement("table");
  table.className = "ledger";
  table.dataset.view = view;

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.className = col.cls;
    th.scope = "col";
    if (col.key === "select") {
      th.innerHTML = '<input type="checkbox" class="row-check-all" aria-label="Select all shown case sheets">';
    } else if (col.sortable) {
      // The visible text can drop at narrow widths; the aria-label cannot.
      th.innerHTML =
        `<button type="button" class="col-sort" data-sort="${col.key}" aria-label="Sort by ${col.label}">` +
        `<span class="col-sort-text">${col.label}</span></button>`;
    } else {
      th.innerHTML = `<span class="col-head"><span class="col-head-text">${col.label}</span></span>`;
    }
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  table.append(thead, tbody);
  panel.appendChild(table);
  wrap.appendChild(panel);
  mount.appendChild(wrap);

  const expanded = new Set();
  // IDs whose copy button is showing "Copied", so a poll that re-renders inside
  // the 1.2s does not cut the confirmation short.
  const copied = new Map();
  let records = initial;
  let query = "";
  let sort = { key: "date", dir: "desc" };
  let onDelete = null;
  const picked = new Set();
  let shownItems = [];

  function sorted(items) {
    const dir = sort.dir === "asc" ? 1 : -1;
    const by = {
      date: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      type: (a, b) => a.type.localeCompare(b.type),
      label: (a, b) => labelFor(a).localeCompare(labelFor(b)),
    }[sort.key];
    return by ? [...items].sort((a, b) => by(a, b) * dir) : [...items];
  }

  function artifactCell(r) {
    const td = document.createElement("td");
    td.className = "col-art";
    if (r.status !== "done") {
      td.innerHTML = `<span class="art-none">${esc(WAITING_TEXT[r.status] || r.status)}</span>`;
      return td;
    }

    const actions = actionsFor(r);
    if (!actions.length) {
      td.innerHTML = '<span class="art-none">—</span>';
      return td;
    }

    const group = document.createElement("div");
    group.className = "art-group";

    // The first action is a real button with a short label for phones; the full
    // label stays its accessible name.
    const [first, ...rest] = actions;
    const primary = document.createElement(first.href ? "a" : "button");
    primary.className = "btn btn-sm art-primary";
    primary.dataset.focus = "primary";
    primary.setAttribute("aria-label", first.label);
    primary.innerHTML =
      `<span class="art-long" aria-hidden="true">${esc(first.label)}</span>` +
      `<span class="art-short" aria-hidden="true">${esc(first.short)}</span>`;
    if (first.href) {
      primary.href = first.href;
    } else {
      primary.type = "button";
      primary.addEventListener("click", () => download(first, r.id, primary, reportError));
    }
    group.appendChild(primary);

    // Everything else sits behind ⋯ at every width, so a download never vanishes
    // because the window got narrow.
    if (rest.length) {
      const menu = document.createElement("div");
      menu.className = "menu-wrap";
      const more = document.createElement("button");
      more.type = "button";
      more.className = "icon-btn art-more";
      more.dataset.focus = "more";
      more.setAttribute("aria-label", `More actions for ${labelFor(r)}`);
      more.innerHTML = DOTS;
      const pop = document.createElement("div");
      pop.className = "popover popover-right";
      pop.dataset.focus = "more";
      pop.hidden = true;
      for (const spec of rest) {
        const item = document.createElement(spec.href ? "a" : "button");
        item.className = "menu-item";
        item.textContent = spec.label;
        if (spec.href) {
          item.href = spec.href;
        } else {
          item.type = "button";
          item.addEventListener("click", () => {
            closePopover();
            more.focus();
            if (spec.run) spec.run();
            else download(spec, r.id, more, reportError);
          });
        }
        pop.appendChild(item);
      }
      menu.append(more, pop);
      wirePopover(menu, more, pop);
      group.appendChild(menu);
    }

    td.appendChild(group);
    return td;
  }

  function renderRow(r, highlightId) {
    const tr = document.createElement("tr");
    tr.className = "row";
    tr.dataset.id = r.id;
    tr.dataset.focus = "row";
    if (r.id === highlightId) tr.classList.add("row-new");

    const href = expandable ? null : `/cases?id=${encodeURIComponent(r.id)}`;
    const state = { href, copied: copied.has(r.id) };

    for (const col of columns) {
      if (col.key === "select") {
        const td = document.createElement("td");
        td.className = col.cls;
        if (selectable(r)) {
          td.innerHTML =
            `<input type="checkbox" class="row-check" data-focus="check"${picked.has(r.id) ? " checked" : ""}` +
            ` aria-label="Select ${esc(labelFor(r))}">`;
        }
        tr.appendChild(td);
        continue;
      }
      if (col.key === "artifacts") {
        tr.appendChild(artifactCell(r));
        continue;
      }
      const td = document.createElement("td");
      td.className = col.cls;
      td.innerHTML = col.render(r, shown, state);
      tr.appendChild(td);
    }

    if (expandable) {
      const open = expanded.has(r.id);
      tr.tabIndex = 0;
      tr.setAttribute("aria-expanded", String(open));
      tr.setAttribute("aria-controls", `detail-${r.id}`);
      const toggle = () => {
        if (expanded.has(r.id)) expanded.delete(r.id);
        else expanded.add(r.id);
        api.render();
        tbody.querySelector(`tr.row[data-id="${CSS.escape(r.id)}"]`)?.focus();
      };
      tr.addEventListener("click", (e) => {
        if (e.target.closest("a, button, .popover, .col-select")) return;
        toggle();
      });
      tr.addEventListener("keydown", (e) => {
        if (e.target !== tr) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    } else {
      // On Cases the row's whole job is to open the artifact. The name
      // is the link keyboard and middle-click use; the rest of the row is just a
      // bigger target for the pointer.
      tr.addEventListener("click", (e) => {
        if (e.target.closest("a, button, .popover, .col-select")) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else location.href = href;
      });
    }

    return tr;
  }

  function renderDetail(r) {
    const tr = document.createElement("tr");
    tr.className = "row-detail";
    tr.id = `detail-${r.id}`;
    tr.dataset.id = r.id;

    if (labelIndex > 0) {
      const spacer = document.createElement("td");
      spacer.className = "detail-gutter";
      spacer.colSpan = labelIndex;
      tr.appendChild(spacer);
    }

    const td = document.createElement("td");
    td.className = "detail-cell";
    td.colSpan = columns.length - Math.max(labelIndex, 0);

    const body = document.createElement("div");
    body.className = "detail-body";
    body.textContent = detailFor(r);
    td.appendChild(body);

    if (onDelete) {
      const actions = document.createElement("div");
      actions.className = "detail-actions";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-sm btn-danger";
      del.dataset.focus = "delete";
      del.textContent = "Delete request";
      // Deleting the files under a running skill would strand it mid-write.
      if (r.status === "processing") {
        del.disabled = true;
        del.title = "Can't delete while Claude is working on it";
      }
      del.addEventListener("click", () => {
        // The row leaves the table now; focus goes to its neighbour rather than
        // falling back to the top of the page.
        const row = tbody.querySelector(`tr.row[data-id="${CSS.escape(r.id)}"]`);
        let next = tr.nextElementSibling;
        while (next && !next.classList.contains("row")) next = next.nextElementSibling;
        let prev = row && row.previousElementSibling;
        while (prev && !prev.classList.contains("row")) prev = prev.previousElementSibling;
        const neighbour = (next || prev)?.dataset.id;

        expanded.delete(r.id);
        onDelete(r);
        if (neighbour) tbody.querySelector(`tr.row[data-id="${CSS.escape(neighbour)}"]`)?.focus();
      });
      actions.appendChild(del);
      td.appendChild(actions);
    }

    tr.appendChild(td);
    return tr;
  }

  function monthRow(key, count) {
    const tr = document.createElement("tr");
    tr.className = "month-row";
    const th = document.createElement("th");
    th.colSpan = columns.length;
    th.scope = "colgroup";
    th.innerHTML = `<span>${esc(monthLabel(key))}</span><span class="month-count">${count}</span>`;
    tr.appendChild(th);
    return tr;
  }

  // A re-render replaces every row, so whatever had focus inside the table is
  // found again by row ID and role afterwards.
  function focusedTarget() {
    const active = document.activeElement;
    if (!active || !tbody.contains(active)) return null;
    const row = active.closest("tr[data-id]");
    const role = active.dataset.focus || active.closest("[data-focus]")?.dataset.focus;
    return row && role ? { id: row.dataset.id, role } : null;
  }

  function restoreFocus(target) {
    if (!target) return;
    const sel = `tr[data-id="${CSS.escape(target.id)}"]`;
    const el =
      target.role === "row"
        ? tbody.querySelector(`${sel}.row`)
        : tbody.querySelector(`${sel} [data-focus="${target.role}"]`);
    el?.focus();
  }

  const api = {
    get expandedSet() {
      return expanded;
    },

    setData(next) {
      records = next;
    },

    setQuery(next) {
      query = (next || "").trim().toLowerCase();
    },

    setDelete(fn) {
      onDelete = fn;
    },

    onSelectionChange: null,

    /** Picked IDs still in the data, in the order the table shows them. */
    selected() {
      const order = new Map(shownItems.map((r, i) => [r.id, i]));
      return records
        .filter((r) => picked.has(r.id) && selectable && selectable(r))
        .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
        .map((r) => r.id);
    },

    clearSelection() {
      picked.clear();
      api.render();
      selectionChanged();
    },

    onSortChange: null,

    /** True while a row's ⋯ menu is open, so a poll can hold its re-render. */
    isInteracting() {
      return Boolean(tbody.querySelector(".popover:not([hidden])"));
    },

    visible() {
      let items = applyFacets(records, readFacets());
      if (query) {
        items = items.filter(
          (r) =>
            (r.id || "").toLowerCase().startsWith(query) ||
            (r.label || "").toLowerCase().includes(query) ||
            (r.description || "").toLowerCase().includes(query),
        );
      }
      return sorted(items);
    },

    render({ highlightId = null } = {}) {
      const items = api.visible();
      const focus = focusedTarget();
      // A row's open menu is about to be destroyed; release it so the shared
      // popover state does not hold a detached node.
      if (api.isInteracting()) closePopover();
      tbody.innerHTML = "";
      wrap.hidden = items.length === 0;

      // Month dividers are an artifact of chronology, so they exist only under
      // the date sort. Any other sort would scatter them incoherently.
      const grouped = sort.key === "date";
      const perMonth = new Map();
      if (grouped) {
        for (const r of items) {
          const key = monthKey(r.createdAt);
          perMonth.set(key, (perMonth.get(key) || 0) + 1);
        }
      }
      let lastMonth = null;

      for (const r of items) {
        if (grouped) {
          const key = monthKey(r.createdAt);
          if (key !== lastMonth) {
            lastMonth = key;
            tbody.appendChild(monthRow(key, perMonth.get(key)));
          }
        }
        tbody.appendChild(renderRow(r, highlightId));
        if (expandable && expanded.has(r.id)) tbody.appendChild(renderDetail(r));
      }

      for (const btn of headRow.querySelectorAll(".col-sort")) {
        const active = btn.dataset.sort === sort.key;
        btn.dataset.active = String(active);
        btn.closest("th").setAttribute(
          "aria-sort",
          active ? (sort.dir === "asc" ? "ascending" : "descending") : "none",
        );
      }

      shownItems = items;
      syncCheckAll();
      restoreFocus(focus);
      return items;
    },
  };

  // Click-to-copy on the ID. It flashes "Copied" for 1.2s and announces the ID;
  // a failure is a toast from copyText. It never toggles the row.
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".row-id");
    if (!btn) return;
    e.stopPropagation();
    const id = btn.closest("tr").dataset.id;
    const text = btn.dataset.copy;
    if (!(await copyText(text, text))) return;

    clearTimeout(copied.get(id));
    const current = () => tbody.querySelector(`tr.row[data-id="${CSS.escape(id)}"] .row-id`);
    const live = current();
    if (live) {
      live.textContent = "Copied";
      live.dataset.copied = "true";
    }
    copied.set(
      id,
      setTimeout(() => {
        copied.delete(id);
        const el = current();
        if (!el) return;
        el.textContent = el.dataset.copy;
        delete el.dataset.copied;
      }, 1200),
    );
  });

  function syncCheckAll() {
    const all = headRow.querySelector(".row-check-all");
    if (!all) return;
    const eligible = shownItems.filter(selectable);
    const on = eligible.filter((r) => picked.has(r.id)).length;
    all.disabled = !eligible.length;
    all.checked = eligible.length > 0 && on === eligible.length;
    all.indeterminate = on > 0 && on < eligible.length;
  }

  function selectionChanged() {
    syncCheckAll();
    if (api.onSelectionChange) api.onSelectionChange(api.selected());
  }

  tbody.addEventListener("change", (e) => {
    const box = e.target.closest(".row-check");
    if (!box) return;
    const id = box.closest("tr").dataset.id;
    if (box.checked) picked.add(id);
    else picked.delete(id);
    selectionChanged();
  });

  headRow.addEventListener("change", (e) => {
    if (!e.target.classList.contains("row-check-all")) return;
    for (const r of shownItems.filter(selectable)) {
      if (e.target.checked) picked.add(r.id);
      else picked.delete(r.id);
    }
    api.render();
    selectionChanged();
  });

  headRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".col-sort");
    if (!btn) return;
    const key = btn.dataset.sort;
    if (sort.key === key) sort = { key, dir: sort.dir === "asc" ? "desc" : "asc" };
    else sort = { key, dir: key === "date" ? "desc" : "asc" };
    if (api.onSortChange) api.onSortChange();
    else api.render();
  });

  return api;
}
