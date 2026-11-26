// The app rail, list chrome, filter bar and the small shared helpers.
//
// The views read as places — each keeps its own route and can be linked to —
// but each is really a predicate over the same request index. These predicates
// are the single source of truth; the pages import them rather than restating
// their own filters.

const ICON = {
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  mark: '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="M5.5 6.5h5M5.5 9h5M5.5 11.5h3"/>',
  queue: '<path d="M2.5 4h11M2.5 8h11M2.5 12h7"/>',
  cases: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6.5h11M6.5 6.5v7"/>',
  caret: '<path d="M4 6.5l4 4 4-4"/>',
};

function icon(name) {
  return (
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    ICON[name] +
    "</svg>"
  );
}

export const VIEWS = [
  {
    id: "queue",
    label: "Queue",
    href: "/",
    icon: "queue",
    match: () => true,
  },
  {
    id: "cases",
    label: "Test cases",
    href: "/cases",
    icon: "cases",
    match: (r) => r.status === "done" && (r.type === "create" || r.type === "analyze"),
  },
];

export const TYPES = ["create", "knowledge", "analyze"];
export const STATUSES = ["pending", "processing", "done", "error"];

export const TYPE_LABEL = {
  create: "Create",
  analyze: "Analyze",
  knowledge: "Knowledge",
};

export const STATUS_LABEL = {
  pending: "Pending",
  processing: "Processing",
  done: "Done",
  error: "Error",
};

// One glyph per request type, used by chips and the composer's mode tiles.
export const TYPE_ICON = {
  create: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 2.5h5.5L12 5v8.5H4z"/><path d="M8 7v4M6 9h4"/></svg>',
  analyze: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="4.25"/><path d="M10.2 10.2 13.5 13.5M5.2 7l1.3 1.3 2.3-2.5"/></svg>',
  knowledge: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.5 3.5h4A1.5 1.5 0 018 5v8.5A1.5 1.5 0 006.5 12h-4zM13.5 3.5h-4A1.5 1.5 0 008 5v8.5A1.5 1.5 0 019.5 12h4z"/></svg>',
};

/** Type chip with its icon. `short` is the narrow-screen code in data-short. */
export function typeChip(type) {
  const label = TYPE_LABEL[type] || type;
  const short = { create: "CR", analyze: "AN", knowledge: "KN" }[type] || "";
  return (
    `<span class="chip chip-${esc(type)}" data-tone="${esc(type)}" data-short="${short}">` +
    (TYPE_ICON[type] || "") +
    `<span class="chip-text">${esc(label)}</span></span>`
  );
}

/** Status as dot + word, so colour is never the only signal. */
export function statusBadge(status) {
  return (
    `<span class="status status-${esc(status)}">` +
    `<span class="dot dot-${esc(status)}" aria-hidden="true"></span>${esc(STATUS_LABEL[status] || status)}</span>`
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key) {
  const [year, month] = key.split("-");
  return `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

let cache = null;

export async function loadRequests({ fresh = false } = {}) {
  if (cache && !fresh) return cache;
  const res = await fetch("/api/requests");
  if (!res.ok) throw new Error("Could not read the queue");
  cache = await res.json();
  return cache;
}

// ---- Facet state, carried in the query string so a filtered view is shareable ----

export function readFacets() {
  const q = new URLSearchParams(location.search);
  const list = (key) => (q.get(key) || "").split(",").filter(Boolean);
  return { type: list("type"), status: list("status"), month: list("month") };
}

function writeFacets(facets) {
  const q = new URLSearchParams(location.search);
  for (const key of ["type", "status", "month"]) {
    if (facets[key].length) q.set(key, facets[key].join(","));
    else q.delete(key);
  }
  const search = q.toString();
  history.replaceState(null, "", search ? `${location.pathname}?${search}` : location.pathname);
}

export function clearFacets() {
  writeFacets({ type: [], status: [], month: [] });
}

export function applyFacets(records, facets) {
  return records.filter((r) => {
    if (facets.type.length && !facets.type.includes(r.type)) return false;
    if (facets.status.length && !facets.status.includes(r.status)) return false;
    if (facets.month.length && !facets.month.includes(monthKey(r.createdAt))) return false;
    return true;
  });
}

// ---- Rail ----

function railItem({ id, label, href, icon: iconName, count, current }) {
  const a = document.createElement("a");
  a.className = "rail-item";
  a.href = href;
  a.dataset.label = label;
  a.dataset.view = id;
  if (current) a.setAttribute("aria-current", "page");
  a.innerHTML =
    icon(iconName) +
    `<span class="rail-item-label">${label}</span>` +
    `<span class="rail-count">${count === undefined ? "" : count}</span>`;
  return a;
}

function liveCard(records) {
  const processing = records.filter((r) => r.status === "processing").length;
  const pending = records.filter((r) => r.status === "pending").length;
  return (
    `<div class="rail-live-head"><span class="rail-live-dot${processing ? " is-on" : ""}" aria-hidden="true"></span>` +
    `<b>${processing ? "Claude is working" : pending ? "Waiting for /run-it" : "Idle"}</b></div>` +
    `<span>${processing} processing · ${pending} pending</span>` +
    (pending ? "<span>Run <code>/run-it</code> to pick them up</span>" : "")
  );
}

/**
 * Render the rail once per page: mark, New request, the three views and a live
 * card. Counts and the card need `records`; call `updateRailCounts` when they
 * change instead of re-mounting, so keyboard focus in the rail survives polls.
 * Facets no longer live here — see `mountFilterBar`.
 */
export function mountRail({ view, records = null } = {}) {
  const rail = document.querySelector(".app-rail");
  if (!rail) return;

  rail.innerHTML = "";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Main");

  const mark = document.createElement("a");
  mark.className = "rail-mark";
  mark.href = "/";
  mark.style.textDecoration = "none";
  mark.innerHTML = icon("mark") + '<span class="rail-wordmark">TC Queue</span>';

  const create = document.createElement("a");
  create.className = "rail-new";
  create.href = "/new";
  create.innerHTML = icon("plus") + '<span class="rail-new-label">New request</span>';
  create.setAttribute("aria-label", "New request");
  if (location.pathname === "/new") create.setAttribute("aria-current", "page");

  const views = document.createElement("div");
  views.className = "rail-band";
  views.innerHTML = '<p class="rail-band-head">Views</p>';
  for (const v of VIEWS) {
    views.appendChild(
      railItem({
        id: v.id,
        label: v.label,
        href: v.href,
        icon: v.icon,
        count: records ? records.filter(v.match).length : undefined,
        current: v.id === view,
      }),
    );
  }

  const live = document.createElement("div");
  live.className = "rail-live";
  live.setAttribute("aria-live", "polite");
  live.hidden = !records;
  if (records) live.innerHTML = liveCard(records);

  nav.append(mark, create, views, live);
  rail.appendChild(nav);
}

/** Patch the rail's counts and live card in place. */
export function updateRailCounts(records) {
  const rail = document.querySelector(".app-rail");
  if (!rail || !records) return;
  for (const v of VIEWS) {
    const n = rail.querySelector(`.rail-item[data-view="${v.id}"] .rail-count`);
    if (n) n.textContent = records.filter(v.match).length;
  }
  const live = rail.querySelector(".rail-live");
  if (live) {
    const html = liveCard(records);
    if (live.innerHTML !== html) live.innerHTML = html;
    live.hidden = false;
  }
}

// ---- Filter bar ----

let openPopover = null;

function closePopover() {
  if (!openPopover) return;
  openPopover.pop.hidden = true;
  openPopover.btn.setAttribute("aria-expanded", "false");
  openPopover = null;
}

document.addEventListener("click", (e) => {
  if (openPopover && !openPopover.group.contains(e.target)) closePopover();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openPopover) {
    const btn = openPopover.btn;
    closePopover();
    btn.focus();
  }
});

/**
 * Small shared popover menu: a trigger button toggles a `.popover` sibling.
 * Closes on outside click and Escape. Use for ⋯ menus and filter facets.
 */
export function wirePopover(group, btn, pop) {
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = openPopover && openPopover.pop === pop;
    closePopover();
    if (wasOpen) return;
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    openPopover = { group, btn, pop };
    pop.querySelector("input, button, a")?.focus();
  });
}

export { closePopover };

const FACET_GROUPS = [
  { key: "type", name: "Type", get: (r) => r.type, order: TYPES, label: (t) => TYPE_LABEL[t] || t },
  { key: "status", name: "Status", get: (r) => r.status, order: STATUSES, label: (s) => STATUS_LABEL[s] || s },
  { key: "month", name: "Month", get: (r) => monthKey(r.createdAt), order: null, label: monthLabel },
];

/**
 * Facets as a row of buttons with checkbox popovers, above a list. The query
 * string stays the only place filter state lives. Groups with one value or
 * fewer are hidden; `skip` drops groups a page shows another way (the Queue's
 * status pills). Returns `{ update(records) }` for polls.
 */
export function mountFilterBar({ mount, view, records, skip = [], onChange }) {
  const active = VIEWS.find((v) => v.id === view) || VIEWS[0];
  let scope = records.filter(active.match);

  function render(focusKey, focusValue) {
    const facets = readFacets();
    mount.className = "fbar";
    mount.innerHTML = "";

    for (const g of FACET_GROUPS) {
      if (skip.includes(g.key)) continue;
      const counts = new Map();
      for (const r of scope) counts.set(g.get(r), (counts.get(g.get(r)) || 0) + 1);
      let values = g.order ? g.order.filter((v) => counts.has(v)) : [...counts.keys()].sort().reverse();
      for (const v of facets[g.key]) if (!values.includes(v)) values.push(v);
      if (values.length <= 1 && !facets[g.key].length) continue;

      const group = document.createElement("div");
      group.className = "fbar-group";
      const chosen = facets[g.key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fbtn";
      btn.dataset.active = String(chosen.length > 0);
      btn.innerHTML =
        esc(g.name) +
        (chosen.length ? `: <span class="fbtn-value">${esc(chosen.map(g.label).join(", "))}</span>` : "") +
        icon("caret");

      const pop = document.createElement("div");
      pop.className = "popover";
      pop.hidden = true;
      pop.setAttribute("role", "group");
      pop.setAttribute("aria-label", g.name);
      for (const v of values) {
        const row = document.createElement("label");
        row.className = "popover-option";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = v;
        box.checked = chosen.includes(v);
        box.addEventListener("change", () => {
          const next = readFacets();
          next[g.key] = box.checked ? [...next[g.key], v] : next[g.key].filter((x) => x !== v);
          writeFacets(next);
          render(g.key, v);
          onChange(next);
        });
        const text = document.createElement("span");
        text.textContent = g.label(v);
        const n = document.createElement("span");
        n.className = "popover-count";
        n.textContent = counts.get(v) || 0;
        row.append(box, text, n);
        pop.appendChild(row);
      }

      group.append(btn, pop);
      wirePopover(group, btn, pop);
      mount.appendChild(group);

      if (focusKey === g.key) {
        pop.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        openPopover = { group, btn, pop };
        pop.querySelector(`input[value="${CSS.escape(focusValue)}"]`)?.focus();
      }
    }

    const any = FACET_GROUPS.some((g) => !skip.includes(g.key) && facets[g.key].length);
    if (any) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "link-btn";
      clear.textContent = "Clear filters";
      clear.addEventListener("click", () => {
        const next = readFacets();
        for (const g of FACET_GROUPS) if (!skip.includes(g.key)) next[g.key] = [];
        writeFacets(next);
        render();
        onChange(next);
      });
      mount.appendChild(clear);
    }
  }

  render();
  return {
    update(next) {
      scope = next.filter(active.match);
      if (!openPopover || !mount.contains(openPopover.group)) render();
    },
    render,
  };
}

/**
 * The Queue's status pills: a count per status that toggles the status facet.
 */
export function mountStatusPills({ mount, records, onChange }) {
  function render(focus) {
    const chosen = readFacets().status;
    mount.className = "spills";
    mount.setAttribute("role", "group");
    mount.setAttribute("aria-label", "Filter by status");
    mount.innerHTML = STATUSES.map((s) => {
      const n = records.filter((r) => r.status === s).length;
      return (
        `<button type="button" class="spill" data-status="${s}" aria-pressed="${chosen.includes(s)}">` +
        `<span class="dot" aria-hidden="true"></span><b>${n}</b>${STATUS_LABEL[s]}</button>`
      );
    }).join("");
    mount.querySelectorAll(".spill").forEach((b) =>
      b.addEventListener("click", () => {
        const next = readFacets();
        const s = b.dataset.status;
        next.status = next.status.includes(s) ? next.status.filter((x) => x !== s) : [...next.status, s];
        writeFacets(next);
        render(s);
        onChange(next);
      }),
    );
    if (focus) mount.querySelector(`.spill[data-status="${focus}"]`)?.focus();
  }
  render();
  return {
    update(next) {
      records = next;
      const focused = mount.contains(document.activeElement) ? document.activeElement.dataset.status : null;
      render(focused);
    },
    render,
  };
}

// ---- Feedback: toasts and screen-reader announcements ----

function region(id, className) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = className;
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Transient feedback. Errors stay until dismissed; everything else fades.
 * `action` + `onAction` give an inline button (e.g. Undo). Returns a dismiss fn.
 */
export function toast(message, { tone = "info", action = null, onAction = null, timeout = 5000 } = {}) {
  const host = region("toast-region", "toast-region");
  const t = document.createElement("div");
  t.className = "toast";
  t.dataset.tone = tone;
  t.setAttribute("role", tone === "error" ? "alert" : "status");
  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;
  t.appendChild(text);

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    t.remove();
  };

  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sm";
    b.textContent = action;
    b.addEventListener("click", () => {
      dismiss();
      onAction?.();
    });
    t.appendChild(b);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-btn";
  close.setAttribute("aria-label", "Dismiss");
  close.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  close.addEventListener("click", dismiss);
  t.appendChild(close);

  host.appendChild(t);
  if (tone !== "error" && timeout) timer = setTimeout(dismiss, timeout);
  return dismiss;
}

/** Announce a short message to screen readers without showing anything. */
export function announce(message) {
  const el = region("sr-announcer", "sr-only");
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}

/** Copy text and report it: "Copied" for screen readers, a toast on failure. */
export async function copyText(text, label = text) {
  try {
    await navigator.clipboard.writeText(text);
    announce(`Copied ${label}`);
    return true;
  } catch {
    toast("Couldn't copy to the clipboard.", { tone: "error" });
    return false;
  }
}

// ---- List chrome ----

/**
 * Build the scaffold a list surface shares with the Queue: header with title,
 * search and tally, then the ledger's mount, then the empty slot. The Queue
 * carries this in its HTML; Cases is a page that switch between a
 * detail view and a list, so they build it when the list is what's showing.
 *
 * The whole scaffold comes from here rather than just the header, so the three
 * views cannot drift in order, class names or gutters.
 */
export function listChrome({ mount, title, placeholder, onQuery }) {
  const head = document.createElement("header");
  head.className = "surface-head";
  head.innerHTML =
    `<div class="page-head-main"><h1 class="surface-title">${esc(title)}</h1></div>` +
    '<div class="surface-tools">' +
    '<div class="search">' +
    '<svg class="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false">' +
    '<circle cx="7" cy="7" r="4.25"/><path d="M10.2 10.2 13.5 13.5"/></svg>' +
    `<input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">` +
    "</div>" +
    "</div>";

  const search = head.querySelector("input");
  search.addEventListener("input", () => onQuery(search.value));

  // Filters on the left, tally on the right. Pages mount a filter bar (and the
  // Queue its status pills) into the slots.
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.innerHTML =
    '<div class="toolbar-pills"></div><div class="toolbar-filters"></div>' +
    '<span class="toolbar-spacer"></span><p class="surface-tally" aria-live="polite"></p>';

  const list = document.createElement("div");
  list.className = "surface-list";

  const empty = document.createElement("div");
  empty.className = "empty";
  empty.hidden = true;

  mount.append(head, toolbar, list, empty);

  return {
    search,
    list,
    empty,
    tally: toolbar.querySelector(".surface-tally"),
    toolbar,
    pills: toolbar.querySelector(".toolbar-pills"),
    filters: toolbar.querySelector(".toolbar-filters"),
  };
}

/**
 * The only nothing a Cases list can show: the page has rows, but the
 * search and facets exclude all of them. A genuinely empty index is handled
 * before the list is ever built, because its recovery is different.
 */
export function renderNoMatch({ empty, noun, query, onClear }) {
  empty.textContent = "";

  const title = document.createElement("p");
  title.className = "empty-title";
  title.textContent = "No matches";

  const text = document.createElement("p");
  text.className = "empty-text";
  text.textContent = query
    ? `Nothing matches “${query}” under the current filters.`
    : `This page has ${noun}, but none of them match the current filters.`;

  const cta = document.createElement("p");
  cta.className = "empty-cta";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "btn";
  reset.textContent = "Clear search and filters";
  reset.addEventListener("click", onClear);
  cta.appendChild(reset);

  empty.append(title, text, cta);
}

// ---- Small shared helpers ----

export function esc(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : str;
  // Quotes too: the result is also placed inside attribute values.
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export function shortDate(iso) {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
