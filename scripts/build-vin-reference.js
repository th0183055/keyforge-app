import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const dataDir = path.join(workspace, "data");
const mutableDataDir = process.env.TIMLOCK_DATA_DIR ? path.resolve(process.env.TIMLOCK_DATA_DIR) : dataDir;
const storePath = path.join(mutableDataDir, "store.json");
const storeExamplePath = path.join(dataDir, "store.example.json");
const calendarPath = path.join(workspace, "calendar-import", "Tim Work_tim@wekeycars.com.ics");
const outputJsonPath = path.join(dataDir, "vin-reference.json");
const outputCsvPath = path.join(dataDir, "vin-reference.csv");
const cachePath = path.join(dataDir, "vin-decode-cache.json");

const vinPattern = /[A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9\s-]{15,35}[A-HJ-NPR-Z0-9]/gi;

function unfoldIcs(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
}

function cleanText(value = "") {
  return value
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseProperties(block) {
  const props = {};
  for (const line of block.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const rawKey = line.slice(0, index);
    const key = rawKey.split(";")[0].toUpperCase();
    const value = cleanText(line.slice(index + 1));
    if (!props[key]) props[key] = [];
    props[key].push(value);
  }
  return props;
}

function parseIcsDate(value) {
  if (!value) return "";
  const compact = value.replace("Z", "");
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!match) return "";
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
  ).toISOString();
}

function validateVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

function normalizeVinCandidate(value) {
  const candidate = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return validateVin(candidate) ? candidate : "";
}

function addVin(map, vin, source) {
  const normalized = normalizeVinCandidate(vin);
  if (!normalized) return;
  if (!map.has(normalized)) {
    map.set(normalized, {
      vin: normalized,
      sources: [],
      firstSeen: "",
      lastSeen: "",
    });
  }

  const record = map.get(normalized);
  record.sources.push(source);
  if (source.date) {
    if (!record.firstSeen || source.date < record.firstSeen) record.firstSeen = source.date;
    if (!record.lastSeen || source.date > record.lastSeen) record.lastSeen = source.date;
  }
}

function collectVinsFromText(map, text, source) {
  for (const match of String(text || "").matchAll(vinPattern)) {
    addVin(map, match[0], source);
  }
}

async function collectStoreVins(map) {
  const store = await readStoreForVinReference();
  for (const job of store.jobs || []) {
    const source = {
      sourceType: "store",
      title: job.title || job.vehicle || "Stored job",
      date: job.createdAt || "",
      jobId: job.id || "",
      programmer: job.programmer || "",
      price: job.price || "",
      payment: job.payment || "",
    };

    collectVinsFromText(map, Object.values(job).join("\n"), source);
  }
}

async function readStoreForVinReference() {
  for (const candidatePath of [storePath, storeExamplePath]) {
    if (!existsSync(candidatePath)) continue;
    return JSON.parse(await readFile(candidatePath, "utf8"));
  }
  return { jobs: [] };
}

async function collectCalendarVins(map) {
  if (!existsSync(calendarPath)) return;
  const ics = unfoldIcs(await readFile(calendarPath, "utf8"));
  const eventBlocks = [...ics.matchAll(/BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/g)].map((match) => match[1]);

  for (const block of eventBlocks) {
    const props = parseProperties(block);
    const summary = props.SUMMARY?.[0] || "Untitled";
    const description = props.DESCRIPTION?.[0] || "";
    const location = props.LOCATION?.[0] || "";
    const date = parseIcsDate(props.DTSTART?.[0]);
    const source = {
      sourceType: "calendar",
      title: summary,
      date,
      location,
      jobId: props.UID?.[0] || "",
      programmer: extractProgrammer(description),
      price: extractMoney(`${summary}\n${description}`) || "",
      payment: extractPayment(`${summary}\n${description}`),
    };

    collectVinsFromText(map, `${summary}\n${description}\n${location}`, source);
  }
}

function extractMoney(text) {
  const amounts = [...String(text).matchAll(/\$ ?(\d+(?:\.\d{2})?)/g)].map((match) => Number(match[1]));
  return amounts.length ? Math.max(...amounts) : "";
}

function extractPayment(text) {
  const match = String(text).match(/\[(cr|ch|cash|n30|no30|cc|venmo|zelle)\]/i);
  return match ? match[1].toLowerCase() : "";
}

function extractProgrammer(text) {
  const upper = String(text).toUpperCase();
  const hits = ["FDRS", "TIS", "TECHSTREAM", "SPS", "PCP", "AUTEL", "SMART PRO", "IM608", "XTOOL"].filter((tool) =>
    upper.includes(tool),
  );
  return [...new Set(hits)].join(" + ");
}

async function readCache() {
  if (!existsSync(cachePath)) return {};
  return JSON.parse(await readFile(cachePath, "utf8"));
}

async function writeCache(cache) {
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

async function decodeVin(vin, cache) {
  if (cache[vin]) return cache[vin];

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`VIN decode failed for ${vin}: ${response.status}`);
  const payload = await response.json();
  const decoded = payload.Results?.[0] || {};
  cache[vin] = decoded;
  await writeCache(cache);
  await new Promise((resolve) => setTimeout(resolve, 75));
  return decoded;
}

function value(result, key) {
  const item = result?.[key];
  return item && item !== "Not Applicable" ? item : "";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function firstSource(vinRecord) {
  return [...vinRecord.sources].sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] || {};
}

function mostRecentSource(vinRecord) {
  return [...vinRecord.sources].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || {};
}

function buildReferenceRow(vinRecord, decoded) {
  const first = firstSource(vinRecord);
  const latest = mostRecentSource(vinRecord);

  return {
    vin: vinRecord.vin,
    year: value(decoded, "ModelYear"),
    make: value(decoded, "Make"),
    model: value(decoded, "Model"),
    trim: value(decoded, "Trim"),
    bodyClass: value(decoded, "BodyClass"),
    engine: [value(decoded, "DisplacementL"), value(decoded, "EngineConfiguration")].filter(Boolean).join("L "),
    driveType: value(decoded, "DriveType"),
    plantCity: value(decoded, "PlantCity"),
    plantCountry: value(decoded, "PlantCountry"),
    decodeErrorCode: value(decoded, "ErrorCode"),
    decodeErrorText: value(decoded, "ErrorText"),
    sourceCount: vinRecord.sources.length,
    firstSeen: vinRecord.firstSeen,
    lastSeen: vinRecord.lastSeen,
    firstJobTitle: first.title || "",
    latestJobTitle: latest.title || "",
    latestProgrammerHint: latest.programmer || "",
    latestPriceHint: latest.price || "",
    latestPaymentHint: latest.payment || "",
    keySystemStatus: "needs locksmith verification",
    keyOptions: "",
    programmerOptions: latest.programmer || "",
    originationTools: "",
    verifyBeforeDispatch: "FCC/frequency; blade/keyway; programmer coverage; supplier part number; authorization",
    notes: "Decoded from VIN. Locksmith key data must be verified before use.",
  };
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  const vinMap = new Map();
  await collectStoreVins(vinMap);
  await collectCalendarVins(vinMap);

  const cache = await readCache();
  const rows = [];
  const vins = [...vinMap.keys()].sort();

  for (const vin of vins) {
    const decoded = await decodeVin(vin, cache);
    rows.push(buildReferenceRow(vinMap.get(vin), decoded));
  }

  const reference = {
    generatedAt: new Date().toISOString(),
    totalUniqueVins: rows.length,
    rows,
  };

  const headers = Object.keys(rows[0] || { vin: "" });
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");

  await writeFile(outputJsonPath, `${JSON.stringify(reference, null, 2)}\n`);
  await writeFile(outputCsvPath, `${csv}\n`);

  console.log(
    JSON.stringify(
      {
        totalUniqueVins: rows.length,
        outputJsonPath,
        outputCsvPath,
        cachePath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
