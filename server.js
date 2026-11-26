const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const {
  EDITABLE_COLUMNS,
  toTestrailTable,
  applyTestrailEdits,
  sameTestrailHeaders,
  sourceRowKeys,
  sourceIndex,
  extractJiraId,
} = require("./testrail-sheet");
const { parseCsvTable, csvField } = require("./csv-table");
const testrailUpload = require("./testrail-upload");
const p0Share = require("./p0-share");

const app = express();
const PORT = Number(process.env.PORT) || 4568;
// Loopback only: the API has no auth and can upload to TestRail with your
// credentials. Set HOST to expose it deliberately.
const HOST = process.env.HOST || "127.0.0.1";
const QUEUE_DIR = path.join(__dirname, "queue");
const OUTPUT_DIR = path.join(__dirname, "output");

fs.mkdirSync(QUEUE_DIR, { recursive: true });

// A sheet full of test cases is sent back as JSON, and the largest result CSV on
// disk is over 200 KB before escaping — well past the 100 KB default.
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".csv", ".xlsx", ".xls", ".doc", ".docx",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
]);

function getAllowedExt(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, QUEUE_DIR),
  filename: (req, file, cb) => {
    const id = req._requestId || uuidv4();
    req._requestId = id;

    if (file.fieldname === "csv") {
      cb(null, `${id}_input.csv`);
    } else {
      const idx = req._attachmentIdx = (req._attachmentIdx || 0);
      req._attachmentIdx++;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${id}_attach_${idx}${ext}`);
    }
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "csv") {
      cb(null, file.mimetype === "text/csv" || file.originalname.endsWith(".csv"));
    } else {
      cb(null, !!getAllowedExt(file.originalname));
    }
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: "csv", maxCount: 1 },
  { name: "attachments", maxCount: 10 },
]);

// --- CSV helpers ---

function csvQuote(val) {
  if (val == null) return '""';
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return '"' + s + '"';
}

// Some result CSVs quote every field, others only where a comma or a quote forces
// it. The header gives the file's habit away, since column names never contain a
// comma and so are only quoted on purpose.
function detectCsvStyle(headerLine) {
  if (!headerLine) return csvField;
  return headerLine.split(",").every((field) => /^".*"$/.test(field)) ? csvQuote : csvField;
}

// Rows that came back unchanged are written out with the exact bytes they arrived
// with, and only edited rows are re-serialized. Otherwise a one-cell fix would
// rewrite every line of a file whose quoting is not perfectly uniform, burying the
// real change in the diff.
function buildCsvTable(columns, rows, original = "") {
  const source = parseCsvTable(original);
  const quote = detectCsvStyle(source.headerLine);

  const verbatim = new Map();
  source.rows.forEach((values, i) => {
    const key = JSON.stringify(values);
    if (!verbatim.has(key)) verbatim.set(key, source.rawLines[i]);
  });

  const headerHeld =
    source.headerLine != null &&
    source.columns.length === columns.length &&
    source.columns.every((name, i) => name === columns[i]);

  const lines = [headerHeld ? source.headerLine : columns.map(quote).join(",")];

  for (const row of rows) {
    const values = columns.map((_, i) => (row[i] == null ? "" : String(row[i])));
    const raw = verbatim.get(JSON.stringify(values));
    lines.push(raw != null ? raw : values.map(quote).join(","));
  }

  // Row terminators are taken from the header's, since a few of these files are
  // CRLF and rewriting them as LF would mark every line as changed.
  const firstBreak = original.indexOf("\n");
  const eol = firstBreak > 0 && original[firstBreak - 1] === "\r" ? "\r\n" : "\n";

  return lines.join(eol) + (original && !original.endsWith("\n") ? "" : eol);
}

function convertToTestrailCsv(resultCsvContent, record) {
  const source = parseCsvTable(resultCsvContent);
  if (!source.rows.length) return "";
  const table = toTestrailTable(source.columns, source.rows, record);
  return [table.columns, ...table.rows]
    .map((row) => row.map(csvQuote).join(","))
    .join("\n");
}

// --- Editable test cases ---
//
// The sheet edits queue/<id>_result.csv, which is what the TestRail download
// reads. The skill also left a copy in output/, and that copy is what the vault
// mirrors — so a save has to reach both. The queue record never named its output
// file, so find it by content while the two are still identical and remember it
// on the record from then on.

function isOutputCsvName(name) {
  return (
    typeof name === "string" &&
    /^[^\\/]+\.csv$/i.test(name) &&
    !name.includes("..")
  );
}

function findOutputTwin(resultCsv) {
  if (!fs.existsSync(OUTPUT_DIR)) return null;

  const target = resultCsv.trimEnd();
  const matches = fs.readdirSync(OUTPUT_DIR).filter((name) => {
    if (!name.toLowerCase().endsWith(".csv")) return false;
    try {
      return fs.readFileSync(path.join(OUTPUT_DIR, name), "utf-8").trimEnd() === target;
    } catch {
      return false;
    }
  });

  // Two byte-identical files would make the choice a coin flip, so link neither
  // rather than risk writing an edit into the wrong one.
  return matches.length === 1 ? matches[0] : null;
}

function resolveOutputTwin(record, resultCsv) {
  if (
    isOutputCsvName(record.outputFile) &&
    fs.existsSync(path.join(OUTPUT_DIR, record.outputFile))
  ) {
    return record.outputFile;
  }
  return findOutputTwin(resultCsv);
}

// Every request whose result is a CSV can be opened in the sheet; knowledge notes
// have no result CSV and so fall out naturally.
function openCases(id) {
  const meta = path.join(QUEUE_DIR, `${id}_request.json`);
  if (!fs.existsSync(meta)) return { status: 404, error: "not found" };

  const resultFile = path.join(QUEUE_DIR, `${id}_result.csv`);
  if (!fs.existsSync(resultFile)) {
    return { status: 404, error: "this request has no test-case CSV to edit" };
  }

  return {
    meta,
    resultFile,
    record: JSON.parse(fs.readFileSync(meta, "utf-8")),
    csv: fs.readFileSync(resultFile, "utf-8"),
  };
}

// Node rejects header values outside Latin-1, so a label containing an en dash
// or any other non-Latin-1 character throws ERR_INVALID_CHAR and the download
// fails instead of being served. Send an ASCII-only `filename` for that reason
// and the real UTF-8 name via RFC 6266 `filename*`, which browsers prefer.
function setDownloadName(res, downloadName) {
  const asciiFallback =
    downloadName
      .replace(/[\/\\<>:"|?*\x00-\x1f]/g, "_")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/_+/g, "_") || "download";

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiFallback}"; ` +
      `filename*=UTF-8''${encodeURIComponent(downloadName)}`
  );
}

// Multer writes uploads to queue/ before the handler runs, so a rejected
// submission would leave an orphan CSV behind with no request to own it.
function discardUploads(req) {
  const files = [
    ...((req.files && req.files.csv) || []),
    ...((req.files && req.files.attachments) || []),
  ];
  for (const f of files) {
    try {
      fs.unlinkSync(f.path);
    } catch {}
  }
}

function reject(req, res, message) {
  discardUploads(req);
  return res.status(400).json({ error: message });
}

// --- API ---

// Request ids become file names in queue/, so anything but a plain id (an
// encoded "../", say) is refused before a route touches the disk.
const REQUEST_ID = /^[\w-]+$/;
app.param("id", (_req, res, next, id) => {
  if (!REQUEST_ID.test(id)) return res.status(400).json({ error: "bad request id" });
  next();
});

app.post("/api/requests", uploadFields, (req, res) => {
  const id = req._requestId || uuidv4();
  const { type, description, label } = req.body;
  const csvFile = req.files && req.files.csv && req.files.csv[0];
  const attachFiles = (req.files && req.files.attachments) || [];

  const TYPES = ["create", "analyze", "knowledge"];
  if (!type || !TYPES.includes(type)) {
    return reject(req, res, `type must be one of: ${TYPES.join(", ")}`);
  }
  // Create and knowledge can work from attached files alone; analyze needs a
  // description to match the CSV against.
  const hasDescription = Boolean(description && description.trim());
  const filesSuffice = (type === "create" || type === "knowledge") && attachFiles.length > 0;
  if (!hasDescription && !filesSuffice) {
    return reject(req, res, "description is required");
  }
  if (type === "analyze" && !csvFile) {
    return reject(req, res, "CSV file is required for analyze");
  }

  const record = {
    id,
    type,
    label: (label || "").trim() || undefined,
    description: (description || "").trim(),
    status: "pending",
    hasInputCsv: !!csvFile,
    inputCsvOriginalName: csvFile ? csvFile.originalname : undefined,
    attachments: attachFiles.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
    })),
    createdAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };

  fs.writeFileSync(
    path.join(QUEUE_DIR, `${id}_request.json`),
    JSON.stringify(record, null, 2)
  );

  res.status(201).json(record);
});

app.get("/api/requests", (_req, res) => {
  const files = fs.readdirSync(QUEUE_DIR).filter((f) => f.endsWith("_request.json"));
  // A record mid-rewrite (or hand-broken) is skipped for this poll rather than
  // failing the whole list.
  const requests = files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), "utf-8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(requests);
});

app.get("/api/requests/:id", (req, res) => {
  const file = path.join(QUEUE_DIR, `${req.params.id}_request.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });
  res.json(JSON.parse(fs.readFileSync(file, "utf-8")));
});

app.get("/api/requests/:id/testrail", (req, res) => {
  const meta = path.join(QUEUE_DIR, `${req.params.id}_request.json`);
  if (!fs.existsSync(meta)) return res.status(404).json({ error: "not found" });

  const record = JSON.parse(fs.readFileSync(meta, "utf-8"));
  if (record.status !== "done") {
    return res.status(409).json({ error: "result not ready yet" });
  }

  const resultFile = path.join(QUEUE_DIR, `${req.params.id}_result.csv`);
  if (!fs.existsSync(resultFile)) {
    return res.status(404).json({ error: "result file missing" });
  }

  if (!record.downloaded) {
    record.downloaded = true;
    record.downloadedAt = new Date().toISOString();
    fs.writeFileSync(meta, JSON.stringify(record, null, 2));
  }

  const csvContent = fs.readFileSync(resultFile, "utf-8");
  const testrailCsv = convertToTestrailCsv(csvContent, record);

  const downloadName = record.label
    ? `${record.label}_testrail.csv`
    : `${record.id}_testrail.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  setDownloadName(res, downloadName);
  res.send(testrailCsv);
});

app.get("/api/requests/:id/cases", (req, res) => {
  const found = openCases(req.params.id);
  if (found.error) return res.status(found.status).json({ error: found.error });

  const { meta, record, csv } = found;
  const table = parseCsvTable(csv);
  const testrail = toTestrailTable(table.columns, table.rows, record);

  // Resolve the output/ copy now, while an unedited result still matches it byte
  // for byte. After the first save the two diverge and content matching is blind.
  const twin = resolveOutputTwin(record, csv);
  let dirty = false;
  if (twin && twin !== record.outputFile) {
    record.outputFile = twin;
    dirty = true;
  }

  if (record.caseCount == null && Array.isArray(table.rows)) {
    record.caseCount = table.rows.length;
    const priIdx = sourceIndex(table.columns, "priority");
    if (priIdx >= 0) {
      const pc = {};
      for (const row of table.rows) {
        const v = String(row[priIdx] || "").trim().toLowerCase();
        if (/^p[0-3]$/.test(v)) pc[v] = (pc[v] || 0) + 1;
      }
      record.priorityCounts = pc;
    }
    dirty = true;
  }

  if (dirty) {
    fs.writeFileSync(meta, JSON.stringify(record, null, 2));
  }

  res.json({
    id: record.id,
    type: record.type,
    label: record.label || "",
    outputFile: twin || null,
    editedAt: record.casesEditedAt || null,
    testrailUploads: record.testrailUploads || [],
    columns: testrail.columns,
    rows: testrail.rows,
    rowKeys: sourceRowKeys(table.columns, table.rows),
    editableColumns: [...EDITABLE_COLUMNS],
  });
});

app.put("/api/requests/:id/cases", (req, res) => {
  const found = openCases(req.params.id);
  if (found.error) return res.status(found.status).json({ error: found.error });

  const { meta, record, resultFile, csv } = found;
  const { columns, rows, rowKeys } = req.body || {};

  if (!Array.isArray(columns) || !columns.length || !Array.isArray(rows)) {
    return res.status(400).json({ error: "columns and rows are required" });
  }
  if (rows.length > 5000) {
    return res.status(400).json({ error: "a sheet is limited to 5000 cases" });
  }
  if (!sameTestrailHeaders(columns)) {
    return res.status(409).json({
      error: "this sheet shows TestRail columns now — reload to pick up the new version",
    });
  }

  const onDisk = parseCsvTable(csv);
  let nextRows;
  try {
    nextRows = applyTestrailEdits(
      onDisk.columns,
      onDisk.rows,
      columns,
      rows,
      Array.isArray(rowKeys) ? rowKeys : [],
    );
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const updated = buildCsvTable(onDisk.columns, nextRows, csv);

  // Matched against the pre-save content, so the twin is still findable.
  const twin = resolveOutputTwin(record, csv);

  fs.writeFileSync(resultFile, updated);
  if (twin) fs.writeFileSync(path.join(OUTPUT_DIR, twin), updated);

  record.casesEditedAt = new Date().toISOString();
  if (twin) record.outputFile = twin;
  record.caseCount = nextRows.length;
  const priIdx = sourceIndex(onDisk.columns, "priority");
  if (priIdx >= 0) {
    const pc = {};
    for (const row of nextRows) {
      const v = String(row[priIdx] || "").trim().toLowerCase();
      if (/^p[0-3]$/.test(v)) pc[v] = (pc[v] || 0) + 1;
    }
    record.priorityCounts = pc;
  }
  fs.writeFileSync(meta, JSON.stringify(record, null, 2));

  const refreshed = toTestrailTable(onDisk.columns, nextRows, record);
  res.json({
    ok: true,
    savedAt: record.casesEditedAt,
    outputFile: twin || null,
    rows: refreshed.rows,
    columns: refreshed.columns,
    rowKeys: sourceRowKeys(onDisk.columns, nextRows),
    editableColumns: [...EDITABLE_COLUMNS],
  });
});

// --- TestRail upload ---
//
// The only outbound call the server makes. Credentials come from
// testrail.local.json (gitignored) or TESTRAIL_* env vars.

let suiteCache = { at: 0, projectId: null, suites: [] };
// Upload id → { total, created, step, folder }, polled by the dialog.
const uploadsInFlight = new Map();

function storyKey(record) {
  return extractJiraId(record.description || "") || extractJiraId(record.label || "");
}

// The vault already holds the Jira summary for anything Claude has processed.
function storyTitle(key) {
  if (!key) return "";
  try {
    const index = JSON.parse(fs.readFileSync(path.join(__dirname, "knowledge", "index.json"), "utf-8"));
    const entry = index.entries && index.entries[key];
    return entry && entry.title ? String(entry.title) : "";
  } catch {
    return "";
  }
}

app.get("/api/testrail/suites", async (_req, res) => {
  const config = testrailUpload.readConfig();
  if (!config) return res.json({ configured: false });

  try {
    const fresh = Date.now() - suiteCache.at < 10 * 60 * 1000 && suiteCache.projectId === config.projectId;
    if (!fresh) {
      const suites = await testrailUpload.createClient(config).getSuites(config.projectId);
      suiteCache = {
        at: Date.now(),
        projectId: config.projectId,
        suites: suites.filter((s) => !s.is_completed).map((s) => ({ id: s.id, name: s.name })),
      };
    }
    const pinned = config.suites
      .map((id) => suiteCache.suites.find((s) => s.id === id))
      .filter(Boolean);
    const others = suiteCache.suites
      .filter((s) => !config.suites.includes(s.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ configured: true, projectId: config.projectId, pinned, others });
  } catch (err) {
    res.status(502).json({ configured: true, error: err.message });
  }
});

app.get("/api/requests/:id/testrail/plan", (req, res) => {
  const found = openCases(req.params.id);
  if (found.error) return res.status(found.status).json({ error: found.error });

  const { record, csv } = found;
  const config = testrailUpload.readConfig();
  const key = storyKey(record);
  const table = parseCsvTable(csv);
  const plan = testrailUpload.buildUploadPlan(table.columns, table.rows, {
    refs: key,
    fallbackPlatform: String(req.query.fallbackPlatform || ""),
  });

  res.json({
    configured: !!config,
    folderName: storyTitle(key) || record.label || key || "",
    refs: key,
    sourceCount: plan.sourceCount,
    total: plan.total,
    missingPlatform: plan.missingPlatform,
    platformChoices: testrailUpload.PLATFORMS.map((p) => p.folder),
    folders: plan.folders.map((f) => ({ name: f.name, count: f.cases.length })),
    problems: plan.problems,
    uploads: record.testrailUploads || [],
  });
});

// Shared by the preview and the upload: validates where the cases go and
// builds the plan from the request's current CSV.
function syncTarget(req, config) {
  const found = openCases(req.params.id);
  if (found.error) return found;
  if (!config) return { status: 400, error: "TestRail is not set up — add testrail.local.json" };

  const { suiteId, placement, folderName, refs, fallbackPlatform } = req.body || {};
  const suite = Number(suiteId);
  const name = String(folderName || "").trim();
  if (!suite) return { status: 400, error: "pick a suite" };
  if (placement !== "standalone" && placement !== "new") {
    return { status: 400, error: "placement must be standalone or new" };
  }
  if (!name) return { status: 400, error: "the folder needs a name" };

  const { record, csv } = found;
  const key = storyKey(record);
  const table = parseCsvTable(csv);
  const plan = testrailUpload.buildUploadPlan(table.columns, table.rows, {
    refs: String(refs == null ? key : refs).trim(),
    pic: config.pic,
    fallbackPlatform: String(fallbackPlatform || ""),
  });
  if (plan.problems.length) {
    return { status: 400, error: "some cases cannot be uploaded", problems: plan.problems };
  }
  if (!plan.total) return { status: 400, error: "there are no cases to upload" };

  return {
    ...found,
    key,
    plan,
    target: {
      projectId: config.projectId,
      suiteId: suite,
      placement,
      folderName: name,
      plan,
      // Source id → TestRail case id from earlier uploads into this suite.
      links: (record.testrailLinks || {})[suite] || {},
    },
  };
}

function sendTargetError(res, t) {
  res.status(t.status).json({ error: t.error, ...(t.problems && { problems: t.problems }) });
}

// Read-only: what an upload with these settings would add, update and retire.
app.post("/api/requests/:id/testrail/preview", async (req, res) => {
  const config = testrailUpload.readConfig();
  const t = syncTarget(req, config);
  if (t.error) return sendTargetError(res, t);

  try {
    const diff = await testrailUpload.reconcile(testrailUpload.createClient(config), t.target);
    res.json({
      storyExists: !!diff.story,
      counts: testrailUpload.countOps(diff),
      folders: diff.folders.map((f) => {
        const n = { add: 0, update: 0, same: 0 };
        f.ops.forEach((op) => n[op.kind]++);
        return { name: f.name, ...n };
      }),
      updates: diff.folders.flatMap((f) => f.ops
        .filter((op) => op.kind === "update")
        .map((op) => ({ folder: f.name, caseId: op.caseId, title: op.title, fields: Object.keys(op.changes) }))),
      obsolete: diff.obsolete,
      untouched: diff.untouched,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/requests/:id/testrail/upload", async (req, res) => {
  const id = req.params.id;
  const config = testrailUpload.readConfig();
  const t = syncTarget(req, config);
  if (t.error) return sendTargetError(res, t);
  if (uploadsInFlight.has(id)) return res.status(409).json({ error: "this request is already uploading" });

  const { meta, record, key, target } = t;
  const markObsolete = !!(req.body && req.body.markObsolete);
  const progress = { total: 0, done: 0, step: "folders", folder: null };
  uploadsInFlight.set(id, progress);
  try {
    const client = testrailUpload.createClient(config);
    // Reconciled again rather than trusting the preview: TestRail may have
    // changed since the dialog opened.
    const diff = await testrailUpload.reconcile(client, target);
    const counts = testrailUpload.countOps(diff);
    progress.total = counts.add + counts.update + (markObsolete ? counts.obsolete : 0);

    const result = await testrailUpload.applySync(client, diff, {
      projectId: target.projectId,
      suiteId: target.suiteId,
      folderName: target.folderName,
      folderDescription: testrailUpload.jiraUrl(key, record.description),
      markObsolete,
      onProgress: (p) => Object.assign(progress, p),
    });

    const suite = target.suiteId;
    const suiteName = (suiteCache.suites.find((s) => s.id === suite) || {}).name || String(suite);
    const upload = {
      at: new Date().toISOString(),
      mode: "sync",
      suiteId: suite,
      suiteName,
      placement: target.placement,
      folderName: target.folderName,
      sectionId: result.storySectionId,
      url: testrailUpload.sectionUrl(config, suite, result.storySectionId),
      planned: progress.total,
      done: result.done,
      added: result.added,
      updated: result.updated,
      unchanged: result.unchanged,
      obsoleted: result.obsoleted,
      notRetired: markObsolete ? 0 : counts.obsolete,
      // Kept for older readers of the log: cases newly created by this run.
      created: result.added,
      folders: result.folders.map((f) => ({
        name: f.name, sectionId: f.sectionId, added: f.added, updated: f.updated, unchanged: f.unchanged,
      })),
      error: result.error,
    };

    // Re-read: the sheet may have saved while the upload ran.
    const latest = JSON.parse(fs.readFileSync(meta, "utf-8"));
    latest.testrailUploads = [...(latest.testrailUploads || []), upload];
    const links = { ...(latest.testrailLinks || {}) };
    const suiteLinks = { ...(links[suite] || {}) };
    for (const [folder, byId] of Object.entries(result.links)) {
      suiteLinks[folder] = { ...(suiteLinks[folder] || {}), ...byId };
    }
    links[suite] = suiteLinks;
    latest.testrailLinks = links;
    fs.writeFileSync(meta, JSON.stringify(latest, null, 2));

    res.status(result.error ? 502 : 200).json({ ok: !result.error, storyCreated: result.storyCreated, ...upload });
  } catch (err) {
    res.status(502).json({ error: err.message });
  } finally {
    uploadsInFlight.delete(id);
  }
});

app.get("/api/requests/:id/testrail/progress", (req, res) => {
  const progress = uploadsInFlight.get(req.params.id);
  res.json(progress ? { running: true, ...progress } : { running: false });
});

// --- Share P0 ---
//
// P0 cases of one or more sheets → a new Google Sheet in the ADC account's
// Drive, or a CSV of the same rows when Google is not reachable.

function p0Sources(ids) {
  if (!Array.isArray(ids) || !ids.length) return { status: 400, error: "pick at least one case sheet" };
  if (ids.length > 200) return { status: 400, error: "pick at most 200 case sheets" };

  const sources = [];
  for (const id of ids) {
    if (typeof id !== "string" || !REQUEST_ID.test(id)) return { status: 400, error: "bad request id" };
    const found = openCases(id);
    if (found.error) return { status: found.status, error: `${id.slice(0, 8)}: ${found.error}` };
    const { record, csv } = found;
    const key = storyKey(record);
    const table = parseCsvTable(csv);
    sources.push({
      id,
      columns: table.columns,
      rows: table.rows,
      story: storyTitle(key) || record.label || key || "",
      link: testrailUpload.jiraUrl(key, record.description || ""),
    });
  }
  return { sources };
}

// Which spreadsheet a selection was already shared as, keyed by its sorted request
// IDs, so the same selection reopens the link instead of making a second sheet.
// Lives in queue/ because it is runtime state like the rest of the queue.
const P0_SHARES_FILE = path.join(QUEUE_DIR, "p0-shares.json");

function p0Key(ids) {
  return [...new Set(ids)].sort().join(",");
}

function readP0Shares() {
  try {
    return JSON.parse(fs.readFileSync(P0_SHARES_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeP0Shares(shares) {
  fs.writeFileSync(P0_SHARES_FILE, JSON.stringify(shares, null, 2));
}

function p0Hash(rows) {
  return require("crypto").createHash("sha1").update(JSON.stringify(rows)).digest("hex");
}

function p0Existing(ids, sheet) {
  const saved = readP0Shares()[p0Key(ids)];
  if (!saved) return null;
  // The P0 set moved on since the sheet was made: say so, but don't replace it.
  return { ...saved, changed: saved.hash !== p0Hash(sheet.rows) };
}

function p0Label(id) {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${id}_request.json`), "utf-8"));
    return storyTitle(storyKey(record)) || record.label || id.slice(0, 8);
  } catch {
    return id.slice(0, 8);
  }
}

// Saved spreadsheets made from a different selection that still holds some of
// these sheets — "Passport Scanner" alone is already in the sheet made for
// "Family Group + Passport Scanner". Newest first.
function p0Related(ids) {
  const wanted = new Set(ids);
  const exact = p0Key(ids);
  return Object.entries(readP0Shares())
    .filter(([key]) => key !== exact)
    .map(([key, saved]) => {
      const members = key.split(",");
      const shared = members.filter((id) => wanted.has(id));
      if (!shared.length) return null;
      return {
        ids: members,
        url: saved.url,
        spreadsheetId: saved.spreadsheetId,
        title: saved.title,
        createdAt: saved.createdAt,
        sharedLabels: shared.map(p0Label),
        otherLabels: members.filter((id) => !wanted.has(id)).map(p0Label),
        coversAll: ids.every((id) => members.includes(id)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function rememberP0Share(ids, sheet, { url, spreadsheetId, account }) {
  const shares = readP0Shares();
  shares[p0Key(ids)] = {
    url,
    spreadsheetId: spreadsheetId || (String(url).match(/\/d\/([\w-]+)/) || [])[1] || "",
    title: sheet.title,
    account: account || "",
    rowCount: sheet.rows.length,
    hash: p0Hash(sheet.rows),
    createdAt: new Date().toISOString(),
  };
  writeP0Shares(shares);
  return shares[p0Key(ids)];
}

function p0Sheet(req) {
  const found = p0Sources((req.body || {}).ids);
  if (found.error) return found;
  const built = p0Share.buildP0Rows(found.sources);
  return { ...built, title: p0Share.sheetTitle() };
}

async function p0Google() {
  const config = p0Share.readConfig();
  const token = await p0Share.gcloudToken();
  return { config, client: p0Share.createGoogleClient({ token, quotaProject: config.quotaProject }) };
}

function p0Failure(err) {
  return {
    error: err.message,
    ...(err.login && { loginCommand: p0Share.LOGIN_COMMAND }),
  };
}

// Read-only: what would go into the sheet, and whose Drive it would land in.
app.post("/api/p0/preview", async (req, res) => {
  const sheet = p0Sheet(req);
  if (sheet.error) return res.status(sheet.status).json({ error: sheet.error });

  let google;
  try {
    const scriptConfig = p0Share.readConfig();
    if (scriptConfig.appsScriptUrl) {
      google = {
        mode: "apps-script",
        scriptUrl: scriptConfig.appsScriptUrl,
        account: scriptConfig.account,
        shareDomain: scriptConfig.shareDomain,
      };
      return res.json({
        title: sheet.title,
        headers: sheet.headers,
        rowCount: sheet.rows.length,
        perSource: sheet.perSource,
        existing: p0Existing(req.body.ids, sheet),
        related: p0Related(req.body.ids),
        google,
      });
    }
    const { config, client } = await p0Google();
    const who = await client.whoami();
    google = p0Share.canCreateSheets(who.scopes)
      ? { account: who.email, shareDomain: config.shareDomain }
      : {
          account: who.email,
          canCreate: false,
          error: `${who.email || "This account"}'s gcloud credentials have no Google Sheets access`,
          loginCommand: p0Share.LOGIN_COMMAND,
        };
  } catch (err) {
    google = p0Failure(err);
  }

  res.json({
    title: sheet.title,
    headers: sheet.headers,
    rowCount: sheet.rows.length,
    perSource: sheet.perSource,
    existing: p0Existing(req.body.ids, sheet),
    related: p0Related(req.body.ids),
    google,
  });
});

// Creates the spreadsheet. A Google failure is not an HTTP error: the response
// carries the CSV so the dialog can hand it over as the fallback.
app.post("/api/p0/share", async (req, res) => {
  const sheet = p0Sheet(req);
  if (sheet.error) return res.status(sheet.status).json({ error: sheet.error });
  if (!sheet.rows.length) return res.status(400).json({ error: "the selected sheets have no P0 cases" });

  const csv = p0Share.toCsv(sheet.headers, sheet.rows);
  const filename = `${sheet.title}.csv`;

  try {
    // The browser does this route: it form-posts the payload to the web app in a new tab.
    const scriptConfig = p0Share.readConfig();
    if (scriptConfig.appsScriptUrl) {
      return res.json({
        ok: true,
        mode: "apps-script",
        scriptUrl: scriptConfig.appsScriptUrl,
        payload: {
          title: sheet.title,
          headers: sheet.headers,
          rows: sheet.rows,
          shareDomain: scriptConfig.shareDomain,
        },
      });
    }
    const { config, client } = await p0Google();
    const who = await client.whoami().catch(() => ({ email: "" }));
    const created = await client.createSpreadsheet(sheet.title, sheet.headers, sheet.rows);

    let shared = "";
    let shareError = "";
    if (config.shareDomain) {
      try {
        await client.shareWithDomain(created.spreadsheetId, config.shareDomain);
        shared = config.shareDomain;
      } catch (err) {
        shareError = err.message;
      }
    }

    rememberP0Share(req.body.ids, sheet, {
      url: created.spreadsheetUrl,
      spreadsheetId: created.spreadsheetId,
      account: who.email,
    });
    res.json({
      ok: true,
      url: created.spreadsheetUrl,
      title: sheet.title,
      account: who.email,
      rowCount: sheet.rows.length,
      shared,
      shareError,
    });
  } catch (err) {
    res.json({ ok: false, ...p0Failure(err), title: sheet.title, rowCount: sheet.rows.length, csv, filename });
  }
});

// The Apps Script route creates the sheet in the browser, which reports it here.
app.post("/api/p0/record", (req, res) => {
  const sheet = p0Sheet(req);
  if (sheet.error) return res.status(sheet.status).json({ error: sheet.error });
  const { url, spreadsheetId, account } = req.body;
  if (typeof url !== "string" || !/^https:\/\/docs\.google\.com\//.test(url)) {
    return res.status(400).json({ error: "not a Google Sheets link" });
  }
  res.json({ ok: true, saved: rememberP0Share(req.body.ids, sheet, { url, spreadsheetId, account }) });
});

// The saved sheet is gone (deleted in Drive), so the selection can be shared afresh.
app.post("/api/p0/forget", (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids are required" });
  const shares = readP0Shares();
  delete shares[p0Key(ids)];
  writeP0Shares(shares);
  res.json({ ok: true });
});

app.post("/api/p0/csv", (req, res) => {
  const sheet = p0Sheet(req);
  if (sheet.error) return res.status(sheet.status).json({ error: sheet.error });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  setDownloadName(res, `${sheet.title}.csv`);
  res.send(p0Share.toCsv(sheet.headers, sheet.rows));
});

app.get("/api/requests/:id/knowledge", (req, res) => {
  const meta = path.join(QUEUE_DIR, `${req.params.id}_request.json`);
  if (!fs.existsSync(meta)) return res.status(404).json({ error: "not found" });

  const record = JSON.parse(fs.readFileSync(meta, "utf-8"));
  if (record.status !== "done") {
    return res.status(409).json({ error: "knowledge note not ready yet" });
  }

  const key = record.knowledgeKey;
  // Guard against path traversal — the key becomes a filename.
  if (!key || !/^[A-Za-z0-9._-]+$/.test(key)) {
    return res.status(404).json({ error: "no knowledge note recorded for this request" });
  }

  const noteFile = path.join(__dirname, "knowledge", "entries", `${key}.md`);
  if (!fs.existsSync(noteFile)) {
    return res.status(404).json({ error: "knowledge note file missing" });
  }

  if (!record.downloaded) {
    record.downloaded = true;
    record.downloadedAt = new Date().toISOString();
    fs.writeFileSync(meta, JSON.stringify(record, null, 2));
  }

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  setDownloadName(res, `${key}.md`);
  res.send(fs.readFileSync(noteFile, "utf-8"));
});

app.get("/new", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "new.html"));
});

app.get("/cases", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "cases.html"));
});

app.delete("/api/requests/:id", (req, res) => {
  const id = req.params.id;

  const metaPath = path.join(QUEUE_DIR, `${id}_request.json`);
  let attachmentFiles = [];
  if (fs.existsSync(metaPath)) {
    try {
      const record = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      // Only this request's own attachment files, never a path the record names.
      attachmentFiles = (record.attachments || [])
        .map((a) => String((a && a.filename) || ""))
        .filter((name) => name.startsWith(`${id}_attach_`) && path.basename(name) === name);
    } catch {}
  }

  const toDelete = [
    `${id}_request.json`,
    `${id}_input.csv`,
    `${id}_result.csv`,
    ...attachmentFiles,
  ];
  toDelete.forEach((p) => {
    const fp = path.join(QUEUE_DIR, p);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
  res.json({ ok: true });
});

// --- Start ---

app.listen(PORT, HOST, () => {
  console.log(`TC Queue UI running at http://localhost:${PORT}`);
});
