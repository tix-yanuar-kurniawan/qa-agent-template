"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  TESTRAIL_HEADERS,
  EDITABLE_COLUMNS,
  toTestrailTable,
  applyTestrailEdits,
} = require("./testrail-sheet");

const SOURCE_COLUMNS = [
  "id",
  "case",
  "preconditions",
  "steps",
  "expected result",
  "type",
  "priority",
  "criticality",
  "platform",
];

function sourceRow(overrides = {}) {
  const base = {
    id: "TC01",
    case: "Verify hit API with mapped holder",
    preconditions: "account: userId=101670323",
    steps: "curl -X GET ...",
    "expected result": "HTTP 200 SUCCESS",
    type: "e2e - regression",
    priority: "P0",
    criticality: "critical",
    platform: "API",
  };
  return SOURCE_COLUMNS.map((name) =>
    Object.prototype.hasOwnProperty.call(overrides, name)
      ? overrides[name]
      : base[name],
  );
}

function testrailValue(row, name) {
  return row[TESTRAIL_HEADERS.indexOf(name)];
}

describe("toTestrailTable", () => {
  it("emits the TestRail import columns, not the source headers", () => {
    const table = toTestrailTable(SOURCE_COLUMNS, [sourceRow()], {
      label: "PLAT-59678 - BCA",
      description: "curl ...",
    });
    assert.deepEqual(table.columns, TESTRAIL_HEADERS);
    assert.equal(table.rows.length, 1);
    assert.equal(testrailValue(table.rows[0], "Title"), "Verify hit API with mapped holder");
    assert.equal(testrailValue(table.rows[0], "Steps"), "curl -X GET ...");
    assert.equal(testrailValue(table.rows[0], "Expected Result"), "HTTP 200 SUCCESS");
    assert.equal(testrailValue(table.rows[0], "Case Type"), "e2e - regression");
    assert.equal(testrailValue(table.rows[0], "Priority"), "p0");
    assert.equal(testrailValue(table.rows[0], "Section"), "PLAT-59678 - BCA");
    assert.equal(testrailValue(table.rows[0], "Created by AI"), "Yes");
    assert.ok(!table.columns.includes("preconditions"));
    assert.ok(!table.columns.includes("id"));
  });

  it("marks Title, Steps, Expected Result, Platform, Criticality, Case Type, Priority as editable", () => {
    assert.deepEqual(
      [...EDITABLE_COLUMNS].sort(),
      [
        "Case Type",
        "Criticality",
        "Expected Result",
        "Platform",
        "Priority",
        "Steps",
        "Title",
      ].sort(),
    );
  });
});

describe("applyTestrailEdits", () => {
  it("writes editable fields back and leaves source-only columns in place", () => {
    const source = [sourceRow(), sourceRow({ id: "TC02", case: "Verify registered holder" })];
    const view = toTestrailTable(SOURCE_COLUMNS, source, { label: "PLAT-59678", description: "" });
    const edited = view.rows.map((row) => row.slice());
    edited[0][TESTRAIL_HEADERS.indexOf("Title")] = "Verify mapped holder (edited)";
    edited[0][TESTRAIL_HEADERS.indexOf("Priority")] = "p1";
    edited[0][TESTRAIL_HEADERS.indexOf("Section")] = "should be ignored";

    const next = applyTestrailEdits(SOURCE_COLUMNS, source, view.columns, edited, ["TC01", "TC02"]);
    assert.equal(next.length, 2);
    assert.equal(next[0][SOURCE_COLUMNS.indexOf("case")], "Verify mapped holder (edited)");
    assert.equal(next[0][SOURCE_COLUMNS.indexOf("priority")], "P1");
    assert.equal(next[0][SOURCE_COLUMNS.indexOf("preconditions")], "account: userId=101670323");
    assert.equal(next[0][SOURCE_COLUMNS.indexOf("id")], "TC01");
    assert.equal(next[1][SOURCE_COLUMNS.indexOf("case")], "Verify registered holder");
  });

  it("appends a new row with the next id and drops deleted rows", () => {
    const source = [sourceRow(), sourceRow({ id: "TC02", case: "Keep me" })];
    const view = toTestrailTable(SOURCE_COLUMNS, source, { label: "X", description: "" });
    const kept = view.rows[1].slice();
    const added = TESTRAIL_HEADERS.map((name) => {
      if (name === "Title") return "Verify new case";
      if (name === "Steps") return "1. Do it";
      if (name === "Expected Result") return "It works";
      if (name === "Priority") return "p2";
      if (name === "Criticality") return "medium";
      if (name === "Case Type") return "specific";
      if (name === "Platform") return "API";
      return kept[TESTRAIL_HEADERS.indexOf(name)] || "";
    });

    const next = applyTestrailEdits(
      SOURCE_COLUMNS,
      source,
      view.columns,
      [kept, added],
      ["TC02", ""],
    );
    assert.equal(next.length, 2);
    assert.equal(next[0][SOURCE_COLUMNS.indexOf("id")], "TC02");
    assert.equal(next[0][SOURCE_COLUMNS.indexOf("case")], "Keep me");
    assert.equal(next[1][SOURCE_COLUMNS.indexOf("id")], "TC03");
    assert.equal(next[1][SOURCE_COLUMNS.indexOf("case")], "Verify new case");
    assert.equal(next[1][SOURCE_COLUMNS.indexOf("preconditions")], "");
  });

  it("maps a 7-column API CSV with no id column", () => {
    const cols = [
      "case",
      "steps",
      "expected result",
      "type",
      "priority",
      "criticality",
      "platform",
    ];
    const rows = [
      [
        "Verify hit API",
        "curl ...",
        "200",
        "specific",
        "P0",
        "high",
        "API",
      ],
    ];
    const view = toTestrailTable(cols, rows, { label: "API", description: "" });
    const edited = view.rows.map((row) => row.slice());
    edited[0][TESTRAIL_HEADERS.indexOf("Title")] = "Verify hit API edited";
    const next = applyTestrailEdits(cols, rows, view.columns, edited, ["0"]);
    assert.equal(next[0][0], "Verify hit API edited");
    assert.equal(next[0].length, 7);
  });

  it("rejects a sheet whose headers are not the TestRail set", () => {
    assert.throws(
      () => applyTestrailEdits(SOURCE_COLUMNS, [sourceRow()], ["Title", "Steps"], [["a", "b"]], ["TC01"]),
      /testrail/i,
    );
  });
});

describe("multiline CSV results", () => {
  it("formats both fields and preserves quoting through the download converter", () => {
    const fs = require("node:fs");
    const vm = require("node:vm");
    const source = fs.readFileSync(require.resolve("./server"), "utf8");
    const context = vm.createContext({ toTestrailTable, ...require("./csv-table") });
    vm.runInContext(source.slice(source.indexOf("function csvQuote("), source.indexOf("// --- Editable test cases ---")), context);
    const csv = 'case,steps,expected result\n"Example","1. Open 2.5. 2. Click ""Save"".","1. Saved, successfully. 2. Balance is 10.00."\n';
    const exported = context.convertToTestrailCsv(csv, {});
    const table = context.parseCsvTable(exported);
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0].length, 15);
    assert.equal(table.rows[0][3], '1. Open 2.5.\n2. Click "Save".');
    assert.equal(table.rows[0][4], '1. Saved, successfully.\n2. Balance is 10.00.');
    const original = context.parseCsvTable(csv);
    // Sent back unedited, the cells keep their source text rather than the display form.
    const edited = applyTestrailEdits(original.columns, original.rows, table.columns, table.rows, ["0"]);
    assert.deepEqual(edited, original.rows);
  });
});

describe("save round-trip", () => {
  const { sourceRowKeys, extractJiraId } = require("./testrail-sheet");

  it("keeps each row's own preconditions when ids repeat", () => {
    const rows = [
      sourceRow({ id: "TC01", case: "A", preconditions: "pre1" }),
      sourceRow({ id: "TC01", case: "B", preconditions: "pre2" }),
    ];
    const keys = sourceRowKeys(SOURCE_COLUMNS, rows);
    assert.deepEqual(keys, ["TC01", "TC01#2"]);
    const table = toTestrailTable(SOURCE_COLUMNS, rows);
    const out = applyTestrailEdits(SOURCE_COLUMNS, rows, table.columns, table.rows, keys);
    assert.deepEqual(out, rows);
  });

  it("leaves untouched cells byte-for-byte as they were", () => {
    const rows = [sourceRow({ steps: "1. Open app 2. Tap", "expected result": "1. ok 2. fine", priority: "p0" })];
    const table = toTestrailTable(SOURCE_COLUMNS, rows);
    const out = applyTestrailEdits(SOURCE_COLUMNS, rows, table.columns, table.rows, sourceRowKeys(SOURCE_COLUMNS, rows));
    assert.deepEqual(out, rows);
  });

  it("still formats a cell the user edited", () => {
    const rows = [sourceRow()];
    const table = toTestrailTable(SOURCE_COLUMNS, rows);
    table.rows[0][TESTRAIL_HEADERS.indexOf("Steps")] = "1. a 2. b";
    const out = applyTestrailEdits(SOURCE_COLUMNS, rows, table.columns, table.rows, ["TC01"]);
    assert.equal(out[0][SOURCE_COLUMNS.indexOf("steps")], "1. a\n2. b");
  });

  it("does not take UTF-8 or SHA-256 for a Jira key", () => {
    assert.equal(extractJiraId("Export as UTF-8, hash with SHA-256, story PLAT-123"), "PLAT-123");
    assert.equal(extractJiraId("Export as UTF-8"), "");
    assert.equal(extractJiraId("https://x.atlassian.net/browse/abc-9"), "ABC-9");
  });
});
