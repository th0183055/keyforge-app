import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const dataDir = path.join(workspace, "data");
const outputPath = path.join(dataDir, "public-reference-sources.json");

const commonMakes = ["Acura", "Chevrolet", "Chrysler", "Dodge", "Ford", "Honda", "Hyundai", "Jeep", "Kia", "Lexus", "Nissan", "Ram", "Subaru", "Toyota", "Volkswagen"];

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function stringsMatch(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  const autelProductsPayload = await fetchJson("https://www.autel.com/ev-coverage/getProduct?lg=en");
  const autelProducts = (autelProductsPayload.data || [])
    .filter((product) => /IMMO|MaxiIM|IM508|IM608/i.test(`${product.proName} ${product.systemName}`))
    .map((product) => ({ name: product.proName, systemName: product.systemName }));
  const coverage = [];
  for (const product of autelProducts.filter((product) => /IM508|IM608/i.test(product.name)).slice(0, 4)) {
    const url = `https://www.autel.com/vehicle-coverage/getModel?lg=en&language=en&product=${encodeURIComponent(product.name)}`;
    const payload = await fetchJson(url).catch(() => ({ data: [] }));
    const makes = (payload.data || []).filter((make) => commonMakes.some((common) => stringsMatch(common, make)));
    coverage.push({ product: product.name, supportedMakes: makes, supportedMakeCount: makes.length });
  }
  const nhtsaVariables = await fetchJson("https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleVariableList?format=json").catch(() => ({ Results: [] }));
  const output = {
    generatedAt: new Date().toISOString(),
    sources: [
      { id: "nhtsa-vpic", name: "NHTSA vPIC", type: "official public vehicle identity", use: "VIN/YMM identity, body, engine, trim, plant, drive, fuel, GVWR, and manufacturer facts" },
      { id: "autel-coverage", name: "Autel public vehicle coverage", type: "public programmer coverage clue", use: "Programmer availability clues by product/make/model/year where the public endpoint returns data" },
      { id: "fcc-equipment", name: "FCC equipment authorization data", type: "public FCC ID clue", use: "FCC grantee/product clues after a candidate FCC is known from supplier or field data" },
      { id: "supplier-public-catalogs", name: "Supplier public catalogs", type: "public/live catalog facts", use: "Product names, fitment, FCC/chip/button clues, images, and stock where access is allowed" }
    ],
    autel: { products: autelProducts, coverage },
    nhtsa: {
      vehicleVariableCount: nhtsaVariables.Results?.length || 0,
      usefulVariables: (nhtsaVariables.Results || [])
        .filter((item) => /Model Year|Make|Model|Trim|Series|Body Class|Engine|Fuel|Drive|GVWR|Plant|Transmission/i.test(item.Name || ""))
        .map((item) => ({ id: item.ID, name: item.Name, group: item.GroupName }))
        .slice(0, 80),
    },
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
