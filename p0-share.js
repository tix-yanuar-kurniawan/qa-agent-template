"use strict";

// "Share P0": the P0 cases of one or more case sheets, flattened into the sheet
// devs asked for (Case, Platform, Epic/story, name, link) and posted to Google
// Sheets as a new spreadsheet. Like the TestRail upload, it generates nothing —
// it reshapes cases already on disk.
//
// A case that lists several platforms becomes one row per platform, so each
// platform's devs can filter to their own rows.
//
// Google auth is the user's own Application Default Credentials, read through
// `gcloud auth application-default print-access-token`. The spreadsheet is
// created in that account's Drive. When anything about that fails, the caller
// falls back to a CSV of the same rows.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { platformsFor, PLATFORMS } = require("./testrail-upload");

const CONFIG_FILE = path.join(__dirname, "google.local.json");
const ADC_FILE = path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
const HEADERS = ["Jira Title", "Jira Link", "Case", "Platforms"];
const LINK_COLUMN = 1;
const DIVIDER = /^-{3}.*-{3}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Scopes the ADC login needs for this feature, on top of what it already has.
const LOGIN_COMMAND =
  "gcloud auth application-default login --scopes=" +
  [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/sqlservice.login",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ].join(",");

// Any of these lets the token create a spreadsheet.
const SHEET_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive",
];

function canCreateSheets(scopes) {
  return scopes.some((s) => SHEET_SCOPES.includes(s));
}

function readConfig(file = CONFIG_FILE, env = process.env) {
  let local = {};
  if (fs.existsSync(file)) {
    try {
      local = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      local = {};
    }
  }
  // An empty string turns domain sharing off.
  const shareDomain = env.P0_SHARE_DOMAIN ?? local.shareDomain ?? "tiket.com";
  return {
    shareDomain: String(shareDomain).trim(),
    quotaProject: env.GOOGLE_QUOTA_PROJECT || local.quotaProject || adcQuotaProject(),
    // When set, the browser posts the rows to the user's Apps Script web app instead
    // of the server using gcloud ADC (tiket.com blocks gcloud from Sheets scopes, and
    // a domain-only web app needs the browser's Google sign-in). See scripts/p0-share.gs.
    appsScriptUrl: String(env.P0_APPS_SCRIPT_URL || local.appsScriptUrl || "").trim(),
    // Who deployed the script; shown in the dialog only.
    account: String(local.account || ""),
  };
}

// Only the quota project is read from the ADC file; the token comes from gcloud.
function adcQuotaProject(file = ADC_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")).quota_project_id || "";
  } catch {
    return "";
  }
}

// "P0 Devs - 23 Oct 2026", in the server's local time.
function sheetTitle(now = new Date()) {
  return `P0 Devs - ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

// Pure: sources → rows in HEADERS order. Each source is
// { columns, rows, story, link } where columns/rows are the source CSV table.
function buildP0Rows(sources) {
  const out = [];
  const perSource = [];

  for (const src of sources) {
    const lower = src.columns.map((c) => String(c).trim().toLowerCase());
    const get = (row, name) => {
      const i = lower.indexOf(name);
      return i >= 0 && row[i] != null ? String(row[i]).trim() : "";
    };

    let cases = 0;
    let rows = 0;
    for (const row of src.rows) {
      const title = get(row, "case");
      if (!title || DIVIDER.test(title)) continue;
      if (get(row, "priority").toLowerCase() !== "p0") continue;
      cases++;

      const cell = get(row, "platform");
      const { platforms, unknown } = platformsFor(cell);
      // Platforms TestRail has no folder for still go out under their own name.
      const names = [...platforms.map((p) => p.folder), ...unknown.map((u) => original(cell, u))];
      for (const platform of names.length ? names : [""]) {
        out.push([src.story, src.link, title, platform]);
        rows++;
      }
    }
    perSource.push({ id: src.id, label: src.story, cases, rows });
  }

  // Grouped by platform so each platform's devs read one block: Responsive,
  // Android, iOS, Panel, Backend, API, then any other platform by name, then rows
  // with none. Within a block, the selection's story and case order is kept.
  const known = PLATFORMS.map((p) => p.folder);
  const rank = (name) => {
    if (!name) return [2, ""];
    const i = known.indexOf(name);
    return i >= 0 ? [0, String(i).padStart(3, "0")] : [1, name.toLowerCase()];
  };
  const grouped = out
    .map((row, i) => ({ row, i, r: rank(row[3]) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1].localeCompare(b.r[1]) || a.i - b.i)
    .map((x) => x.row);

  return { headers: HEADERS.slice(), rows: grouped, perSource };
}

// platformsFor lower-cases tokens; give an unknown one back as it was written.
function original(cell, token) {
  const hit = cell.split(",").map((t) => t.trim()).find((t) => t.toLowerCase() === token);
  return hit || token;
}

function toCsv(headers, rows) {
  const quote = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(quote).join(",")).join("\n") + "\n";
}

// --- Google ---

function gcloudToken(run = execFile) {
  return new Promise((resolve, reject) => {
    run(
      "gcloud",
      ["auth", "application-default", "print-access-token"],
      { timeout: 20000 },
      (err, stdout, stderr) => {
        if (err) {
          const reason = err.code === "ENOENT"
            ? "gcloud is not installed"
            : String(stderr || err.message).trim().split("\n").pop();
          return reject(new GoogleError(`No Google credentials: ${reason}`, { login: true }));
        }
        resolve(String(stdout).trim());
      },
    );
  });
}

class GoogleError extends Error {
  constructor(message, { login = false, status = 0 } = {}) {
    super(message);
    this.login = login;
    this.status = status;
  }
}

function createGoogleClient({ token, quotaProject = "" }, fetchImpl = fetch) {
  async function call(method, url, body) {
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers["Content-Type"] = "application/json";
    if (quotaProject) headers["x-goog-user-project"] = quotaProject;
    const res = await fetchImpl(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      const msg = (data.error && (data.error.message || data.error_description)) || text || res.statusText;
      const scopes = /insufficient.*scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(text);
      throw new GoogleError(`Google ${res.status}: ${msg}`, {
        status: res.status,
        login: scopes || res.status === 401,
      });
    }
    return data;
  }

  return {
    // The account the token belongs to, i.e. whose Drive the sheet lands in.
    async whoami() {
      const data = await call(
        "GET",
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
      );
      return { email: data.email || "", scopes: String(data.scope || "").split(" ").filter(Boolean) };
    },

    async createSpreadsheet(title, headers, rows) {
      const text = (v) => ({ userEnteredValue: { stringValue: String(v ?? "") } });
      const linkCell = (v) =>
        v
          ? { ...text(v), userEnteredFormat: { textFormat: { link: { uri: String(v) } } } }
          : text(v);
      const rowData = [
        { values: headers.map((h) => ({ ...text(h), userEnteredFormat: { textFormat: { bold: true } } })) },
        ...rows.map((r) => ({ values: r.map((v, i) => (i === LINK_COLUMN ? linkCell(v) : text(v))) })),
      ];
      return call("POST", "https://sheets.googleapis.com/v4/spreadsheets", {
        properties: { title },
        sheets: [
          {
            properties: { title: "P0", gridProperties: { frozenRowCount: 1 } },
            data: [{ startRow: 0, startColumn: 0, rowData }],
          },
        ],
      });
    },

    // Anyone at the domain with the link can view; the file stays unlisted.
    async shareWithDomain(fileId, domain) {
      return call(
        "POST",
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`,
        { type: "domain", role: "reader", domain, allowFileDiscovery: false },
      );
    },
  };
}

module.exports = {
  HEADERS,
  LOGIN_COMMAND,
  GoogleError,
  canCreateSheets,
  readConfig,
  sheetTitle,
  buildP0Rows,
  toCsv,
  gcloudToken,
  createGoogleClient,
};
