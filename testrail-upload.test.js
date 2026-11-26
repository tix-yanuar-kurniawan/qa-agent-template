"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  platformsFor,
  preconditionText,
  buildUploadPlan,
  jiraUrl,
  diffFolder,
  reconcile,
  countOps,
  applySync,
} = require("./testrail-upload");

const COLUMNS = [
  "id", "case", "preconditions", "steps", "expected result",
  "type", "priority", "criticality", "platform",
];

function row(o = {}) {
  const base = {
    id: "TC01",
    case: "Verify the reward card shows the points",
    preconditions: "account: loyalty member",
    steps: "1. Open rewards 2. Tap the card",
    "expected result": "1. Card shows 2. Points match",
    type: "specific",
    priority: "P0",
    criticality: "high",
    platform: "Responsive",
    ...o,
  };
  return COLUMNS.map((c) => base[c]);
}

describe("platformsFor", () => {
  it("maps each source platform to its folder and TestRail option", () => {
    const { platforms, unknown } = platformsFor("Backend, Responsive, IOS app, Android App, Panel - dWeb");
    assert.deepEqual(unknown, []);
    assert.deepEqual(
      platforms.map((p) => [p.folder, p.platformId]),
      [["Responsive", 2], ["Android", 7], ["iOS", 8], ["Panel", 4], ["Backend", 5]],
    );
  });

  it("expands Multi-Platform to every end-user surface", () => {
    assert.deepEqual(platformsFor("Multi-Platform").platforms.map((p) => p.folder), ["Responsive", "Android", "iOS"]);
  });

  it("reports tokens it cannot place", () => {
    assert.deepEqual(platformsFor("Responsive, Smart TV").unknown, ["smart tv"]);
  });
});

describe("buildUploadPlan", () => {
  it("copies a multi-platform case into each platform folder", () => {
    const plan = buildUploadPlan(COLUMNS, [row({ platform: "Responsive, Backend" })], { refs: "PLAT-1" });
    assert.equal(plan.total, 2);
    assert.deepEqual(plan.folders.map((f) => f.name), ["Responsive", "Backend"]);
    assert.equal(plan.folders[0].cases[0].payload.custom_platform, 2);
    assert.equal(plan.folders[1].cases[0].payload.custom_platform, 5);
  });

  it("takes priority from criticality, not from P0-P3", () => {
    const plan = buildUploadPlan(COLUMNS, [
      row({ id: "a", criticality: "critical", priority: "P3" }),
      row({ id: "b", criticality: "low", priority: "P0" }),
      row({ id: "c", criticality: "" }),
    ]);
    assert.deepEqual(plan.folders[0].cases.map((c) => c.payload.priority_id), [4, 1, 2]);
  });

  it("fills the TestRail fields from the source row", () => {
    const [c] = buildUploadPlan(COLUMNS, [row()], { refs: "PLAT-1", pic: "Jane Tester" }).folders[0].cases;
    assert.equal(c.payload.title, "Verify the reward card shows the points");
    assert.equal(c.payload.template_id, 1);
    assert.equal(c.payload.type_id, 14);
    assert.equal(c.payload.refs, "PLAT-1");
    assert.equal(c.payload.custom_pic, "Jane Tester");
    assert.equal(c.payload.custom_preconds, "User: loyalty member");
    assert.equal(c.payload.custom_steps, "1. Open rewards\n2. Tap the card");
    assert.equal(c.payload.custom_expected, "1. Card shows\n2. Points match");
    assert.equal(c.payload.custom_tcstatus, 1);
    assert.equal(c.payload.custom_case_created_by_ai, 1);
  });

  it("strips machine-only notes from the precondition", () => {
    assert.equal(
      preconditionText(
        "account: gk-tiket-web role=member; data: one passenger whose passport expires soon; " +
          "UNKNOWN: specimen passport image; state: run at a mobile viewport (TC22)",
      ),
      "User: member\nData: one passenger whose passport expires soon\nState: run at a mobile viewport",
    );
    assert.equal(
      preconditionText("account: UNKNOWN: an eligible member; config: flag=false; rest otherwise enabled"),
      "Config: flag=false; rest otherwise enabled",
    );
    assert.equal(preconditionText("Log in as a guest"), "Log in as a guest");
  });

  it("marks negative titles as Functional Negative", () => {
    const [c] = buildUploadPlan(COLUMNS, [row({ case: "Verify an invalid code is rejected" })]).folders[0].cases;
    assert.equal(c.payload.type_id, 15);
  });

  it("refuses rows it cannot place instead of guessing", () => {
    const plan = buildUploadPlan(COLUMNS, [row({ id: "TC09", platform: "" }), row({ id: "TC10", platform: "Fax" })]);
    assert.equal(plan.total, 0);
    assert.equal(plan.missingPlatform, 1);
    assert.match(plan.problems[0], /TC10.*fax/);
    assert.match(plan.problems[1], /1 case\(s\) have no platform/);
  });

  it("uses the chosen fallback for rows without a platform", () => {
    const plan = buildUploadPlan(COLUMNS, [row({ platform: "" })], { fallbackPlatform: "Backend" });
    assert.deepEqual(plan.problems, []);
    assert.equal(plan.folders[0].name, "Backend");
  });

  it("skips the divider rows older result CSVs carry", () => {
    const plan = buildUploadPlan(COLUMNS, [row({ case: "--- P0 TC for PLAT-1 ---", platform: "" }), row()]);
    assert.equal(plan.total, 1);
    assert.deepEqual(plan.problems, []);
  });
});

describe("jiraUrl", () => {
  it("prefers a link in the description and falls back to the key", () => {
    assert.equal(jiraUrl("PLAT-1", "see https://x.atlassian.net/browse/PLAT-1 please"), "https://x.atlassian.net/browse/PLAT-1");
    assert.equal(jiraUrl("PLAT-2", "PLAT-2"), "https://borobudur.atlassian.net/browse/PLAT-2");
  });
});

// cases: { <section id>: [case, …] } already in TestRail.
function fakeClient(sections, cases = {}) {
  let nextId = 900;
  const calls = { sections: [], cases: [], updates: [] };
  return {
    calls,
    getSections: async () => sections.map((s) => ({ ...s })),
    getCases: async (_p, _s, sectionId) => (cases[sectionId] || []).map((c) => ({ ...c })),
    addSection: async (_p, body) => {
      const s = { id: nextId++, parent_id: body.parent_id || null, name: body.name };
      calls.sections.push(body);
      return s;
    },
    addCase: async (sectionId, body) => {
      calls.cases.push({ sectionId, title: body.title });
      return { id: nextId++ };
    },
    updateCase: async (caseId, body) => {
      calls.updates.push({ caseId, body });
      return { id: caseId };
    },
  };
}

async function sync(client, opts, applyOpts = {}) {
  const target = { projectId: 184, suiteId: 7, placement: "new", folderName: "X", ...opts };
  const diff = await reconcile(client, target);
  const result = await applySync(client, diff, { projectId: 184, suiteId: 7, folderName: target.folderName, ...applyOpts });
  return { diff, result };
}

describe("first upload", () => {
  const plan = buildUploadPlan(COLUMNS, [row({ platform: "Responsive, Android App" })]);

  it("nests the story under STANDALONE STORIES and reuses existing folders", async () => {
    const client = fakeClient([
      { id: 1, parent_id: null, name: "STANDALONE STORIES" },
      { id: 2, parent_id: 1, name: "My Story" },
      { id: 3, parent_id: 2, name: "Responsive" },
    ]);
    const { result } = await sync(client, { placement: "standalone", folderName: "my story ", plan });
    assert.equal(result.storySectionId, 2);
    assert.equal(result.storyCreated, false);
    assert.deepEqual(client.calls.sections, [{ suite_id: 7, name: "Android", parent_id: 2 }]);
    assert.deepEqual(client.calls.cases.map((c) => c.sectionId), [3, 901]);
    assert.equal(result.added, 2);
  });

  it("creates a top-level story folder with the Jira link for a new folder", async () => {
    const client = fakeClient([{ id: 1, parent_id: null, name: "STANDALONE STORY" }]);
    await sync(client, { folderName: "Fresh", plan }, { folderDescription: "https://j/PLAT-1" });
    assert.deepEqual(client.calls.sections[0], { suite_id: 7, name: "Fresh", description: "https://j/PLAT-1" });
    assert.deepEqual(client.calls.sections[1], { suite_id: 7, name: "Responsive", parent_id: 900 });
  });

  it("reports progress after every write", async () => {
    const client = fakeClient([]);
    const seen = [];
    await sync(client, { plan }, { onProgress: (p) => seen.push(p) });
    assert.deepEqual(seen.map((p) => `${p.step}:${p.folder}:${p.done}`), [
      "folders:null:0", "cases:Responsive:0", "cases:Responsive:1", "cases:Android:1", "cases:Android:2",
    ]);
  });

  it("fails before creating anything when the suite has no standalone folder", async () => {
    const client = fakeClient([]);
    await assert.rejects(
      reconcile(client, { projectId: 184, suiteId: 7, placement: "standalone", folderName: "X", plan }),
      /STANDALONE STORY/,
    );
    assert.equal(client.calls.sections.length, 0);
  });

  it("reports how far it got, with links for what landed, when a case fails", async () => {
    const client = fakeClient([]);
    let n = 0;
    client.addCase = async () => {
      if (++n === 2) throw new Error("boom");
      return { id: 50 + n };
    };
    const { result } = await sync(client, { plan });
    assert.equal(result.added, 1);
    assert.equal(result.error, "boom");
    assert.deepEqual(result.links, { Responsive: { TC01: 51 }, Android: {} });
  });
});

function existing(o = {}) {
  return {
    id: 500,
    title: "Verify the reward card shows the points",
    custom_preconds: "User: loyalty member",
    custom_steps: "1. Open rewards\r\n2. Tap the card",
    custom_expected: "1. Card shows\n2. Points match",
    priority_id: 3,
    refs: "PLAT-1",
    custom_tcstatus: 3,
    custom_case_created_by_ai: 1,
    ...o,
  };
}

describe("diffFolder", () => {
  const planned = (o) => buildUploadPlan(COLUMNS, [row(o)], { refs: "PLAT-1" }).folders[0].cases;

  it("leaves an identical case alone, ignoring line endings and status", () => {
    const { ops, leftover } = diffFolder(planned(), [existing()]);
    assert.deepEqual(ops.map((o) => [o.kind, o.caseId]), [["same", 500]]);
    assert.deepEqual(leftover, []);
  });

  it("updates only the content fields that changed", () => {
    const { ops } = diffFolder(planned({ steps: "1. Open rewards 2. Tap the card 3. Scroll" }), [existing()]);
    assert.equal(ops[0].kind, "update");
    assert.deepEqual(ops[0].changes, { custom_steps: "1. Open rewards\n2. Tap the card\n3. Scroll" });
  });

  it("follows the saved link when the title was edited", () => {
    const { ops } = diffFolder(planned({ case: "Verify the reward card shows the balance" }), [existing()], { TC01: 500 });
    assert.equal(ops[0].kind, "update");
    assert.equal(ops[0].caseId, 500);
    assert.deepEqual(Object.keys(ops[0].changes), ["title"]);
  });

  it("adds an edited-title case that has no link, leaving the old one over", () => {
    const { ops, leftover } = diffFolder(planned({ case: "A new title" }), [existing()]);
    assert.equal(ops[0].kind, "add");
    assert.deepEqual(leftover.map((c) => c.id), [500]);
  });

  it("never pairs by title with a hand-written case", () => {
    const { ops } = diffFolder(planned(), [existing({ custom_case_created_by_ai: 2 })]);
    assert.equal(ops[0].kind, "add");
  });

  it("treats the HTML TestRail returns after an update as the plain text it was sent as", () => {
    const { ops } = diffFolder(planned(), [existing({
      custom_preconds: "<p>User: loyalty member</p>\n",
      custom_steps: "<ol>\n<li>Open rewards</li>\n<li>Tap the card</li>\n</ol>\n",
      custom_expected: "<ol>\n<li>Card shows</li>\n<li>Points match</li>\n</ol>\n",
    })]);
    assert.equal(ops[0].kind, "same");
  });

  it("still sees a real edit behind HTML", () => {
    const { ops } = diffFolder(planned(), [existing({
      custom_steps: "<ol>\n<li>Open rewards</li>\n<li>Tap the banner</li>\n</ol>\n",
    })]);
    assert.deepEqual(Object.keys(ops[0].changes), ["custom_steps"]);
  });

  it("brings a retired case back as a draft", () => {
    const { ops } = diffFolder(planned(), [existing({ custom_tcstatus: 5 })]);
    assert.deepEqual(ops[0].changes, { custom_tcstatus: 1 });
  });

  it("prefers a live case over a retired one with the same title", () => {
    const { ops } = diffFolder(planned(), [existing({ id: 1, custom_tcstatus: 5 }), existing({ id: 2 })]);
    assert.equal(ops[0].caseId, 2);
  });
});

describe("re-sync of an earlier upload", () => {
  const sections = [
    { id: 10, parent_id: null, name: "Story" },
    { id: 11, parent_id: 10, name: "Responsive" },
    { id: 12, parent_id: 10, name: "Backend" },
  ];

  it("updates, adds and offers our dropped cases as obsolete without touching hand-written ones", async () => {
    const plan = buildUploadPlan(COLUMNS, [
      row({ id: "TC01", criticality: "critical" }),
      row({ id: "TC02", case: "Verify a brand new thing" }),
    ], { refs: "PLAT-1" });
    const client = fakeClient(sections, {
      11: [existing({ id: 500 }), existing({ id: 501, title: "Verify a dropped case" })],
      12: [existing({ id: 600, title: "Backend case, platform since removed" }), existing({ id: 601, title: "Manual", custom_case_created_by_ai: 2 })],
    });

    const { diff, result } = await sync(client, { folderName: "Story", plan }, { markObsolete: true });
    assert.deepEqual(countOps(diff), { add: 1, update: 1, same: 0, obsolete: 2 });
    assert.deepEqual(diff.obsolete.map((c) => c.caseId), [501, 600]);
    assert.equal(diff.untouched, 1);

    assert.deepEqual(client.calls.sections, []);
    assert.deepEqual(client.calls.cases, [{ sectionId: 11, title: "Verify a brand new thing" }]);
    assert.deepEqual(client.calls.updates, [
      { caseId: 500, body: { priority_id: 4 } },
      { caseId: 501, body: { custom_tcstatus: 5 } },
      { caseId: 600, body: { custom_tcstatus: 5 } },
    ]);
    assert.deepEqual(result.links, { Responsive: { TC01: 500, TC02: 900 } });
    assert.equal(result.obsoleted, 2);
  });

  it("leaves dropped cases alone unless asked to mark them", async () => {
    const plan = buildUploadPlan(COLUMNS, [row()], { refs: "PLAT-1" });
    const client = fakeClient(sections, { 11: [existing(), existing({ id: 501, title: "Dropped" })] });
    const { result } = await sync(client, { folderName: "Story", plan });
    assert.deepEqual(client.calls.updates, []);
    assert.deepEqual(client.calls.cases, []);
    assert.equal(result.unchanged, 1);
    assert.equal(result.done, 0);
  });
});
