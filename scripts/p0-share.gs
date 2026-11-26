/**
 * Share P0 — Google Apps Script web app.
 *
 * TC Queue's Share P0 dialog opens this web app in a new tab and form-posts the
 * P0 rows to it. Because it runs in the browser, the tab is already signed in
 * to Google, so the deployment can stay "Anyone within <your org>". The script
 * creates the spreadsheet in the deployer's Drive, shares it with the domain by
 * link, shows the link, and posts it back to the TC Queue tab.
 *
 * Setup: paste into script.google.com, run doGet once to grant access, then
 * Deploy › New deployment › Web app (Execute as: Me, Who has access: Anyone
 * within your organisation). Put the /exec URL in google.local.json.
 */

function doGet(e) {
  const params = (e && e.parameter) || {};
  // TC Queue asks, from a hidden frame, whether a sheet it shared earlier still
  // exists, so it only offers to create a new one once that sheet is gone.
  if (params.check) return checkSheet(params.check, params.origin);
  return page(
    "<h1>Share P0 is deployed</h1><p>Sheets will be created in " +
      esc(Session.getEffectiveUser().getEmail()) + "'s Drive. Use Share P0 in TC Queue.</p>",
  );
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.parameter.payload);
  } catch (err) {
    return page("<h1>Couldn’t read the request</h1><p>Open Share P0 from TC Queue again.</p>");
  }

  try {
    const headers = body.headers || [];
    const rows = body.rows || [];
    const ss = SpreadsheetApp.create(String(body.title || "P0 Devs"));
    const sheet = ss.getSheets()[0];
    sheet.setName("P0");

    const values = [headers].concat(rows).map(function (r) {
      return headers.map(function (_, i) { return String(r[i] == null ? "" : r[i]); });
    });
    // Plain text, so a case title starting with "=" or "+" is never a formula.
    sheet.getRange(1, 1, values.length, headers.length).setNumberFormat("@").setValues(values);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);

    let shared = "";
    let shareError = "";
    if (body.shareDomain) {
      try {
        DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        shared = body.shareDomain;
      } catch (err) {
        shareError = String((err && err.message) || err);
      }
    }

    const result = {
      type: "p0-share",
      ok: true,
      url: ss.getUrl(),
      id: ss.getId(),
      title: ss.getName(),
      account: Session.getEffectiveUser().getEmail(),
      rowCount: rows.length,
      shared: shared,
      shareError: shareError,
    };
    return page(
      "<h1>" + esc(result.title) + "</h1>" +
        "<p>" + rows.length + " rows in " + esc(result.account) + "’s Drive" +
        (shared ? ", viewable by anyone at " + esc(shared) + " with the link." : ". It’s private — share it from Sheets.") +
        "</p>" +
        '<p><input id="link" readonly value="' + esc(result.url) + '"></p>' +
        '<p><button id="copy">Copy link</button> <a href="' + esc(result.url) + '" target="_blank" rel="noopener">Open spreadsheet</a></p>' +
        '<p id="note"></p>',
      result,
      body.origin,
    );
  } catch (err) {
    const msg = String((err && err.message) || err);
    return page("<h1>Couldn’t create the spreadsheet</h1><p>" + esc(msg) + "</p>",
      { type: "p0-share", ok: false, error: msg }, body.origin);
  }
}

function checkSheet(id, origin) {
  let exists = false;
  try {
    exists = !DriveApp.getFileById(id).isTrashed();
  } catch (err) {
    exists = false; // deleted for good, or no longer ours to see
  }
  const msg = { type: "p0-check", id: id, exists: exists };
  return HtmlService.createHtmlOutput(
    "<script>window.top.postMessage(" + JSON.stringify(msg).replace(/</g, "\\u003c") + "," +
      JSON.stringify(origin || "*") + ");</script>",
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// The result goes back to the TC Queue tab (window.top.opener) when the browser
// keeps that link; the page shows the link either way.
function page(html, result, origin) {
  const script = result
    ? "<script>(function(){var r=" + JSON.stringify(result).replace(/</g, "\\u003c") + ";" +
      "var sent=false;try{if(window.top.opener){window.top.opener.postMessage(r," + JSON.stringify(origin || "*") + ");sent=true;}}catch(e){}" +
      "var n=document.getElementById('note');if(n&&sent)n.textContent='Sent back to TC Queue — you can close this tab.';" +
      "var b=document.getElementById('copy');if(b)b.onclick=function(){var i=document.getElementById('link');i.select();" +
      "var ok=false;try{ok=document.execCommand('copy');}catch(e){}b.textContent=ok?'Copied':'Press ⌘C';};" +
      "})();</script>"
    : "";
  return HtmlService.createHtmlOutput(
    '<div style="font:14px -apple-system,Segoe UI,sans-serif;max-width:640px;margin:40px auto;color:#182132">' +
      html + "</div>" +
      "<style>h1{font-size:20px}input{width:100%;padding:6px;font:13px ui-monospace,monospace}" +
      "button,a{font:14px inherit;margin-right:8px}</style>" + script,
  ).setTitle("Share P0");
}
