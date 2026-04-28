import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const dataDir = path.join(workspace, "data");
const outputPath = path.join(dataDir, "vpic-catalog.json");
const cachePath = path.join(dataDir, "vpic-catalog-cache.json");
const vinReferencePath = path.join(dataDir, "vin-reference.json");

const defaultMakes = [
  "Acura",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "GMC",
  "Honda",
  "Hyundai",
  "Jeep",
  "Kia",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Nissan",
  "Ram",
  "Subaru",
  "Toyota",
  "Volkswagen",
];

const vehicleTypes = ["passenger car", "truck", "multipurpose passenger vehicle"];
const startYear = Number(process.env.START_YEAR || 2010);
const endYear = Number(process.env.END_YEAR || new Date().getFullYear() + 1);
const requestedMakes = process.env.MAKES
  ? process.env.MAKES.split(",").map((make) => make.trim()).filter(Boolean)
  : defaultMakes;

async function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

async function fetchModels(make, year, vehicleType, cache) {
  const key = `${normalize(make)}|${year}|${normalize(vehicleType)}`;
  if (cache[key]) return cache[key];

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(
    make,
  )}/modelyear/${year}/vehicletype/${encodeURIComponent(vehicleType)}?format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`vPIC request failed for ${make} ${year} ${vehicleType}: ${response.status}`);
  }

  const payload = await response.json();
  cache[key] = payload.Results || [];
  await writeJson(cachePath, cache);
  await new Promise((resolve) => setTimeout(resolve, 60));
  return cache[key];
}

async function readSeenVehicles() {
  const reference = await readJsonIfExists(vinReferencePath, { rows: [] });
  const seen = new Map();
  for (const row of reference.rows || []) {
    const key = [row.year, normalize(row.make), normalize(row.model)].join("|");
    if (!row.year || !row.make || !row.model) continue;
    seen.set(key, (seen.get(key) || 0) + Number(row.sourceCount || 1));
  }
  return seen;
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  const cache = await readJsonIfExists(cachePath, {});
  const seenVehicles = await readSeenVehicles();
  const rows = [];
  const errors = [];

  for (const make of requestedMakes) {
    for (let year = startYear; year <= endYear; year += 1) {
      for (const vehicleType of vehicleTypes) {
        try {
          const models = await fetchModels(make, year, vehicleType, cache);
          for (const model of models) {
            const vehicleKey = [year, normalize(model.Make_Name), normalize(model.Model_Name)].join("|");
            rows.push({
              year,
              makeId: model.Make_ID,
              make: model.Make_Name,
              modelId: model.Model_ID,
              model: model.Model_Name,
              vehicleTypeId: model.VehicleTypeId,
              vehicleType: model.VehicleTypeName,
              seenInCalendarCount: seenVehicles.get(vehicleKey) || 0,
              locksmithDataStatus: seenVehicles.has(vehicleKey) ? "seen in local history" : "needs key intelligence",
              keySystemStatus: "not verified",
              keyOptions: "",
              programmerOptions: "",
              originationTools: "",
              verifyBeforeDispatch: "VIN decode; trim/body; keyway/blade; FCC/frequency; transponder/prox; programmer coverage",
            });
          }
        } catch (error) {
          errors.push({ make, year, vehicleType, error: error.message });
        }
      }
    }
  }

  const unique = new Map();
  for (const row of rows) {
    const key = [row.year, normalize(row.make), normalize(row.model), normalize(row.vehicleType)].join("|");
    const existing = unique.get(key);
    if (!existing || row.seenInCalendarCount > existing.seenInCalendarCount) {
      unique.set(key, row);
    }
  }

  const catalogRows = [...unique.values()].sort(
    (a, b) =>
      b.year - a.year ||
      String(a.make).localeCompare(String(b.make)) ||
      String(a.model).localeCompare(String(b.model)),
  );

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: "NHTSA vPIC GetModelsForMakeYear API",
    startYear,
    endYear,
    makes: requestedMakes,
    vehicleTypes,
    totalApplications: catalogRows.length,
    errors,
    rows: catalogRows,
  };

  await writeJson(outputPath, catalog);
  console.log(
    JSON.stringify(
      {
        totalApplications: catalog.totalApplications,
        errors: errors.length,
        outputPath,
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
