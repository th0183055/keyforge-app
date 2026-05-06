import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const defaultRawPath = path.join(dataDir, "parts-reference-raw.txt");
const defaultOutputPath = path.join(dataDir, "parts-cross-reference.json");

function cleanString(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value) {
  return cleanString(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function usefulValue(value) {
  const clean = cleanString(value).replace(/,+$/g, "").trim();
  if (!clean) return "";
  if (/^(?:-|NA|N\/A|NONE|NULL)$/i.test(clean)) return "";
  if (/^\d+\.\d+$/.test(clean)) return "";
  return clean;
}

function splitReferenceCell(value) {
  const clean = usefulValue(value);
  if (!clean) return [];
  const pieces = clean
    .split(/\s*,\s*|\s*;\s*|\s+\|\s+/)
    .map(usefulValue)
    .filter(Boolean);
  return pieces.length ? pieces : [clean];
}

function expandReferenceValue(value) {
  const clean = usefulValue(value);
  if (!clean) return [];
  const values = new Set([clean]);

  if (/^URL:/i.test(clean)) values.add(clean.replace(/^URL:/i, ""));
  if (clean.includes("/")) {
    clean
      .split("/")
      .map(usefulValue)
      .filter(Boolean)
      .forEach((part) => values.add(part));
  }
  for (const match of clean.matchAll(/\{([^}]+)\}/g)) {
    const inner = usefulValue(match[1]);
    if (inner) values.add(inner);
  }
  const parenthetical = clean.replace(/\([^)]*\)/g, "").trim();
  if (parenthetical && parenthetical !== clean) values.add(parenthetical);

  return Array.from(values).filter((item) => normalizeToken(item).length >= 2);
}

function addToken(map, value, role) {
  for (const expanded of expandReferenceValue(value)) {
    const key = normalizeToken(expanded);
    if (!key || key.length < 2) continue;
    if (!map.has(key)) {
      map.set(key, {
        value: expanded,
        normalized: key,
        roles: new Set(),
      });
    }
    map.get(key).roles.add(role);
  }
}

function tokenListFromMap(map) {
  return Array.from(map.values())
    .map((item) => ({
      value: item.value,
      normalized: item.normalized,
      roles: Array.from(item.roles).sort(),
    }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

function looksLikeOe(value) {
  const key = normalizeToken(value);
  if (key.length < 5) return false;
  if (/^(?:TIK|ULK|OEM|ILCO|SC|FORD|CHRY|GM|CAD|HON|ACURA|HYU|KIA|NIS|INF|TOY|LEX|MAZ|MIT|SUB|VOLVO|BMW)/.test(key)) return false;
  return /\d/.test(key) && /[A-Z]/.test(key);
}

function detectTable(line) {
  const normalized = cleanString(line).toUpperCase();
  if (normalized.includes("ML_PN") && normalized.includes("LR_ID") && normalized.includes("MW_ID")) return "alias";
  if (normalized.includes("ML P/N") && normalized.includes("GSI P/N") && normalized.includes("KI P/N")) return "supplier";
  return "";
}

function parseAliasRow(cells, rowNumber, rawLine) {
  const [mlPartNumber, lrId, mwId, tiPartNumber, ...aliasCells] = cells.map(cleanString);
  const tokenMap = new Map();
  addToken(tokenMap, mlPartNumber, "ML_PN");
  addToken(tokenMap, lrId, "LR_ID");
  addToken(tokenMap, mwId, "MW_ID");
  addToken(tokenMap, tiPartNumber, "TI_PN");
  const aliases = aliasCells.flatMap(splitReferenceCell);
  aliases.forEach((alias) => addToken(tokenMap, alias, "ALIAS"));
  if (!tokenMap.size) return null;
  const tokens = tokenListFromMap(tokenMap);
  return {
    id: `parts-ref-${rowNumber}`,
    sourceTable: "ML/LR/MW/TI aliases",
    rowNumber,
    mlPartNumber: usefulValue(mlPartNumber),
    lrId: usefulValue(lrId),
    mwId: usefulValue(mwId),
    tiPartNumber: usefulValue(tiPartNumber),
    aliases: tokens.filter((token) => token.roles.includes("ALIAS")).map((token) => token.value),
    oemPartNumbers: tokens.filter((token) => token.roles.includes("ALIAS") && looksLikeOe(token.value)).map((token) => token.value),
    tokens,
    rawLine,
  };
}

function parseSupplierRow(cells, rowNumber, rawLine) {
  const [mlPartNumber, gsiPartNumber, mwPartNumber, kiPartNumber, tiPartNumber, ...oeCells] = cells.map(cleanString);
  const tokenMap = new Map();
  addToken(tokenMap, mlPartNumber, "ML_PN");
  addToken(tokenMap, gsiPartNumber, "GSI_PN");
  addToken(tokenMap, mwPartNumber, "MW_OR_KI_SKU");
  addToken(tokenMap, kiPartNumber, "KI_PN");
  addToken(tokenMap, tiPartNumber, "TI_PN");
  oeCells.flatMap(splitReferenceCell).forEach((value) => addToken(tokenMap, value, "GSI_PRIMARY_OE"));
  if (!tokenMap.size) return null;
  const tokens = tokenListFromMap(tokenMap);
  return {
    id: `parts-ref-${rowNumber}`,
    sourceTable: "GSI/KI/OE cross-reference",
    rowNumber,
    mlPartNumber: usefulValue(mlPartNumber),
    gsiPartNumber: usefulValue(gsiPartNumber),
    mwPartNumber: usefulValue(mwPartNumber),
    kiPartNumber: usefulValue(kiPartNumber),
    tiPartNumber: usefulValue(tiPartNumber),
    aliases: tokens
      .filter((token) => !["ML_PN", "GSI_PN", "MW_OR_KI_SKU", "KI_PN", "TI_PN"].some((role) => token.roles.includes(role)))
      .map((token) => token.value),
    oemPartNumbers: tokens.filter((token) => token.roles.includes("GSI_PRIMARY_OE") || looksLikeOe(token.value)).map((token) => token.value),
    tokens,
    rawLine,
  };
}

function mergeDuplicateRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const preferredKey =
      normalizeToken(row.mlPartNumber) ||
      normalizeToken(row.mwPartNumber || row.mwId) ||
      normalizeToken(row.lrId || row.gsiPartNumber) ||
      normalizeToken(row.tiPartNumber) ||
      row.id;
    if (!grouped.has(preferredKey)) {
      grouped.set(preferredKey, { ...row, duplicateRowNumbers: [] });
      continue;
    }
    const existing = grouped.get(preferredKey);
    const tokenMap = new Map(existing.tokens.map((token) => [token.normalized, { ...token, roles: new Set(token.roles) }]));
    for (const token of row.tokens) {
      if (!tokenMap.has(token.normalized)) tokenMap.set(token.normalized, { ...token, roles: new Set(token.roles) });
      else token.roles.forEach((role) => tokenMap.get(token.normalized).roles.add(role));
    }
    const mergedTokens = tokenListFromMap(tokenMap);
    grouped.set(preferredKey, {
      ...existing,
      gsiPartNumber: existing.gsiPartNumber || row.gsiPartNumber || "",
      mwPartNumber: existing.mwPartNumber || row.mwPartNumber || "",
      kiPartNumber: existing.kiPartNumber || row.kiPartNumber || "",
      tiPartNumber: existing.tiPartNumber || row.tiPartNumber || "",
      aliases: Array.from(new Set([...(existing.aliases || []), ...(row.aliases || [])])).sort(),
      oemPartNumbers: Array.from(new Set([...(existing.oemPartNumbers || []), ...(row.oemPartNumbers || [])])).sort(),
      tokens: mergedTokens,
      duplicateRowNumbers: [...(existing.duplicateRowNumbers || []), row.rowNumber],
    });
  }
  return Array.from(grouped.values()).sort((a, b) => {
    const left = a.mlPartNumber || a.mwPartNumber || a.mwId || a.lrId || a.gsiPartNumber || "";
    const right = b.mlPartNumber || b.mwPartNumber || b.mwId || b.lrId || b.gsiPartNumber || "";
    return left.localeCompare(right, undefined, { numeric: true });
  });
}

function buildLookupIndex(rows) {
  const index = {};
  for (const row of rows) {
    for (const token of row.tokens || []) {
      if (!index[token.normalized]) index[token.normalized] = [];
      index[token.normalized].push(row.id);
    }
  }
  return Object.fromEntries(Object.entries(index).sort(([left], [right]) => left.localeCompare(right)));
}

function parseReference(text) {
  const rows = [];
  let table = "";
  const lines = String(text || "").split(/\r?\n/);

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    const detected = detectTable(line);
    if (detected) {
      table = detected;
      return;
    }
    if (!table || !cleanString(line.replace(/\t/g, " "))) return;

    const cells = line.split("\t").map(cleanString);
    const hasUsefulCells = cells.some(usefulValue);
    if (!hasUsefulCells) return;
    const row = table === "supplier" ? parseSupplierRow(cells, rowNumber, line) : parseAliasRow(cells, rowNumber, line);
    if (row) rows.push(row);
  });

  const mergedRows = mergeDuplicateRows(rows);
  const totalTokens = mergedRows.reduce((sum, row) => sum + (row.tokens?.length || 0), 0);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "User supplied parts cross-reference paste",
    rawSourceFile: path.relative(repoRoot, defaultRawPath).replace(/\\/g, "/"),
    totalRawRows: rows.length,
    totalRows: mergedRows.length,
    totalTokens,
    rows: mergedRows,
    tokenIndex: buildLookupIndex(mergedRows),
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : "";
  let raw = inputPath && existsSync(inputPath) ? await readFile(inputPath, "utf8") : await readStdin();
  raw = raw.replace(/^\uFEFF/, "");
  if (!raw.trim()) {
    throw new Error("No parts reference text supplied. Pipe the pasted TSV into this script or pass a file path.");
  }

  await mkdir(dataDir, { recursive: true });
  const parsed = parseReference(raw);
  if (!parsed.rows.length) {
    throw new Error("No reference rows were parsed. Check that the paste includes the ML/LR/MW/TI or GSI/KI header row.");
  }
  await writeFile(defaultRawPath, raw, "utf8");
  await writeFile(defaultOutputPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`Imported ${parsed.totalRows} normalized reference rows from ${parsed.totalRawRows} raw rows.`);
  console.log(`Indexed ${parsed.totalTokens} part/OE/alias tokens.`);
  console.log(`Wrote ${path.relative(repoRoot, defaultOutputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
