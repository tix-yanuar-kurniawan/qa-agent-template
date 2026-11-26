// CSV reading shared by the server and the scripts that run outside it. Cells may
// hold quoted commas, doubled quotes and real newlines (numbered steps), so rows
// are split on unquoted newlines before each row is split into fields.

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
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

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
    } else {
      if (ch === '"') {
        inQuotes = true;
        current += ch;
      } else if (ch === "\n") {
        if (current.trim()) rows.push(current.replace(/\r$/, ""));
        current = "";
        continue;
      } else {
        current += ch;
      }
    }
  }
  if (current.trim()) rows.push(current.replace(/\r$/, ""));
  return rows;
}

function parseCsvTable(text) {
  const lines = splitCsvRows(text);
  if (!lines.length) return { columns: [], rows: [], headerLine: null, rawLines: [] };

  const columns = parseCsvLine(lines[0]).map((h) => h.trim());
  const rawLines = lines.slice(1);
  const rows = rawLines.map((line) => {
    const fields = parseCsvLine(line);
    return columns.map((_, i) => (fields[i] == null ? "" : fields[i]));
  });

  return { columns, rows, headerLine: lines[0], rawLines };
}

function csvField(val) {
  const s = val == null ? "" : String(val);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

module.exports = { parseCsvLine, splitCsvRows, parseCsvTable, csvField };
