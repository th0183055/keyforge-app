import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const sourceDir = process.env.PROGRAMMING_DATA_DIR || "C:\\Users\\th018\\OneDrive\\Desktop\\Data new";
const outDir = path.join(process.cwd(), "data");
const outputPath = path.join(outDir, "programming-reference.json");

function normalize(value) {
  return String(value || "").trim();
}

function normalizeMake(value) {
  return normalize(value).replaceAll("_", " ");
}

const files = (await readdir(sourceDir)).filter((file) => file.toLowerCase().endsWith(".json"));
const rows = [];
const errors = [];

for (const file of files) {
  const filePath = path.join(sourceDir, file);
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    for (const [makeName, models] of Object.entries(payload)) {
      for (const [modelName, applications] of Object.entries(models || {})) {
        for (const app of applications || []) {
          rows.push({
            make: normalizeMake(makeName).toUpperCase(),
            model: normalize(modelName),
            year: Number(app.year),
            ignitionType: normalize(app.type),
            immobilizerSystem: normalize(app.immo_system),
            programMethod: normalize(app.program_method),
            requiresPin: Boolean(app.requires_pin),
            requiresBypass: Boolean(app.requires_bypass),
            requiresOnline: Boolean(app.requires_online),
            allKeysLostSupported: Boolean(app.all_keys_lost_supported),
            notes: normalize(app.notes),
            sourceFile: file,
          });
        }
      }
    }
  } catch (error) {
    errors.push({ file, error: error.message });
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  sourceDir,
  totalRows: rows.length,
  errors,
  rows: rows.sort(
    (a, b) =>
      String(a.make).localeCompare(String(b.make)) ||
      String(a.model).localeCompare(String(b.model)) ||
      a.year - b.year,
  ),
};

await mkdir(outDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      totalRows: output.totalRows,
      errors: errors.length,
      outputPath,
      sample: output.rows.slice(0, 5),
    },
    null,
    2,
  ),
);
