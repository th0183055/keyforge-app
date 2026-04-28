import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const extractPath = path.join(workspace, "data", "inventory-labels-extract.txt");
const outputJsonPath = path.join(workspace, "data", "key-innovations-labels.json");
const outputCsvPath = path.join(workspace, "data", "key-innovations-labels.csv");

const knownPrefixes = new Set([
  "ABARTH",
  "ABRITES",
  "ACURA",
  "AUDI",
  "BMW",
  "BUICK",
  "CAD",
  "CADILLAC",
  "CHEV",
  "CHEVY",
  "CHRY",
  "CHRYSLER",
  "DODGE",
  "FIAT",
  "FORD",
  "GM",
  "GMC",
  "HON",
  "HONDA",
  "HYU",
  "HYUNDAI",
  "ILCO",
  "INF",
  "INFINITI",
  "JEEP",
  "JMA",
  "KIA",
  "LEX",
  "LEXUS",
  "LINCOLN",
  "MAZ",
  "MAZDA",
  "MIT",
  "MITSUBISHI",
  "NIS",
  "NISSAN",
  "RAM",
  "SCION",
  "SUB",
  "SUBARU",
  "SUZ",
  "SUZUKI",
  "TOY",
  "TOYOTA",
  "VW",
  "VOLKSWAGEN",
  "VOLVO",
  "XH",
]);
const headerPattern = /^[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+$/;
const optionPattern = /^(?:L|U|T|P|H|HL|RS|G|SD|TG|TH|B|RSH|PAI|PAO|ECC)(?:,\s*(?:L|U|T|P|H|HL|RS|G|SD|TG|TH|B|RSH|PAI|PAO|ECC))*$/;
const noisyLines = new Set([
  "SCAN FOR MORE",
  "MORE",
  "FOR",
  "PAGE BREAK",
  "--- PAGE BREAK ---",
]);

function cleanLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function splitValues(lines) {
  return lines
    .join(" ")
    .split(/,|\/|\s{2,}/)
    .map((item) => cleanLine(item).replace(/,$/, ""))
    .filter(Boolean)
    .filter((item) => !noisyLines.has(item.toUpperCase()));
}

function looksLikeFcc(value) {
  const text = value.toUpperCase();
  if (text.includes(":")) return false;
  if (/^\d+$/.test(text)) return false;
  return /[A-Z]/.test(text) && /\d/.test(text) && text.length >= 5 && !text.startsWith("164-") && !text.startsWith("591");
}

function looksLikePart(value) {
  const text = value.toUpperCase();
  return (
    text.includes("STRATTEC") ||
    text.startsWith("164-") ||
    /^\d{5,}$/.test(text) ||
    /^[A-Z0-9]{2,4}-?\d{2,}[A-Z0-9-]*$/.test(text)
  );
}

function brandFromSku(sku) {
  return sku.split("-")[0];
}

function parseEntries(text) {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const entries = [];
  let current = null;

  for (const line of lines) {
    const normalized = line.toUpperCase();
    const prefix = brandFromSku(normalized);
    if (headerPattern.test(normalized) && knownPrefixes.has(prefix) && !noisyLines.has(normalized)) {
      if (current) entries.push(current);
      current = {
        sku: normalized,
        brand: brandFromSku(normalized),
        rawLines: [],
      };
      continue;
    }

    if (current) {
      current.rawLines.push(line);
    }
  }

  if (current) entries.push(current);
  return entries.map(enrichEntry);
}

function enrichEntry(entry) {
  const optionLine = entry.rawLines.find((line) => optionPattern.test(line.toUpperCase()));
  const beforeOptions = optionLine ? entry.rawLines.slice(0, entry.rawLines.indexOf(optionLine)) : entry.rawLines.slice(0, 2);
  const afterOptions = optionLine ? entry.rawLines.slice(entry.rawLines.indexOf(optionLine) + 1) : entry.rawLines.slice(2);
  const fccCandidates = splitValues(beforeOptions).filter(looksLikeFcc);
  const partCandidates = splitValues(afterOptions).filter(looksLikePart);
  const descriptor = entry.rawLines.find((line) => /smart key|chip|blade|wired|prox|remote/i.test(line)) || "";

  return {
    sku: entry.sku,
    brand: entry.brand,
    fccIds: [...new Set(fccCandidates)],
    functions: optionLine || "",
    oemPartNumbers: [...new Set(partCandidates)],
    descriptor,
    rawText: entry.rawLines.join(" | "),
    source: "Key Innovations inventory labels PDF",
    confidence: "catalog label extraction - review",
  };
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

await mkdir(path.join(workspace, "data"), { recursive: true });
const text = await readFile(extractPath, "utf8");
const entries = parseEntries(text).filter((entry) => entry.fccIds.length || entry.oemPartNumbers.length || entry.descriptor);

const output = {
  generatedAt: new Date().toISOString(),
  source: "Full List - Inventory Labels (1).pdf",
  totalEntries: entries.length,
  entries,
};

const headers = ["sku", "brand", "fccIds", "functions", "oemPartNumbers", "descriptor", "confidence", "rawText"];
const csv = [headers.join(","), ...entries.map((entry) => headers.map((header) => csvCell(entry[header])).join(","))].join(
  "\n",
);

await writeFile(outputJsonPath, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(outputCsvPath, `${csv}\n`);

console.log(
  JSON.stringify(
    {
      totalEntries: entries.length,
      outputJsonPath,
      outputCsvPath,
      samples: entries.slice(0, 5),
    },
    null,
    2,
  ),
);
