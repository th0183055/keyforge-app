import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const dataDir = path.join(workspace, "data");
const outputPath = path.join(dataDir, "public-reference-sources.json");

const commonMakes = ["Acura", "Chevrolet", "Chrysler", "Dodge", "Ford", "Honda", "Hyundai", "Jeep", "Kia", "Lexus", "Nissan", "Ram", "Subaru", "Toyota", "Volkswagen"];

const publicTargets = [
  {
    id: "xtool-vehicle-coverage",
    name: "XTOOL public vehicle coverage",
    category: "programmer coverage",
    url: "https://www.xtoolonline.com/support/vehicle-coverage",
    use: "XTOOL make/model coverage clue for diagnosis, key programming, special functions, and IMMO where publicly accessible.",
  },
  {
    id: "xtool-key-programming-manual",
    name: "XTOOL key programming manual",
    category: "programmer / EEPROM tool",
    url: "https://www.xtooltech.com/official/product_document/1661416059950.pdf",
    use: "Public manual availability clue for XTOOL key programming workflow and EEPROM/IMMO tool capability.",
  },
  {
    id: "advanced-diagnostics-smart-pro",
    name: "Advanced Diagnostics Smart Pro",
    category: "programmer coverage",
    url: "https://www.hickleys.com/diagnostics/smartpro.php",
    use: "Public Smart Pro / Info Quest capability clue. Verify exact vehicle coverage inside licensed AD resources before dispatch.",
  },
  {
    id: "toyota-tis-techstream",
    name: "Toyota TIS / Techstream",
    category: "OEM programmer",
    url: "https://techinfo.toyota.com/",
    use: "Official Toyota service-info clue for Techstream, key code, immobilizer/smart reset, and security-professional workflow.",
  },
  {
    id: "gm-techline-connect",
    name: "GM Techline Connect / SPS",
    category: "OEM programmer",
    url: "https://www.gmparts.com/trade-professionals/diagnostic-support-resources",
    use: "Official GM clue for Techline Connect, SPS, calibrations, GDS software, and scan-tool update workflow.",
  },
  {
    id: "ford-motorcraft-service",
    name: "Ford Motorcraft Service / FDRS",
    category: "OEM programmer",
    url: "https://www.motorcraft-service.com/contact/index.html",
    use: "Official Ford service-info clue for IDS/FJDS/FDRS diagnostic support and account-based service access.",
  },
  {
    id: "honda-techinfo",
    name: "Honda Service Express / i-HDS",
    category: "OEM programmer",
    url: "https://techinfo.honda.com/",
    use: "Official Honda service-info entry point. Verify immobilizer and module workflows through authorized service resources.",
  },
  {
    id: "nissan-techinfo",
    name: "Nissan TechInfo",
    category: "OEM programmer",
    url: "https://www.nissan-techinfo.com/",
    use: "Official Nissan service-info entry point. Verify CONSULT/security workflows through authorized resources.",
  },
  {
    id: "stellantis-techauthority",
    name: "Stellantis TechAuthority",
    category: "OEM programmer",
    url: "https://www.techauthority.com/",
    use: "Official Stellantis service-info entry point for Chrysler/Dodge/Jeep/Ram security and programming references.",
  },
  {
    id: "autel-xp400-pro",
    name: "Autel XP400 Pro",
    category: "EEPROM tool",
    url: "https://autel.com/au/immo/xp400-pro/",
    use: "Public EEPROM/MCU/IMMO ECU read-write tool capability clue for Autel IM508/IM608 workflows.",
  },
  {
    id: "xhorse-key-tool-plus-manual",
    name: "Xhorse Key Tool Plus manual",
    category: "EEPROM tool",
    url: "https://www.xhorsetool.com/upload/pro/22120916705811783595.pdf",
    use: "Public manual availability clue for Xhorse OBD IMMO, EEPROM read/write, and immo data tooling.",
  },
  {
    id: "obdstar-x300-dp-plus",
    name: "OBDSTAR X300 DP Plus",
    category: "EEPROM tool",
    url: "https://www.obdstarstore.com/wholesale/obdstar-x300-dp-plus-full-configuration.html",
    use: "Public IMMO/EEPROM/key-renewing adapter capability clue. Verify vehicle-specific coverage before quoting.",
  },
];

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "LockForge public source indexer" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function probeTarget(target) {
  try {
    const response = await fetch(target.url, {
      headers: { "user-agent": "LockForge public source indexer" },
      signal: AbortSignal.timeout(18000),
    });
    const contentType = response.headers.get("content-type") || "";
    let text = "";
    if (response.ok && /text|html|json/i.test(contentType)) {
      text = (await response.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    }
    const haystack = response.ok ? `${target.name} ${target.use} ${text}`.toLowerCase() : "";
    const keywords = ["key programming", "immo", "immobilizer", "all keys lost", "add key", "read password", "pin", "remote learning", "eeprom", "mcu", "ecu", "fdrs", "techstream", "techline", "sps", "smart pro", "info quest", "xhorse", "x100"];
    return {
      id: target.id,
      name: target.name,
      category: target.category,
      url: target.url,
      use: target.use,
      status: response.ok ? "available" : "unavailable",
      httpStatus: response.status,
      contentType,
      signals: response.ok ? keywords.filter((keyword) => haystack.includes(keyword)).slice(0, 12) : [],
      publicTextIndexed: Boolean(text),
    };
  } catch (error) {
    return {
      id: target.id,
      name: target.name,
      category: target.category,
      url: target.url,
      use: target.use,
      status: "probe failed",
      error: error.message,
      signals: [],
      publicTextIndexed: false,
    };
  }
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
  const sourceProbes = [];
  for (const target of publicTargets) {
    sourceProbes.push(await probeTarget(target));
  }
  const output = {
    generatedAt: new Date().toISOString(),
    sources: [
      { id: "nhtsa-vpic", name: "NHTSA vPIC", type: "official public vehicle identity", use: "VIN/YMM identity, body, engine, trim, plant, drive, fuel, GVWR, and manufacturer facts" },
      { id: "autel-coverage", name: "Autel public vehicle coverage", type: "public programmer coverage clue", use: "Programmer availability clues by product/make/model/year where the public endpoint returns data" },
      { id: "xtool-public", name: "XTOOL public sources", type: "public programmer coverage clue", use: "Public XTOOL pages/manuals for key programming, IMMO, and EEPROM capability clues" },
      { id: "advanced-diagnostics-public", name: "Advanced Diagnostics public sources", type: "public programmer coverage clue", use: "Public Smart Pro / Info Quest capability clues; exact coverage still must be verified in licensed resources" },
      { id: "oem-programmer-sources", name: "OEM programmer sources", type: "official service-info clue", use: "Official Ford/Toyota/GM/Honda/Nissan/Stellantis entry points for OEM/security programming paths" },
      { id: "eeprom-tool-sources", name: "EEPROM tool sources", type: "public tool capability clue", use: "Public tool pages/manuals for EEPROM/MCU/IMMO ECU read-write capability" },
      { id: "fcc-equipment", name: "FCC equipment authorization data", type: "public FCC ID clue", use: "FCC grantee/product clues after a candidate FCC is known from supplier or field data" },
      { id: "supplier-public-catalogs", name: "Supplier public catalogs", type: "public/live catalog facts", use: "Product names, fitment, FCC/chip/button clues, images, and stock where access is allowed" },
    ],
    autel: { products: autelProducts, coverage },
    probes: sourceProbes,
    programmerSources: sourceProbes.filter((probe) => /programmer|OEM/i.test(probe.category)),
    eepromSources: sourceProbes.filter((probe) => /EEPROM/i.test(probe.category)),
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
