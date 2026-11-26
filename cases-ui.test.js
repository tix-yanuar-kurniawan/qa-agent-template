"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

// Run the page's actual handlers with a small DOM double, without booting the
// application or touching queue files. Browser layout is outside these tests.
class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text; }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  querySelector() { return null; }
  click() { this.listeners.click?.(); }
  remove() {}
}

function page(fetch = async () => { throw new Error("Unexpected request"); }) {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const context = vm.createContext({
    document: {
      getElementById: getElement,
      querySelector: getElement,
      querySelectorAll: () => [],
      createElement: () => new Element(),
      addEventListener() {},
      body: new Element(),
    },
    window: { addEventListener() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    mountRail() {},
    confirm: () => true,
    fetch,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  });
  const source = fs.readFileSync(path.join(__dirname, "public/cases.js"), "utf8")
    .replace(/import\s+[\s\S]*?from\s+"[^"]+";/g, "")
    .split("(async function boot()")[0];
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  run(`
    requestId = "fixture";
    columns = ["Title", "Priority", "Criticality"];
    rows = [["First", "p0", "high"], ["Second", "p1", "medium"]];
    rowKeys = ["first", "second"];
    baseline = JSON.stringify(rows);
  `);
  return { run, getElement };
}

test("numbered steps and expectations are readable without dirtying the sheet", () => {
  const { run, getElement } = page();
  run(`
    columns = ["Steps", "Expected Result"];
    rows = [["1. Open reward. 2. Search campaign. 3. Save.", "1. Reward appears. 2. Balance is 2.5."]];
    baseline = JSON.stringify(rows);
    openPanel(0);
  `);
  const fields = getElement("cp-body").children;
  assert.equal(fields[0].children[1].value, "1. Open reward.\n2. Search campaign.\n3. Save.");
  assert.equal(fields[1].children[1].value, "1. Reward appears.\n2. Balance is 2.5.");
  assert.equal(run("isDirty()"), false);
  assert.equal(run('readableCell("Version 2.5 costs 10.00", "Steps")'), "Version 2.5 costs 10.00");
  assert.equal(run('readableCell("1. First.\\n2. Second. 3. Third.", "Steps")'), "1. First.\n2. Second.\n3. Third.");
  assert.equal(run('readableCell("1. First. 2. Second.", "Title")'), "1. First. 2. Second.");
});

test("new case dropdowns represent blank values and offer supported criticalities", () => {
  const { run, getElement } = page();
  run("addRow()");
  const fields = getElement("cp-body").children;
  const priority = fields[1].children[1];
  const criticality = fields[2].children[1];
  for (const select of [priority, criticality]) {
    assert.equal(select.children[0].value, "");
    assert.equal(select.children[0].selected, true);
  }
  assert.deepEqual(criticality.children.map((option) => option.value),
    ["", "critical", "high", "medium", "low"]);
  assert.equal(run("rows[2][1]"), "");
  assert.equal(run("rows[2][2]"), "");
  criticality.value = "low";
  criticality.listeners.change();
  assert.equal(run("rows[2][2]"), "low");
});

test("dropdowns preserve existing and legacy values", () => {
  const { run } = page();
  for (const current of ["HIGH", "legacy-value"]) {
    const select = run(`makeSelect(CRITICALITIES, ${JSON.stringify(current)}, true)`);
    const selected = select.children.filter((option) => option.selected);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].value, current === "HIGH" ? "high" : current);
  }
});

for (const action of ["delete", "reclassify"]) {
  test(`active zero-count priority filter can be cleared after ${action}`, () => {
    const { run, getElement } = page();
    run('listFilter.add("p0"); renderFilters();');
    if (action === "delete") {
      run("deleteRow(0)");
    } else {
      run("openPanel(0)");
      const priority = getElement("cp-body").children[1].children[1];
      priority.value = "p1";
      priority.listeners.change();
    }
    assert.equal(run("visibleRows().length"), 0);
    const chip = getElement("ct-filters").children.find((el) => el.dataset.priority === "p0");
    assert.ok(chip);
    assert.equal(chip.attributes["aria-pressed"], "true");
    chip.click();
    assert.equal(run("visibleRows().length"), action === "delete" ? 1 : 2);
    assert.equal(run("listFilter.size"), 0);
  });
}

for (const outcome of ["success", "http-error", "network-error"]) {
  test(`save-before-download handles ${outcome}`, async () => {
    const calls = [];
    const { run, getElement } = page(async (url, options) => {
      calls.push(options?.method || "GET");
      if (options?.method === "PUT") {
        if (outcome === "network-error") throw new Error("Offline");
        return {
          ok: outcome === "success",
          status: 409,
          json: async () => outcome === "success"
            ? { savedAt: "2026-09-24T00:00:00Z" }
            : { error: "Save conflict" },
        };
      }
      return { ok: true, headers: { get: () => "" }, blob: async () => ({}) };
    });
    run('setCell(0, 0, "Edited title")');
    await run("handleDownload()");
    assert.deepEqual(calls, outcome === "success" ? ["PUT", "GET"] : ["PUT"]);
    assert.equal(run("isDirty()"), outcome !== "success");
    assert.equal(run("saving"), false);
    if (outcome !== "success") assert.equal(getElement("c-alert").hidden, false);
  });
}

test("download does not race an in-flight save", async () => {
  let finishSave;
  const calls = [];
  const { run } = page((url, options) => {
    calls.push(options?.method || "GET");
    return new Promise((resolve) => { finishSave = resolve; });
  });
  run('setCell(0, 0, "Edited title")');
  const pending = run("save()");
  await run("handleDownload()");
  assert.deepEqual(calls, ["PUT"]);
  finishSave({ ok: true, json: async () => ({}) });
  assert.equal(await pending, true);
});
