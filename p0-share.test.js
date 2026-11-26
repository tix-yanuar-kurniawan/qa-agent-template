"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildP0Rows, toCsv, sheetTitle, createGoogleClient, HEADERS } = require("./p0-share");

const COLUMNS = ["id", "case", "platform", "priority"];

function source(rows, extra = {}) {
  return {
    id: "req-1",
    columns: COLUMNS,
    rows,
    story: "[FE] TIKETCUAN Affiliate Leaderboard",
    link: "https://borobudur.atlassian.net/browse/PLAT-58520",
    ...extra,
  };
}

const LINK = "https://borobudur.atlassian.net/browse/PLAT-58520";
const STORY = "[FE] TIKETCUAN Affiliate Leaderboard";

test("buildP0Rows keeps only P0 cases, as Jira Title | Jira Link | Case | Platforms", () => {
  const { headers, rows, perSource } = buildP0Rows([
    source([
      ["TC-1", "Verify leaderboard loads", "Responsive", "P0"],
      ["TC-2", "Verify empty tier", "Responsive", "P1"],
      ["TC-3", "Verify join CTA", "Responsive", "p0"],
    ]),
  ]);
  assert.deepEqual(headers, ["Jira Title", "Jira Link", "Case", "Platforms"]);
  assert.deepEqual(rows, [
    [STORY, LINK, "Verify leaderboard loads", "Responsive"],
    [STORY, LINK, "Verify join CTA", "Responsive"],
  ]);
  assert.deepEqual(perSource, [{ id: "req-1", label: STORY, cases: 2, rows: 2 }]);
});

test("buildP0Rows gives a multi-platform case one row per platform, grouped by platform", () => {
  const { rows, perSource } = buildP0Rows([
    source([
      ["TC-1", "Verify checkout", "iOS, Android, Responsive", "P0"],
      ["TC-2", "Verify app banner", "Multi-Platform", "P0"],
    ]),
  ]);
  assert.deepEqual(
    rows.map((r) => [r[3], r[2]]),
    [
      ["Responsive", "Verify checkout"],
      ["Responsive", "Verify app banner"],
      ["Android", "Verify checkout"],
      ["Android", "Verify app banner"],
      ["iOS", "Verify checkout"],
      ["iOS", "Verify app banner"],
    ],
  );
  assert.equal(perSource[0].cases, 2);
  assert.equal(perSource[0].rows, 6);
});

test("buildP0Rows puts unknown platforms after known ones and missing platforms last", () => {
  const { rows } = buildP0Rows([
    source([
      ["TC-1", "Verify no platform", "", "P0"],
      ["TC-2", "Verify kiosk", "Smart TV", "P0"],
      ["TC-3", "Verify api", "API", "P0"],
    ]),
  ]);
  assert.deepEqual(rows.map((r) => r[3]), ["API", "Smart TV", ""]);
});

test("buildP0Rows skips divider rows and keeps story order inside a platform", () => {
  const { rows, perSource } = buildP0Rows([
    source([["", "--- P0 TC for X ---", "", "P0"], ["TC-1", "A", "API", "P0"], ["TC-2", "A2", "Android", "P0"]]),
    source([["TC-1", "B", "Panel", "P2"]], { id: "req-2", story: "Other" }),
    source([["TC-9", "C", "API", "P0"], ["TC-8", "C2", "Android", "P0"]], { id: "req-3", story: "Third", link: "" }),
  ]);
  assert.deepEqual(rows, [
    [STORY, LINK, "A2", "Android"],
    ["Third", "", "C2", "Android"],
    [STORY, LINK, "A", "API"],
    ["Third", "", "C", "API"],
  ]);
  assert.deepEqual(perSource.map((s) => s.cases), [2, 0, 2]);
});

test("toCsv quotes only what needs quoting", () => {
  assert.equal(
    toCsv(["Case", "link"], [['Say "hi", then go', "x"], ["line\nbreak", ""]]),
    'Case,link\n"Say ""hi"", then go",x\n"line\nbreak",\n',
  );
});

test("sheetTitle names the sheet after today's date", () => {
  assert.equal(sheetTitle(new Date(2026, 9, 23)), "P0 Devs - 23 Oct 2026");
});

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, ...init, body: init.body && JSON.parse(init.body) });
    const { status = 200, body = {} } = handler(url, init) || {};
    return { ok: status < 400, status, statusText: "", text: async () => JSON.stringify(body) };
  };
  return { impl, calls };
}

test("createSpreadsheet posts one sheet with a bold header and linked URLs", async () => {
  const { impl, calls } = fakeFetch(() => ({ body: { spreadsheetId: "abc", spreadsheetUrl: "https://s/abc" } }));
  const client = createGoogleClient({ token: "t", quotaProject: "qp" }, impl);
  const out = await client.createSpreadsheet("P0 Devs - 1 Jan 2026", HEADERS, [["S", "https://j/1", "A", "iOS"]]);

  assert.equal(out.spreadsheetUrl, "https://s/abc");
  const [call] = calls;
  assert.equal(call.url, "https://sheets.googleapis.com/v4/spreadsheets");
  assert.equal(call.headers.Authorization, "Bearer t");
  assert.equal(call.headers["x-goog-user-project"], "qp");
  assert.equal(call.body.properties.title, "P0 Devs - 1 Jan 2026");
  const rowData = call.body.sheets[0].data[0].rowData;
  assert.equal(rowData[0].values[0].userEnteredFormat.textFormat.bold, true);
  assert.equal(rowData[1].values[1].userEnteredFormat.textFormat.link.uri, "https://j/1");
  assert.equal(rowData[1].values[3].userEnteredValue.stringValue, "iOS");
});

test("a missing Sheets scope is reported as a login problem", async () => {
  const { impl } = fakeFetch(() => ({
    status: 403,
    body: { error: { message: "Request had insufficient authentication scopes.", status: "PERMISSION_DENIED" } },
  }));
  const client = createGoogleClient({ token: "t" }, impl);
  await assert.rejects(client.createSpreadsheet("x", HEADERS, []), (err) => {
    assert.equal(err.login, true);
    assert.equal(err.status, 403);
    assert.match(err.message, /insufficient authentication scopes/);
    return true;
  });
});

test("shareWithDomain grants unlisted domain read access", async () => {
  const { impl, calls } = fakeFetch(() => ({ body: { id: "p" } }));
  await createGoogleClient({ token: "t" }, impl).shareWithDomain("abc", "tiket.com");
  assert.match(calls[0].url, /drive\/v3\/files\/abc\/permissions/);
  assert.deepEqual(calls[0].body, { type: "domain", role: "reader", domain: "tiket.com", allowFileDiscovery: false });
  assert.equal(calls[0].headers["x-goog-user-project"], undefined);
});

test("canCreateSheets needs a Sheets or Drive scope, not just cloud-platform", () => {
  const { canCreateSheets } = require("./p0-share");
  assert.equal(canCreateSheets(["openid", "https://www.googleapis.com/auth/cloud-platform"]), false);
  assert.equal(canCreateSheets(["https://www.googleapis.com/auth/drive.file"]), true);
});

