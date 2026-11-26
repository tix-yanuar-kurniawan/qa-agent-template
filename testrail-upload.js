"use strict";

// Direct upload of a request's source CSV into TestRail (project 184), and
// re-sync of cases already uploaded.
//
// This is the one place the server reaches out to another system. It still
// generates nothing: it reshapes cases that are already on disk and posts them.
//
// Layout in TestRail, one platform folder per platform a case lists:
//   <suite> › [STANDALONE STORY ›] <story folder> › <platform folder> › case
// A case that lists several platforms is copied into each platform folder.

const fs = require("fs");
const path = require("path");
const { formatNumberedList, NEGATIVE_TITLE } = require("./testrail-sheet");

const CONFIG_FILE = path.join(__dirname, "testrail.local.json");
const DEFAULT_PROJECT_ID = 184;
const DEFAULT_SUITES = [12196, 3023, 3025];
const JIRA_BROWSE = "https://borobudur.atlassian.net/browse/";

// TestRail option ids, read from project 184's case fields on 2026-10-01.
const TEMPLATE_TEXT = 1; // "Test Case (Text)": custom_steps / custom_expected / custom_preconds
const TYPE_POSITIVE = 14;
const TYPE_NEGATIVE = 15;
const AUTOMATION_STATUS_NOT_YET = 2;
const AUTOMATION_TYPE_TBR = 3;
const CREATED_BY_AI_YES = 1;
const TC_STATUS_DRAFT = 1;
const TITLE_LIMIT = 250;

// P0–P3 in the source CSV is a private triage mark. TestRail priority comes from
// criticality.
const PRIORITY_BY_CRITICALITY = { critical: 4, high: 3, medium: 2, low: 1 };
const DEFAULT_PRIORITY = 2;

// Source platform token → the TestRail folder it lands in and the custom_platform
// option it carries. Order here is the order the folders are created in.
const PLATFORMS = [
  { folder: "Responsive", platformId: 2, match: /^responsive$/ },
  { folder: "Android", platformId: 7, match: /^android( app)?$/ },
  { folder: "iOS", platformId: 8, match: /^ios( app)?$/ },
  { folder: "Panel", platformId: 4, match: /^(panel( - dweb)?|dashboard panel)$/ },
  { folder: "Backend", platformId: 5, match: /^backend$/ },
  { folder: "API", platformId: 5, match: /^api$/ },
];

// "Multi-Platform" means every end-user surface.
const MULTI_PLATFORM = /^multi[- ]?platform$/;
const MULTI_PLATFORM_FOLDERS = ["Responsive", "Android", "iOS"];

const STANDALONE_ROOT = /^standalone stor(y|ies)$/i;

function readConfig(file = CONFIG_FILE, env = process.env) {
  let local = {};
  if (fs.existsSync(file)) {
    try {
      local = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      local = {};
    }
  }
  const url = env.TESTRAIL_URL || local.url || "";
  const username = env.TESTRAIL_USERNAME || local.username || "";
  const apiKey = env.TESTRAIL_API_KEY || local.apiKey || "";
  if (!url || !username || !apiKey) return null;
  return {
    url: url.replace(/\/index\.php.*$/, "").replace(/\/+$/, ""),
    username,
    apiKey,
    projectId: Number(local.projectId) || DEFAULT_PROJECT_ID,
    suites: Array.isArray(local.suites) && local.suites.length
      ? local.suites.map(Number)
      : DEFAULT_SUITES.slice(),
    pic: local.pic || "",
  };
}

function platformsFor(value) {
  const tokens = String(value || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const folders = new Set();
  const unknown = [];
  for (const token of tokens) {
    if (MULTI_PLATFORM.test(token)) {
      MULTI_PLATFORM_FOLDERS.forEach((f) => folders.add(f));
      continue;
    }
    const hit = PLATFORMS.find((p) => p.match.test(token));
    if (hit) folders.add(hit.folder);
    else unknown.push(token);
  }
  // Keep the canonical folder order regardless of how the cell was written.
  const ordered = PLATFORMS.filter((p) => folders.has(p.folder));
  return { platforms: ordered, unknown };
}

function inferType(title) {
  return NEGATIVE_TITLE.test(title) ? TYPE_NEGATIVE : TYPE_POSITIVE;
}

// The source preconditions are `key: value` clauses joined by ";", with
// credential keys, UNKNOWN gaps and cross-references to source ids. None of
// that belongs in TestRail, so it is reshaped into plain lines:
// UNKNOWN clauses are dropped, "(TC22)" references go (TestRail ids differ), and
// "account: gk-tiket-web role=member" becomes "User: member".
const PRECONDITION_KEYS = new Set(["account", "config", "data", "state", "device", "unknown"]);
const UNKNOWN = /^unknown\b/i;
const SOURCE_REF = /\s*\((?:see\s+)?TC\d+(?:\s*[,/&]\s*TC\d+)*\)/gi;

function preconditionLines(preconditions) {
  const clauses = [];
  for (const piece of preconditions.split(";")) {
    const text = piece.trim();
    if (!text) continue;
    const m = /^([a-z][\w-]*)\s*:\s*([\s\S]*)$/i.exec(text);
    if (m && PRECONDITION_KEYS.has(m[1].toLowerCase())) clauses.push({ key: m[1].toLowerCase(), value: m[2].trim() });
    else if (clauses.length) clauses[clauses.length - 1].value += `; ${text}`;
    else clauses.push({ key: "", value: text });
  }

  const lines = [];
  for (const { key, value } of clauses) {
    if (key === "unknown" || UNKNOWN.test(value)) continue;
    let v = value.replace(SOURCE_REF, "").trim();
    if (!v) continue;
    if (key === "account") {
      v = v.replace(/^\S+\s+role=/i, "").replace(/^role=/i, "");
      lines.push(`User: ${v}`);
    } else if (key) {
      lines.push(`${key[0].toUpperCase()}${key.slice(1)}: ${v}`);
    } else {
      lines.push(v);
    }
  }
  return lines;
}

function preconditionText(preconditions) {
  return preconditionLines(preconditions).join("\n");
}

// Pure: source table → what would be posted, grouped by platform folder.
// Older result CSVs carry "--- P0 TC for … ---" divider rows between groups.
const DIVIDER = /^-{3}.*-{3}$/;

function buildUploadPlan(sourceColumns, sourceRows, { refs = "", pic = "", fallbackPlatform = "" } = {}) {
  const lower = sourceColumns.map((c) => String(c).toLowerCase());
  const get = (row, name) => {
    const i = lower.indexOf(name);
    return i >= 0 && row[i] != null ? String(row[i]) : "";
  };

  const groups = new Map();
  const problems = [];
  let missingPlatform = 0;
  let sourceCount = 0;

  sourceRows.forEach((row, i) => {
    const id = get(row, "id") || `row ${i + 1}`;
    const title = get(row, "case").trim();
    if (!title || DIVIDER.test(title)) return;
    sourceCount++;

    if (title.length > TITLE_LIMIT) {
      problems.push(`${id}: title is ${title.length} characters, TestRail allows ${TITLE_LIMIT}`);
      return;
    }

    let cell = get(row, "platform").trim();
    if (!cell) {
      missingPlatform++;
      cell = fallbackPlatform;
    }
    const { platforms, unknown } = platformsFor(cell);
    if (unknown.length) {
      problems.push(`${id}: no TestRail platform for "${unknown.join(", ")}"`);
      return;
    }
    if (!platforms.length) return;

    const criticality = get(row, "criticality").trim().toLowerCase();
    const base = {
      title,
      template_id: TEMPLATE_TEXT,
      type_id: inferType(title),
      priority_id: PRIORITY_BY_CRITICALITY[criticality] || DEFAULT_PRIORITY,
      refs,
      custom_preconds: preconditionText(get(row, "preconditions")),
      custom_steps: formatNumberedList(get(row, "steps")),
      custom_expected: formatNumberedList(get(row, "expected result")),
      custom_automation_status: AUTOMATION_STATUS_NOT_YET,
      custom_automation_type: AUTOMATION_TYPE_TBR,
      custom_case_created_by_ai: CREATED_BY_AI_YES,
      custom_tcstatus: TC_STATUS_DRAFT,
    };
    if (pic) base.custom_pic = pic;

    for (const p of platforms) {
      if (!groups.has(p.folder)) groups.set(p.folder, []);
      groups.get(p.folder).push({ sourceId: id, payload: { ...base, custom_platform: p.platformId } });
    }
  });

  const folders = PLATFORMS
    .filter((p) => groups.has(p.folder))
    .map((p) => ({ name: p.folder, cases: groups.get(p.folder) }));

  if (missingPlatform && !fallbackPlatform) {
    problems.push(`${missingPlatform} case(s) have no platform — pick one for them`);
  }

  return {
    folders,
    total: folders.reduce((n, f) => n + f.cases.length, 0),
    sourceCount,
    missingPlatform,
    problems,
  };
}

function jiraUrl(jiraId, description = "") {
  const m = String(description).match(/https?:\/\/[^\s]+\/browse\/[A-Z]+-\d+/i);
  if (m) return m[0];
  return jiraId ? JIRA_BROWSE + jiraId : "";
}

function sameName(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function findChild(sections, parentId, name) {
  return sections.find((s) => (s.parent_id || null) === (parentId || null) && sameName(s.name, name));
}

// --- HTTP client ---

function createClient(config, fetchImpl = fetch) {
  const auth = "Basic " + Buffer.from(`${config.username}:${config.apiKey}`).toString("base64");

  async function call(method, endpoint, body) {
    for (let attempt = 0; ; attempt++) {
      const resp = await fetchImpl(`${config.url}/index.php?/api/v2/${endpoint}`, {
        method,
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (resp.status === 429 && attempt < 5) {
        const wait = Number(resp.headers.get("retry-after")) || 2 ** attempt;
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!resp.ok) {
        const reason = (data && data.error) || text.slice(0, 200) || resp.statusText;
        throw new Error(`TestRail ${endpoint.split("/")[0]} failed (${resp.status}): ${reason}`);
      }
      return data;
    }
  }

  // Bulk GETs come back as { <key>: [...], _links: { next } } on current TestRail.
  async function list(endpoint, key) {
    const out = [];
    let next = endpoint;
    while (next) {
      const page = await call("GET", next);
      if (Array.isArray(page)) return page;
      out.push(...(page[key] || []));
      const link = page._links && page._links.next;
      next = link ? link.replace(/^\/api\/v2\//, "") : null;
    }
    return out;
  }

  return {
    getSuites: (projectId) => list(`get_suites/${projectId}`, "suites"),
    getSections: (projectId, suiteId) =>
      list(`get_sections/${projectId}&suite_id=${suiteId}`, "sections"),
    addSection: (projectId, body) => call("POST", `add_section/${projectId}`, body),
    getCases: (projectId, suiteId, sectionId) =>
      list(`get_cases/${projectId}&suite_id=${suiteId}&section_id=${sectionId}`, "cases"),
    addCase: (sectionId, body) => call("POST", `add_case/${sectionId}`, body),
    updateCase: (caseId, body) => call("POST", `update_case/${caseId}`, body),
  };
}

// --- Sync ---
//
// Every upload is a sync. Before writing anything it reads what is already in
// the target folders and pairs each planned case with an existing TestRail case,
// first by the link saved from an earlier upload, then by title. A paired case is
// updated only when its content differs; an unpaired one is added. Nothing is
// ever deleted (the uploader has no delete permission): a case of ours that is
// no longer in the CSV can be marked Obsolete instead.

const TC_STATUS_OBSOLETE = 5;
// Obsolete, Invalid, Dropped: already retired, so not offered again.
const RETIRED_STATUSES = new Set([TC_STATUS_OBSOLETE, 6, 7]);

// What a sync is allowed to overwrite. Status, automation, PIC and type stay as
// they are in TestRail, so moving a case past Draft there survives a re-sync.
const CONTENT_FIELDS = ["title", "custom_preconds", "custom_steps", "custom_expected", "priority_id", "refs"];

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

// TestRail can hand a text field back as HTML even though it was posted as
// plain text (seen after update_case, and the web editor saves HTML too).
// Reduce it to the plain-text shape we post, so equal content compares equal.
function htmlToText(html) {
  let n = 0;
  return html
    .replace(/>\s+</g, "><")
    .replace(/<ol[^>]*>/gi, () => { n = 0; return "\n"; })
    .replace(/<ul[^>]*>/gi, () => { n = -1; return "\n"; })
    .replace(/<li[^>]*>/gi, () => (n >= 0 ? `${++n}. ` : "- "))
    .replace(/<\/li>|<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ol|ul|h\d)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#39|[a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function normalized(value) {
  let text = String(value == null ? "" : value).replace(/\r\n?/g, "\n");
  if (/<\/?(p|ol|ul|li|br|div)\b[^>]*>/i.test(text)) text = htmlToText(text);
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function contentChanges(existing, payload) {
  const changes = {};
  for (const field of CONTENT_FIELDS) {
    if (normalized(existing[field]) !== normalized(payload[field])) changes[field] = payload[field];
  }
  return changes;
}

function isRetired(c) {
  return RETIRED_STATUSES.has(Number(c.custom_tcstatus));
}

// links: { <platform folder>: { <source id>: <case id> } } for one suite.
function linkedIds(links) {
  const ids = new Set();
  for (const byId of Object.values(links || {})) {
    for (const caseId of Object.values(byId || {})) ids.add(Number(caseId));
  }
  return ids;
}

// A case this tool put there: linked from an earlier upload, or flagged as
// AI-made (uploads from before links were saved). Anything else was written by
// hand and is never paired by title, updated or retired.
function isOurs(c, ours) {
  return ours.has(Number(c.id)) || Number(c.custom_case_created_by_ai) === CREATED_BY_AI_YES;
}

// Pure: pair the planned cases of one platform folder with what is in it.
function diffFolder(planned, existing, links = {}, ours = linkedIds({ _: links })) {
  const pool = new Map(existing.map((c) => [Number(c.id), c]));
  const matched = new Array(planned.length).fill(null);

  planned.forEach((c, i) => {
    const caseId = Number(links[c.sourceId]);
    if (caseId && pool.has(caseId)) {
      matched[i] = pool.get(caseId);
      pool.delete(caseId);
    }
  });
  // Titles second, so a title match can never steal a linked case. A live case
  // beats a retired one with the same title.
  for (const wantRetired of [false, true]) {
    planned.forEach((c, i) => {
      if (matched[i]) return;
      const hit = [...pool.values()].find(
        (e) => isOurs(e, ours) && isRetired(e) === wantRetired && sameName(e.title, c.payload.title),
      );
      if (hit) {
        matched[i] = hit;
        pool.delete(Number(hit.id));
      }
    });
  }

  const ops = planned.map((c, i) => {
    const hit = matched[i];
    if (!hit) return { kind: "add", sourceId: c.sourceId, title: c.payload.title, payload: c.payload };
    const changes = contentChanges(hit, c.payload);
    // Back in the CSV after being retired: bring it back as a draft.
    if (isRetired(hit)) changes.custom_tcstatus = TC_STATUS_DRAFT;
    const kind = Object.keys(changes).length ? "update" : "same";
    return { kind, sourceId: c.sourceId, title: c.payload.title, caseId: Number(hit.id), changes };
  });

  return { ops, leftover: [...pool.values()] };
}

// Read-only. Works out what a sync would do without writing anything.
async function reconcile(client, { projectId, suiteId, placement, folderName, plan, links = {} }) {
  const sections = await client.getSections(projectId, suiteId);

  let parentId = null;
  if (placement === "standalone") {
    const root = sections.find((s) => !s.parent_id && STANDALONE_ROOT.test(String(s.name).trim()));
    if (!root) throw new Error("this suite has no STANDALONE STORY folder at the top level");
    parentId = root.id;
  }

  const story = findChild(sections, parentId, folderName) || null;
  const ours = linkedIds(links);
  const plannedByFolder = new Map(plan.folders.map((f) => [f.name, f.cases]));
  const folders = [];
  const obsolete = [];
  let untouched = 0;

  // Every platform folder under the story, including ones the CSV no longer uses.
  for (const p of PLATFORMS) {
    const section = story ? findChild(sections, story.id, p.folder) || null : null;
    const planned = plannedByFolder.get(p.folder) || [];
    if (!section && !planned.length) continue;

    const existing = section ? await client.getCases(projectId, suiteId, section.id) : [];
    const { ops, leftover } = diffFolder(planned, existing, links[p.folder], ours);
    if (planned.length) folders.push({ name: p.folder, section, ops });

    for (const c of leftover) {
      if (isOurs(c, ours) && !isRetired(c)) obsolete.push({ caseId: Number(c.id), title: c.title, folder: p.folder });
      else untouched++;
    }
  }

  return { sections, parentId, story, folders, obsolete, untouched };
}

function countOps(diff) {
  const counts = { add: 0, update: 0, same: 0 };
  for (const f of diff.folders) for (const op of f.ops) counts[op.kind]++;
  return { ...counts, obsolete: diff.obsolete.length };
}

async function ensureSection(client, ctx, parentId, name, description) {
  const existing = findChild(ctx.sections, parentId, name);
  if (existing) return { section: existing, created: false };
  const body = { suite_id: ctx.suiteId, name };
  if (parentId) body.parent_id = parentId;
  if (description) body.description = description;
  const section = await client.addSection(ctx.projectId, body);
  ctx.sections.push(section);
  return { section, created: true };
}

// Writes what reconcile() worked out. onProgress gets { step, folder, done }
// after every TestRail write, so the dialog can show how far it has got.
// result.links holds every pairing made, even when the sync stops partway.
async function applySync(client, diff, {
  projectId, suiteId, folderName, folderDescription, markObsolete = false, onProgress = () => {},
}) {
  const ctx = { projectId, suiteId, sections: diff.sections };
  onProgress({ step: "folders", folder: null, done: 0 });

  const story = await ensureSection(client, ctx, diff.parentId, folderName, folderDescription);
  const result = {
    storySectionId: story.section.id,
    storyCreated: story.created,
    folders: [],
    links: {},
    added: 0,
    updated: 0,
    unchanged: 0,
    obsoleted: 0,
    done: 0,
    error: null,
  };

  try {
    for (const folder of diff.folders) {
      const sub = await ensureSection(client, ctx, story.section.id, folder.name);
      const entry = { name: folder.name, sectionId: sub.section.id, created: sub.created, added: 0, updated: 0, unchanged: 0 };
      const links = (result.links[folder.name] = {});
      result.folders.push(entry);
      onProgress({ step: "cases", folder: folder.name, done: result.done });

      for (const op of folder.ops) {
        if (op.kind === "same") {
          links[op.sourceId] = op.caseId;
          entry.unchanged++;
          result.unchanged++;
          continue;
        }
        if (op.kind === "add") {
          const made = await client.addCase(sub.section.id, op.payload);
          links[op.sourceId] = Number(made.id);
          entry.added++;
          result.added++;
        } else {
          await client.updateCase(op.caseId, op.changes);
          links[op.sourceId] = op.caseId;
          entry.updated++;
          result.updated++;
        }
        result.done++;
        onProgress({ step: "cases", folder: folder.name, done: result.done });
      }
    }

    if (markObsolete) {
      for (const c of diff.obsolete) {
        onProgress({ step: "obsolete", folder: null, done: result.done });
        await client.updateCase(c.caseId, { custom_tcstatus: TC_STATUS_OBSOLETE });
        result.obsoleted++;
        result.done++;
      }
      onProgress({ step: "obsolete", folder: null, done: result.done });
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

function sectionUrl(config, suiteId, sectionId) {
  return `${config.url}/index.php?/suites/view/${suiteId}&group_by=cases:section_id&group_id=${sectionId}`;
}

module.exports = {
  CONFIG_FILE,
  PLATFORMS,
  PRIORITY_BY_CRITICALITY,
  STANDALONE_ROOT,
  readConfig,
  platformsFor,
  preconditionText,
  buildUploadPlan,
  jiraUrl,
  createClient,
  diffFolder,
  reconcile,
  countOps,
  applySync,
  sectionUrl,
};
