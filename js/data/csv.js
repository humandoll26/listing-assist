export function parseCsvText(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const nextChar = normalized[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      current = "";
      rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const filteredRows = rows
    .map((cells) => cells.map((cell) => cell.trim()))
    .filter((cells) => cells.some((cell) => cell !== ""));

  if (filteredRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...dataRows] = filteredRows;
  const headers = headerRow.map((header, index) => normalizeHeader(header || `column_${index + 1}`));
  const mappedRows = dataRows.map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });

  return { headers, rows: mappedRows };
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^\uFEFF/, "")
    .trim();
}
