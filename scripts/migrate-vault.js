#!/usr/bin/env node
/**
 * One-time migration: upgrade knowledge/entries/*.md (bullet metadata) into
 * Obsidian-native notes (YAML frontmatter + [[wikilinks]]), and mirror each
 * issue's output CSV into a searchable markdown table under knowledge/test-cases/.
 *
 * Safe to re-run: entries that already start with YAML frontmatter are skipped.
 * Test-case notes are always regenerated from the current CSVs.
 *
 *   node scripts/migrate-vault.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENTRIES_DIR = path.join(ROOT, "knowledge", "entries");
const TESTCASES_DIR = path.join(ROOT, "knowledge", "test-cases");
const OUTPUT_DIR = path.join(ROOT, "output");
const INDEX_PATH = path.join(ROOT, "knowledge", "index.json");

// ---------- CSV parsing (mirrors server.js semantics) ----------

function splitCsvRows(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '""';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
        current += ch;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
      current += ch;
    } else if (ch === "\n") {
      if (current.trim()) rows.push(current.replace(/\r$/, ""));
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) rows.push(current.replace(/\r$/, ""));
  return rows;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ---------- helpers ----------

const HEADER_LABELS = {
  id: "ID",
  case: "Case",
  preconditions: "Preconditions",
  steps: "Steps",
  "expected result": "Expected Result",
  type: "Type",
  validity: "Validity",
  reason: "Reason",
  priority: "Priority",
  criticality: "Criticality",
  platform: "Platform",
};

function labelFor(h) {
  const key = h.trim().toLowerCase();
  return HEADER_LABELS[key] || h.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function mdCell(v) {
  return String(v == null ? "" : v)
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>")
    .trim();
}

function toTag(s) {
  const t = s
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9_/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!t || /^[0-9]+$/.test(t)) return null; // Obsidian rejects purely-numeric tags
  return t;
}

function yamlString(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function camelToKebab(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripQuotes(s) {
  if (s == null) return null;
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"'))
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return s;
}

// Minimal frontmatter reader for the few fields needed to rebuild a test-case note.
function readFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const get = (k) => {
    const r = fm.match(new RegExp("^" + k + ":\\s*(.*)$", "m"));
    return r ? r[1].trim() : null;
  };
  const tagsLine = get("tags");
  return {
    key: stripQuotes(get("key")),
    title: stripQuotes(get("title")),
    date: get("date"),
    action: get("action"),
    tags: tagsLine
      ? tagsLine.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

// ---------- CSV resolution per entry ----------

function listCsvs() {
  return fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs }));
}

function resolveCsv(key, action, csvs) {
  const names = new Set(csvs.map((c) => c.name));
  const tryNames = [];

  // analyze runs are written as "<KEY>_<ts>.csv" / "[redo] <KEY>_<ts>.csv"
  if (action === "analyze") {
    const rx = new RegExp("^(\\[redo\\] )?" + reEscape(key) + "_\\d+\\.csv$", "i");
    const matches = csvs
      .filter((c) => rx.test(c.name))
      .sort((a, b) => {
        const ar = a.name.startsWith("[redo]") ? 1 : 0;
        const br = b.name.startsWith("[redo]") ? 1 : 0;
        if (ar !== br) return br - ar; // prefer [redo]
        return b.mtime - a.mtime; // then newest
      });
    if (matches.length) return matches[0].name;
  }

  tryNames.push(`tc-${key}.csv`);
  tryNames.push(`tc-${key.toLowerCase()}.csv`);
  const apiKebab = camelToKebab(key.replace(/-v\d+$/i, ""));
  tryNames.push(`tc-api-${apiKebab}.csv`);
  for (const n of tryNames) if (names.has(n)) return n;

  // last resort: any "<KEY>_*.csv"
  const rx2 = new RegExp("^(\\[redo\\] )?" + reEscape(key) + "_\\d+\\.csv$", "i");
  const m2 = csvs.filter((c) => rx2.test(c.name)).sort((a, b) => b.mtime - a.mtime);
  return m2.length ? m2[0].name : null;
}

// ---------- entry parsing ----------

function bullet(content, label) {
  const m = content.match(new RegExp("^- \\*\\*" + label + "\\*\\*:\\s*(.*)$", "m"));
  return m ? m[1].trim() : null;
}

function deriveKind(source, key) {
  const s = (source || "").toLowerCase();
  if (s.includes("epic")) return "epic";
  if (s.includes("story")) return "story";
  if (s.includes("confluence")) return "confluence";
  if (s.includes("curl") || s.includes("api")) return "api";
  if (s.includes("file") || s.includes("pdf") || s.includes("doc")) return "doc";
  if (/^[A-Z]+-\d+/.test(key)) return "epic";
  if (/^[A-Za-z]+$/.test(key)) return "api";
  return "doc";
}

function num(content, label) {
  const m = content.match(new RegExp("^- " + reEscape(label) + ":\\s*(\\d+)", "m"));
  return m ? Number(m[1]) : null;
}

function migrateEntry(file, index, csvs, report) {
  const full = path.join(ENTRIES_DIR, file);
  const raw = fs.readFileSync(full, "utf-8");

  // Already in Obsidian format: leave the entry's prose untouched, but still
  // (re)build its test-case note from the current CSV so the mirror stays fresh.
  if (raw.startsWith("---")) {
    const fm = readFrontmatter(raw) || {};
    const k = fm.key || file.replace(/\.md$/, "");
    const act = fm.action || (index[k] && index[k].type) || "create";
    const csvName = resolveCsv(k, act, csvs);
    if (csvName) {
      const tc = generateTestCaseNote({ key: k, title: fm.title || k, dateStr: fm.date, tags: fm.tags, csvName });
      report.testcases.push({ key: k, csv: csvName, rows: tc.rows });
    } else {
      report.noCsv.push(k);
    }
    report.skipped.push(file);
    return;
  }

  const key = file.replace(/\.md$/, "");
  const idx = index[key] || {};

  const title = bullet(raw, "Title") || idx.title || key;
  const source = bullet(raw, "Source") || "Unknown";
  const dateStr = bullet(raw, "Date") || idx.date || null;
  const figmaLine = bullet(raw, "Figma");
  const figma = !!figmaLine && /^yes/i.test(figmaLine);
  const figmaNote = figma ? figmaLine.replace(/^yes\s*[—-]\s*/i, "").trim() : null;

  const relRaw = bullet(raw, "Related issues") || "";
  const related =
    !relRaw || /^none$/i.test(relRaw.trim())
      ? idx.related || []
      : relRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const kwRaw = bullet(raw, "Keywords") || "";
  const keywords =
    kwRaw && !/^none$/i.test(kwRaw.trim())
      ? kwRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : idx.keywords || [];
  const tags = [...new Set(keywords.map(toTag).filter(Boolean))];

  // action: index type, else infer from body / source
  let action = idx.type || null;
  if (!action) {
    if (/##\s*Valid Case Count/i.test(raw)) action = "analyze";
    else if (deriveKind(source, key) === "api") action = "create-api";
    else action = "create";
  }
  const kind = deriveKind(source, key);

  const counts = {
    cases_total: num(raw, "Total"),
    cases_e2e: num(raw, "E2E"),
    cases_specific: num(raw, "Specific"),
    cases_valid: num(raw, "Original valid"),
    cases_additional: num(raw, "Additional added"),
    cases_invalid: num(raw, "Invalid removed"),
  };

  // resolve and (re)generate the test-case note
  const csvName = resolveCsv(key, action, csvs);
  let testCasesLink = null;
  if (csvName) {
    const tcNote = generateTestCaseNote({ key, title, dateStr, tags, csvName });
    testCasesLink = tcNote.noteName;
    report.testcases.push({ key, csv: csvName, rows: tcNote.rows });
  } else {
    report.noCsv.push(key);
  }

  // body = everything from the first "## " heading onward
  const bodyStart = raw.search(/^## /m);
  const body = bodyStart >= 0 ? raw.slice(bodyStart).trim() : "";

  // assemble frontmatter
  const fm = [];
  fm.push("---");
  fm.push(`kind: ${kind}`);
  fm.push(`key: ${yamlString(key)}`);
  fm.push(`title: ${yamlString(title)}`);
  fm.push(`source: ${yamlString(source)}`);
  fm.push(`action: ${action}`);
  if (dateStr) fm.push(`date: ${dateStr}`);
  fm.push(`figma: ${figma}`);
  if (figmaNote) fm.push(`figma_note: ${yamlString(figmaNote)}`);
  if (tags.length) fm.push(`tags: [${tags.join(", ")}]`);
  if (keywords.length) fm.push(`keywords: [${keywords.map(yamlString).join(", ")}]`);
  if (related.length)
    fm.push(`related: [${related.map((k) => yamlString(`[[${k}]]`)).join(", ")}]`);
  for (const [k, v] of Object.entries(counts)) if (v != null) fm.push(`${k}: ${v}`);
  if (testCasesLink) fm.push(`test_cases: ${yamlString(`[[${testCasesLink}]]`)}`);
  fm.push("---");

  const heading = `# ${key} — ${title}`;
  const relLine = related.length
    ? `\n> **Related:** ${related.map((k) => `[[${k}]]`).join(" · ")}`
    : "";
  const tcLine = testCasesLink ? `\n> **Test cases:** [[${testCasesLink}]]` : "";

  const out = `${fm.join("\n")}\n\n${heading}${relLine}${tcLine}\n\n${body}\n`;
  fs.writeFileSync(full, out);
  report.migrated.push(file);
}

// ---------- test-case note generation ----------

function generateTestCaseNote({ key, title, dateStr, tags, csvName }) {
  const csvPath = path.join(OUTPUT_DIR, csvName);
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = splitCsvRows(text);
  const header = parseCsvLine(rows[0]).map((h) => h.trim());
  const dataRows = rows.slice(1).map(parseCsvLine).filter((r) => r.some((c) => c.trim()));

  const labels = ["#", ...header.map(labelFor)];
  const sep = labels.map(() => "---");
  const lines = [`| ${labels.join(" | ")} |`, `| ${sep.join(" | ")} |`];
  dataRows.forEach((r, i) => {
    const cells = [String(i + 1), ...header.map((_, c) => mdCell(r[c]))];
    lines.push(`| ${cells.join(" | ")} |`);
  });

  const noteName = `${key} — Test Cases`;
  const tcTags = [...new Set([...(tags || []), "test-cases"])];
  const fm = [
    "---",
    "kind: testcases",
    `key: ${yamlString(key)}`,
    `title: ${yamlString(`${title} — Test Cases`)}`,
    `source_issue: ${yamlString(`[[${key}]]`)}`,
    `csv: ${yamlString(`output/${csvName}`)}`,
    `count: ${dataRows.length}`,
  ];
  if (dateStr) fm.push(`date: ${dateStr}`);
  if (tcTags.length) fm.push(`tags: [${tcTags.join(", ")}]`);
  fm.push("---");

  const out =
    `${fm.join("\n")}\n\n` +
    `# ${key} — Test Cases\n\n` +
    `> Source issue: [[${key}]] · Source CSV: \`output/${csvName}\` · ${dataRows.length} cases\n\n` +
    `${lines.join("\n")}\n`;

  fs.mkdirSync(TESTCASES_DIR, { recursive: true });
  fs.writeFileSync(path.join(TESTCASES_DIR, `${noteName}.md`), out);
  return { noteName, rows: dataRows.length };
}

// ---------- main ----------

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8")).entries || {};
  const csvs = listCsvs();
  const files = fs.readdirSync(ENTRIES_DIR).filter((f) => f.endsWith(".md"));
  const report = { migrated: [], skipped: [], testcases: [], noCsv: [] };

  for (const file of files) {
    try {
      migrateEntry(file, index, csvs, report);
    } catch (e) {
      console.error(`ERROR migrating ${file}:`, e.message);
    }
  }

  console.log("\n=== Migration report ===");
  console.log(`Entries migrated:        ${report.migrated.length}`);
  console.log(`Entries skipped (done):  ${report.skipped.length}`);
  console.log(`Test-case notes written: ${report.testcases.length}`);
  if (report.noCsv.length) {
    console.log(`\nEntries with no matching CSV (no test-case note):`);
    report.noCsv.forEach((k) => console.log(`  - ${k}`));
  }
  console.log("\nTest-case notes:");
  report.testcases.forEach((t) => console.log(`  - ${t.key}  ←  ${t.csv}  (${t.rows} rows)`));
}

main();
