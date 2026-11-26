"use strict";

const TESTRAIL_HEADERS = [
  "Section",
  "Section Description",
  "Title",
  "Steps",
  "Expected Result",
  "Reference",
  "Automation Status",
  "Automation Type",
  "Platform",
  "Criticality",
  "Created by AI",
  "Test case Status",
  "Type",
  "Case Type",
  "Priority",
];

const EDITABLE_COLUMNS = new Set([
  "Title",
  "Steps",
  "Expected Result",
  "Platform",
  "Criticality",
  "Case Type",
  "Priority",
]);

const TESTRAIL_TO_SOURCE = {
  Title: "case",
  Steps: "steps",
  "Expected Result": "expected result",
  Platform: "platform",
  Criticality: "criticality",
  "Case Type": "type",
  Priority: "priority",
};

// Standards and encodings that look like issue keys ("UTF-8", "SHA-256").
const NOT_JIRA_PREFIX = /^(UTF|UCS|SHA|MD|ISO|IEC|RFC|COVID|AES|RSA|TLS|SSL|HTTP|IPV|WCAG|ES|ECMA|CVE|CWE|OWASP|PCI|GMT|UTC|IEEE)-/;

function extractJiraId(description) {
  const text = String(description || "");
  const urlMatch = text.match(/\/browse\/([A-Z]+-\d+)/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  for (const [, key] of text.matchAll(/\b([A-Z]{2,10}-\d+)\b/g)) {
    if (!NOT_JIRA_PREFIX.test(key)) return key;
  }
  return "";
}

function extractJiraLink(description) {
  const urlMatch = description.match(/(https?:\/\/[^\s]+\/browse\/[A-Z]+-\d+)/i);
  return urlMatch ? urlMatch[1] : description;
}

// A title that reads as a negative case. Shared with the TestRail upload.
const NEGATIVE_TITLE =
  /\bnot\b|invalid|reject|fail|error|gracefully|missing|without|\bnon[\s-]|empty|exceed|unsupported|deactivat/i;

function inferFunctionalType(caseTitle) {
  return NEGATIVE_TITLE.test(caseTitle)
    ? "Functional Negative"
    : "Functional Positive";
}

function sourceIndex(columns, name) {
  const needle = name.toLowerCase();
  return columns.findIndex((c) => String(c).toLowerCase() === needle);
}

function sourceValue(columns, row, name) {
  const i = sourceIndex(columns, name);
  return i >= 0 && row[i] != null ? String(row[i]) : "";
}

// Keep list items inside one CSV cell, separated by real newlines.
function formatNumberedList(value) {
  const text = String(value == null ? "" : value);
  if (!/^\s*1[.)]\s+/.test(text)) return text;
  let next = 2;
  return text.replace(/(\s+)(\d+)([.)])(?=[ \t]+\S)/g, (match, space, number, punctuation) => {
    if (Number(number) !== next) return match;
    next++;
    return `${space.includes("\n") ? space : "\n"}${number}${punctuation}`;
  });
}

function toTestrailTable(sourceColumns, sourceRows, record = {}) {
  const description = record.description || "";
  const jiraId = extractJiraId(description);
  const jiraLink = extractJiraLink(description);
  const section = record.label || jiraId || "Untitled";

  const rows = sourceRows.map((row) => {
    const title = sourceValue(sourceColumns, row, "case");
    return [
      section,
      jiraLink,
      title,
      formatNumberedList(sourceValue(sourceColumns, row, "steps")),
      formatNumberedList(sourceValue(sourceColumns, row, "expected result")),
      jiraId,
      "Not Yet",
      "TBR",
      sourceValue(sourceColumns, row, "platform"),
      sourceValue(sourceColumns, row, "criticality"),
      "Yes",
      "Approved",
      inferFunctionalType(title),
      sourceValue(sourceColumns, row, "type"),
      sourceValue(sourceColumns, row, "priority").toLowerCase(),
    ];
  });

  return { columns: TESTRAIL_HEADERS.slice(), rows };
}

function sameTestrailHeaders(columns) {
  return (
    Array.isArray(columns) &&
    columns.length === TESTRAIL_HEADERS.length &&
    TESTRAIL_HEADERS.every((name, i) => columns[i] === name)
  );
}

function normalizePriority(value) {
  const s = String(value == null ? "" : value).trim();
  const match = /^p([0-3])$/i.exec(s);
  return match ? `P${match[1]}` : s;
}

function nextSourceId(sourceColumns, rows) {
  const idIdx = sourceIndex(sourceColumns, "id");
  if (idIdx < 0) return "";

  let prefix = "";
  let width = 0;
  let highest = 0;
  let found = false;

  for (const row of rows) {
    const match = /^([A-Za-z]*)(\d+)$/.exec(String(row[idIdx] || "").trim());
    if (!match) continue;
    found = true;
    prefix = match[1];
    width = Math.max(width, match[2].length);
    highest = Math.max(highest, Number(match[2]));
  }

  return found ? prefix + String(highest + 1).padStart(width, "0") : "TC01";
}

// One key per row, unique even when the CSV repeats an id: a repeat gets "#n"
// so each row pairs back with itself on save, not with the first of its id.
function sourceRowKeys(sourceColumns, sourceRows) {
  const idIdx = sourceIndex(sourceColumns, "id");
  const seen = new Set();
  return sourceRows.map((row, i) => {
    const id = idIdx >= 0 ? String(row[idIdx] || "").trim() : "";
    let key = id || String(i);
    for (let n = 2; seen.has(key); n++) key = `${id || i}#${n}`;
    seen.add(key);
    return key;
  });
}

// How a source cell is shown in the sheet (see toTestrailTable).
function displayedValue(sourceName, value) {
  if (sourceName === "steps" || sourceName === "expected result") return formatNumberedList(value);
  if (sourceName === "priority") return String(value).toLowerCase();
  return String(value);
}

function applyTestrailEdits(
  sourceColumns,
  sourceRows,
  testrailColumns,
  testrailRows,
  rowKeys = [],
) {
  if (!sameTestrailHeaders(testrailColumns)) {
    throw new Error("the sheet must use the TestRail columns");
  }

  const testrailIndex = (name) => TESTRAIL_HEADERS.indexOf(name);
  const idIdx = sourceIndex(sourceColumns, "id");
  const byKey = new Map();
  sourceRowKeys(sourceColumns, sourceRows).forEach((key, i) => byKey.set(key, sourceRows[i]));

  const built = [];

  for (let i = 0; i < testrailRows.length; i++) {
    const incoming = Array.isArray(testrailRows[i]) ? testrailRows[i] : [];
    const key = rowKeys[i] != null ? String(rowKeys[i]).trim() : "";
    const existing = key && byKey.has(key) ? byKey.get(key) : null;
    const next = existing
      ? existing.slice()
      : sourceColumns.map(() => "");

    if (!existing && idIdx >= 0) {
      next[idIdx] = nextSourceId(sourceColumns, [...sourceRows, ...built]);
    }

    for (const [testrailName, sourceName] of Object.entries(TESTRAIL_TO_SOURCE)) {
      const si = sourceIndex(sourceColumns, sourceName);
      if (si < 0) continue;
      let value = incoming[testrailIndex(testrailName)];
      value = value == null ? "" : String(value);
      // Untouched cells keep their source bytes, so a one-cell save does not
      // reformat every other row.
      if (existing && value === displayedValue(sourceName, existing[si] == null ? "" : existing[si])) continue;
      if (sourceName === "priority") value = normalizePriority(value);
      if (sourceName === "steps" || sourceName === "expected result") value = formatNumberedList(value);
      next[si] = value;
    }

    built.push(next);
  }

  return built;
}

module.exports = {
  formatNumberedList,
  extractJiraId,
  NEGATIVE_TITLE,
  TESTRAIL_HEADERS,
  EDITABLE_COLUMNS,
  toTestrailTable,
  applyTestrailEdits,
  sameTestrailHeaders,
  sourceRowKeys,
  sourceIndex,
};
