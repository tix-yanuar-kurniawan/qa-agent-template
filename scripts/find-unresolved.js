#!/usr/bin/env node
/**
 * Scan knowledge/entries/*.md frontmatter `related:` lists and report which
 * referenced issue keys have no entry note yet (the "unresolved" graph links).
 *
 *   node scripts/find-unresolved.js
 */
const fs = require("fs");
const path = require("path");

const ENTRIES = path.resolve(__dirname, "..", "knowledge", "entries");
const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

const files = fs.readdirSync(ENTRIES).filter((f) => f.endsWith(".md"));
const existing = new Set(files.map((f) => f.replace(/\.md$/, "")));
const refs = {}; // key -> Set of referring entry keys

for (const f of files) {
  const raw = fs.readFileSync(path.join(ENTRIES, f), "utf8");
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) continue;
  const relLine = fmMatch[1].match(/^related:\s*\[(.*)\]\s*$/m);
  if (!relLine) continue;
  const keys = [...relLine[1].matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
  for (const k of keys) {
    (refs[k] = refs[k] || new Set()).add(f.replace(/\.md$/, ""));
  }
}

const allRefs = Object.keys(refs);
const unresolved = allRefs.filter((k) => KEY_RE.test(k) && !existing.has(k)).sort();
const nonJiraUnresolved = allRefs.filter((k) => !KEY_RE.test(k) && !existing.has(k)).sort();

const result = {
  count: unresolved.length,
  unresolved,
  referrers: Object.fromEntries(unresolved.map((k) => [k, [...refs[k]].sort()])),
  nonJiraUnresolved,
};

const outDir = path.resolve(__dirname, "..", ".import-cache");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "unresolved.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
