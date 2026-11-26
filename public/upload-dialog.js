// The "Upload to TestRail" dialog on the case sheet.
//
// The server builds the plan (platform folders, priority from criticality) and
// does the posting; this only collects the suite, placement and folder name.
// Every upload is a sync: once a target is picked the server previews what is
// already there, so a second upload updates cases instead of duplicating them.

import { timeAgo } from "./shell.js";

const el = (id) => document.getElementById(id);
const dialog = el("tr-dialog");
const form = el("tr-form");
const statusEl = el("tr-status");
const fieldsEl = el("tr-fields");
const suiteSel = el("tr-suite");
const placementSel = el("tr-placement");
const folderInput = el("tr-folder");
const refsInput = el("tr-refs");
const fallbackField = el("tr-fallback-field");
const fallbackSel = el("tr-fallback");
const previewEl = el("tr-preview");
const problemsEl = el("tr-problems");
const submitBtn = el("tr-submit");
const badgeEl = el("c-tr-badge");
const bodyEl = el("tr-body");
const footEl = el("tr-foot");
const closeBtn = el("tr-close");
const stageEl = el("tr-stage");
const stageFoot = el("tr-stage-foot");
const progressEl = el("tr-progress");
const progressFill = el("tr-progress-fill");
const progressValue = el("tr-progress-value");
const stageTitle = el("tr-stage-title");
const stagePath = el("tr-stage-path");
const stepsEl = el("tr-steps");
const stageNote = el("tr-stage-note");
const stageBack = el("tr-stage-back");
const stageOpen = el("tr-stage-open");
const stageDone = el("tr-stage-done");

const POLL_MS = 400;

const LAST_SUITE_KEY = "tc-queue:testrail-suite";

const PREVIEW_DEBOUNCE_MS = 450;

let requestId = null;
let plan = null;
let busy = false;
// The server's answer to "what would an upload with these settings do?".
let diff = null;
let diffError = "";
let previewSeq = 0;
let previewTimer = null;
let markObsolete = true;

async function getJSON(url, options) {
  const resp = await fetch(url, options);
  const data = await resp.json().catch(() => ({}));
  // A sync that stopped partway still reports what it did.
  if (!resp.ok && data.mode !== "sync" && !data.created) {
    const err = new Error(data.error || `Request failed (${resp.status})`);
    err.data = data;
    throw err;
  }
  return data;
}

function rememberedSuite() {
  try {
    return localStorage.getItem(LAST_SUITE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberSuite(id) {
  try {
    localStorage.setItem(LAST_SUITE_KEY, String(id));
  } catch {
    /* per-viewer convenience only */
  }
}

function option(value, label) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

function fillSuites({ pinned = [], others = [] }) {
  suiteSel.replaceChildren(option("", "Pick a suite…"));
  const groups = [["Your suites", pinned], ["Other suites", others]];
  for (const [label, list] of groups) {
    if (!list.length) continue;
    const g = document.createElement("optgroup");
    g.label = label;
    list.forEach((s) => g.appendChild(option(s.id, s.name)));
    suiteSel.appendChild(g);
  }
  const last = rememberedSuite();
  if (last && [...pinned, ...others].some((s) => String(s.id) === last)) suiteSel.value = last;
}

function suiteName() {
  const o = suiteSel.selectedOptions[0];
  return o && o.value ? o.textContent : "Suite";
}

function targetBody() {
  return {
    suiteId: Number(suiteSel.value),
    placement: placementSel.value,
    folderName: folderInput.value.trim(),
    refs: refsInput.value.trim(),
    fallbackPlatform: fallbackSel.value,
  };
}

function targetReady() {
  return !!plan && !plan.problems.length && !!suiteSel.value && !!folderInput.value.trim();
}

function schedulePreview() {
  clearTimeout(previewTimer);
  const seq = ++previewSeq;
  diff = null;
  diffError = "";
  if (!targetReady()) {
    renderPreview();
    return;
  }
  renderPreview();
  previewTimer = setTimeout(async () => {
    try {
      const next = await getJSON(`/api/requests/${requestId}/testrail/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetBody()),
      });
      if (seq !== previewSeq) return;
      diff = next;
    } catch (err) {
      if (seq !== previewSeq) return;
      diffError = err.message;
    }
    renderPreview();
  }, PREVIEW_DEBOUNCE_MS);
}

function para(className, text) {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// A collapsed list of case titles, so the counts can be checked before syncing.
function caseList(summary, items) {
  const det = document.createElement("details");
  det.className = "tr-cases";
  const sum = document.createElement("summary");
  sum.textContent = summary;
  const ul = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    const folder = document.createElement("span");
    folder.className = "tr-cases-folder";
    folder.textContent = item.folder;
    const title = document.createElement("span");
    title.textContent = item.title;
    li.append(folder, title);
    if (item.note) {
      const note = document.createElement("span");
      note.className = "tr-cases-note";
      note.textContent = item.note;
      li.append(note);
    }
    ul.appendChild(li);
  }
  det.append(sum, ul);
  return det;
}

const FIELD_NAMES = {
  title: "title",
  custom_preconds: "precondition",
  custom_steps: "steps",
  custom_expected: "expected",
  priority_id: "priority",
  refs: "references",
  custom_tcstatus: "back to Draft",
};

function renderDiff() {
  const out = [];
  if (diffError) {
    const error = para("tr-note tr-diff-error", `Could not check TestRail: ${diffError}`);
    error.setAttribute("role", "alert");
    out.push(error);
    return out;
  }
  if (!diff) {
    out.push(para("tr-note", targetReady() ? "Checking what is already in TestRail\u2026" : ""));
    return out;
  }

  const { add, update, same } = diff.counts;
  const { obsolete } = diff;
  const chips = document.createElement("p");
  chips.className = "tr-diff";
  const chip = (n, label, tone) => {
    const c = document.createElement("span");
    c.className = "chip";
    c.dataset.tone = n ? tone : "none";
    c.textContent = `${n} ${label}`;
    return c;
  };
  chips.append(chip(add, "new", "success"), chip(update, "to update", "warn"), chip(same, "unchanged", "none"));
  out.push(chips);

  if (!diff.storyExists) {
    out.push(para("tr-note", "The story folder does not exist yet, so everything is new."));
  }
  if (diff.updates.length) {
    out.push(caseList(
      `Show the ${plural(diff.updates.length, "case")} to update`,
      diff.updates.map((u) => ({
        folder: u.folder,
        title: u.title,
        note: u.fields.map((f) => FIELD_NAMES[f] || f).join(", "),
      })),
    ));
  }

  if (obsolete.length) {
    const label = document.createElement("label");
    label.className = "tr-check";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = markObsolete;
    box.addEventListener("change", () => {
      markObsolete = box.checked;
      syncSubmit();
    });
    const text = document.createElement("span");
    text.textContent =
      `Mark ${plural(obsolete.length, "case")} no longer in this CSV as Obsolete ` +
      "(TestRail cases cannot be deleted from here)";
    label.append(box, text);
    out.push(label);
    out.push(caseList(`Show the ${plural(obsolete.length, "case")}`, diff.obsolete));
  }
  if (diff.untouched) {
    out.push(para("tr-note", `${plural(diff.untouched, "other case")} in these folders ` +
      `${diff.untouched === 1 ? "was" : "were"} not made here or ${diff.untouched === 1 ? "is" : "are"} already retired, and ${diff.untouched === 1 ? "is" : "are"} left alone.`));
  }
  return out;
}

function renderPreview() {
  if (!plan) return;
  const trail = [suiteName()];
  if (placementSel.value === "standalone") trail.push("STANDALONE STORY");
  trail.push(folderInput.value.trim() || "\u2026");

  const counts = plan.folders.map((f) => `${f.name} ${f.count}`).join(" \u00b7 ");
  const copies = plan.total !== plan.sourceCount
    ? ` (${plan.sourceCount} cases, copied once per platform)`
    : "";

  previewEl.replaceChildren(
    para("tr-path", `${trail.join(" \u203a ")} \u203a {platform}`),
    para("tr-note", `${plan.total} TestRail cases${copies}: ${counts}`),
    ...renderDiff(),
  );
  syncSubmit();
}

function writes() {
  if (!diff) return 0;
  const { add, update, obsolete } = diff.counts;
  return add + update + (markObsolete ? obsolete : 0);
}

// Legacy entries (before sync) only carry `created`; sync entries carry `done`.
function landed(u) {
  return u.mode === "sync" ? !u.error || u.done > 0 : u.created > 0;
}

function lastUpload(uploads) {
  const done = (uploads || []).filter(landed);
  return done[done.length - 1];
}

function shortWhen(iso) {
  const at = new Date(iso);
  return at.toLocaleString([], {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

function syncSummary(u) {
  if (u.mode !== "sync") return `${u.created} cases added`;
  const parts = [];
  if (u.added) parts.push(`${u.added} added`);
  if (u.updated) parts.push(`${u.updated} updated`);
  if (u.obsoleted) parts.push(`${u.obsoleted} marked obsolete`);
  return parts.length ? parts.join(", ") : "already up to date";
}

// The page header's "In TestRail · 2h ago" link, beside the Sync button: green
// once the last sync landed, amber when it stopped partway.
export function renderUploadBadge(uploads) {
  const last = lastUpload(uploads);
  badgeEl.hidden = !last;
  if (!last) return;

  const partial = last.mode === "sync" ? !!last.error : last.created < last.planned;
  badgeEl.classList.toggle("partial", partial);
  if (last.url) badgeEl.href = last.url;
  else badgeEl.removeAttribute("href");

  const doneCount = last.mode === "sync" ? last.done : last.created;
  const label = partial ? `${doneCount}/${last.planned} in TestRail` : "In TestRail";
  badgeEl.title =
    `${partial ? `Stopped after ${doneCount} of ${last.planned} changes` : syncSummary(last)} ` +
    `in ${last.suiteName} \u203a ${last.folderName}, ${shortWhen(last.at)}. Click to open in TestRail.`;
  badgeEl.innerHTML = '<span class="dot" aria-hidden="true"></span>';
  const text = document.createElement("span");
  text.className = "c-tr-badge-label";
  text.textContent = `${label} \u00b7 ${timeAgo(last.at)}`;
  badgeEl.append(text);
}

// Older result CSVs have no platform column; the user names one for them.
function fillFallback() {
  fallbackField.hidden = !plan.missingPlatform;
  if (!plan.missingPlatform || fallbackSel.options.length) return;
  fallbackSel.append(
    option("", `Pick one for ${plan.missingPlatform} case(s)\u2026`),
    ...plan.platformChoices.map((p) => option(p, p)),
  );
}

async function replan() {
  const q = fallbackSel.value ? `?fallbackPlatform=${encodeURIComponent(fallbackSel.value)}` : "";
  const next = await getJSON(`/api/requests/${requestId}/testrail/plan${q}`);
  plan = { ...next, uploads: plan.uploads };
  showProblems(plan.problems);
  schedulePreview();
}

function syncSubmit() {
  const n = writes();
  submitBtn.disabled = busy || !targetReady() || !diff || n === 0;
  if (busy) return;
  if (diff && n === 0) submitBtn.textContent = "Up to date";
  else if (diff && diff.storyExists) submitBtn.textContent = `Sync ${plural(n, "change")}`;
  else submitBtn.textContent = "Upload";
}

function showProblems(list) {
  problemsEl.replaceChildren(...list.map((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    return li;
  }));
  problemsEl.hidden = !list.length;
}

// --- Progress stage ---
//
// The upload is one long POST. The server records how far it has got, and the
// stage polls that to draw the progress bar and the per-folder steps.

let stage = null;

function trail() {
  const parts = [suiteName()];
  if (placementSel.value === "standalone") parts.push("STANDALONE STORY");
  parts.push(folderInput.value.trim());
  return parts.join(" \u203a ");
}

function stepRow(label, meta) {
  const li = document.createElement("li");
  li.className = "tr-step";
  li.dataset.state = "pending";
  const dot = document.createElement("span");
  dot.className = "tr-step-dot";
  dot.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 8.5l2.25 2.25L11.5 5.5"/></svg>';
  const name = document.createElement("span");
  name.className = "tr-step-name";
  name.textContent = label;
  const count = document.createElement("span");
  count.className = "tr-step-meta";
  count.textContent = meta;
  li.append(dot, name, count);
  stepsEl.appendChild(li);
  return { li, meta: count };
}

function enterStage() {
  stage = { started: Date.now(), timer: null, steps: [], total: writes() };
  bodyEl.hidden = true;
  footEl.hidden = true;
  stageFoot.hidden = true;
  closeBtn.hidden = true;
  stageEl.hidden = false;
  stageEl.dataset.state = "preparing";
  stageTitle.textContent = diff.storyExists ? "Syncing with TestRail" : "Uploading to TestRail";
  stagePath.textContent = trail();
  stageNote.textContent = "Setting up folders\u2026";
  progressValue.textContent = "";
  progressFill.style.width = "0%";
  progressEl.removeAttribute("aria-valuenow");

  stepsEl.replaceChildren();
  stage.prep = stepRow("Folders", "");
  let offset = 0;
  for (const f of diff.folders) {
    const count = f.add + f.update;
    if (!count) continue;
    stage.steps.push({ ...stepRow(f.name, `0/${count}`), name: f.name, count, offset });
    offset += count;
  }
  if (markObsolete && diff.counts.obsolete) {
    const count = diff.counts.obsolete;
    stage.steps.push({ ...stepRow("Mark obsolete", `0/${count}`), name: null, step: "obsolete", count, offset });
  }
  stage.prep.li.dataset.state = "active";
}

function remaining(created, total) {
  if (created < 3) return "";
  const perCase = (Date.now() - stage.started) / created;
  const secs = Math.round((perCase * (total - created)) / 1000);
  if (secs < 5) return "almost done";
  return secs < 60 ? `about ${secs}s left` : `about ${Math.ceil(secs / 60)} min left`;
}

function drawProgress({ step, folder, done: created, total: serverTotal }, { final = false, failed = false } = {}) {
  // The server reconciles again before writing, so its total wins once known.
  if (serverTotal) stage.total = serverTotal;
  const total = stage.total;
  const pct = total ? Math.min(1, created / total) : 1;
  const preparing = step === "folders" && !final;

  stageEl.dataset.state = failed ? "error" : final ? "done" : preparing ? "preparing" : "running";
  if (!preparing) {
    const shown = Math.round((final && !failed ? 1 : pct) * 100);
    progressFill.style.width = `${shown}%`;
    progressEl.setAttribute("aria-valuenow", String(shown));
    progressValue.textContent = `${Math.round(pct * 100)}%`;
  }

  stage.prep.li.dataset.state = preparing ? "active" : "done";
  for (const s of stage.steps) {
    const done = Math.max(0, Math.min(s.count, created - s.offset));
    s.meta.textContent = `${done}/${s.count}`;
    let state = "pending";
    if (done === s.count) state = "done";
    else if (failed && (isCurrent(s, step, folder) || done > 0)) state = "failed";
    else if (isCurrent(s, step, folder) || done > 0) state = "active";
    s.li.dataset.state = state;
  }

  if (!final) {
    const left = remaining(created, total);
    stageNote.textContent = preparing
      ? "Setting up folders\u2026"
      : `${created} of ${plural(total, "change")}${left ? ` \u00b7 ${left}` : ""}`;
  }
}

function isCurrent(s, step, folder) {
  return s.step ? s.step === step : step === "cases" && folder === s.name;
}

async function poll() {
  try {
    const p = await getJSON(`/api/requests/${requestId}/testrail/progress`);
    if (p.running && stage && stageEl.dataset.state !== "done") drawProgress(p);
  } catch {
    /* the POST reports the real outcome */
  }
}

function finishStage(data, error) {
  clearInterval(stage.timer);
  const done = data ? data.done : 0;
  if (data && data.planned != null) stage.total = data.planned;
  const secs = Math.max(1, Math.round((Date.now() - stage.started) / 1000));

  drawProgress({ step: "cases", folder: null, done }, { final: true, failed: !!error });

  if (error) {
    stageTitle.textContent = done ? "Sync stopped partway" : "Upload failed";
    stageNote.textContent = done
      ? `${done} of ${plural(stage.total, "change")} made it in before TestRail refused: ${error}. ` +
        "Syncing again picks up where this stopped."
      : error;
  } else {
    const summary = syncSummary(data);
    stageTitle.textContent = summary.charAt(0).toUpperCase() + summary.slice(1);
    const left = data.notRetired ? ` ${plural(data.notRetired, "case")} no longer in the CSV ${data.notRetired === 1 ? "was" : "were"} left as is.` : "";
    stageNote.textContent = `Done in ${secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`}.${left}`;
  }

  const url = data && data.url;
  stageOpen.hidden = !url;
  if (url) stageOpen.href = url;
  stageBack.hidden = !error;
  stageDone.hidden = !!error && done === 0;
  stageFoot.hidden = false;
  closeBtn.hidden = false;
  (error ? stageBack : stageDone).focus();
}

function leaveStage() {
  if (stage) clearInterval(stage.timer);
  stage = null;
  stageEl.hidden = true;
  stageFoot.hidden = true;
  closeBtn.hidden = false;
  bodyEl.hidden = false;
  footEl.hidden = false;
}

export async function openUploadDialog(id) {
  requestId = id;
  plan = null;
  busy = false;
  diff = null;
  diffError = "";
  markObsolete = true;
  fieldsEl.hidden = true;
  problemsEl.hidden = true;
  leaveStage();
  submitBtn.textContent = "Upload";
  statusEl.hidden = false;
  statusEl.textContent = "Loading suites…";
  syncSubmit();
  if (!dialog.open) dialog.showModal();

  try {
    const [suites, nextPlan] = await Promise.all([
      getJSON("/api/testrail/suites"),
      getJSON(`/api/requests/${id}/testrail/plan`),
    ]);
    if (!suites.configured) {
      statusEl.textContent =
        "TestRail is not set up. Copy testrail.example.json to testrail.local.json and fill in your API key.";
      return;
    }
    if (suites.error) throw new Error(suites.error);

    plan = nextPlan;
    fallbackSel.replaceChildren();
    fillFallback();
    fillSuites(suites);
    folderInput.value = plan.folderName;
    refsInput.value = plan.refs;
    // Default to where this request went last time, so uploading again syncs.
    const last = lastUpload(plan.uploads);
    if (last && [...suiteSel.options].some((o) => o.value === String(last.suiteId))) {
      suiteSel.value = String(last.suiteId);
      placementSel.value = last.placement;
      folderInput.value = last.folderName;
    }
    statusEl.hidden = true;
    fieldsEl.hidden = false;
    showProblems(plan.problems);
    schedulePreview();
    (suiteSel.value ? folderInput : suiteSel).focus();
  } catch (err) {
    statusEl.textContent = `Could not reach TestRail: ${err.message}`;
  }
}

async function submit(event) {
  event.preventDefault();
  if (submitBtn.disabled) return;

  busy = true;
  syncSubmit();
  rememberSuite(suiteSel.value);
  enterStage();
  stage.timer = setInterval(poll, POLL_MS);

  try {
    const data = await getJSON(`/api/requests/${requestId}/testrail/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...targetBody(), markObsolete }),
    });
    plan.uploads.push(data);
    renderUploadBadge(plan.uploads);
    finishStage(data, data.error);
  } catch (err) {
    if (err.data && err.data.problems) showProblems(err.data.problems);
    finishStage(null, err.message);
  } finally {
    busy = false;
    // What is in TestRail has changed; "Back" should show the new state.
    schedulePreview();
  }
}

function close() {
  if (busy) return;
  dialog.close();
}

form.addEventListener("submit", submit);
closeBtn.addEventListener("click", close);
el("tr-cancel").addEventListener("click", close);
stageDone.addEventListener("click", close);
stageBack.addEventListener("click", () => {
  leaveStage();
  submitBtn.focus();
});
dialog.addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
fallbackSel.addEventListener("change", () => {
  replan().catch((err) => showProblems([err.message]));
});
for (const input of [suiteSel, placementSel, folderInput, refsInput]) {
  input.addEventListener("input", schedulePreview);
}
for (const input of [suiteSel, placementSel]) {
  input.addEventListener("change", schedulePreview);
}
