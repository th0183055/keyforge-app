import { createServer } from "node:http";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "store.json");
const keyIntelligencePath = path.join(dataDir, "key-intelligence.json");
const vinReferencePath = path.join(dataDir, "vin-reference.json");
const vpicCatalogPath = path.join(dataDir, "vpic-catalog.json");
const sourceConnectorsPath = path.join(dataDir, "source-connectors.json");
const keyInnovationsLabelsPath = path.join(dataDir, "key-innovations-labels.json");
const programmingReferencePath = path.join(dataDir, "programming-reference.json");
const masterCatalogPath = path.join(dataDir, "master-catalog.json");
const supplierAccountsPath = path.join(dataDir, "supplier-accounts.local.json");
const localSecretPath = path.join(dataDir, ".lockforge-secret");

const supplierRegistry = [
  {
    id: "key-innovations",
    name: "Key Innovations",
    loginUrl: "https://keyinnovations.com/login.php",
    lookupMode: "live connector",
  },
  {
    id: "uhs",
    name: "UHS Hardware",
    loginUrl: "https://www.uhs-hardware.com/login.php",
    lookupMode: "planned connector",
  },
  {
    id: "transponder-island",
    name: "Transponder Island",
    loginUrl: "https://transponderisland.com/",
    lookupMode: "planned connector",
  },
  {
    id: "key4",
    name: "Key4",
    loginUrl: "https://www.key4.com/",
    lookupMode: "planned connector",
  },
  {
    id: "idn-hoffman",
    name: "IDN-H. Hoffman",
    loginUrl: "https://www.idn-inc.com/",
    lookupMode: "login/import planned",
  },
  {
    id: "golden-supply",
    name: "Golden Supply Inc.",
    loginUrl: "https://www.goldenremotes.com/sca-golden-dev/checkout.ssp?is=login&login=T",
    lookupMode: "live public connector",
  },
];

function supplierDefaults(definition) {
  return {
    id: definition.id,
    name: definition.name,
    loginUrl: definition.loginUrl || "",
    username: "",
    enabled: definition.id === "key-innovations" ? false : false,
    passwordCipher: null,
    lookupMode: definition.lookupMode,
    updatedAt: null,
  };
}

function mergeSupplierRegistry(accounts) {
  const existing = new Map((accounts || []).map((account) => [account.id, account]));
  const merged = supplierRegistry.map((definition) => ({
    ...supplierDefaults(definition),
    ...(existing.get(definition.id) || {}),
    name: definition.name,
    lookupMode: definition.lookupMode,
    loginUrl: existing.get(definition.id)?.loginUrl || definition.loginUrl || "",
  }));
  for (const account of accounts || []) {
    if (!supplierRegistry.some((definition) => definition.id === account.id)) merged.push(account);
  }
  return merged;
}

const seedStore = {
  jobs: [
    {
      id: randomUUID(),
      title: "RLP - Grandfather Clock",
      customer: "RLP",
      vehicle: "Sligh Clock",
      service: "Repair / lock problem",
      verification: "Customer scheduled job",
      status: "Part on order",
      schedule: "Friday, April 24, 2026 - 09:15 to 09:45",
      locationName: "24255 Jasmin Ln",
      address: "24255 Jasmin Ln, Glenwood, IA 51534, USA",
      phone: "402-960-9734",
      contact: "",
      price: 170,
      payment: "cr",
      programmer: "Clock hardware inspection",
      sequence: "Confirmation #4PP4A2R5U / Q180",
      tags: ["RLP", "clock", "part ordered"],
      notes: ["Has key not turning", "Q170 for first hour and service trip", "Part on order"],
      createdAt: "2026-04-24T14:15:00.000Z",
    },
    {
      id: randomUUID(),
      title: "DK 25 F-150 gry",
      customer: "Sarah",
      vehicle: "2025 Ford F-150 gray",
      service: "Duplicate key",
      verification: "Completed customer job",
      status: "Completed",
      schedule: "Friday, April 24, 2026 - 10:30 to 10:45",
      locationName: "2311 Lincoln Ave",
      address: "2311 Lincoln Ave, Plattsmouth, NE 68048, USA",
      phone: "402-296-1010",
      contact: "Sarah",
      vin: "1FTFW3L58SKD97045",
      mileage: "25,437",
      price: 278.53,
      payment: "cr",
      programmer: "FRD8334 + FDRS",
      sequence: "228.53 + 50",
      tags: ["DK", "Ford", "FDRS"],
      notes: ["VIN recorded", "Mileage 25,437", "FRD8334 + FDRS", "228.53 + 50"],
      createdAt: "2026-04-24T15:30:00.000Z",
    },
    {
      id: randomUUID(),
      title: "AU 00 Accord [Del Auto]",
      customer: "Del Auto",
      vehicle: "2000 Honda Accord",
      service: "Auto unlock",
      verification: "Completed dealer job",
      status: "Completed",
      schedule: "Friday, April 24, 2026 - 11:15 to 11:20",
      locationName: "8759 S 48th St",
      address: "8759 S 48th St, Bellevue, NE 68157, USA",
      phone: "",
      contact: "",
      vin: "1HGCG1651YA06308",
      price: 60,
      payment: "ch",
      programmer: "Field unlock service",
      sequence: "",
      tags: ["AU", "Honda", "dealer"],
      notes: ["VIN recorded", "$60.00 [ch]"],
      createdAt: "2026-04-24T16:15:00.000Z",
    },
    {
      id: randomUUID(),
      title: "DK 24 Expedition blk [ehs]",
      customer: "Rande",
      vehicle: "2024 Ford Expedition black",
      service: "Duplicate key",
      verification: "Rande via text",
      status: "Completed",
      schedule: "Thursday, April 23, 2026 - 10:30 to 10:40",
      locationName: "",
      address: "",
      phone: "",
      contact: "Rande via text",
      vin: "1FMJK2A87REA42384",
      mileage: "69,416",
      keyCode: "10077",
      price: 110,
      payment: "n30",
      programmer: "PCP + FDRS",
      sequence: "Sq. Inv. 14121",
      tags: ["DK", "Ford", "FDRS", "n30"],
      notes: ["24 Expedition", "LP: none", "PCP + FDRS", "Sq. Inv. 14121"],
      createdAt: "2026-04-23T15:30:00.000Z",
    },
    {
      id: randomUUID(),
      title: "PCP 25 Camry wht [ewc]",
      customer: "Edwards Chevrolet",
      vehicle: "2025 Toyota Camry hybrid white",
      service: "Program customer-provided key",
      verification: "Melissa via text",
      status: "Completed",
      schedule: "Thursday, April 23, 2026 - 09:55 to 10:05",
      locationName: "Edwards Chevrolet",
      address: "3400 S Expressway St, Council Bluffs, IA 51501, USA",
      phone: "",
      contact: "Melissa via text",
      vin: "4T1DAACK3SU116334",
      keyCode: "87731",
      price: 110,
      payment: "n30",
      programmer: "PCP + TIS",
      sequence: "Sq. Inv. 14120",
      tags: ["PCP", "Toyota", "TIS", "n30"],
      notes: ["Customer-provided 2025 Toyota Camry hybrid key needed programming", "PCP + TIS", "Sq. Inv. 14120"],
      createdAt: "2026-04-23T14:55:00.000Z",
    },
    {
      id: randomUUID(),
      title: "CU Trailer",
      customer: "Chris",
      vehicle: "Trailer with 3 Master Lock padlocks",
      service: "Trailer lock service",
      verification: "Completed customer job",
      status: "Completed",
      schedule: "Thursday, April 23, 2026 - 09:15 to 09:25",
      locationName: "11528 Centennial Rd",
      address: "11528 Centennial Rd, La Vista, NE 68128, USA",
      phone: "(314) 308-2603",
      contact: "Chris",
      price: 150,
      payment: "cr",
      programmer: "Field lock service",
      sequence: "",
      tags: ["CU", "trailer", "padlocks"],
      notes: ["Pick or cut off 3 Master Lock padlocks off of trailer", "$150.00 [cr]"],
      createdAt: "2026-04-23T14:15:00.000Z",
    },
  ],
  vehicles: [
    ["2025 Ford F-150", "DK job pattern, FRD8334 + FDRS, mileage and VIN captured"],
    ["2024 Ford Expedition", "DK job pattern, PCP + FDRS, key code and invoice captured"],
    ["2025 Toyota Camry hybrid", "PCP job pattern, TIS workflow, dealer text authorization"],
    ["2000 Honda Accord", "AU dealer job pattern with fast closeout and VIN record"],
  ],
  auditLog: [],
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(storePath)) {
    await writeStore(seedStore);
  }
}

async function readStore() {
  await ensureStore();
  return JSON.parse(await readFile(storePath, "utf8"));
}

async function writeStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

async function readKeyIntelligence() {
  return JSON.parse(await readFile(keyIntelligencePath, "utf8"));
}

async function readSourceConnectors() {
  return JSON.parse(await readFile(sourceConnectorsPath, "utf8"));
}

async function writeKeyIntelligence(intelligence) {
  await writeFile(keyIntelligencePath, `${JSON.stringify(intelligence, null, 2)}\n`);
}

async function localVaultKey() {
  await mkdir(dataDir, { recursive: true });
  let secret = process.env.LOCKFORGE_SECRET;
  if (!secret) {
    if (existsSync(localSecretPath)) {
      secret = await readFile(localSecretPath, "utf8");
    } else {
      secret = randomBytes(32).toString("hex");
      await writeFile(localSecretPath, secret);
    }
  }
  return createHash("sha256").update(secret).digest();
}

async function encryptSecret(value) {
  const key = await localVaultKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  };
}

async function decryptSecret(cipherPayload) {
  if (!cipherPayload?.value || !cipherPayload?.iv || !cipherPayload?.tag) return "";
  const key = await localVaultKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(cipherPayload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(cipherPayload.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherPayload.value, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function readSupplierAccounts() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(supplierAccountsPath)) {
    const seed = {
      generatedAt: new Date().toISOString(),
      accounts: mergeSupplierRegistry([]),
    };
    await writeFile(supplierAccountsPath, `${JSON.stringify(seed, null, 2)}\n`);
    return seed;
  }
  const vault = JSON.parse(await readFile(supplierAccountsPath, "utf8"));
  const accounts = mergeSupplierRegistry(vault.accounts);
  if (accounts.length !== vault.accounts?.length) {
    const nextVault = { ...vault, accounts };
    await writeSupplierAccounts(nextVault);
    return nextVault;
  }
  return { ...vault, accounts };
}

async function writeSupplierAccounts(accounts) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(supplierAccountsPath, `${JSON.stringify(accounts, null, 2)}\n`);
}

function publicSupplierAccount(account) {
  return {
    id: account.id,
    name: account.name,
    loginUrl: account.loginUrl || "",
    username: account.username || "",
    enabled: Boolean(account.enabled),
    connected: Boolean(account.enabled && account.username && account.passwordCipher),
    hasPassword: Boolean(account.passwordCipher),
    lookupMode: account.lookupMode || "planned connector",
    updatedAt: account.updatedAt || null,
  };
}

function cookieHeaderFrom(headers) {
  const setCookie = headers.getSetCookie ? headers.getSetCookie() : headers.get("set-cookie")?.split(/,(?=[^;]+?=)/g) || [];
  return setCookie.map((cookie) => cookie.split(";")[0]).filter(Boolean).join("; ");
}

function mergeCookies(currentCookie, headers) {
  const nextCookies = cookieHeaderFrom(headers)
    .split("; ")
    .filter(Boolean);
  if (!nextCookies.length) return currentCookie;
  const jar = new Map(
    String(currentCookie || "")
      .split("; ")
      .filter(Boolean)
      .map((cookie) => {
        const [name, ...rest] = cookie.split("=");
        return [name, rest.join("=")];
      }),
  );
  nextCookies.forEach((cookie) => {
    const [name, ...rest] = cookie.split("=");
    if (name) jar.set(name, rest.join("="));
  });
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&#x3D;", "=")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "));
}

function normalizeImageUrl(url) {
  const cleanUrl = decodeHtml(url).replace("{:size}", "500x659");
  if (!cleanUrl) return "";
  return cleanUrl.startsWith("//") ? `https:${cleanUrl}` : cleanUrl;
}

function parseProductCards(html) {
  const cards = [];
  const matches = String(html || "").matchAll(/<article[\s\S]*?class="card[\s\S]*?<\/article>/gi);
  for (const match of matches) {
    const card = match[0];
    const url = decodeHtml(card.match(/<a[^>]+href="([^"]+)"/i)?.[1] || "").split("?")[0];
    const image =
      normalizeImageUrl(card.match(/<img[^>]+src="([^"]+)"/i)?.[1]) ||
      normalizeImageUrl(card.match(/data-srcset="([^"]+)"/i)?.[1]?.split(" ")[0]);
    cards.push({
      id: decodeHtml(card.match(/data-entity-id="([^"]+)"/i)?.[1]),
      supplier: "Key Innovations",
      name: decodeHtml(card.match(/data-name="([^"]+)"/i)?.[1]),
      brand: decodeHtml(card.match(/data-product-brand="([^"]*)"/i)?.[1]),
      price: decodeHtml(card.match(/data-product-price="\s*([^"\s]+)/i)?.[1]),
      url,
      image,
      source: "Key Innovations live search",
      customFields: {},
    });
  }
  return cards.filter((card) => card.name && card.url);
}

function parseCustomFields(html) {
  const fields = {};
  const detailMatches = String(html || "").matchAll(
    /<dt[^>]*productView-info-name[^>]*>\s*([^<:]+):?\s*<\/dt>\s*<dd[^>]*productView-info-value[^>]*>\s*([\s\S]*?)\s*<\/dd>/gi,
  );
  for (const match of detailMatches) {
    const name = decodeHtml(match[1]).replace(/:$/, "");
    const value = decodeHtml(match[2].replace(/<[^>]+>/g, " "));
    if (name && value) fields[name] = value;
  }

  const availableToSell = String(html || "").match(/"available_to_sell":\s*"?(\d+)"?/i)?.[1];
  const stockLevel = String(html || "").match(/"stock_level":\s*"?(\d+)"?/i)?.[1];
  if (availableToSell || stockLevel) fields.Stock = availableToSell || stockLevel;

  const jsonMatches = String(html || "").matchAll(/"custom_fields":\s*(\[[\s\S]*?\])\s*,\s*"images"/gi);
  for (const match of jsonMatches) {
    try {
      const rows = JSON.parse(match[1]);
      rows.forEach((row) => {
        if (row.name && row.value) fields[row.name] = row.value;
      });
    } catch {
      // Ignore malformed embedded product JSON from third-party pages.
    }
  }
  return fields;
}

function fitmentLinesForVehicle(html, vehicle) {
  const make = cleanString(vehicle.make).toUpperCase();
  const model = cleanString(vehicle.model).toUpperCase();
  if (!make || !model) return [];
  const lines = Array.from(String(html || "").matchAll(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi))
    .map((match) => decodeHtml(match[1].replace(/<[^>]+>/g, " ")).toUpperCase())
    .map((line) => line.replace(/\s+/g, " ").trim());
  return lines
    .filter((line) => /\b(19\d{2}|20\d{2})\b/.test(line))
    .filter((line) => line.includes(make) && line.includes(model))
    .slice(0, 20);
}

function lineCoversYear(line, year) {
  const target = Number(year);
  if (!target) return false;
  const ranges = String(line).matchAll(/\b(19\d{2}|20\d{2})(?:\s*-\s*(19\d{2}|20\d{2}))?\b/g);
  for (const match of ranges) {
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (target >= start && target <= end) return true;
  }
  return false;
}

function productScore(product, vehicle) {
  const text = `${product.name} ${product.brand} ${Object.values(product.customFields || {}).join(" ")}`.toUpperCase();
  const make = cleanString(vehicle.make).toUpperCase();
  const model = cleanString(vehicle.model).toUpperCase();
  const normalizedModel = model.replace(/[^A-Z0-9]/g, "");
  let score = 0;

  if (make && text.includes(make)) score += 35;
  if (model && text.includes(model)) score += 35;
  if (normalizedModel && text.replace(/[^A-Z0-9]/g, "").includes(normalizedModel)) score += 25;
  if (/KEY|REMOTE|PROX|FOBIK|TRANSPONDER|SMART/.test(text)) score += 20;
  if (/FORD|LINCOLN|MERCURY/.test(text) && make === "FORD") score += 20;
  if (/FCC|OEM|CHIP|BUTTON|FREQUENCY|MIDWEST_SKU|AKG PART NUMBER|VISUAL_SKU/.test(text)) score += 15;
  if (/GM|TOYOTA|HONDA|NISSAN|CHRYSLER|DODGE|JEEP|RAM/.test(text) && make === "FORD") score -= 40;
  if (/PUNCH|MACHINE|TOOL|BATTERY|SHELL|CASE/.test(text)) score -= 15;
  if (product.fitmentLines?.length) {
    const exactYear = product.fitmentLines.some((line) => lineCoversYear(line, vehicle.year));
    score += exactYear ? 90 : -100;
  }
  return score;
}

async function keyInnovationsRequest(pathname, options = {}, cookie = "") {
  const url = pathname.startsWith("http") ? pathname : `https://keyinnovations.com${pathname}`;
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "User-Agent": "LockForge Systems supplier connector/0.1",
      Accept: "text/html,application/xhtml+xml",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  return {
    response,
    cookie: mergeCookies(cookie, response.headers),
    text: await response.text(),
  };
}

async function keyInnovationsLogin(account) {
  if (!account?.enabled || !account.username || !account.passwordCipher) {
    return { ok: false, reason: "Key Innovations account is not enabled or is missing credentials.", cookie: "" };
  }

  const password = await decryptSecret(account.passwordCipher);
  if (!password) return { ok: false, reason: "Saved Key Innovations password could not be decrypted.", cookie: "" };

  let session = await keyInnovationsRequest("/login.php");
  const body = new URLSearchParams({
    login_email: account.username,
    login_pass: password,
    redirect_to: "/vin-plate-lookup/",
  });
  session = await keyInnovationsRequest(
    "/login.php?action=check_login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://keyinnovations.com",
        Referer: "https://keyinnovations.com/login.php",
      },
      body,
    },
    session.cookie,
  );

  const check = await keyInnovationsRequest("/vin-plate-lookup/", {}, session.cookie);
  const signedIn = !/please sign in to continue|sign in/i.test(check.text) || /logout|account\.php/i.test(check.text);
  return {
    ok: signedIn,
    reason: signedIn ? "Signed in to Key Innovations." : "Key Innovations did not accept the saved login.",
    cookie: check.cookie,
    vinLookupHtml: check.text,
  };
}

function searchQueriesForVehicle(vehicle, vin) {
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const compactModel = cleanString(vehicle.model).replace(/[^A-Za-z0-9]/g, "");
  return [
    vin,
    `${title} key`,
    `${title} remote`,
    `${title} proximity key`,
    `${vehicle.make || ""} ${vehicle.model || ""} transponder key`,
    compactModel && `${vehicle.make || ""} ${compactModel} key`,
  ]
    .map((query) => cleanString(query))
    .filter(Boolean);
}

async function searchKeyInnovationsProducts(vehicle, vin, cookie = "") {
  const fitment = await searchKeyInnovationsFitment(vehicle);
  if (fitment.products.length) {
    return {
      connected: Boolean(cookie),
      source: "Key Innovations exact Searchspring fitment",
      searchAttempts: fitment.searchAttempts,
      products: fitment.products,
    };
  }

  const seen = new Map();
  const queries = searchQueriesForVehicle(vehicle, vin);
  const searchAttempts = [];

  for (const query of queries) {
    const url = `/search.php?search_query=${encodeURIComponent(query)}`;
    const result = await keyInnovationsRequest(url, {}, cookie);
    cookie = result.cookie;
    const cards = parseProductCards(result.text);
    searchAttempts.push({ query, resultCount: cards.length });
    cards.forEach((card) => {
      const key = card.url || card.id || card.name;
      if (!seen.has(key)) seen.set(key, { ...card, matchedQuery: query });
    });
  }

  const products = Array.from(seen.values()).slice(0, 20);
  const enriched = [];
  for (const product of products) {
    let detailFields = {};
    if (product.url) {
      try {
        const detail = await keyInnovationsRequest(product.url, {}, cookie);
        cookie = detail.cookie;
        detailFields = parseCustomFields(detail.text);
        product.fitmentLines = fitmentLinesForVehicle(detail.text, vehicle);
      } catch {
        detailFields = {};
        product.fitmentLines = [];
      }
    }
    const enrichedProduct = {
      ...product,
      customFields: detailFields,
    };
    enrichedProduct.score = productScore(enrichedProduct, vehicle);
    enrichedProduct.keyInfo = {
      sku: detailFields.VISUAL_SKU || detailFields["IKS SKU"] || detailFields.MIDWEST_SKU || "",
      itemNumber: detailFields["Item #"] || detailFields["AKG Part Number"] || detailFields["NetSuite Id"] || "",
      fcc: detailFields.FCC || "",
      oem: detailFields.OEM || "",
      chip: detailFields.Chip || "",
      frequency: detailFields.Frequency || "",
      buttons: detailFields["Button Config"] || detailFields["Number of Buttons"] || "",
      battery: detailFields.Battery || "",
      condition: detailFields.Condition || "",
      productType: detailFields["LOCKSMITH PRODUCT TYPE"] || "",
      stock: detailFields.Stock || (detailFields["Back Order Indicator"] === "T" ? "Back order flag" : ""),
      fitment: enrichedProduct.fitmentLines?.[0] || "",
    };
    enriched.push(enrichedProduct);
  }

  return {
    connected: Boolean(cookie),
    source: "Key Innovations live website search",
    searchAttempts,
    products: enriched
      .filter((product) => product.score > 0)
      .sort((a, b) => b.score - a.score || Number(a.price || 0) - Number(b.price || 0))
      .slice(0, 8),
  };
}

function listValue(value) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function resultCategoryText(result) {
  return [...(result.categories || []), ...(result.categories_hierarchy || [])].map(decodeHtml).join(" ");
}

function scoreFitmentResult(result) {
  const text = `${result.name || ""} ${result.product_type_unigram || ""} ${resultCategoryText(result)}`.toUpperCase();
  let score = 100;
  if (/PROX|PROXIMITY|REMOTE|KEY|TRANSPONDER|FOBIK/.test(text)) score += 40;
  if (/OEM|STRATTEC|ORIGINAL/.test(`${result.brand || ""} ${result.custom_condition || ""}`.toUpperCase())) score += 15;
  if (/LISHI|PICK|DECODER|BLADE|SHELL|CASE|BUTTON PAD/.test(text)) score -= 25;
  if (/TOOL|MACHINE|PROGRAMMER/.test(text)) score -= 35;
  return score;
}

async function searchKeyInnovationsFitment(vehicle) {
  const year = cleanString(vehicle.year);
  const make = cleanString(vehicle.make).toUpperCase();
  const model = cleanString(vehicle.model).toUpperCase();
  if (!year || !make || !model) return { products: [], searchAttempts: [] };

  const filter = `${year}>${make}>${model}`;
  const url =
    `https://api.searchspring.net/api/search/search.json?siteId=0r6l0x&resultsFormat=native&resultsPerPage=40&filter.ss_fitment=${encodeURIComponent(filter)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LockForge Systems supplier connector/0.1",
    },
  });
  if (!response.ok) return { products: [], searchAttempts: [{ query: `fitment ${filter}`, resultCount: 0 }] };
  const payload = await response.json();
  const results = payload.results || [];

  return {
    searchAttempts: [{ query: `exact fitment ${filter}`, resultCount: Number(payload.pagination?.totalResults || results.length) }],
    products: results
      .map((result) => {
        const product = {
          id: String(result.uid || result.id || ""),
          supplier: "Key Innovations",
          name: decodeHtml(result.name),
          brand: decodeHtml(result.brand),
          price: result.price || result.ss_retail_price || "",
          url: result.url?.startsWith("http") ? result.url : `https://keyinnovations.com${result.url || ""}`,
          image: normalizeImageUrl(result.imageUrl || result.thumbnailImageUrl || result.cdn_thumbnail_url),
          source: "Key Innovations exact vehicle fitment",
          matchedQuery: filter,
          customFields: result,
          fitmentLines: [`${filter}`],
          keyInfo: {
            sku: result.sku || result.custom_visual_sku || result.custom_midwest_sku || "",
            itemNumber: result.custom_item || result.custom_akg_part_number || "",
            fcc: listValue(result.custom_fcc),
            oem: listValue(result.custom_oem),
            chip: result.custom_chip || "",
            frequency: result.custom_frequency || "",
            buttons: result.custom_button_config || result.custom_number_of_buttons || "",
            battery: result.custom_battery || "",
            condition: result.custom_condition || "",
            productType: decodeHtml(result.product_type_unigram || result.categories?.at(-1) || ""),
            stock: String(result.ss_in_stock) === "1" ? "In stock" : "Out of stock",
            fitment: filter,
          },
        };
        product.score = scoreFitmentResult(result);
        return product;
      })
      .sort((a, b) => b.score - a.score || Number(a.price || 0) - Number(b.price || 0))
      .slice(0, 40),
  };
}

function goldenSupplyValueFromDescription(description, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const html = String(description || "").replace(/\r?\n/g, "<br>");
  const match = html.match(new RegExp(`${escapedLabel}\\s*:\\s*([\\s\\S]*?)(?:<br\\s*\\/?>|$)`, "i"));
  return stripHtml(match?.[1] || "");
}

function goldenSupplyUrl(item) {
  const component = cleanString(item.urlcomponent);
  if (!component) return "https://www.goldenremotes.com/";
  return `https://www.goldenremotes.com/${component}`;
}

function goldenSupplyImage(item) {
  return normalizeImageUrl(item.itemimages_detail?.media?.url || item.itemimages_detail?.urls?.[0]?.url || "");
}

function goldenSupplyCoversVehicle(item, vehicle) {
  const make = cleanString(vehicle.make).toUpperCase();
  const model = cleanString(vehicle.model).toUpperCase();
  const itemMake = cleanString(item.custitem2).toUpperCase();
  const itemModel = cleanString(item.custitem_tt_model).toUpperCase();
  const yearText = cleanString(item.custitemtt_year);

  if (make && itemMake && itemMake !== make) return false;
  if (model && itemModel) {
    const normalizedModel = model.replace(/[^A-Z0-9]/g, "");
    const normalizedItemModel = itemModel.replace(/[^A-Z0-9]/g, "");
    if (normalizedItemModel !== normalizedModel) return false;
  }
  if (vehicle.year && yearText && !lineCoversYear(yearText, vehicle.year)) return false;
  return true;
}

function scoreGoldenSupplyItem(item, vehicle) {
  const text = [
    item.itemid,
    item.displayname,
    item.storedisplayname2,
    item.custitem1,
    item.custitem2,
    item.custitem_tt_model,
    item.storedetaileddescription,
  ]
    .map(stripHtml)
    .join(" ")
    .toUpperCase();
  let score = 0;
  if (goldenSupplyCoversVehicle(item, vehicle)) score += 140;
  if (/SMART|PROX|PROXIMITY/.test(text)) score += 35;
  if (/FLIP|REMOTE|TRANSPONDER|INSERT KEY|KEY/.test(text)) score += 30;
  if (/FCC ID|FREQUENCY|TRANSPONDER TYPE|PART #/.test(text)) score += 25;
  if (/SHELL|CASE|BUTTON PAD|BATTERY|EMERGENCY INSERT/.test(text)) score -= 20;
  if (/PROGRAMMER|TOOL|MACHINE|LISHI|PICK/.test(text)) score -= 60;
  return score;
}

function normalizeGoldenSupplyItem(item, vehicle, matchedQuery) {
  const description = item.storedetaileddescription || item.storedescription || "";
  const part = goldenSupplyValueFromDescription(description, "PART #") || item.displayname || "";
  const fcc = goldenSupplyValueFromDescription(description, "FCC ID");
  const frequency = goldenSupplyValueFromDescription(description, "FREQUENCY");
  const chip = goldenSupplyValueFromDescription(description, "TRANSPONDER TYPE");
  const quantity = Number(item.quantityavailable || 0);
  const fullPrice = Number(item.onlinecustomerprice_detail?.onlinecustomerprice ?? item.pricelevel1 ?? 0);
  const lowerPrice = Number(item.pricelevel2 ?? fullPrice);
  const hasLowerPrice = lowerPrice > 0 && fullPrice > lowerPrice;
  const productType = cleanString(item.custitem1 || item.department || "");
  const fitment = [item.custitemtt_year, item.custitem2, item.custitem_tt_model].filter(Boolean).join(" ");
  const product = {
    id: String(item.internalid || item.itemid || ""),
    supplier: "Golden Supply Inc.",
    name: cleanString(item.storedisplayname2 || item.displayname || item.itemid),
    brand: cleanString(item.custitem2 || ""),
    price: hasLowerPrice ? lowerPrice : fullPrice || item.pricelevel2 || item.pricelevel1 || "",
    priceFormatted: hasLowerPrice
      ? item.pricelevel2_formatted
      : item.onlinecustomerprice_detail?.onlinecustomerprice_formatted || item.pricelevel2_formatted || item.pricelevel1_formatted || "",
    listPrice: hasLowerPrice ? fullPrice : "",
    listPriceFormatted: hasLowerPrice ? item.pricelevel1_formatted || item.onlinecustomerprice_detail?.onlinecustomerprice_formatted || "" : "",
    url: goldenSupplyUrl(item),
    image: goldenSupplyImage(item),
    source: "Golden Supply live item search",
    matchedQuery,
    fitmentLines: fitment ? [fitment] : [],
    customFields: {
      itemId: item.itemid || "",
      displayName: item.displayname || "",
      productType,
      year: item.custitemtt_year || "",
      make: item.custitem2 || "",
      model: item.custitem_tt_model || "",
      quantityAvailable: Number.isFinite(quantity) ? quantity : "",
      purchasable: Boolean(item.ispurchasable),
      backorderable: Boolean(item.isbackorderable),
      description: stripHtml(description),
    },
    keyInfo: {
      sku: item.itemid || "",
      itemNumber: part,
      fcc,
      oem: part,
      chip,
      frequency,
      buttons: "",
      battery: "",
      condition: "",
      productType,
      stock: item.isinstock ? `In stock${Number.isFinite(quantity) ? ` (${quantity})` : ""}` : "Out of stock",
      fitment,
    },
  };
  product.score = scoreGoldenSupplyItem(item, vehicle);
  return product;
}

async function goldenSupplyRequest(query) {
  const url =
    `https://www.goldenremotes.com/api/items?fieldset=details&language=en&country=US&currency=USD&limit=100&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LockForge Systems supplier connector/0.1",
    },
  });
  if (!response.ok) {
    throw new Error(`Golden Supply returned ${response.status}`);
  }
  return response.json();
}

async function searchGoldenSupplyProducts(vehicle, vin) {
  const queries = searchQueriesForVehicle(vehicle, vin).filter((query) => query !== vin);
  const seen = new Map();
  const searchAttempts = [];

  for (const query of queries.slice(0, 4)) {
    const payload = await goldenSupplyRequest(query);
    const items = payload.items || [];
    searchAttempts.push({ query, resultCount: Number(payload.total || items.length), returnedCount: items.length });
    items.forEach((item) => {
      if (!goldenSupplyCoversVehicle(item, vehicle)) return;
      const key = item.internalid || item.itemid || item.urlcomponent;
      if (!seen.has(key)) seen.set(key, normalizeGoldenSupplyItem(item, vehicle, query));
    });
  }

  return {
    connected: true,
    source: "Golden Supply live item search",
    searchAttempts,
    products: Array.from(seen.values())
      .filter((product) => product.score > 0)
      .sort((a, b) => b.score - a.score || Number(a.price || 0) - Number(b.price || 0))
      .slice(0, 60),
  };
}

async function liveKeyInnovationsLookup(vehicle, vin) {
  const supplierAccounts = await readSupplierAccounts();
  const account = supplierAccounts.accounts.find((item) => item.id === "key-innovations");
  const login = await keyInnovationsLogin(account);
  const live = await searchKeyInnovationsProducts(vehicle, vin, login.cookie);
  return {
    supplier: "Key Innovations",
    loginStatus: login.ok ? "connected" : "search-only",
    statusMessage: login.reason,
    vinLookupAvailable: login.ok && !/please sign in to continue/i.test(login.vinLookupHtml || ""),
    ...live,
  };
}

async function liveGoldenSupplyLookup(vehicle, vin) {
  const live = await searchGoldenSupplyProducts(vehicle, vin);
  return {
    supplier: "Golden Supply Inc.",
    loginStatus: "connected",
    statusMessage: "Golden Supply public item search is connected.",
    vinLookupAvailable: false,
    ...live,
  };
}

function supplierLookupStatus(account, override = {}) {
  const enabled = Boolean(account?.enabled);
  const configured = Boolean(account?.username && account?.passwordCipher);
  const connectorLive = account?.id === "key-innovations" || account?.id === "golden-supply";
  return {
    id: account?.id || "",
    name: account?.name || "Supplier",
    enabled,
    configured,
    connectorLive,
    lookupMode: account?.lookupMode || "planned connector",
    status: override.status || (connectorLive ? "live connector" : enabled ? "saved, connector planned" : "disabled"),
    message:
      override.message ||
      (connectorLive
        ? account?.id === "golden-supply"
          ? "Live Golden Supply item search is wired."
          : "Live lookup is wired."
        : enabled
          ? "Login is saved, but this supplier still needs a connector before parts can appear in comparisons."
          : "Disabled in Settings."),
    productCount: override.productCount || 0,
  };
}

async function liveSupplierLookups(vehicle, vin) {
  const supplierAccounts = await readSupplierAccounts();
  const statuses = supplierAccounts.accounts.map((account) => supplierLookupStatus(account));
  const keyIndex = statuses.findIndex((status) => status.id === "key-innovations");
  const goldenIndex = statuses.findIndex((status) => status.id === "golden-supply");
  const products = [];
  const searchAttempts = [];
  let loginStatus = "connected";
  let statusMessage = "Supplier lookups completed.";
  let connected = false;

  try {
    const keyInnovations = await liveKeyInnovationsLookup(vehicle, vin);
    products.push(...(keyInnovations.products || []));
    searchAttempts.push(...(keyInnovations.searchAttempts || []));
    connected = connected || Boolean(keyInnovations.connected);
    if (keyIndex >= 0) {
      statuses[keyIndex] = supplierLookupStatus(
        supplierAccounts.accounts.find((account) => account.id === "key-innovations"),
        {
          status: keyInnovations.loginStatus,
          message: keyInnovations.statusMessage,
          productCount: keyInnovations.products?.length || 0,
        },
      );
    }
  } catch (error) {
    if (keyIndex >= 0) {
      statuses[keyIndex] = supplierLookupStatus(
        supplierAccounts.accounts.find((account) => account.id === "key-innovations"),
        {
          status: "error",
          message: error.message || "Key Innovations lookup failed.",
          productCount: 0,
        },
      );
    }
    loginStatus = "partial";
    statusMessage = error.message || "Key Innovations lookup failed.";
  }

  try {
    const goldenSupply = await liveGoldenSupplyLookup(vehicle, vin);
    products.push(...(goldenSupply.products || []));
    searchAttempts.push(...(goldenSupply.searchAttempts || []));
    connected = connected || Boolean(goldenSupply.connected);
    if (goldenIndex >= 0) {
      statuses[goldenIndex] = supplierLookupStatus(
        supplierAccounts.accounts.find((account) => account.id === "golden-supply"),
        {
          status: goldenSupply.loginStatus,
          message: goldenSupply.statusMessage,
          productCount: goldenSupply.products?.length || 0,
        },
      );
    }
  } catch (error) {
    if (goldenIndex >= 0) {
      statuses[goldenIndex] = supplierLookupStatus(
        supplierAccounts.accounts.find((account) => account.id === "golden-supply"),
        {
          status: "error",
          message: error.message || "Golden Supply lookup failed.",
          productCount: 0,
        },
      );
    }
    loginStatus = products.length ? "partial" : "error";
    statusMessage = products.length ? "Golden Supply lookup failed after other supplier results loaded." : error.message || "Live supplier lookup failed.";
  }

  return {
    supplier: "Supplier comparison",
    loginStatus,
    statusMessage,
    connected,
    source: "Multi-supplier live search",
    products,
    searchAttempts,
    supplierStatuses: statuses,
  };
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Request body too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function jobStatus(verification) {
  if (String(verification).toLowerCase().includes("pending")) return "Hold";
  return "AI prep ready";
}

function cleanJob(input) {
  const customer = String(input.customer || "").trim();
  const vehicle = String(input.vehicle || "").trim();
  const service = String(input.service || "").trim();
  const verification = String(input.verification || "").trim();

  if (!customer || !vehicle || !service || !verification) {
    throw new Error("Customer, vehicle, service, and verification are required");
  }

  return {
    id: randomUUID(),
    customer,
    vehicle,
    service,
    verification,
    status: jobStatus(verification),
    createdAt: new Date().toISOString(),
  };
}

function cleanPartOutcome(input) {
  const vehicle = input.vehicle || {};
  const part = input.part || {};
  const year = cleanString(vehicle.year);
  const make = cleanString(vehicle.make).toUpperCase();
  const model = cleanString(vehicle.model);
  const partName = cleanString(part.name);
  const supplier = cleanString(part.supplier);
  if (!year || !make || !model || !partName) {
    throw new Error("Vehicle year/make/model and part name are required");
  }

  const refs = [
    part.sku ? `SKU ${cleanString(part.sku)}` : "",
    part.oem ? `OEM ${cleanString(part.oem)}` : "",
    part.fcc ? `FCC ${cleanString(part.fcc)}` : "",
    part.frequency ? `Frequency ${cleanString(part.frequency)}` : "",
    part.chip ? `Chip ${cleanString(part.chip)}` : "",
    part.buttons ? `Buttons ${cleanString(part.buttons)}` : "",
    part.price ? `Price ${cleanString(part.price)}` : "",
    part.stock ? `Stock ${cleanString(part.stock)}` : "",
  ].filter(Boolean);

  return {
    id: randomUUID(),
    title: `Verified part - ${year} ${make} ${model}`,
    customer: "Shop evidence",
    vehicle: [year, make, model, cleanString(vehicle.trim)].filter(Boolean).join(" "),
    service: "Verified key part",
    verification: "Part marked worked in LockForge",
    status: "Completed",
    vin: cleanString(input.vin).toUpperCase(),
    programmer: [part.oem, part.sku, part.fcc].map(cleanString).filter(Boolean).join(" / "),
    sequence: partName,
    tags: ["verified-part", supplier, make].filter(Boolean),
    notes: [supplier ? `Supplier ${supplier}` : "", partName, ...refs].filter(Boolean),
    createdAt: new Date().toISOString(),
  };
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function listFromText(value) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean);
  return cleanString(value)
    .split(/\n|;/)
    .map(cleanString)
    .filter(Boolean);
}

function slug(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanIntelligenceRecord(input) {
  const yearStart = Number(input.yearStart || input.match?.yearStart);
  const yearEnd = Number(input.yearEnd || input.match?.yearEnd || yearStart);
  const make = cleanString(input.make || input.match?.make).toUpperCase();
  const model = cleanString(input.model || input.match?.model);
  const keySystemName = cleanString(input.keySystemName || input.keySystem?.name);

  if (!yearStart || !yearEnd || !make || !model || !keySystemName) {
    throw new Error("Year, make, model, and key system name are required");
  }

  return {
    id: cleanString(input.id) || `${slug(make)}-${slug(model)}-${yearStart}${yearEnd !== yearStart ? `-${yearEnd}` : ""}`,
    match: {
      yearStart,
      yearEnd,
      make,
      model,
    },
    keySystem: {
      name: keySystemName,
      confidence: cleanString(input.confidence || input.keySystem?.confidence || "medium"),
      notes: cleanString(input.notes || input.keySystem?.notes),
    },
    keyOptions: [
      {
        name: cleanString(input.keyName || input.keyOptions?.[0]?.name || "Verified key option"),
        position: cleanString(input.keyPosition || input.keyOptions?.[0]?.position || "Recommended value"),
        supplier: cleanString(input.supplier || input.keyOptions?.[0]?.supplier || "Preferred locksmith supplier"),
        partNumber: cleanString(input.partNumber || input.keyOptions?.[0]?.partNumber || "VERIFY"),
        quality: cleanString(input.quality || input.keyOptions?.[0]?.quality || "Verified"),
        costPosition: cleanString(input.costPosition || input.keyOptions?.[0]?.costPosition || "mid"),
        notes: cleanString(input.keyNotes || input.keyOptions?.[0]?.notes),
      },
    ],
    programmers: [
      {
        name: cleanString(input.programmerName || input.programmers?.[0]?.name || "Coverage-verified programmer"),
        type: cleanString(input.programmerType || input.programmers?.[0]?.type || "Verified"),
        confidence: cleanString(input.programmerConfidence || input.programmers?.[0]?.confidence || "medium"),
        notes: cleanString(input.programmerNotes || input.programmers?.[0]?.notes),
      },
    ],
    tools: [
      {
        name: cleanString(input.toolName || input.tools?.[0]?.name || "Origination tool"),
        type: cleanString(input.toolType || input.tools?.[0]?.type || "Verified"),
        confidence: cleanString(input.toolConfidence || input.tools?.[0]?.confidence || "medium"),
        notes: cleanString(input.toolNotes || input.tools?.[0]?.notes),
      },
    ],
    verifyBeforeDispatch: listFromText(input.verifyBeforeDispatch).length
      ? listFromText(input.verifyBeforeDispatch)
      : ["FCC / frequency", "Blade / keyway", "Programmer coverage", "Supplier part number", "Authorization"],
    sourceJobIds: listFromText(input.sourceJobIds),
    updatedAt: new Date().toISOString(),
  };
}

function aiDecision(prompt) {
  const normalized = prompt.toLowerCase();
  const blocked = ["bypass", "steal", "break in", "hotwire", "hide from", "no permission"].some((term) =>
    normalized.includes(term),
  );

  if (blocked) {
    return {
      riskLevel: "blocked",
      policyDecision: "refused",
      response:
        "I can help with lawful locksmith workflow, verification, quote prep, and documentation. I cannot provide bypass instructions or guidance for unauthorized entry.",
    };
  }

  if (normalized.includes("quote") || normalized.includes("price")) {
    return {
      riskLevel: "low",
      policyDecision: "allowed",
      response:
        "Quote prep: confirm vehicle/lock details, key count, location distance, proof of ownership, parts availability, programming requirement, and after-hours rate before presenting the range.",
    };
  }

  if (normalized.includes("ford") || normalized.includes("f-150")) {
    return {
      riskLevel: "medium",
      policyDecision: "allowed_with_verified_job_context",
      response:
        "For the F-150 job: verify registration, attach ID photo, confirm keyway and remote style, check programmer support, add a contingency note for module or battery issues, then generate the customer authorization.",
    };
  }

  return {
    riskLevel: "low",
    policyDecision: "allowed",
    response:
      "Safe next step: tie the request to a verified job, capture customer authorization, list parts and tools, then produce a clean technician checklist and customer-facing quote note.",
  };
}

function validateVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

const vinYearCodes = {
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
  V: 2027,
  W: 2028,
  X: 2029,
  Y: 2030,
  1: 2031,
  2: 2032,
  3: 2033,
  4: 2034,
  5: 2035,
  6: 2036,
  7: 2037,
  8: 2038,
  9: 2039,
};

const vinTransliteration = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

const vinWeights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function vinCharacterValue(character) {
  return /\d/.test(character) ? Number(character) : vinTransliteration[character] || 0;
}

function calculateVinCheckDigit(vin) {
  const sum = vin
    .split("")
    .reduce((total, character, index) => total + vinCharacterValue(character) * vinWeights[index], 0);
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

function parseVin(vin, decodedYear) {
  const normalized = vin.toUpperCase();
  const expectedCheckDigit = calculateVinCheckDigit(normalized);
  const actualCheckDigit = normalized[8];
  const yearCode = normalized[9];
  const derivedYear = vinYearCodes[yearCode] || "";

  return {
    vin: normalized,
    wmi: normalized.slice(0, 3),
    vds: normalized.slice(3, 8),
    checkDigit: actualCheckDigit,
    expectedCheckDigit,
    checkDigitValid: actualCheckDigit === expectedCheckDigit,
    modelYearCode: yearCode,
    derivedModelYear: derivedYear,
    nhtsaModelYear: decodedYear || "",
    modelYearMatchesNhtsa: decodedYear ? Number(decodedYear) === Number(derivedYear) : null,
    plantCode: normalized[10],
    serial: normalized.slice(11),
  };
}

function valueFromDecode(result, key) {
  return result?.[key] && result[key] !== "Not Applicable" ? result[key] : "";
}

function vehicleFamily(make, model) {
  const text = `${make} ${model}`.toLowerCase();
  if (text.includes("ford") || text.includes("lincoln")) return "ford";
  if (text.includes("toyota") || text.includes("lexus")) return "toyota";
  if (text.includes("honda") || text.includes("acura")) return "honda";
  if (text.includes("chevrolet") || text.includes("gmc") || text.includes("cadillac") || text.includes("buick")) {
    return "gm";
  }
  return "general";
}

function yearsMatch(record, year) {
  const modelYear = Number(year);
  return modelYear >= Number(record.match.yearStart) && modelYear <= Number(record.match.yearEnd);
}

function stringsMatch(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function findIntelligenceRecord(vehicle, intelligence) {
  return intelligence.records.find(
    (record) =>
      yearsMatch(record, vehicle.year) &&
      stringsMatch(record.match.make, vehicle.make) &&
      stringsMatch(record.match.model, vehicle.model),
  );
}

function summarizeMatchedJobs(record, jobs) {
  if (!record) return [];
  return record.sourceJobIds
    .map((id) => jobs.find((job) => job.id === id))
    .filter(Boolean)
    .map((job) => ({
      id: job.id,
      title: job.title || job.vehicle,
      schedule: job.schedule,
      programmer: job.programmer,
      price: job.price,
      payment: job.payment,
      notes: job.notes || [],
    }));
}

function normalizeVehicleText(value) {
  return cleanString(value).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function normalizeVinCandidate(value) {
  const candidate = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return validateVin(candidate) ? candidate : "";
}

function extractVinsFromText(value) {
  const text = String(value || "").toUpperCase();
  const candidates = new Set();
  for (const match of text.matchAll(/[A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9\s-]{15,30}[A-HJ-NPR-Z0-9]/g)) {
    const normalized = normalizeVinCandidate(match[0]);
    if (normalized) candidates.add(normalized);
  }
  return Array.from(candidates);
}

function jobVehicleText(job) {
  return normalizeVehicleText([job.title, job.vehicle, ...(job.notes || [])].filter(Boolean).join(" "));
}

function jobRawText(job) {
  return [job.title, job.vehicle, job.vin, job.sequence, job.keyCode, ...(job.notes || [])].filter(Boolean).join(" ");
}

function jobVins(job) {
  return [...new Set([normalizeVinCandidate(job.vin), ...extractVinsFromText(jobRawText(job))].filter(Boolean))];
}

function yearTokens(year) {
  const full = String(year || "");
  return full ? [full, full.slice(-2)] : [];
}

function modelTokens(model) {
  const base = normalizeVehicleText(model);
  const compact = base.replace(/\s+/g, "");
  const tokens = new Set([base, compact]);
  if (/F\s?150|F150/.test(base)) tokens.add("F 150").add("F150").add("F-150");
  if (/EXPEDITION/.test(base)) tokens.add("EXPEDITION");
  if (/CAMRY/.test(base)) tokens.add("CAMRY");
  if (/ACCORD/.test(base)) tokens.add("ACCORD");
  return Array.from(tokens).filter(Boolean);
}

function textContainsAny(text, values) {
  const normalized = normalizeVehicleText(text);
  const compact = normalized.replace(/\s+/g, "");
  return values.some((value) => {
    const token = normalizeVehicleText(value);
    if (!token) return false;
    return normalized.includes(token) || compact.includes(token.replace(/\s+/g, ""));
  });
}

function jobMatchesVehicle(job, vehicle) {
  const text = jobVehicleText(job);
  const make = normalizeVehicleText(vehicle.make);
  const yearMatch = textContainsAny(text, yearTokens(vehicle.year));
  const modelMatch = textContainsAny(text, modelTokens(vehicle.model));
  const makeMatch = make && text.includes(make);
  if (!modelMatch || !yearMatch) return false;
  return makeMatch || modelMatch;
}

function jobMatchesMakeModel(job, vehicle) {
  const text = jobVehicleText(job);
  const make = normalizeVehicleText(vehicle.make);
  const modelMatch = textContainsAny(text, modelTokens(vehicle.model));
  const makeMatch = make && text.includes(make);
  return modelMatch && (makeMatch || !make);
}

function tokenMatchesProduct(token, product) {
  if (!token || token.length < 4) return false;
  const productText = normalizeVehicleText([
    product.name,
    product.sku,
    product.id,
    product.keyInfo?.sku,
    product.keyInfo?.itemNumber,
    product.keyInfo?.oem,
    product.keyInfo?.fcc,
    product.customFields?.itemId,
    product.customFields?.displayName,
  ].filter(Boolean).join(" "));
  return productText.includes(normalizeVehicleText(token));
}

function jobReferenceTokens(job) {
  const tokens = new Set();
  const text = [job.programmer, job.sequence, job.keyCode, ...(job.notes || [])].filter(Boolean).join(" ");
  for (const match of text.matchAll(/\b(?:[A-Z]{2,5}\d{3,5}|\d{3}-R\d{4}R?|[A-Z0-9]{3,}-[A-Z0-9]{3,})\b/gi)) {
    tokens.add(match[0].toUpperCase());
  }
  return Array.from(tokens);
}

function buildShopEvidence(vehicle, vin, jobs) {
  const lookupVin = normalizeVinCandidate(vin);
  const exactVinJobs = jobs.filter((job) => lookupVin && jobVins(job).includes(lookupVin));
  const exactVehicleJobs = jobs.filter((job) => !exactVinJobs.some((exact) => exact.id === job.id) && jobMatchesVehicle(job, vehicle));
  const makeModelJobs = jobs.filter(
    (job) =>
      !exactVinJobs.some((exact) => exact.id === job.id) &&
      !exactVehicleJobs.some((exact) => exact.id === job.id) &&
      jobMatchesMakeModel(job, vehicle),
  );
  const evidenceJobs = [...exactVinJobs, ...exactVehicleJobs, ...makeModelJobs].slice(0, 8);
  const tokens = [...new Set(evidenceJobs.flatMap(jobReferenceTokens))];
  const programmers = [...new Set(evidenceJobs.map((job) => job.programmer).filter(Boolean))];
  const tools = [...new Set(tokens.filter((token) => /[A-Z]{2,5}\d{3,5}/.test(token)))];
  const keyCodes = [...new Set(evidenceJobs.map((job) => job.keyCode).filter(Boolean))];
  const prices = evidenceJobs.map((job) => Number(job.price)).filter((price) => Number.isFinite(price) && price > 0);
  const confidence = exactVinJobs.length ? "high" : exactVehicleJobs.length ? "medium-high" : makeModelJobs.length ? "medium" : "none";

  return {
    confidence,
    exactVinCount: exactVinJobs.length,
    exactVehicleCount: exactVehicleJobs.length,
    makeModelCount: makeModelJobs.length,
    totalMatches: evidenceJobs.length,
    programmers,
    tools,
    keyCodes,
    tokens,
    priceRange: prices.length ? { low: Math.min(...prices), high: Math.max(...prices) } : null,
    jobs: evidenceJobs.map((job) => ({
      id: job.id,
      title: job.title || job.vehicle,
      vehicle: job.vehicle,
      vin: job.vin || "",
      service: job.service,
      programmer: job.programmer || "",
      keyCode: job.keyCode || "",
      price: job.price || "",
      payment: job.payment || "",
      notes: job.notes || [],
    })),
    summary: evidenceJobs.length
      ? `${evidenceJobs.length} completed shop job${evidenceJobs.length === 1 ? "" : "s"} matched this lookup.`
      : "No completed shop job matched this exact vehicle yet.",
  };
}

function applyShopEvidenceToProducts(liveSupplierLookup, shopEvidence) {
  if (!liveSupplierLookup?.products?.length || !shopEvidence?.tokens?.length) return liveSupplierLookup;
  return {
    ...liveSupplierLookup,
    products: liveSupplierLookup.products.map((product) => {
      const matchedTokens = shopEvidence.tokens.filter((token) => tokenMatchesProduct(token, product));
      if (!matchedTokens.length) return product;
      return {
        ...product,
        score: (product.score || 0) + 35,
        keyInfo: {
          ...(product.keyInfo || {}),
          shopMatch: matchedTokens.slice(0, 3).join(", "),
        },
      };
    }),
  };
}

function productText(product) {
  return normalizeVehicleText([
    product.name,
    product.brand,
    product.source,
    product.customFields?.displayName,
    product.customFields?.itemId,
    product.customFields?.year,
    product.customFields?.make,
    product.customFields?.model,
    product.keyInfo?.sku,
    product.keyInfo?.itemNumber,
    product.keyInfo?.oem,
    product.keyInfo?.fcc,
    product.keyInfo?.chip,
    product.keyInfo?.productType,
    product.keyInfo?.fitment,
    product.customFields?.description,
  ].filter(Boolean).join(" "));
}

function productFamily(product) {
  const text = productText(product);
  if (/INSERT|BLADE|EMERGENCY/.test(text)) return "insert";
  if (/TOOL|MACHINE|LISHI|PICK|DECODER/.test(text)) return "tool";
  if (/PROX|PROXIMITY|SMART|PUSH|PEPS/.test(text)) return "proximity";
  if (/FLIP|REMOTE HEAD|REMOTEHEAD|SWITCHBLADE/.test(text)) return "remote-head";
  if (/TRANSPONDER|CHIP/.test(text)) return "transponder";
  if (/\bREMOTE\b/.test(text)) return "remote-head";
  return "unknown";
}

function familyFromShopEvidence(shopEvidence) {
  const tokens = (shopEvidence?.tokens || []).join(" ").toUpperCase();
  const jobText = (shopEvidence?.jobs || [])
    .flatMap((job) => [job.title, job.vehicle, job.programmer, job.keyCode, ...(job.notes || [])])
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  const text = `${tokens} ${jobText}`;
  if (/R8370|M3N-A3C108397|M3NA2C93142300|PEPS|PROX|SMART/.test(text)) return "proximity";
  if (/R8334|R8337|A08TBLP|FLIP|REMOTE HEAD|FRD8334|FRD8337/.test(text)) return "remote-head";
  if (/R8259|TRANSPONDER|HITAG|ID49/.test(text)) return "transponder";
  return "";
}

function expectedFamily(vehicle, programmingReference, shopEvidence) {
  const shopFamily = shopEvidence?.exactVinCount ? familyFromShopEvidence(shopEvidence) : "";
  if (shopFamily) return shopFamily;
  const ignition = String(programmingReference?.ignitionType || "").toLowerCase();
  if (ignition === "smart") return "proximity";
  if (ignition === "keyed") return "transponder";
  const year = Number(vehicle.year);
  const text = normalizeVehicleText([vehicle.make, vehicle.model, vehicle.trim].join(" "));
  if (year >= 2018 && /(FORD|LINCOLN|TOYOTA|LEXUS|HONDA|ACURA)/.test(text)) return "proximity";
  return "unknown";
}

function conditionScore(product) {
  const condition = normalizeVehicleText(product.keyInfo?.condition || product.name);
  if (/OEM|NEW/.test(condition)) return 10;
  if (/REFURBISHED|GRADE A|RECASE/.test(condition)) return 7;
  if (/PREMIUM AFTERMARKET|AFTERMARKET/.test(condition)) return 6;
  return 3;
}

function partPriceValue(product) {
  const value = Number(String(product.price || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : Infinity;
}

function productInStock(product) {
  return /^In stock/i.test(product.keyInfo?.stock || "");
}

function productHasShopMatch(product) {
  return Boolean(product.keyInfo?.shopMatch);
}

function evaluatePartSelection(product, vehicle, shopEvidence, programmingReference) {
  const reasons = [];
  const warnings = [];
  const missing = [];
  const text = productText(product);
  const family = productFamily(product);
  const expected = expectedFamily(vehicle, programmingReference, shopEvidence);
  const expectedSource = shopEvidence?.exactVinCount && familyFromShopEvidence(shopEvidence) ? "shop history" : programmingReference ? "programming reference" : "vehicle pattern";
  let score = 0;

  if (product.fitmentLines?.some((line) => lineCoversYear(line, vehicle.year))) {
    score += 28;
    reasons.push("fitment covers model year");
  } else if (text.includes(String(vehicle.year))) {
    score += 16;
    reasons.push("product text includes model year");
  } else {
    missing.push("year fitment");
  }

  if (text.includes(normalizeVehicleText(vehicle.make))) {
    score += 12;
    reasons.push("make match");
  }
  if (text.includes(normalizeVehicleText(vehicle.model)) || text.replace(/\s+/g, "").includes(normalizeVehicleText(vehicle.model).replace(/\s+/g, ""))) {
    score += 16;
    reasons.push("model match");
  }

  if (product.keyInfo?.shopMatch) {
    score += shopEvidence?.exactVinCount ? 38 : 24;
    reasons.push(`shop history matched ${product.keyInfo.shopMatch}`);
  }

  if (expected !== "unknown") {
    if (family === expected || (expected === "transponder" && ["remote-head", "transponder"].includes(family))) {
      score += expectedSource === "shop history" ? 22 : 14;
      reasons.push(`${expected} family match from ${expectedSource}`);
    } else if (["insert", "tool"].includes(family)) {
      score -= 28;
      warnings.push(`${family} is supporting/reference item, not the main programmable key`);
    } else if (product.keyInfo?.shopMatch) {
      warnings.push(`shop evidence matched this item; still verify ${family} vs ${expected}`);
    } else {
      score -= 10;
      warnings.push(`verify ${family} vs expected ${expected}`);
    }
  }

  if (product.keyInfo?.fcc) {
    score += 10;
    reasons.push("FCC listed");
  } else {
    missing.push("FCC");
  }

  if (product.keyInfo?.frequency) {
    score += 7;
    reasons.push("frequency listed");
  } else if (family !== "insert") {
    missing.push("frequency");
  }

  if (product.keyInfo?.chip) {
    score += 7;
    reasons.push("chip/transponder listed");
  } else if (!["insert", "tool"].includes(family)) {
    missing.push("chip/transponder");
  }

  if (/\b\d\s*(BUTTON|BTN)\b/i.test(product.name) || product.keyInfo?.buttons) {
    score += 5;
    reasons.push("button count clue");
  } else if (["proximity", "remote-head"].includes(family)) {
    missing.push("button layout");
  }

  if (/^In stock/i.test(product.keyInfo?.stock || "")) {
    score += 9;
    reasons.push("in stock");
  } else {
    warnings.push(product.keyInfo?.stock || "stock unknown");
  }

  score += conditionScore(product);
  if (product.price) score += 3;
  if (family === "tool") score -= 30;
  if (family === "insert") score -= 12;
  score = Math.max(0, Math.min(100, score));
  if (family === "tool") score = Math.min(score, 35);
  if (family === "insert") score = Math.min(score, 55);
  if (family === "transponder" && expected === "proximity" && !product.keyInfo?.shopMatch) score = Math.min(score, 60);

  const rank =
    score >= 82 && !warnings.some((item) => /supporting|tool/i.test(item))
      ? "Recommended"
      : score >= 62
        ? "Possible"
        : score >= 38
          ? "Verify carefully"
          : "Reference only";

  return {
    score,
    rank,
    family,
    expectedFamily: expected,
    expectedSource,
    reasons: reasons.slice(0, 6),
    warnings: warnings.slice(0, 4),
    missing: missing.slice(0, 5),
  };
}

function selectionRankWeight(rank) {
  return { Recommended: 4, Possible: 3, "Verify carefully": 2, "Reference only": 1 }[rank] || 0;
}

function buildSelectionSummary(products) {
  const counts = products.reduce(
    (nextCounts, product) => {
      const rank = product.selection?.rank || "Reference only";
      nextCounts[rank] = (nextCounts[rank] || 0) + 1;
      return nextCounts;
    },
    {},
  );
  const topPick = products.find((product) => product.selection?.rank === "Recommended") || products[0] || null;
  const bestPick =
    products.find((product) => product.selection?.rank === "Recommended" && productHasShopMatch(product) && productInStock(product)) ||
    products.find((product) => product.selection?.rank === "Recommended" && productInStock(product)) ||
    topPick;
  const verification = topPick
    ? [...new Set([...(bestPick.selection?.missing || []), ...(bestPick.selection?.warnings || [])])].slice(0, 5)
    : ["supplier fitment", "FCC/frequency", "button layout", "blade/keyway"];
  return {
    ...counts,
    counts,
    topPick: bestPick
      ? {
          name: bestPick.name,
          supplier: bestPick.supplier,
          score: bestPick.selection?.score || 0,
          rank: bestPick.selection?.rank || "Reference only",
          family: bestPick.selection?.family || "unknown",
          price: bestPick.priceFormatted || bestPick.price || "",
          stock: bestPick.keyInfo?.stock || "",
          identifiers: [bestPick.keyInfo?.itemNumber, bestPick.keyInfo?.sku, bestPick.keyInfo?.fcc].filter(Boolean).slice(0, 3),
        }
      : null,
    verification,
  };
}

function applyPartSelectionEngine(liveSupplierLookup, vehicle, shopEvidence, programmingReference) {
  if (!liveSupplierLookup?.products?.length) return liveSupplierLookup;
  const products = liveSupplierLookup.products
    .map((product) => {
      const selection = evaluatePartSelection(product, vehicle, shopEvidence, programmingReference);
      return {
        ...product,
        score: Math.max(product.score || 0, selection.score),
        selection,
        keyInfo: {
          ...(product.keyInfo || {}),
          selectionRank: selection.rank,
          selectionScore: selection.score,
          selectionFamily: selection.family,
        },
      };
    })
    .sort(
      (a, b) =>
        selectionRankWeight(b.selection?.rank) - selectionRankWeight(a.selection?.rank) ||
        Number(productHasShopMatch(b)) - Number(productHasShopMatch(a)) ||
        Number(productInStock(b)) - Number(productInStock(a)) ||
        (b.selection?.score || 0) - (a.selection?.score || 0) ||
        partPriceValue(a) - partPriceValue(b),
    );
  const summary = buildSelectionSummary(products);
  return {
    ...liveSupplierLookup,
    products,
    selectionSummary: summary,
  };
}

async function findCatalogApplication(vehicle) {
  try {
    const catalog = JSON.parse(await readFile(vpicCatalogPath, "utf8"));
    return (
      catalog.rows.find(
        (row) =>
          Number(row.year) === Number(vehicle.year) &&
          stringsMatch(row.make, vehicle.make) &&
          stringsMatch(row.model, vehicle.model),
      ) || null
    );
  } catch {
    return null;
  }
}

async function findProgrammingReference(vehicle) {
  try {
    const reference = JSON.parse(await readFile(programmingReferencePath, "utf8"));
    return (
      reference.rows.find(
        (row) =>
          Number(row.year) === Number(vehicle.year) &&
          stringsMatch(row.make, vehicle.make) &&
          stringsMatch(row.model, vehicle.model),
      ) || null
    );
  } catch {
    return null;
  }
}

async function readMasterCatalog() {
  try {
    return JSON.parse(await readFile(masterCatalogPath, "utf8"));
  } catch {
    return { rows: [] };
  }
}

async function readKeyInnovationsLabels() {
  try {
    return JSON.parse(await readFile(keyInnovationsLabelsPath, "utf8"));
  } catch {
    return { entries: [] };
  }
}

const catalogBrandPrefixes = {
  ACURA: ["ACURA", "AC"],
  HONDA: ["HON", "HONDA", "HO"],
  FORD: ["FORD", "FO"],
  LINCOLN: ["FORD", "LINCOLN", "FO"],
  TOYOTA: ["TOY", "TOYOTA", "TO"],
  LEXUS: ["LEX", "LEXUS"],
  CHEVROLET: ["GM", "CHEV", "CHEVY"],
  GMC: ["GM", "GMC"],
  CADILLAC: ["CAD", "CADILLAC", "GM"],
  BUICK: ["BUICK", "GM"],
  CHRYSLER: ["CHRY", "CHRYSLER"],
  DODGE: ["CHRY", "DODGE"],
  JEEP: ["CHRY", "JEEP"],
  RAM: ["RAM", "CHRY"],
  HYUNDAI: ["HYU", "HYUNDAI"],
  KIA: ["KIA"],
  NISSAN: ["NIS", "NISSAN"],
  INFINITI: ["INF", "INFINITI"],
  MAZDA: ["MAZ", "MAZDA"],
  SUBARU: ["SUB", "SUBARU"],
  VOLKSWAGEN: ["VW", "VOLKSWAGEN"],
};

function prefixesForMake(make) {
  return catalogBrandPrefixes[String(make || "").toUpperCase()] || [String(make || "").toUpperCase()];
}

function partNumbersOverlap(left = [], right = []) {
  const rightSet = new Set(right.map((item) => String(item).toUpperCase()));
  return left.some((item) => rightSet.has(String(item).toUpperCase()));
}

function catalogKeyTypeMatches(hlPartNumber, programmingReference) {
  const part = String(hlPartNumber || "").toUpperCase();
  const type = String(programmingReference?.ignitionType || "").toLowerCase();
  if (!part || !type) return false;
  if (type === "smart") return part.includes("-P");
  if (type === "keyed") return part.includes("-K");
  return false;
}

async function findSupplierCandidates(vehicle, record, programmingReference) {
  const [masterCatalog, keyInnovations] = await Promise.all([readMasterCatalog(), readKeyInnovationsLabels()]);
  const prefixes = prefixesForMake(vehicle.make);
  const labelBySku = new Map(keyInnovations.entries.map((entry) => [String(entry.sku).toUpperCase(), entry]));
  const fccHints = new Set((record?.keyOptions || []).flatMap((option) => [option.fccId, option.fcc, option.partNumber]).filter(Boolean));
  const masterRows = masterCatalog.rows.filter((row) => {
    const values = [
      row.hlPartNumber,
      row.mwLegacyPartNumber,
      row.lrLegacyPartNumber,
      row.tiActivePartNumber,
      row.klrActivePartNumber,
    ]
      .filter(Boolean)
      .map((value) => String(value).toUpperCase());
    return prefixes.some((prefix) => values.some((value) => value.startsWith(`${prefix}-`) || value.startsWith(prefix)));
  });

  const candidates = masterRows.map((row) => {
    const linkedLabel =
      labelBySku.get(String(row.mwLegacyPartNumber || "").toUpperCase()) ||
      labelBySku.get(String(row.lrLegacyPartNumber || "").toUpperCase()) ||
      null;
    let score = 20;
    const reasons = ["make prefix match"];

    if (catalogKeyTypeMatches(row.hlPartNumber, programmingReference)) {
      score += 30;
      reasons.push(`${programmingReference.ignitionType} type match`);
    }

    if (linkedLabel) {
      score += 25;
      reasons.push("supplier label match");
    }

    if (row.fccId || linkedLabel?.fccIds?.length) {
      score += 10;
      reasons.push("FCC available");
    }

    if (row.oemPartNumbers?.length || linkedLabel?.oemPartNumbers?.length) {
      score += 10;
      reasons.push("OEM/part refs available");
    }

    if (partNumbersOverlap(row.oemPartNumbers, linkedLabel?.oemPartNumbers)) {
      score += 15;
      reasons.push("master and label part refs overlap");
    }

    for (const hint of fccHints) {
      const text = [row.fccId, row.hlPartNumber, row.mwLegacyPartNumber, linkedLabel?.rawText].join(" ").toUpperCase();
      if (text.includes(String(hint).toUpperCase()) && !String(hint).toUpperCase().startsWith("VERIFY")) {
        score += 25;
        reasons.push("Key DB hint match");
      }
    }

    return {
      score,
      confidence: score >= 75 ? "medium-high" : score >= 55 ? "medium" : "low",
      reasons,
      hlPartNumber: row.hlPartNumber,
      fccId: row.fccId || linkedLabel?.fccIds?.[0] || "",
      attributes: row.attributes || linkedLabel?.functions || "",
      oemPartNumbers: row.oemPartNumbers?.length ? row.oemPartNumbers : linkedLabel?.oemPartNumbers || [],
      legacyPartNumber: row.mwLegacyPartNumber || row.lrLegacyPartNumber || "",
      activePartNumber: row.tiActivePartNumber || row.klrActivePartNumber || "",
      supplierSku: linkedLabel?.sku || row.mwLegacyPartNumber || "",
      supplierBrand: linkedLabel?.brand || prefixes[0],
      descriptor: linkedLabel?.descriptor || "",
      source: linkedLabel ? "Master catalog + Key Innovations label" : "Master catalog",
      verify: ["vehicle application", "button layout", "FCC/frequency", "blade/keyway", "supplier stock"],
    };
  });

  return candidates
    .sort((a, b) => b.score - a.score || String(a.hlPartNumber).localeCompare(String(b.hlPartNumber)))
    .slice(0, 8);
}

function fallbackRecommendations(family) {
  const recommendations = {
    ford: {
      keys: [
        {
          name: "Aftermarket high-quality smart / remote head key",
          position: "Best value",
          notes: "Use a reputable supplier option first when FCC, button layout, frequency, and emergency blade match the vehicle.",
        },
        {
          name: "Strattec / OEM-equivalent option",
          position: "Premium",
          notes: "Use when dealer account, module sensitivity, or customer preference justifies the higher part cost.",
        },
        {
          name: "Cheap marketplace key",
          position: "Avoid",
          notes: "Higher risk of wrong board, poor range, failed programming, or warranty comeback.",
        },
      ],
      programmers: [
        {
          name: "FDRS / OEM path",
          type: "Most reliable",
          notes: "Best choice for newer Ford/Lincoln proximity and module-sensitive jobs when credentials and subscription are available.",
        },
        {
          name: "Advanced aftermarket programmer",
          type: "Fast field option",
          notes: "Useful when coverage is confirmed by year/model/key type and the job does not require OEM service functions.",
        },
      ],
      tools: [
        {
          name: "Lishi / code source + key machine",
          type: "Origination",
          notes: "Confirm keyway, read or source code lawfully, cut test blade, then program after verification.",
        },
        {
          name: "Battery support and charger",
          type: "Stability",
          notes: "Protect the job from voltage drop during programming or module communication.",
        },
      ],
      recommendation: {
        headline: "Likely efficient path: good aftermarket key + confirmed Ford programmer coverage",
        summary:
          "For Ford jobs, start by confirming key type, FCC/frequency, blade, and immobilizer path. Use a good supplier key for value, but step up to OEM-equivalent when FDRS/module behavior or customer risk makes reliability worth it.",
        reasons: ["Avoid cheapest remotes", "Check FDRS need", "Confirm FCC", "Support battery"],
      },
    },
    toyota: {
      keys: [
        {
          name: "High-quality aftermarket proximity key",
          position: "Best value",
          notes: "Match board, FCC, frequency, emergency blade, and hybrid/prox requirements before ordering.",
        },
        {
          name: "OEM Toyota / Lexus key",
          position: "When required",
          notes: "Use for late-model coverage gaps, customer requirements, or uncertain aftermarket reliability.",
        },
      ],
      programmers: [
        {
          name: "TIS / Techstream path",
          type: "Most reliable",
          notes: "Preferred for Toyota/Lexus when seed/passcode, security, or late-model behavior requires OEM workflow.",
        },
        {
          name: "Validated aftermarket programmer",
          type: "Field option",
          notes: "Use only when coverage is confirmed for the exact model year and key system.",
        },
      ],
      tools: [
        {
          name: "Code/source + precision cut",
          type: "Origination",
          notes: "Confirm mechanical emergency blade and code path, especially on dealer and all-keys-lost work.",
        },
      ],
      recommendation: {
        headline: "Likely efficient path: quality prox key + TIS when late-model risk is high",
        summary:
          "Toyota hybrid and proximity jobs reward accuracy. Avoid bargain keys, verify FCC/frequency, and choose TIS/OEM workflow when the vehicle year or security path raises failure risk.",
        reasons: ["Verify hybrid/prox", "Prefer TIS on risk", "Match FCC", "Avoid comebacks"],
      },
    },
    honda: {
      keys: [
        {
          name: "Reputable aftermarket transponder / remote option",
          position: "Best value",
          notes: "Match transponder generation, remote style, and blade before programming.",
        },
        {
          name: "OEM Honda / Acura option",
          position: "Premium",
          notes: "Use when remote reliability, customer preference, or model-specific coverage points to OEM.",
        },
      ],
      programmers: [
        {
          name: "Validated Honda-capable programmer",
          type: "Field option",
          notes: "Confirm immobilizer coverage for the exact year/model before arrival.",
        },
      ],
      tools: [
        {
          name: "Honda-compatible Lishi / code path",
          type: "Origination",
          notes: "Choose by keyway and generation; confirm code quality before cutting final keys.",
        },
      ],
      recommendation: {
        headline: "Likely efficient path: verified Honda coverage + reputable key blank",
        summary:
          "Honda jobs are usually efficient when the keyway, immobilizer generation, and remote type are confirmed before dispatch. Use OEM only when reliability or customer expectations justify it.",
        reasons: ["Confirm keyway", "Check immo generation", "Use reputable blank"],
      },
    },
    gm: {
      keys: [
        {
          name: "Reputable GM-compatible remote / prox",
          position: "Best value",
          notes: "Match FCC, frequency, blade, and PEPS/prox requirements.",
        },
        {
          name: "OEM / AC Delco option",
          position: "Premium",
          notes: "Use when module/programming reliability or dealer/fleet requirements matter.",
        },
      ],
      programmers: [
        {
          name: "SPS / OEM service path",
          type: "Most reliable",
          notes: "Best for newer GM module-sensitive jobs or when aftermarket coverage is unclear.",
        },
        {
          name: "Validated aftermarket programmer",
          type: "Field option",
          notes: "Useful when exact year/model coverage and security wait requirements are known.",
        },
      ],
      tools: [
        {
          name: "Code/source + appropriate GM keyway tool",
          type: "Origination",
          notes: "Confirm keyway and whether the job is blade, remote head, or proximity.",
        },
      ],
      recommendation: {
        headline: "Likely efficient path: confirmed GM coverage + reputable FCC-matched part",
        summary:
          "GM work should start with exact key system identification. Use aftermarket for value when proven, and move to OEM/SPS when coverage uncertainty could cost more than the part savings.",
        reasons: ["Match FCC", "Check SPS need", "Know security wait"],
      },
    },
    general: {
      keys: [
        {
          name: "Reputable supplier key",
          position: "Best value",
          notes: "Match FCC/frequency, transponder, blade, and button layout before selecting part.",
        },
        {
          name: "OEM part",
          position: "When required",
          notes: "Use when aftermarket confidence is low or the vehicle security system demands it.",
        },
      ],
      programmers: [
        {
          name: "Coverage-verified programmer",
          type: "Primary",
          notes: "Pick the tool with confirmed year/make/model/key-system support, not just broad brand claims.",
        },
      ],
      tools: [
        {
          name: "Keyway-specific originator",
          type: "Origination",
          notes: "Confirm keyway, code path, and cutting method before committing parts.",
        },
      ],
      recommendation: {
        headline: "Likely efficient path: identify key system first, then choose the middle-value part",
        summary:
          "The lowest-risk workflow is to decode the vehicle, identify the key system, verify programmer coverage, then choose a reputable mid-grade part unless OEM is required.",
        reasons: ["Identify key system", "Verify programmer", "Choose reliable value"],
      },
    },
  };

  return recommendations[family] || recommendations.general;
}

function inferKeyRequirements(vehicle, record, catalogApplication, matchedJobs, programmingReference) {
  const family = vehicleFamily(vehicle.make, vehicle.model);
  const year = Number(vehicle.year);
  const text = `${vehicle.make} ${vehicle.model} ${vehicle.trim} ${vehicle.bodyClass}`.toLowerCase();
  const isLateModel = year >= 2018;
  const isProximityLikely =
    isLateModel &&
    (text.includes("hybrid") ||
      text.includes("xlt") ||
      text.includes("limited") ||
      text.includes("platinum") ||
      text.includes("touring") ||
      text.includes("sport touring") ||
      ["ford", "toyota", "lexus", "lincoln", "honda", "acura"].includes(family));
  const matchedProgrammers = matchedJobs.map((job) => job.programmer).filter(Boolean);
  const recordKey = record?.keyOptions?.[0];

  const requirements = [
    {
      label: "Vehicle identity",
      value: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" "),
      confidence: "high",
      source: vehicle.identitySource || "NHTSA VIN decode",
    },
    {
      label: "Likely key style",
      value:
        programmingReference?.ignitionType ||
        recordKey?.name ||
        (isProximityLikely ? "Proximity / remote system likely" : "Transponder or remote-head key likely"),
      confidence: programmingReference ? "high" : record ? record.keySystem.confidence : "low",
      source: programmingReference ? "Programming reference" : record ? "Key DB verified record" : "Derived from year/make/model only",
    },
    {
      label: "Program method",
      value: programmingReference?.programMethod || record?.programmers?.[0]?.type || "Verify coverage",
      confidence: programmingReference ? "high" : "low",
      source: programmingReference ? "Programming reference" : "Needs coverage verification",
    },
    {
      label: "Required programmer",
      value: record?.programmers?.[0]?.name || matchedProgrammers[0] || fallbackRecommendations(family).programmers[0].name,
      confidence: record ? record.programmers?.[0]?.confidence || "medium" : matchedProgrammers.length ? "medium" : "low",
      source: record ? "Key DB" : matchedProgrammers.length ? "Matched past job" : "Brand fallback",
    },
    {
      label: "Origination / tool path",
      value: record?.tools?.[0]?.name || fallbackRecommendations(family).tools[0].name,
      confidence: record ? record.tools?.[0]?.confidence || "medium" : "low",
      source: record ? "Key DB" : "Brand fallback",
    },
    {
      label: "Security requirements",
      value: programmingReference
        ? [
            programmingReference.requiresPin ? "PIN" : "",
            programmingReference.requiresOnline ? "Online" : "",
            programmingReference.requiresBypass ? "Bypass" : "",
          ]
            .filter(Boolean)
            .join(" + ") || "No PIN/online/bypass flag"
        : "Unknown",
      confidence: programmingReference ? "high" : "low",
      source: programmingReference ? "Programming reference" : "Needs verification",
    },
    {
      label: "Supplier part confidence",
      value: recordKey?.partNumber && !recordKey.partNumber.startsWith("VERIFY") ? recordKey.partNumber : "Supplier lookup required",
      confidence: recordKey?.partNumber && !recordKey.partNumber.startsWith("VERIFY") ? "high" : "not verified",
      source: recordKey?.partNumber && !recordKey.partNumber.startsWith("VERIFY") ? "Key DB" : "Needs catalog/API verification",
    },
  ];

  const blockers = [
    "VIN usually does not expose FCC, blade, transponder, or exact remote board by itself",
    "Trim/package can change key system",
    "Supplier catalog confirmation is required before ordering",
  ];

  return {
    headline: record
      ? "Key requirements are based on a verified local record"
      : "Key requirements are inferred and need verification",
    requirements,
    blockers,
    catalogSeen: Boolean(catalogApplication),
    matchedJobCount: matchedJobs.length,
    programmingReference,
  };
}

function sourceReadiness(record, identity = { status: "connected", result: "Used for VIN decode" }) {
  return [
    {
      sourceId: "nhtsa-vpic",
      label: "Vehicle identity",
      status: identity.status,
      result: identity.result,
    },
    {
      sourceId: "shop-history",
      label: "Past job evidence",
      status: record?.sourceJobIds?.length ? "matched" : "dynamic match",
      result: record?.sourceJobIds?.length ? `${record.sourceJobIds.length} linked job record` : "Checked completed job history for VIN/YMM evidence",
    },
    {
      sourceId: "key-db",
      label: "Verified key intelligence",
      status: record ? "matched" : "missing",
      result: record ? record.keySystem.name : "Needs verified year/make/model record",
    },
    {
      sourceId: "supplier-catalogs",
      label: "Supplier catalogs",
      status: record?.keyOptions?.some((item) => item.partNumber && !item.partNumber.startsWith("VERIFY"))
        ? "verified"
        : "needed",
      result: "Needed for FCC, blade, board, OEM/aftermarket equivalents",
    },
    {
      sourceId: "programmer-coverage",
      label: "Programmer coverage",
      status: record?.programmers?.[0]?.confidence === "high" ? "verified" : "needed",
      result: record?.programmers?.[0]?.name || "Needs vendor coverage check",
    },
  ];
}

async function buildLocksmithProfile(vin, decode, store) {
  const vehicle = {
    year: valueFromDecode(decode, "ModelYear"),
    make: valueFromDecode(decode, "Make"),
    model: valueFromDecode(decode, "Model"),
    trim: valueFromDecode(decode, "Trim"),
    bodyClass: valueFromDecode(decode, "BodyClass"),
    engine: [valueFromDecode(decode, "DisplacementL"), valueFromDecode(decode, "EngineConfiguration")]
      .filter(Boolean)
      .join("L "),
    driveType: valueFromDecode(decode, "DriveType"),
    plantCity: valueFromDecode(decode, "PlantCity"),
    plantCountry: valueFromDecode(decode, "PlantCountry"),
    identitySource: "NHTSA VIN decode",
  };

  return buildVehicleProfile(vehicle, store, {
    vin,
    vinDetails: parseVin(vin, vehicle.year),
    confidence: decode?.ErrorCode === "0" ? "High from NHTSA decode" : decode?.ErrorText || "Partial decode",
    lookupMode: "vin",
    source: "Vehicle details from NHTSA vPIC; key/programmer/tool guidance from local verified key intelligence database.",
    fallbackSource: "Vehicle details from NHTSA vPIC; locksmith workflow guidance from local brand fallback model.",
    sourceReadinessIdentity: { status: "connected", result: "Used for VIN decode" },
  });
}

async function buildVehicleProfile(vehicle, store, options = {}) {
  vehicle.make = cleanString(vehicle.make).toUpperCase();
  vehicle.model = cleanString(vehicle.model);
  vehicle.year = cleanString(vehicle.year);

  const family = vehicleFamily(vehicle.make, vehicle.model);
  const catalogApplication = await findCatalogApplication(vehicle);
  const programmingReference = await findProgrammingReference(vehicle);
  const intelligence = await readKeyIntelligence();
  const record = findIntelligenceRecord(vehicle, intelligence);
  const shopEvidence = buildShopEvidence(vehicle, options.vin || "", store.jobs);
  const matchedJobsByRecord = summarizeMatchedJobs(record, store.jobs);
  const matchedJobs = matchedJobsByRecord.length ? matchedJobsByRecord : shopEvidence.jobs;
  const supplierCandidates = await findSupplierCandidates(vehicle, record, programmingReference);
  const rawSupplierLookup = await liveSupplierLookups(vehicle, options.vin || "");
  const evidenceSupplierLookup = applyShopEvidenceToProducts(rawSupplierLookup, shopEvidence);
  const liveSupplierLookup = applyPartSelectionEngine(evidenceSupplierLookup, vehicle, shopEvidence, programmingReference);
  const selected = record
    ? {
        keys: record.keyOptions,
        programmers: record.programmers,
        tools: record.tools,
        recommendation: {
          headline: `Verified baseline: ${record.keySystem.name}`,
          summary: record.keySystem.notes,
          reasons: [
            `Confidence: ${record.keySystem.confidence}`,
            `${record.sourceJobIds.length} matched past job`,
            "Verify before ordering",
          ],
        },
      }
    : fallbackRecommendations(family);

  return {
    vin: options.vin || "",
    lookupMode: options.lookupMode || "ymm",
    vehicle,
    vinDetails: options.vinDetails || null,
    confidence: options.confidence || "Year/make/model lookup - verify trim and key package",
    keys: selected.keys,
    programmers: selected.programmers,
    tools: selected.tools,
    recommendation: selected.recommendation,
    keySystem: record?.keySystem || null,
    verifyBeforeDispatch: record?.verifyBeforeDispatch || selected.recommendation.reasons,
    matchedJobs,
    programmingReference,
    supplierCandidates: supplierCandidates || [],
    shopEvidence,
    liveSupplierLookup,
    keyRequirements: inferKeyRequirements(vehicle, record, catalogApplication, matchedJobs, programmingReference),
    sourceReadiness: sourceReadiness(record, options.sourceReadinessIdentity),
    catalogApplication,
    source: record
      ? options.source || "Vehicle details from year/make/model; key/programmer/tool guidance from local verified key intelligence database."
      : options.fallbackSource || "Vehicle details from year/make/model; supplier fitment and locksmith workflow guidance need verification.",
  };
}

async function handleApi(request, response, pathname) {
  const store = await readStore();

  if (request.method === "GET" && pathname === "/api/jobs") {
    sendJson(response, 200, { jobs: store.jobs });
    return;
  }

  if (request.method === "POST" && pathname === "/api/jobs") {
    const job = cleanJob(await readJsonBody(request));
    store.jobs.unshift(job);
    await writeStore(store);
    sendJson(response, 201, { job });
    return;
  }

  if (request.method === "POST" && pathname === "/api/part-outcomes") {
    const job = cleanPartOutcome(await readJsonBody(request));
    store.jobs.unshift(job);
    await writeStore(store);
    sendJson(response, 201, { job });
    return;
  }

  if (request.method === "GET" && pathname === "/api/vehicles") {
    sendJson(response, 200, { vehicles: store.vehicles });
    return;
  }

  if (request.method === "GET" && pathname === "/api/audit-log") {
    sendJson(response, 200, { auditLog: store.auditLog });
    return;
  }

  if (request.method === "GET" && pathname === "/api/calendar-analysis") {
    try {
      const analysis = JSON.parse(await readFile(path.join(dataDir, "calendar-analysis.json"), "utf8"));
      sendJson(response, 200, analysis);
    } catch {
      sendError(response, 404, "Calendar analysis has not been generated");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/vin-reference") {
    try {
      const reference = JSON.parse(await readFile(vinReferencePath, "utf8"));
      sendJson(response, 200, {
        generatedAt: reference.generatedAt,
        totalUniqueVins: reference.totalUniqueVins,
        rows: reference.rows,
      });
    } catch {
      sendError(response, 404, "VIN reference has not been generated. Run npm run build:vin-reference first.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/vpic-catalog") {
    try {
      const catalog = JSON.parse(await readFile(vpicCatalogPath, "utf8"));
      sendJson(response, 200, {
        generatedAt: catalog.generatedAt,
        source: catalog.source,
        startYear: catalog.startYear,
        endYear: catalog.endYear,
        totalApplications: catalog.totalApplications,
        makes: catalog.makes,
        rows: catalog.rows,
      });
    } catch {
      sendError(response, 404, "vPIC catalog has not been generated. Run npm run sync:vpic first.");
    }
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/vin-reference/")) {
    const vin = decodeURIComponent(pathname.replace("/api/vin-reference/", "")).trim().toUpperCase();
    try {
      const reference = JSON.parse(await readFile(vinReferencePath, "utf8"));
      const row = reference.rows.find((item) => item.vin === vin);
      if (!row) {
        sendError(response, 404, "VIN not found in local reference sheet");
        return;
      }
      sendJson(response, 200, row);
    } catch {
      sendError(response, 404, "VIN reference has not been generated. Run npm run build:vin-reference first.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/key-intelligence") {
    const intelligence = await readKeyIntelligence();
    sendJson(response, 200, intelligence);
    return;
  }

  if (request.method === "GET" && pathname === "/api/sources") {
    sendJson(response, 200, await readSourceConnectors());
    return;
  }

  if (request.method === "GET" && pathname === "/api/supplier-accounts") {
    const supplierAccounts = await readSupplierAccounts();
    sendJson(response, 200, {
      accounts: supplierAccounts.accounts.map(publicSupplierAccount),
    });
    return;
  }

  if (request.method === "POST" && pathname.startsWith("/api/supplier-accounts/")) {
    const supplierId = decodeURIComponent(pathname.replace("/api/supplier-accounts/", "")).trim();
    const body = await readJsonBody(request);
    const supplierAccounts = await readSupplierAccounts();
    const existingIndex = supplierAccounts.accounts.findIndex((account) => account.id === supplierId);
    const existing =
      existingIndex >= 0
        ? supplierAccounts.accounts[existingIndex]
        : {
            id: supplierId,
            name: supplierId
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" "),
            loginUrl: "",
            username: "",
            enabled: false,
            passwordCipher: null,
            updatedAt: null,
          };

    const password = String(body.password || "");
    const passwordCipher = body.clearPassword ? null : password ? await encryptSecret(password) : existing.passwordCipher;
    const account = {
      ...existing,
      name: cleanString(body.name ?? existing.name),
      loginUrl: cleanString(body.loginUrl ?? existing.loginUrl),
      username: cleanString(body.username),
      enabled: Boolean(body.enabled),
      passwordCipher,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      supplierAccounts.accounts[existingIndex] = account;
    } else {
      supplierAccounts.accounts.push(account);
    }

    await writeSupplierAccounts(supplierAccounts);
    sendJson(response, 200, { account: publicSupplierAccount(account) });
    return;
  }

  if (request.method === "GET" && pathname === "/api/key-lookup") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const year = Number(url.searchParams.get("year"));
    const make = cleanString(url.searchParams.get("make")).toUpperCase();
    const model = cleanString(url.searchParams.get("model"));
    const intelligence = await readKeyIntelligence();
    const record = intelligence.records.find(
      (item) => yearsMatch(item, year) && stringsMatch(item.match.make, make) && stringsMatch(item.match.model, model),
    );
    sendJson(response, 200, {
      query: { year, make, model },
      record: record || null,
      nextSources: sourceReadiness(record),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/key-intelligence") {
    const intelligence = await readKeyIntelligence();
    const record = cleanIntelligenceRecord(await readJsonBody(request));
    const existingIndex = intelligence.records.findIndex((item) => item.id === record.id);
    if (existingIndex >= 0) {
      intelligence.records[existingIndex] = record;
    } else {
      intelligence.records.unshift(record);
    }
    await writeKeyIntelligence(intelligence);
    sendJson(response, existingIndex >= 0 ? 200 : 201, { record });
    return;
  }

  if (request.method === "GET" && pathname === "/api/catalog/key-innovations") {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const query = cleanString(url.searchParams.get("q")).toUpperCase();
      const brand = cleanString(url.searchParams.get("brand")).toUpperCase();
      const catalog = JSON.parse(await readFile(keyInnovationsLabelsPath, "utf8"));
      const rows = catalog.entries
        .filter((entry) => !brand || entry.brand === brand)
        .filter((entry) => {
          if (!query) return true;
          return [entry.sku, entry.brand, ...(entry.fccIds || []), ...(entry.oemPartNumbers || []), entry.rawText]
            .join(" ")
            .toUpperCase()
            .includes(query);
        })
        .slice(0, 100);
      sendJson(response, 200, {
        generatedAt: catalog.generatedAt,
        totalEntries: catalog.totalEntries,
        returned: rows.length,
        rows,
      });
    } catch {
      sendError(response, 404, "Key Innovations catalog has not been imported. Run npm run import:key-innovations first.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/programming-reference") {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const year = Number(url.searchParams.get("year"));
      const make = cleanString(url.searchParams.get("make")).toUpperCase();
      const model = cleanString(url.searchParams.get("model"));
      const reference = JSON.parse(await readFile(programmingReferencePath, "utf8"));
      const rows = reference.rows
        .filter((row) => !year || Number(row.year) === year)
        .filter((row) => !make || stringsMatch(row.make, make))
        .filter((row) => !model || stringsMatch(row.model, model))
        .slice(0, 100);
      sendJson(response, 200, { generatedAt: reference.generatedAt, totalRows: reference.totalRows, returned: rows.length, rows });
    } catch {
      sendError(response, 404, "Programming reference has not been imported. Run npm run import:programming first.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/catalog/master") {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const query = cleanString(url.searchParams.get("q")).toUpperCase();
      const catalog = JSON.parse(await readFile(masterCatalogPath, "utf8"));
      const rows = catalog.rows
        .filter((row) => {
          if (!query) return true;
          return Object.values(row).flat().join(" ").toUpperCase().includes(query);
        })
        .slice(0, 100);
      sendJson(response, 200, { generatedAt: catalog.generatedAt, totalRows: catalog.totalRows, returned: rows.length, rows });
    } catch {
      sendError(response, 404, "Master catalog has not been imported. Run npm run import:master-catalog first.");
    }
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/vin/")) {
    const vin = decodeURIComponent(pathname.replace("/api/vin/", "")).trim().toUpperCase();
    if (!validateVin(vin)) {
      sendError(response, 400, "Enter a valid 17-character VIN. Letters I, O, and Q are not used.");
      return;
    }

    const decodeUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
    const vinResponse = await fetch(decodeUrl);
    if (!vinResponse.ok) {
      sendError(response, 502, "NHTSA VIN decoder did not respond");
      return;
    }

    const payload = await vinResponse.json();
    const decode = payload.Results?.[0];
    sendJson(response, 200, await buildLocksmithProfile(vin, decode, store));
    return;
  }

  if (request.method === "GET" && pathname === "/api/vehicle-lookup") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const year = cleanString(url.searchParams.get("year"));
    const make = cleanString(url.searchParams.get("make"));
    const model = cleanString(url.searchParams.get("model"));

    if (!/^(19|20)\d{2}$/.test(year) || !make || !model) {
      sendError(response, 400, "Enter year, make, and model.");
      return;
    }

    const vehicle = {
      year,
      make,
      model,
      trim: "",
      bodyClass: "",
      engine: "",
      driveType: "",
      plantCity: "",
      plantCountry: "",
      identitySource: "Manual year/make/model lookup",
    };
    sendJson(
      response,
      200,
      await buildVehicleProfile(vehicle, store, {
        lookupMode: "ymm",
        confidence: "Year/make/model lookup - verify trim, package, FCC, buttons, blade, and original key style",
        sourceReadinessIdentity: {
          status: "manual",
          result: "VIN not used; supplier parts are broad fitment candidates",
        },
      }),
    );
    return;
  }

  if (request.method === "POST" && pathname === "/api/ai") {
    const body = await readJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      sendError(response, 400, "Prompt is required");
      return;
    }

    const decision = aiDecision(prompt);
    const entry = {
      id: randomUUID(),
      jobId: body.jobId || null,
      prompt,
      response: decision.response,
      riskLevel: decision.riskLevel,
      policyDecision: decision.policyDecision,
      createdAt: new Date().toISOString(),
    };

    store.auditLog.unshift(entry);
    await writeStore(store);
    sendJson(response, 200, entry);
    return;
  }

  sendError(response, 404, "API route not found");
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(__dirname, requestedPath));

  if (!filePath.startsWith(__dirname)) {
    sendError(response, 403, "Forbidden");
    return;
  }

  try {
    const ext = path.extname(filePath);
    const content = await readFile(filePath);
    const noCache = [".html", ".js", ".css"].includes(ext);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      ...(noCache ? { "Cache-Control": "no-store, max-age=0" } : {}),
    });
    response.end(content);
  } catch {
    sendError(response, 404, "File not found");
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      response.end();
      return;
    }

    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname.startsWith("/api/")) {
      await handleApi(request, response, pathname);
      return;
    }
    await serveStatic(response, pathname);
  } catch (error) {
    sendError(response, 500, error.message || "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`LockForge Systems running at http://${host}:${port}/`);
});
