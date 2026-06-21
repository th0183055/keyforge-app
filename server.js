import { createServer } from "node:http";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const dataDir = path.join(__dirname, "data");
const mutableDataDir = process.env.TIMLOCK_DATA_DIR ? path.resolve(process.env.TIMLOCK_DATA_DIR) : dataDir;
const storePath = path.join(mutableDataDir, "store.json");
const storeExamplePath = path.join(dataDir, "store.example.json");
const keyIntelligencePath = path.join(dataDir, "key-intelligence.json");
const vinReferencePath = path.join(dataDir, "vin-reference.json");
const vpicCatalogPath = path.join(dataDir, "vpic-catalog.json");
const sourceConnectorsPath = path.join(dataDir, "source-connectors.json");
const keyInnovationsLabelsPath = path.join(dataDir, "key-innovations-labels.json");
const programmingReferencePath = path.join(dataDir, "programming-reference.json");
const masterCatalogPath = path.join(dataDir, "master-catalog.json");
const partsCrossReferencePath = path.join(dataDir, "parts-cross-reference.json");
const lishiMasterReferencePath = path.join(dataDir, "lishi-master-reference.json");
const supplierAccountsPath = path.join(mutableDataDir, "supplier-accounts.local.json");
const vehicleProfilesPath = path.join(mutableDataDir, "vehicle-profiles.json");
const referenceVaultPath = path.join(mutableDataDir, "reference-vault.json");
const publicReferenceSourcesPath = path.join(mutableDataDir, "public-reference-sources.json");
const proofAttachmentsPath = path.join(mutableDataDir, "proof-attachments.json");
const proofAttachmentFileDir = path.join(mutableDataDir, "proof-attachments");
const localSecretPath = path.join(mutableDataDir, ".lockforge-secret");
const authCookieName = "timlock_session";
const authMaxAgeSeconds = Number(process.env.TIMLOCK_AUTH_TTL_SECONDS || 60 * 60 * 24 * 14);
const attachmentUploadMaxBytes = Number(process.env.TIMLOCK_ATTACHMENT_MAX_BYTES || 5_000_000);
const bootedAt = new Date().toISOString();
const staticJsonCache = new Map();
const partsReferenceRowsByIdCache = new WeakMap();
const jobEvidenceIndexMarker = Symbol("timlock-job-evidence-index");

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
    lookupMode: "live public connector",
  },
  {
    id: "transponder-island",
    name: "Transponder Island",
    loginUrl: "https://transponderisland.com/",
    lookupMode: "live public connector",
  },
  {
    id: "key4",
    name: "Key4",
    loginUrl: "https://www.key4.com/",
    lookupMode: "live vehicle connector",
  },
  {
    id: "idn-hoffman",
    name: "IDN-H. Hoffman",
    loginUrl: "https://www.idn-inc.com/",
    lookupMode: "live public parts search",
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

const emptyStore = {
  jobs: [],
  vehicles: [],
  auditLog: [],
  aiFeedback: [],
  shopRules: [],
  codeDeskRecords: [],
  codeDeskSystems: [],
  codeDeskLessons: [],
  aiPreferences: {
    voice: "field-pro",
    ownerTone: "direct",
    subscriberTone: "polished",
  },
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function normalizeStore(store = {}) {
  return {
    ...emptyStore,
    ...store,
    jobs: Array.isArray(store.jobs) ? store.jobs : [],
    vehicles: Array.isArray(store.vehicles) ? store.vehicles : [],
    auditLog: Array.isArray(store.auditLog) ? store.auditLog : [],
    aiFeedback: Array.isArray(store.aiFeedback) ? store.aiFeedback : [],
    shopRules: Array.isArray(store.shopRules) ? store.shopRules : [],
    codeDeskRecords: Array.isArray(store.codeDeskRecords) ? store.codeDeskRecords : [],
    codeDeskSystems: Array.isArray(store.codeDeskSystems) ? store.codeDeskSystems : [],
    codeDeskLessons: Array.isArray(store.codeDeskLessons) ? store.codeDeskLessons : [],
    aiPreferences: {
      ...emptyStore.aiPreferences,
      ...(store.aiPreferences && typeof store.aiPreferences === "object" ? store.aiPreferences : {}),
    },
  };
}

async function readStoreSeed() {
  return normalizeStore(await readJsonCached(storeExamplePath, emptyStore));
}

async function ensureStore() {
  await mkdir(mutableDataDir, { recursive: true });
  if (!existsSync(storePath)) {
    await writeStore(await readStoreSeed());
  }
}

async function readStore() {
  await ensureStore();
  return normalizeStore(JSON.parse(await readFile(storePath, "utf8")));
}

async function readJsonCached(filePath, fallback = {}) {
  if (staticJsonCache.has(filePath)) return staticJsonCache.get(filePath);
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    staticJsonCache.set(filePath, payload);
    return payload;
  } catch {
    return typeof fallback === "function" ? fallback() : fallback;
  }
}

async function writeStore(store) {
  await mkdir(mutableDataDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

async function readVehicleProfiles() {
  await mkdir(mutableDataDir, { recursive: true });
  if (!existsSync(vehicleProfilesPath)) {
    return { generatedAt: new Date().toISOString(), profiles: [] };
  }
  return JSON.parse(await readFile(vehicleProfilesPath, "utf8"));
}

async function writeVehicleProfiles(profiles) {
  await mkdir(mutableDataDir, { recursive: true });
  await writeFile(vehicleProfilesPath, `${JSON.stringify({ ...profiles, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

async function readReferenceVault() {
  await mkdir(mutableDataDir, { recursive: true });
  if (!existsSync(referenceVaultPath)) {
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  }
  const vault = JSON.parse(await readFile(referenceVaultPath, "utf8"));
  return {
    version: vault.version || 1,
    updatedAt: vault.updatedAt || "",
    entries: Array.isArray(vault.entries) ? vault.entries : [],
  };
}

async function writeReferenceVault(vault) {
  await mkdir(mutableDataDir, { recursive: true });
  await writeFile(referenceVaultPath, `${JSON.stringify({ ...vault, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

async function readPublicReferenceSources() {
  await mkdir(mutableDataDir, { recursive: true });
  if (!existsSync(publicReferenceSourcesPath)) {
    return { generatedAt: "", sources: [], autel: { products: [], coverage: [] }, communityEvidence: [], nhtsa: {} };
  }
  return JSON.parse(await readFile(publicReferenceSourcesPath, "utf8"));
}

async function writePublicReferenceSources(payload) {
  await mkdir(mutableDataDir, { recursive: true });
  await writeFile(publicReferenceSourcesPath, `${JSON.stringify({ ...payload, generatedAt: new Date().toISOString() }, null, 2)}\n`);
}

async function readKeyIntelligence() {
  return readJsonCached(keyIntelligencePath, { rows: [] });
}

async function readSourceConnectors() {
  return readJsonCached(sourceConnectorsPath, { connectors: [] });
}

async function writeKeyIntelligence(intelligence) {
  await writeFile(keyIntelligencePath, `${JSON.stringify(intelligence, null, 2)}\n`);
  staticJsonCache.delete(keyIntelligencePath);
}

async function localVaultKey() {
  await mkdir(mutableDataDir, { recursive: true });
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

async function authSigningKey() {
  const configured = cleanString(process.env.TIMLOCK_AUTH_SECRET || process.env.LOCKFORGE_SECRET);
  if (configured) return createHash("sha256").update(configured).digest();
  return localVaultKey();
}

function authPasswordForRole(role) {
  if (role === "subscriber") {
    return cleanString(process.env.TIMLOCK_SUBSCRIBER_PASSWORD || process.env.TIMLOCK_SUBSCRIBER_PIN);
  }
  return cleanString(process.env.TIMLOCK_OWNER_PASSWORD || process.env.TIMLOCK_OWNER_PIN);
}

function authEnabled() {
  return Boolean(authPasswordForRole("owner") || authPasswordForRole("subscriber"));
}

function safeTextEquals(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function base64UrlJson(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
  }
  return cookies;
}

async function signAuthSession(role) {
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlJson({
    role: role === "subscriber" ? "subscriber" : "owner",
    iat: now,
    exp: now + authMaxAgeSeconds,
    sid: randomUUID(),
  });
  const signature = createHmac("sha256", await authSigningKey()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function verifyAuthSession(token) {
  const [body, signature] = cleanString(token).split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", await authSigningKey()).update(body).digest("base64url");
  if (!safeTextEquals(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!["owner", "subscriber"].includes(payload.role)) return null;
    if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requestAuth(request) {
  const enabled = authEnabled();
  if (!enabled) {
    return {
      enabled: false,
      authenticated: true,
      role: "owner",
      mode: "open-dev",
      warning: "Set TIMLOCK_OWNER_PASSWORD before sharing this app with subscribers.",
    };
  }
  const session = await verifyAuthSession(parseCookies(request)[authCookieName]);
  if (session?.role) {
    return {
      enabled: true,
      authenticated: true,
      role: session.role,
      mode: "session",
      expiresAt: new Date(Number(session.exp) * 1000).toISOString(),
    };
  }
  return {
    enabled: true,
    authenticated: false,
    role: "guest",
    mode: "locked",
  };
}

function authCookie(value, request, maxAge = authMaxAgeSeconds) {
  const secure =
    request.headers["x-forwarded-proto"] === "https" ||
    /^https:/i.test(cleanString(request.headers.origin || request.headers.referer));
  return `${authCookieName}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function authPublicStatus(auth) {
  return {
    enabled: Boolean(auth.enabled),
    authenticated: Boolean(auth.authenticated),
    role: auth.role,
    mode: auth.mode,
    expiresAt: auth.expiresAt || "",
    warning: auth.warning || "",
    roles: {
      owner: Boolean(authPasswordForRole("owner")),
      subscriber: Boolean(authPasswordForRole("subscriber")),
    },
  };
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
  await mkdir(mutableDataDir, { recursive: true });
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
  await mkdir(mutableDataDir, { recursive: true });
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

function absoluteUrl(base, url) {
  const cleanUrl = decodeHtml(url);
  if (!cleanUrl) return "";
  if (cleanUrl.startsWith("http")) return cleanUrl;
  if (cleanUrl.startsWith("//")) return `https:${cleanUrl}`;
  return `${base}${cleanUrl.startsWith("/") ? "" : "/"}${cleanUrl}`;
}

function valueFromText(text, pattern) {
  return cleanString(String(text || "").match(pattern)?.[1] || "");
}

function keyInfoFromSupplierText(text) {
  const cleanText = stripHtml(text);
  return {
    fcc: valueFromText(cleanText, /\b(?:FCC(?:\s*ID)?|FCCID)\s*[:#-]?\s*([A-Z0-9-]{5,})/i) || valueFromText(cleanText, /\b([A-Z0-9]{3,}-[A-Z0-9]{3,})\b/i),
    oem: valueFromText(cleanText, /\b((?:\d{3}-R\d{4}R?)|(?:\d{4,}-[A-Z0-9-]{3,}))\b/i),
    frequency: valueFromText(cleanText, /\b(3(?:15|14|13)|4(?:33|34)|902)\s*MHZ\b/i),
    chip: valueFromText(cleanText, /\b(HITAG[^,;)]*|ID4[689A-Z]?|4D(?:\d+)?|46 CHIP|80 BIT|128 BIT)\b/i),
    buttons: valueFromText(cleanText, /\b([2-7])\s*(?:B|BUTTON|BTN)\b/i),
  };
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
      "User-Agent": "TimLock-App parts connector/0.1",
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
    `https://api.searchspring.net/api/search/search.json?siteId=0r6l0x&resultsFormat=native&resultsPerPage=120&filter.ss_fitment=${encodeURIComponent(filter)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TimLock-App parts connector/0.1",
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
      .slice(0, 120),
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
      "User-Agent": "TimLock-App parts connector/0.1",
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

function supplierHtmlProduct(id, supplier, name, url, image, price, source, matchedQuery, vehicle, extra = {}) {
  const keyInfo = keyInfoFromSupplierText([name, extra.description, extra.sku].filter(Boolean).join(" "));
  const product = {
    id: String(id || url || name),
    supplier,
    name: cleanString(name),
    brand: extra.brand || cleanString(vehicle.make),
    price: cleanString(price),
    priceFormatted: cleanString(price),
    url,
    image: normalizeImageUrl(image),
    source,
    matchedQuery,
    fitmentLines: extra.fitment ? [extra.fitment] : [],
    customFields: extra,
    keyInfo: {
      sku: extra.sku || "",
      itemNumber: keyInfo.oem || extra.sku || "",
      fcc: keyInfo.fcc,
      oem: keyInfo.oem,
      chip: keyInfo.chip,
      frequency: keyInfo.frequency ? `${keyInfo.frequency} MHz` : "",
      buttons: keyInfo.buttons ? `${keyInfo.buttons} button` : "",
      battery: "",
      condition: /aftermarket/i.test(name) ? "Aftermarket" : /oem|original/i.test(name) ? "OEM / new" : "",
      productType: /smart|prox/i.test(name) ? "Smart Key" : /flip/i.test(name) ? "Flip Key" : /transponder/i.test(name) ? "Transponder Key" : "Key item",
      stock: extra.stock || "Stock unknown",
      fitment: extra.fitment || "",
    },
  };
  product.score = productScore(product, vehicle);
  return product;
}

async function htmlFetch(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "TimLock-App parts connector/0.1",
    },
  });
  if (!response.ok) throw new Error(`Search returned ${response.status}`);
  return response.text();
}

function parseUhsProducts(html, vehicle, matchedQuery) {
  const products = [];
  for (const match of String(html || "").matchAll(/<div[^>]+class="[^"]*product-item[^"]*"[^>]*data-product-id="([^"]+)"[^>]*data-json-product='([\s\S]*?)'\s*>/gi)) {
    try {
      const data = JSON.parse(decodeHtml(match[2]));
      const variant = data.variants?.[0] || {};
      const blockStart = match.index || 0;
      const block = String(html || "").slice(blockStart, blockStart + 2500);
      const image = data.featured_image || variant.featured_image?.src || block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i)?.[1] || "";
      const url = absoluteUrl("https://www.uhs-hardware.com", `/products/${data.handle || ""}`);
      const price = Number(variant.price || data.price || 0);
      products.push(
        supplierHtmlProduct(match[1], "UHS Hardware", data.title || variant.name, url, image, price > 999 ? (price / 100).toFixed(2) : price || "", "UHS storefront search", matchedQuery, vehicle, {
          sku: variant.sku || "",
          description: stripHtml(data.description || data.body_html || ""),
          stock: variant.available === false ? "Out of stock" : "Stock unknown",
        }),
      );
    } catch {
      // Ignore malformed embedded Shopify product JSON.
    }
  }
  return products;
}

async function searchUhsProducts(vehicle, vin) {
  const seen = new Map();
  const searchAttempts = [];
  for (const query of searchQueriesForVehicle(vehicle, vin).filter((query) => query !== vin).slice(0, 3)) {
    const html = await htmlFetch(`https://www.uhs-hardware.com/search?q=${encodeURIComponent(query)}`);
    const products = parseUhsProducts(html, vehicle, query);
    searchAttempts.push({ query, resultCount: products.length, returnedCount: products.length });
    products.forEach((product) => {
      if (product.score > 0 && !seen.has(product.id)) seen.set(product.id, product);
    });
  }
  return {
    connected: true,
    source: "UHS storefront search",
    searchAttempts,
    products: Array.from(seen.values()).sort((a, b) => b.score - a.score).slice(0, 40),
  };
}

function parseTransponderIslandProducts(html, vehicle, matchedQuery) {
  const products = [];
  const blocks = String(html || "").matchAll(/<form[^>]+itemtype="http:\/\/schema\.org\/Product"[\s\S]*?<\/form>/gi);
  for (const blockMatch of blocks) {
    const block = blockMatch[0];
    const titleMatch = block.match(/<a[^>]+itemprop="name"[^>]+title="([^"]+)"[^>]+href="([^"]+)"/i);
    const name = decodeHtml(titleMatch?.[1]);
    if (!name) continue;
    const image = normalizeImageUrl(block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i)?.[1]);
    const id = block.match(/name="product_template_id"[^>]+value="([^"]+)"/i)?.[1] || block.match(/name="product_id"[^>]+value="([^"]+)"/i)?.[1];
    products.push(
      supplierHtmlProduct(
        id,
        "Transponder Island",
        name,
        absoluteUrl("https://transponderisland.com", titleMatch?.[2] || ""),
        absoluteUrl("https://transponderisland.com", image),
        "",
        "Transponder Island storefront search",
        matchedQuery,
        vehicle,
        { description: stripHtml(block), stock: /login/i.test(block) ? "Login for price/stock" : "Stock unknown" },
      ),
    );
  }
  return products;
}

async function searchTransponderIslandProducts(vehicle, vin) {
  const query = searchQueriesForVehicle(vehicle, vin).filter((item) => item !== vin)[0];
  const html = await htmlFetch(`https://transponderisland.com/shop?search=${encodeURIComponent(query)}`);
  const products = parseTransponderIslandProducts(html, vehicle, query);
  return {
    connected: true,
    source: "Transponder Island storefront search",
    searchAttempts: [{ query, resultCount: products.length, returnedCount: products.length }],
    products: products.filter((product) => product.score > 0).sort((a, b) => b.score - a.score).slice(0, 40),
  };
}

function parseKey4Products(html, vehicle, matchedQuery) {
  const products = [];
  const blocks = String(html || "")
    .split(/<div class="item"[^>]*>/i)
    .slice(1)
    .map((block) => `<div class="item">${block.split(/<div class="item"[^>]*>/i)[0]}`);
  for (const block of blocks) {
    const titleMatch = block.match(/<a([^>]*class="title"[^>]*)>\s*([\s\S]*?)\s*<\/a>/i);
    const href = titleMatch?.[1]?.match(/href="([^"]+)"/i)?.[1] || "";
    const name = stripHtml(titleMatch?.[2] || "");
    if (!name) continue;
    const sku = stripHtml(block.match(/<span class="id[^"]*"[^>]*>#?([\s\S]*?)<\/span>/i)?.[1] || "");
    const image = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i)?.[1] || "";
    const price = stripHtml(block.match(/<span class="endPrice">\s*([\s\S]*?)\s*<\/span>/i)?.[1] || "");
    products.push(
      supplierHtmlProduct(
        sku || titleMatch?.[1],
        "Key4",
        name,
        absoluteUrl("https://www.key4.com", href),
        absoluteUrl("https://www.key4.com", image),
        price,
        "Key4 vehicle search",
        matchedQuery,
        vehicle,
        { sku, description: stripHtml(block), stock: /out of stock/i.test(block) ? "Out of stock" : "Stock unknown" },
      ),
    );
  }
  return products;
}

async function searchKey4Products(vehicle) {
  const query = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const url =
    `https://www.key4.com/search-by-vehicle?year=${encodeURIComponent(vehicle.year || "")}&make=${encodeURIComponent(vehicle.make || "")}&model=${encodeURIComponent(vehicle.model || "")}`;
  const html = await htmlFetch(url);
  const products = parseKey4Products(html, vehicle, query);
  return {
    connected: true,
    source: "Key4 vehicle search",
    searchAttempts: [{ query, resultCount: products.length, returnedCount: products.length }],
    products: products.filter((product) => product.score > 0).sort((a, b) => b.score - a.score).slice(0, 40),
  };
}

function parseIdnProducts(html, vehicle, matchedQuery) {
  const products = [];
  const make = cleanString(vehicle.make).toUpperCase();
  const model = cleanString(vehicle.model).toUpperCase();
  const normalizedModel = model.replace(/[^A-Z0-9]/g, "");
  for (const match of String(html || "").matchAll(/<li class="item product product-item">[\s\S]*?<\/li>/gi)) {
    const block = match[0];
    const titleMatch = block.match(/class="product-item-link" href="([^"]+)">([\s\S]*?)<\/a>/i);
    const name = stripHtml(titleMatch?.[2] || "");
    if (!name) continue;
    const searchText = normalizeVehicleText(`${name} ${stripHtml(block)}`);
    if (
      make &&
      model &&
      !searchText.includes(make) &&
      !searchText.includes(model) &&
      !searchText.replace(/[^A-Z0-9]/g, "").includes(normalizedModel)
    ) {
      continue;
    }
    const sku = stripHtml(block.match(/<span class="label">Product #<\/span>\s*<a[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
    const image = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i)?.[1] || "";
    products.push(
      supplierHtmlProduct(
        sku || titleMatch?.[1],
        "IDN-H. Hoffman",
        name,
        titleMatch?.[1] || "",
        image,
        "",
        "IDN public parts search",
        matchedQuery,
        vehicle,
        { sku, description: stripHtml(block), stock: /in stock/i.test(block) ? "In stock" : "Stock unknown" },
      ),
    );
  }
  return products;
}

async function searchIdnProducts(vehicle, vin) {
  const query = searchQueriesForVehicle(vehicle, vin).filter((item) => item !== vin)[0];
  const html = await htmlFetch(`https://www.idn-inc.com/catalogsearch/result/?q=${encodeURIComponent(query)}`);
  const products = parseIdnProducts(html, vehicle, query);
  return {
    connected: true,
    source: "IDN public parts search",
    searchAttempts: [{ query, resultCount: products.length, returnedCount: products.length }],
    products: products.filter((product) => product.score > 0).sort((a, b) => b.score - a.score).slice(0, 30),
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

async function liveUhsLookup(vehicle, vin) {
  const live = await searchUhsProducts(vehicle, vin);
  return {
    supplier: "UHS Hardware",
    loginStatus: "connected",
    statusMessage: "UHS public storefront search is connected.",
    vinLookupAvailable: false,
    ...live,
  };
}

async function liveTransponderIslandLookup(vehicle, vin) {
  const live = await searchTransponderIslandProducts(vehicle, vin);
  return {
    supplier: "Transponder Island",
    loginStatus: "connected",
    statusMessage: "Transponder Island public storefront search is connected; login may be required for price/stock.",
    vinLookupAvailable: false,
    ...live,
  };
}

async function liveKey4Lookup(vehicle, vin) {
  const live = await searchKey4Products(vehicle, vin);
  return {
    supplier: "Key4",
    loginStatus: "connected",
    statusMessage: "Key4 vehicle search is connected.",
    vinLookupAvailable: false,
    ...live,
  };
}

async function liveIdnLookup(vehicle, vin) {
  const live = await searchIdnProducts(vehicle, vin);
  return {
    supplier: "IDN-H. Hoffman",
    loginStatus: "connected",
    statusMessage: "IDN public parts search is connected; results may be broad until account/parts integration is added.",
    vinLookupAvailable: false,
    ...live,
  };
}

function supplierLookupStatus(account, override = {}) {
  const enabled = Boolean(account?.enabled);
  const configured = Boolean(account?.username && account?.passwordCipher);
  const connectorLive = ["key-innovations", "golden-supply", "uhs", "transponder-island", "key4", "idn-hoffman"].includes(account?.id);
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
        ? "Live supplier search is wired."
        : enabled
          ? "Login is saved, but this supplier still needs a connector before parts can appear in comparisons."
          : "Disabled in Settings."),
    productCount: override.productCount || 0,
  };
}

async function liveSupplierLookups(vehicle, vin) {
  const supplierAccounts = await readSupplierAccounts();
  const statuses = supplierAccounts.accounts.map((account) => supplierLookupStatus(account));
  const products = [];
  const searchAttempts = [];
  let loginStatus = "connected";
  let statusMessage = "Supplier lookups completed.";
  let connected = false;

  const lookupTasks = [
    ["key-innovations", liveKeyInnovationsLookup],
    ["golden-supply", liveGoldenSupplyLookup],
    ["uhs", liveUhsLookup],
    ["transponder-island", liveTransponderIslandLookup],
    ["key4", liveKey4Lookup],
    ["idn-hoffman", liveIdnLookup],
  ];

  const withTimeout = (promise, supplierName, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${supplierName} lookup timed out after ${Math.round(ms / 1000)} seconds.`)), ms);
      }),
    ]);

  const results = await Promise.all(
    lookupTasks.map(async ([supplierId, lookup]) => {
      const account = supplierAccounts.accounts.find((item) => item.id === supplierId);
      const supplierName = account?.name || supplierId;
      try {
        const timeoutMs = supplierId === "key-innovations" ? 12000 : 7000;
        return { supplierId, account, result: await withTimeout(lookup(vehicle, vin), supplierName, timeoutMs) };
      } catch (error) {
        return { supplierId, account, error };
      }
    }),
  );

  for (const { supplierId, account, result, error } of results) {
    const statusIndex = statuses.findIndex((status) => status.id === supplierId);
    if (result) {
      products.push(...(result.products || []));
      searchAttempts.push(...(result.searchAttempts || []));
      connected = connected || Boolean(result.connected);
      if (statusIndex >= 0) {
        statuses[statusIndex] = supplierLookupStatus(account, {
          status: result.loginStatus,
          message: result.statusMessage,
          productCount: result.products?.length || 0,
        });
      }
    } else {
      if (statusIndex >= 0) {
        statuses[statusIndex] = supplierLookupStatus(account, {
          status: "error",
          message: error.message || `${account?.name || supplierId} lookup failed.`,
          productCount: 0,
        });
      }
      loginStatus = products.length ? "partial" : "error";
      statusMessage = products.length
        ? `${account?.name || supplierId} lookup failed after other supplier results loaded.`
        : error.message || "Live supplier lookup failed.";
    }
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

async function pendingSupplierLookup(statusMessage = "Supplier search is running in the background.") {
  const supplierAccounts = await readSupplierAccounts();
  return {
    supplier: "Supplier comparison",
    loginStatus: "searching",
    statusMessage,
    connected: false,
    source: "Multi-supplier live search",
    products: [],
    searchAttempts: [],
    supplierStatuses: supplierAccounts.accounts.map((account) =>
      supplierLookupStatus(account, {
        status: "searching",
        message: "Waiting to search.",
        productCount: 0,
      }),
    ),
  };
}

async function buildProfileSupplierLookup(vehicle, store, options, programmingReference, verifiedProfile, shopEvidence) {
  const [rawSupplierLookup, partsReference] = await Promise.all([liveSupplierLookups(vehicle, options.vin || ""), readPartsCrossReference()]);
  const crossReferencedSupplierLookup = applyPartsCrossReferenceToProducts(rawSupplierLookup, partsReference);
  const evidenceSupplierLookup = applyShopEvidenceToProducts(crossReferencedSupplierLookup, shopEvidence);
  const profiledSupplierLookup = applyVehicleProfileToProducts(evidenceSupplierLookup, verifiedProfile);
  return applyPartSelectionEngine(profiledSupplierLookup, vehicle, shopEvidence, programmingReference, verifiedProfile);
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 12_000_000) {
      throw new Error("Request body too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message, details = {}) {
  sendJson(response, statusCode, { error: message, ...details });
}

async function jsonFileHealth(label, filePath, countKey = "", optional = false) {
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    const count =
      countKey && Array.isArray(payload[countKey])
        ? payload[countKey].length
        : Array.isArray(payload.rows)
          ? payload.rows.length
          : Array.isArray(payload.entries)
            ? payload.entries.length
            : Array.isArray(payload.jobs)
              ? payload.jobs.length
              : null;
    return { label, ok: true, optional, count };
  } catch (error) {
    return { label, ok: false, optional, error: error.message };
  }
}

async function buildHealthStatus() {
  await ensureStore();
  const files = await Promise.all([
    jsonFileHealth("job store", storePath, "jobs"),
    jsonFileHealth("key intelligence", keyIntelligencePath, "records"),
    jsonFileHealth("programming reference", programmingReferencePath, "rows"),
    jsonFileHealth("VIN reference", vinReferencePath, "rows"),
    jsonFileHealth("vPIC catalog", vpicCatalogPath, "rows"),
    jsonFileHealth("parts cross-reference", partsCrossReferencePath, "rows"),
    jsonFileHealth("Lishi master reference", lishiMasterReferencePath, "tools"),
    jsonFileHealth("reference vault", referenceVaultPath, "entries", true),
    jsonFileHealth("proof attachments", proofAttachmentsPath, "attachments", true),
  ]);
  const missing = files.filter((item) => !item.ok && !item.optional);
  return {
    status: missing.length ? "degraded" : "ok",
    bootedAt,
    checkedAt: new Date().toISOString(),
    storage: {
      mutableDataDir,
      proofAttachments: proofAttachmentStorageMode(),
    },
    summary: missing.length ? `${missing.length} data source${missing.length === 1 ? "" : "s"} need attention` : "All core data sources readable",
    files,
  };
}

function r2ConfigStatus() {
  const required = [
    ["R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID],
    ["R2_BUCKET", process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET],
    ["R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY],
  ];
  const missing = required.filter(([, value]) => !cleanString(value)).map(([name]) => name);
  return {
    configured: missing.length === 0,
    missing,
    bucket: cleanString(process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET),
    publicBaseConfigured: Boolean(cleanString(process.env.R2_PUBLIC_BASE_URL)),
    customEndpointConfigured: Boolean(cleanString(process.env.R2_ENDPOINT)),
  };
}

function storageRecordIdentity(record = {}, fields = [], prefix = "record") {
  const id = cleanString(record.id);
  if (id) return `${prefix}:id:${id}`;
  const signature = fields.map((field) => cleanString(record[field])).filter(Boolean).join("|");
  if (signature) return `${prefix}:sig:${signature}`;
  return `${prefix}:hash:${sha256Hex(JSON.stringify(record).slice(0, 6000))}`;
}

function mergeStorageRecords(existing = [], incoming = [], fields = [], prefix = "record") {
  const map = new Map();
  (Array.isArray(existing) ? existing : []).forEach((record) => {
    if (record && typeof record === "object") map.set(storageRecordIdentity(record, fields, prefix), record);
  });
  (Array.isArray(incoming) ? incoming : []).forEach((record) => {
    if (!record || typeof record !== "object") return;
    const key = storageRecordIdentity(record, fields, prefix);
    map.set(key, { ...(map.get(key) || {}), ...record });
  });
  return Array.from(map.values());
}

function sortStorageJobs(jobs = []) {
  return jobs.sort((a, b) => (Date.parse(b.createdAt || b.importedAt || b.schedule || "") || 0) - (Date.parse(a.createdAt || a.importedAt || a.schedule || "") || 0));
}

function mergeStorageStore(currentStore, incomingStore = {}, replace = false) {
  const current = normalizeStore(currentStore);
  const incoming = normalizeStore(incomingStore);
  if (replace) return incoming;
  return normalizeStore({
    ...current,
    jobs: sortStorageJobs(mergeStorageRecords(current.jobs, incoming.jobs, ["title", "vehicle", "vin", "createdAt", "schedule"], "job")),
    vehicles: mergeStorageRecords(current.vehicles, incoming.vehicles, ["name", "make", "model", "year"], "vehicle"),
    auditLog: mergeStorageRecords(current.auditLog, incoming.auditLog, ["createdAt", "prompt", "route"], "audit"),
    aiFeedback: mergeStorageRecords(current.aiFeedback, incoming.aiFeedback, ["createdAt", "prompt", "value"], "ai-feedback"),
    shopRules: mergeStorageRecords(current.shopRules, incoming.shopRules, ["title", "body", "createdAt"], "shop-rule"),
    codeDeskRecords: mergeStorageRecords(current.codeDeskRecords, incoming.codeDeskRecords, ["system", "code", "bitting"], "code-desk-record"),
    codeDeskSystems: mergeStorageRecords(current.codeDeskSystems, incoming.codeDeskSystems, ["name", "id"], "code-desk-system"),
    codeDeskLessons: mergeStorageRecords(current.codeDeskLessons, incoming.codeDeskLessons, ["createdAt", "system", "code", "bitting", "outcome"], "code-desk-lesson"),
    aiPreferences: {
      ...current.aiPreferences,
      ...(incoming.aiPreferences && typeof incoming.aiPreferences === "object" ? incoming.aiPreferences : {}),
    },
  });
}

function mergeStoragePayloadArray(current = {}, incoming = {}, key, fields = [], prefix = key, replace = false) {
  const incomingPayload = incoming && typeof incoming === "object" ? incoming : {};
  const currentPayload = current && typeof current === "object" ? current : {};
  return {
    ...currentPayload,
    ...incomingPayload,
    [key]: replace
      ? Array.isArray(incomingPayload[key])
        ? incomingPayload[key]
        : []
      : mergeStorageRecords(currentPayload[key], incomingPayload[key], fields, prefix),
    updatedAt: new Date().toISOString(),
  };
}

function mergePublicReferenceSources(current = {}, incoming = {}, replace = false) {
  if (replace) return { ...incoming, generatedAt: incoming.generatedAt || new Date().toISOString() };
  return {
    ...current,
    ...incoming,
    sources: mergeStorageRecords(current.sources, incoming.sources, ["id", "name", "url"], "public-source"),
    communityEvidence: mergeStorageRecords(current.communityEvidence, incoming.communityEvidence, ["id", "source", "vehicle", "createdAt"], "community-evidence"),
    autel: {
      ...(current.autel || {}),
      ...(incoming.autel || {}),
      products: mergeStorageRecords(current.autel?.products, incoming.autel?.products, ["id", "name", "url"], "autel-product"),
      coverage: mergeStorageRecords(current.autel?.coverage, incoming.autel?.coverage, ["id", "vehicle", "system", "year"], "autel-coverage"),
    },
    generatedAt: new Date().toISOString(),
  };
}

async function buildStorageStatus() {
  const [health, store, vehicleProfiles, referenceVault, publicSources, proofAttachments] = await Promise.all([
    buildHealthStatus(),
    readStore(),
    readVehicleProfiles(),
    readReferenceVault(),
    readPublicReferenceSources(),
    readProofAttachments(),
  ]);
  const r2 = r2ConfigStatus();
  const dataDirExternal = Boolean(process.env.TIMLOCK_DATA_DIR);
  const attachmentMode = proofAttachmentStorageMode();
  const proofStorageCounts = proofAttachmentStorageCounts(proofAttachments.attachments);
  const warnings = [];

  if (!dataDirExternal) {
    warnings.push("TIMLOCK_DATA_DIR is not set, so live jobs are using the repo-local ignored data folder.");
  }
  if (attachmentMode !== "cloudflare-r2") {
    warnings.push("Cloudflare R2 is not fully configured, so proof files are stored on the server filesystem.");
  }
  if (attachmentMode !== "cloudflare-r2" && !dataDirExternal) {
    warnings.push("Server-local proof files will not follow users across devices unless persistent storage or R2 is configured.");
  }
  if (!authEnabled()) {
    warnings.push("Auth is not enforced. Set TIMLOCK_OWNER_PASSWORD before handing this app to subscribers.");
  }

  const counts = {
    jobs: store.jobs.length,
    vehicles: store.vehicles.length,
    auditLog: store.auditLog.length,
    aiFeedback: store.aiFeedback.length,
    shopRules: store.shopRules.length,
    vehicleProfiles: Array.isArray(vehicleProfiles.profiles) ? vehicleProfiles.profiles.length : 0,
    referenceVault: Array.isArray(referenceVault.entries) ? referenceVault.entries.length : 0,
    publicSources: Array.isArray(publicSources.sources) ? publicSources.sources.length : 0,
    proofAttachments: proofAttachments.attachments.length,
    proofAttachmentsR2: proofStorageCounts.r2,
    proofAttachmentsLocal: proofStorageCounts.local,
    proofAttachmentsUnknown: proofStorageCounts.unknown,
  };

  return {
    status: health.status === "ok" && warnings.length === 0 ? "durable" : warnings.length ? "needs-attention" : health.status,
    checkedAt: new Date().toISOString(),
    storage: {
      dataDirMode: dataDirExternal ? "external-data-dir" : "repo-local",
      mutableDataDir,
      storePath,
      attachmentMode,
      maxAttachmentBytes: attachmentUploadMaxBytes,
      privateProofFiles: String(process.env.TIMLOCK_PRIVATE_PROOF_FILES || "").toLowerCase() === "true",
      publicR2Preview:
        Boolean(cleanString(process.env.R2_PUBLIC_BASE_URL)) &&
        String(process.env.TIMLOCK_PRIVATE_PROOF_FILES || "").toLowerCase() !== "true" &&
        String(process.env.R2_PUBLIC_PREVIEW || "").toLowerCase() !== "false",
      r2,
      auth: {
        enabled: authEnabled(),
        ownerLoginConfigured: Boolean(authPasswordForRole("owner")),
        subscriberLoginConfigured: Boolean(authPasswordForRole("subscriber")),
      },
    },
    counts,
    warnings,
    backup: {
      serverBackupAvailable: true,
      includesJobs: true,
      includesAiMemory: true,
      includesProofAttachmentMetadata: true,
      includesProofAttachmentFiles: false,
      excluded: ["supplier account passwords", "raw proof file bytes"],
    },
    healthFiles: health.files,
  };
}

function missionToneFromScore(score) {
  const value = Number(score) || 0;
  if (value >= 82) return "ready";
  if (value >= 58) return "warn";
  return "danger";
}

function missionPercent(numerator, denominator) {
  const top = Number(numerator) || 0;
  const bottom = Number(denominator) || 0;
  return bottom ? Math.round((top / bottom) * 100) : 0;
}

function missionScorecard(label, value, detail = "", tone = "") {
  return {
    label: cleanString(label),
    value: cleanString(value),
    detail: cleanString(detail),
    tone: cleanString(tone) || "ready",
  };
}

function missionAttachmentJobIds(proofAttachments = {}) {
  return new Set(
    (proofAttachments.attachments || [])
      .map((attachment) => cleanString(attachment.jobId || attachment.jobID || attachment.job))
      .filter(Boolean),
  );
}

function missionQualityRecord(record = {}, partsReference = {}, attachmentJobIds = new Set()) {
  const job = record.job || record;
  const vehicle = record.vehicle || coverageVehicleForJob(job);
  const vins = record.vins || jobVins(job);
  const partNumbers = coveragePartNumbersForJob(job, partsReference);
  const outcome = record.outcome || partHistoryOutcome(job);
  const programmer = programmerDisplayName(job.programmer) || cleanString(job.programmer);
  const hasNotes = uniqueCleanValues([job.notes || [], job.note, job.service, job.keyCode, job.price]).length > 0;
  const hasAttachment = Boolean(job.id && attachmentJobIds.has(job.id));
  const gaps = uniqueCleanValues([
    vins.length ? "" : "VIN missing",
    vehicle.make && vehicle.model ? "" : "vehicle not parsed",
    partNumbers.length ? "" : "part number missing",
    programmer ? "" : "programmer missing",
    outcome?.key && outcome.key !== "unknown" ? "" : "outcome not scored",
    hasAttachment ? "" : "proof attachment missing",
    hasNotes ? "" : "job notes sparse",
  ]);
  const score = Math.min(
    100,
    Math.round(
      (vins.length ? 16 : 0) +
        (vehicle.make && vehicle.model ? 14 : 0) +
        (partNumbers.length ? 18 : 0) +
        (programmer ? 16 : 0) +
        (outcome?.key && outcome.key !== "unknown" ? 16 : 0) +
        (hasAttachment ? 12 : 0) +
        (hasNotes ? 8 : 0),
    ),
  );
  return {
    id: cleanString(job.id || record.id || record.title),
    title: cleanString(job.title || job.vehicle || record.title || vehicle.label || "Saved job"),
    vehicle: vehicle.label,
    vin: vins[0] || cleanString(job.vin),
    programmer,
    partNumbers: partNumbers.slice(0, 8),
    outcome: outcome?.label || outcome?.key || "",
    hasAttachment,
    score,
    tone: missionToneFromScore(score),
    gaps: gaps.slice(0, 6),
  };
}

function missionTopValueGroups(records = [], valueFn = () => []) {
  const counts = new Map();
  for (const record of records || []) {
    const raw = valueFn(record);
    const values = uniqueCleanValues(Array.isArray(raw) ? raw : [raw]);
    for (const value of values) {
      const compact = compactToken(value);
      if (!compact || compact.length < 3) continue;
      const current = counts.get(compact) || { value, count: 0 };
      current.count += 1;
      counts.set(compact, current);
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function missionConflictSummary(label, records = [], kind = "cluster") {
  const parts = missionTopValueGroups(records, (record) => trainingActualPartTokens(record));
  const programmers = missionTopValueGroups(records, (record) => record.programmer || record.job?.programmer || "");
  const outcomes = missionTopValueGroups(records, (record) => record.outcome?.label || record.outcome?.key || partHistoryOutcome(record.job || record).key);
  const families = missionTopValueGroups(records, (record) => trainingFamilyKey(record));
  const splitReasons = uniqueCleanValues([
    parts.length > 1 ? "part split" : "",
    programmers.length > 1 ? "programmer split" : "",
    outcomes.length > 1 ? "outcome split" : "",
    families.length > 1 ? "key family split" : "",
  ]);
  if (!splitReasons.length) return null;
  return {
    kind,
    label,
    jobs: records.length,
    severity: kind === "VIN" ? "high" : splitReasons.length > 1 ? "medium" : "low",
    reasons: splitReasons,
    parts: parts.slice(0, 4),
    programmers: programmers.slice(0, 4),
    outcomes: outcomes.slice(0, 4),
    families: families.slice(0, 4),
  };
}

function missionProofConflicts(index) {
  const conflicts = [];
  for (const [vin, records] of index.byVin.entries()) {
    if (records.length < 2) continue;
    const summary = missionConflictSummary(vin, records, "VIN");
    if (summary) conflicts.push(summary);
  }
  for (const [vehicleKey, records] of index.byVehicle.entries()) {
    if (!vehicleKey || records.length < 4) continue;
    const label = records.find((record) => record.vehicle?.label)?.vehicle?.label || vehicleKey;
    const summary = missionConflictSummary(label, records, "vehicle");
    if (summary) conflicts.push(summary);
  }
  const severityRank = { high: 0, medium: 1, low: 2 };
  return conflicts
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || b.jobs - a.jobs)
    .slice(0, 12);
}

function missionCodeDeskAudit(store = {}) {
  const records = store.codeDeskRecords || [];
  const systems = store.codeDeskSystems || [];
  const lessons = store.codeDeskLessons || [];
  const systemKeys = new Set(
    systems
      .flatMap((system) => [system.id, system.name, system.keyway, system.blanks || []])
      .flat(Infinity)
      .map(compactToken)
      .filter(Boolean),
  );
  const recordSystemCounts = new Map();
  for (const record of records) {
    const key = compactToken(record.system || record.keyway || record.blank || record.card);
    if (key) recordSystemCounts.set(key, (recordSystemCounts.get(key) || 0) + 1);
  }
  const orphanedRecords = records.filter((record) => {
    const key = compactToken(record.system || record.keyway || record.blank || record.card);
    return key && !systemKeys.has(key);
  });
  const systemsWithoutRecords = systems.filter((system) => {
    const keys = [system.id, system.name, system.keyway, system.blanks || []].flat(Infinity).map(compactToken).filter(Boolean);
    return keys.length && !keys.some((key) => recordSystemCounts.has(key));
  });
  const worked = lessons.filter((lesson) => /worked|confirmed|used|correct/.test(cleanString(lesson.outcome))).length;
  const wrong = lessons.filter((lesson) => /wrong|failed|reject|bad/.test(cleanString(lesson.outcome))).length;
  const score = Math.min(
    100,
    Math.round(
      (systems.length ? 26 : 0) +
        (records.length ? 30 : 0) +
        (lessons.length ? 18 : 0) +
        (records.length && !orphanedRecords.length ? 14 : 0) +
        (systems.length && !systemsWithoutRecords.length ? 12 : 0) -
        Math.min(25, wrong * 4),
    ),
  );
  return {
    score,
    tone: missionToneFromScore(score),
    records: records.length,
    systems: systems.length,
    lessons: lessons.length,
    worked,
    wrong,
    orphanedRecords: orphanedRecords.slice(0, 8).map((record) => ({
      system: record.system || record.keyway || "",
      code: record.code || "",
      bitting: record.bitting || "",
    })),
    systemsWithoutRecords: systemsWithoutRecords.slice(0, 8).map((system) => system.name || system.id),
    gaps: uniqueCleanValues([
      systems.length ? "" : "Import exact depth-space cards",
      records.length ? "" : "Import authorized code records",
      lessons.length ? "" : "Use Mark Worked / Flag Wrong to train Code Desk",
      orphanedRecords.length ? `${orphanedRecords.length} code record${orphanedRecords.length === 1 ? "" : "s"} do not match an imported card` : "",
      systemsWithoutRecords.length ? `${systemsWithoutRecords.length} card${systemsWithoutRecords.length === 1 ? "" : "s"} have no code records yet` : "",
    ]),
  };
}

function missionCoverageHotspots(coverage = {}) {
  const makeHotspots = (coverage.makes || [])
    .filter((item) => (item.jobs || 0) >= 2 && (item.observedCoveragePercent === null || Number(item.observedCoveragePercent || 0) < 80))
    .slice(0, 6)
    .map((item) => ({
      label: item.key,
      type: "Make",
      jobs: item.jobs,
      score: item.observedCoveragePercent ?? 0,
      detail: `${item.successes || 0} worked / ${item.warnings || 0} warnings / ${item.unknown || 0} unknown`,
    }));
  const partHotspots = (coverage.parts || [])
    .filter((item) => item.key !== "Part number not recorded" && (item.jobs || 0) >= 2 && (item.observedCoveragePercent === null || Number(item.observedCoveragePercent || 0) < 85))
    .slice(0, 6)
    .map((item) => ({
      label: item.key,
      type: "Part",
      jobs: item.jobs,
      score: item.observedCoveragePercent ?? 0,
      detail: `${item.vehicles?.slice(0, 2).join(", ") || "vehicles"} | ${item.programmers?.slice(0, 2).join(", ") || "programmer missing"}`,
    }));
  return [...makeHotspots, ...partHotspots].slice(0, 10);
}

function missionCleanupTask(title, detail, target = "coverage", impact = "medium", priority = 50) {
  return {
    title: cleanString(title),
    detail: cleanString(detail),
    target,
    impact,
    priority,
  };
}

function buildMissionIntelligenceAudit({ jobs = [], partsReference = {}, proofAttachments = {}, coverage = {}, store = {} } = {}) {
  const attachmentJobIds = missionAttachmentJobIds(proofAttachments);
  const index = buildJobEvidenceIndex(jobs, partsReference);
  const records = index.records.filter((record) => record.vehicle?.automotive || record.vins?.length || record.tokens?.length);
  const qualityRows = records.map((record) => missionQualityRecord(record, partsReference, attachmentJobIds));
  const averageQuality = qualityRows.length
    ? Math.round(qualityRows.reduce((sum, row) => sum + row.score, 0) / qualityRows.length)
    : 0;
  const weakJobs = qualityRows
    .filter((row) => row.score < 78 || row.gaps.length)
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
    .slice(0, 12);
  const conflicts = missionProofConflicts(index);
  const trainingRows = records
    .map((record) => buildTrainingBacktestRow(record, index))
    .filter(Boolean);
  const trainingReady = trainingRows.filter((row) => row.status === "ready").length;
  const trainingConflicts = trainingRows.filter((row) => row.status === "conflict").length;
  const trainingScore = trainingRows.length
    ? Math.round((trainingReady / trainingRows.length) * 100 - Math.min(20, trainingConflicts * 2))
    : 0;
  const codeDesk = missionCodeDeskAudit(store);
  const coverageSummary = coverage.summary || {};
  const coverageScore = Math.round(
    ((coverageSummary.observedCoveragePercent || 0) +
      (coverageSummary.programmerProofPercent || 0) +
      (coverageSummary.partProofPercent || 0) +
      (coverageSummary.crossReferencePercent || 0)) /
      4,
  );
  const conflictScore = Math.max(0, 100 - conflicts.filter((item) => item.severity === "high").length * 18 - conflicts.length * 5);
  const overall = Math.max(
    0,
    Math.min(100, Math.round(averageQuality * 0.32 + coverageScore * 0.24 + codeDesk.score * 0.18 + trainingScore * 0.16 + conflictScore * 0.1)),
  );
  const hotspots = missionCoverageHotspots(coverage);
  const cleanupQueue = [
    ...weakJobs.slice(0, 4).map((row) => missionCleanupTask(`Clean up ${row.vehicle || row.title}`, row.gaps.join(" | "), "learn", "high", 92 - row.score)),
    ...conflicts.slice(0, 3).map((conflict) => missionCleanupTask(`Resolve ${conflict.kind} conflict`, `${conflict.label}: ${conflict.reasons.join(", ")}`, "training-center", conflict.severity === "high" ? "high" : "medium", 88)),
    ...codeDesk.gaps.slice(0, 3).map((gap) => missionCleanupTask("Tighten Code Desk", gap, "code-desk", "medium", 78)),
    ...hotspots.slice(0, 3).map((item) => missionCleanupTask(`Improve ${item.type} coverage`, `${item.label}: ${item.detail}`, "coverage", "medium", 70)),
  ]
    .filter((task) => task.title && task.detail)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 12);
  return {
    generatedAt: new Date().toISOString(),
    title: "Shop Intelligence Audit",
    headline:
      overall >= 84
        ? "Shop intelligence is clean enough to trust as a decision layer."
        : overall >= 62
          ? "Shop intelligence is useful, but cleanup will lift confidence fast."
          : "Shop intelligence needs proof cleanup before it should drive subscriber decisions.",
    overall,
    tone: missionToneFromScore(overall),
    metrics: [
      missionScorecard("Job quality", `${averageQuality}%`, `${weakJobs.length} cleanup candidates`, missionToneFromScore(averageQuality)),
      missionScorecard("Coverage", `${coverageScore}%`, `${coverageSummary.automotiveJobs || 0} automotive jobs`, missionToneFromScore(coverageScore)),
      missionScorecard("Code Desk", `${codeDesk.score}%`, `${codeDesk.records} codes / ${codeDesk.systems} cards`, codeDesk.tone),
      missionScorecard("Backtest", `${Math.max(0, trainingScore)}%`, `${trainingReady}/${trainingRows.length} ready`, missionToneFromScore(trainingScore)),
      missionScorecard("Conflicts", `${conflictScore}%`, `${conflicts.length} split proof clusters`, missionToneFromScore(conflictScore)),
    ],
    weakJobs,
    conflicts,
    codeDesk,
    hotspots,
    cleanupQueue,
    rules: [
      "Exact VIN proof outranks VIN pattern, vehicle, and part-alias proof.",
      "A part number is not trusted until at least one job, cross-reference, or imported card supports it.",
      "Code Desk confidence rises only from authorized imports and owner marked outcomes.",
      "Subscriber screens should show the single best choice; owner screens keep the audit trail.",
    ],
  };
}

async function buildMissionControl(body = {}, store = { jobs: [] }) {
  const jobs = mergedSearchJobs(store.jobs || [], body.jobs || body.localJobs || []);
  const [
    health,
    storage,
    partsReference,
    lishiReference,
    proofAttachments,
    referenceVault,
    vehicleProfiles,
    publicSources,
    programmingReference,
    masterCatalog,
    keyInnovations,
  ] = await Promise.all([
    buildHealthStatus(),
    buildStorageStatus(),
    readPartsCrossReference(),
    readLishiMasterReference(),
    readProofAttachments(),
    readReferenceVault(),
    readVehicleProfiles(),
    readPublicReferenceSources(),
    readJsonCached(programmingReferencePath, { rows: [] }),
    readMasterCatalog().catch(() => ({ rows: [] })),
    readKeyInnovationsLabels().catch(() => ({ entries: [] })),
  ]);
  const coverage = buildCoverageDashboard(jobs, partsReference);
  const proofVault = buildProofVault("", jobs, partsReference);
  const advisor = buildAiAdvisor({
    jobs,
    partsReference,
    auditLog: store.auditLog,
    feedback: store.aiFeedback,
    shopRules: store.shopRules,
    preferences: store.aiPreferences,
    proofAttachments,
  });
  const codeBaseline = await buildAutoCodeBaseline({ limit: 24 }).catch(() => ({ totalRows: 0, returnedRows: 0, rows: [] }));
  const intelligenceAudit = buildMissionIntelligenceAudit({ jobs, partsReference, proofAttachments, coverage, store });
  const storageWarnings = storage.warnings || [];
  const healthIssues = (health.files || []).filter((file) => !file.ok && !file.optional);
  const coverageSummary = coverage.summary || {};
  const dataCounts = {
    savedJobs: jobs.length,
    automotiveJobs: coverageSummary.automotiveJobs || 0,
    proofAttachments: proofAttachments.attachments?.length || 0,
    partsRows: partsReference.totalRows || partsReference.rows?.length || 0,
    partTokens: partsReference.totalTokens || Object.keys(partsReference.tokenIndex || {}).length,
    lishiTools: lishiReference.tools?.length || 0,
    lishiApplications: lishiReference.applications?.length || 0,
    programmingRows: programmingReference.rows?.length || 0,
    codeBaselineRows: codeBaseline.totalRows || codeBaseline.rows?.length || 0,
    masterCatalogRows: masterCatalog.rows?.length || 0,
    keyInnovationLabels: keyInnovations.entries?.length || 0,
    referenceVault: referenceVault.entries?.length || 0,
    vehicleProfiles: vehicleProfiles.profiles?.length || 0,
    publicSources: publicSources.sources?.length || 0,
    aiFeedback: store.aiFeedback?.length || 0,
    shopRules: store.shopRules?.length || 0,
    codeDeskRecords: store.codeDeskRecords?.length || 0,
    codeDeskSystems: store.codeDeskSystems?.length || 0,
    codeDeskLessons: store.codeDeskLessons?.length || 0,
  };
  const storageScore =
    storage.status === "durable"
      ? 100
      : storage.storage?.attachmentMode === "cloudflare-r2" || storage.storage?.dataDirMode === "external-data-dir"
        ? 78
        : 48;
  const healthScore = health.status === "ok" ? 100 : 45;
  const authScore = storage.storage?.auth?.enabled ? 100 : 42;
  const coverageScore = Math.round(
    ((coverageSummary.observedCoveragePercent || 0) +
      (coverageSummary.programmerProofPercent || 0) +
      (coverageSummary.partProofPercent || 0) +
      (coverageSummary.crossReferencePercent || 0)) /
      4,
  );
  const dataScore = Math.min(
    100,
    Math.round(
      (dataCounts.partsRows ? 18 : 0) +
        (dataCounts.programmingRows ? 18 : 0) +
        (dataCounts.lishiTools ? 14 : 0) +
        (dataCounts.masterCatalogRows ? 14 : 0) +
        (dataCounts.keyInnovationLabels ? 10 : 0) +
        (dataCounts.referenceVault ? 8 : 0) +
        (dataCounts.vehicleProfiles ? 8 : 0) +
        (dataCounts.publicSources ? 10 : 0),
    ),
  );
  const aiScore = Math.min(100, Math.round((advisor.readinessScore || 0) * 0.8 + Math.min(20, dataCounts.aiFeedback + dataCounts.shopRules)));
  const readinessScore = Math.round(healthScore * 0.18 + storageScore * 0.16 + authScore * 0.12 + coverageScore * 0.2 + dataScore * 0.2 + aiScore * 0.14);
  const riskQueue = uniqueCleanValues([
    ...storageWarnings,
    ...healthIssues.map((file) => `${file.label} needs attention: ${file.error || "not readable"}`),
    ...(coverage.gaps?.missingProgrammer || []).slice(0, 3).map((job) => `Add programmer proof: ${job.vehicle || job.title || job.id}`),
    ...(coverage.gaps?.missingPart || []).slice(0, 3).map((job) => `Add part proof: ${job.vehicle || job.title || job.id}`),
    ...(coverage.gaps?.needsOutcome || []).slice(0, 3).map((job) => `Score job outcome: ${job.vehicle || job.title || job.id}`),
    ...(intelligenceAudit.conflicts || []).slice(0, 3).map((conflict) => `Resolve ${conflict.kind} proof conflict: ${conflict.label}`),
    ...(intelligenceAudit.codeDesk?.gaps || []).slice(0, 2).map((gap) => `Code Desk: ${gap}`),
    ...(dataCounts.proofAttachments ? [] : ["Proof Vault has no server-backed attachment metadata yet."]),
  ]).slice(0, 12);
  const actionStack = [
    ...(intelligenceAudit.cleanupQueue || []).slice(0, 4).map((task) => ({
      label: task.title,
      target: task.target,
      detail: task.detail,
      priority: task.priority || 82,
    })),
    {
      label: "Build AI Field Packet",
      target: "ai",
      detail: "Open the AI Bench and create a printable technician command packet.",
      priority: 95,
    },
    {
      label: "Open Workbench",
      target: "workbench",
      detail: "Pull parts, proof, Lishi, Code Desk, and coverage into one job packet.",
      priority: 92,
    },
    {
      label: "Search Proof Vault",
      target: "proof-vault",
      detail: "Find saved job proof and attach missing authorization/photos.",
      priority: 88,
    },
    {
      label: "Review Coverage",
      target: "coverage",
      detail: "See programmer, part, and make-level proof percentages.",
      priority: 84,
    },
    {
      label: "Reference Lists",
      target: "reference-lists",
      detail: "Inspect the raw data powering parts, Lishi, programming, and catalogs.",
      priority: 76,
    },
    {
      label: "Storage Settings",
      target: "settings",
      detail: "Check auth, backups, R2/persistent storage, and attachment durability.",
      priority: storageWarnings.length ? 98 : 68,
    },
  ].sort((a, b) => b.priority - a.priority).slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    title: "TimLock Mission Control",
    headline:
      readinessScore >= 82
        ? "Platform is field-ready and scaling cleanly."
        : readinessScore >= 58
          ? "Platform is strong, with a few proof/storage gaps to tighten."
          : "Platform needs backend/proof cleanup before subscriber-grade use.",
    readinessScore,
    readinessLabel: aiReadinessLabel(readinessScore),
    scorecards: [
      missionScorecard("Backend", `${healthScore}%`, health.summary || "Health checked", missionToneFromScore(healthScore)),
      missionScorecard("Storage", `${storageScore}%`, storage.storage?.attachmentMode || "storage checked", missionToneFromScore(storageScore)),
      missionScorecard("Auth", `${authScore}%`, storage.storage?.auth?.enabled ? "Protection active" : "Protection not enforced", missionToneFromScore(authScore)),
      missionScorecard("Proof", `${coverageScore}%`, `${coverageSummary.automotiveJobs || 0} automotive jobs`, missionToneFromScore(coverageScore)),
      missionScorecard("Data", `${dataScore}%`, `${dataCounts.partsRows} parts rows / ${dataCounts.programmingRows} programming rows`, missionToneFromScore(dataScore)),
      missionScorecard("AI", `${aiScore}%`, advisor.headline || "AI advisor ready", missionToneFromScore(aiScore)),
      missionScorecard("Intel", `${intelligenceAudit.overall}%`, `${intelligenceAudit.cleanupQueue?.length || 0} cleanup moves`, intelligenceAudit.tone),
    ],
    pillars: [
      {
        id: "backend",
        title: "Backend Core",
        score: healthScore,
        tone: missionToneFromScore(healthScore),
        facts: [
          `${(health.files || []).filter((file) => file.ok).length}/${(health.files || []).length} data files readable`,
          `Booted ${bootedAt}`,
          `${healthIssues.length} health issue${healthIssues.length === 1 ? "" : "s"}`,
        ],
      },
      {
        id: "storage",
        title: "Storage + Security",
        score: storageScore,
        tone: missionToneFromScore(storageScore),
        facts: [
          `Data: ${storage.storage?.dataDirMode || "unknown"}`,
          `Proof files: ${storage.storage?.attachmentMode || "unknown"}`,
          storage.storage?.auth?.enabled ? "Auth enabled" : "Auth disabled",
        ],
      },
      {
        id: "proof",
        title: "Proof Engine",
        score: coverageScore,
        tone: missionToneFromScore(coverageScore),
        facts: [
          `${coverageSummary.observedCoveragePercent || 0}% observed success proof`,
          `${coverageSummary.programmerProofPercent || 0}% programmer proof`,
          `${coverageSummary.partProofPercent || 0}% part proof`,
        ],
      },
      {
        id: "ai",
        title: "AI Learning",
        score: aiScore,
        tone: missionToneFromScore(aiScore),
        facts: [
          `${dataCounts.aiFeedback} AI feedback marks`,
          `${dataCounts.shopRules} shop rules`,
          advisor.topAction?.title || "No urgent AI action",
        ],
      },
    ],
    dataMap: dataCounts,
    intelligenceAudit,
    coverageSnapshot: {
      summary: coverageSummary,
      topProgrammers: (coverage.programmers || []).slice(0, 5),
      topMakes: (coverage.makes || []).slice(0, 5),
      proofNote: coverage.proofNote,
    },
    proofSnapshot: {
      totalJobs: proofVault.summary?.totalJobs || 0,
      shownJobs: proofVault.summary?.shownJobs || 0,
      proofAttachments: dataCounts.proofAttachments,
      recent: (proofVault.records || []).slice(0, 5).map((record) => ({
        id: record.id,
        vehicle: record.vehicle,
        vin: record.vin,
        programmer: record.programmer,
        outcome: record.outcome?.label || record.outcome?.key || "",
        parts: (record.partNumbers || []).slice(0, 4),
      })),
    },
    riskQueue,
    actionStack,
    aiSnapshot: {
      readinessScore: advisor.readinessScore,
      headline: advisor.headline,
      topAction: advisor.topAction,
      summary: advisor.summary || [],
      memory: advisor.memory || {},
    },
    releaseBrief: [
      "Mission Control now gives the owner one operational dashboard for backend health, proof readiness, data coverage, storage, auth, and AI learning.",
      "The Shop Intelligence Audit finds weak proof, split evidence, Code Desk gaps, and exact cleanup moves before subscribers see bad recommendations.",
      "Use the risk queue as the nightly cleanup list and the action stack as the fastest path back into the exact app tools.",
      "Readiness percentages are shop-operational signals, not locksmith code/license guarantees.",
    ],
  };
}

function trainingTokenSet(values = []) {
  return new Set(uniqueCleanValues(Array.isArray(values) ? values : [values]).map(compactToken).filter((token) => token.length >= 4));
}

function trainingTokensOverlap(left = [], right = []) {
  const leftSet = trainingTokenSet(left);
  const rightTokens = Array.from(trainingTokenSet(right));
  return rightTokens.some((token) => leftSet.has(token) || Array.from(leftSet).some((item) => item.includes(token) || token.includes(item)));
}

function trainingTopCounts(records = [], valueFn = () => []) {
  const counts = new Map();
  for (const record of records || []) {
    const rawValues = valueFn(record);
    for (const value of uniqueCleanValues(Array.isArray(rawValues) ? rawValues : [rawValues])) {
      const key = compactToken(value);
      if (!key || key.length < 4) continue;
      const current = counts.get(key) || { value, count: 0, examples: [] };
      current.count += 1;
      if (record.title && current.examples.length < 3) current.examples.push(record.title);
      counts.set(key, current);
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function trainingPeerRecords(index, record) {
  const withoutSelf = (records = []) => uniqueById(records.filter((item) => item.id !== record.id), (item) => item.id || item.title);
  const exactVin = withoutSelf((record.vins || []).flatMap((vin) => index.byVin.get(vin) || []));
  const vinPattern = withoutSelf((record.patternKeys || []).flatMap((key) => index.byPattern.get(key) || []));
  const vehicle = withoutSelf(index.byVehicle.get(String(record.vehicleKey || "").toUpperCase()) || []);
  const part = withoutSelf((record.tokens || []).flatMap((token) => index.byToken.get(compactToken(token)) || []));
  if (exactVin.length) return { source: "Exact VIN peers", records: exactVin, baseConfidence: 96 };
  if (vinPattern.length) return { source: "VIN pattern peers", records: vinPattern, baseConfidence: 84 };
  if (vehicle.length) return { source: "Vehicle peers", records: vehicle, baseConfidence: 72 };
  if (part.length) return { source: "Part token peers", records: part, baseConfidence: 64 };
  return { source: "No peers", records: [], baseConfidence: 35 };
}

function trainingActualPartTokens(record = {}) {
  return uniqueCleanValues([
    record.proofPatternRecord?.partTokens || [],
    record.tokens || [],
  ]).filter((value) => {
    const token = compactToken(value);
    if (token.length < 4) return false;
    if (normalizeVinCandidate(value)) return false;
    if (/^(?:ADD|AKL|AUTO|FIELD|LOCK|LOCKOUT|SERVICE|WORKED|COMPLETED|OUTCOMEWORKED|PARTOUTCOME)$/.test(token)) return false;
    return /\d/.test(token);
  });
}

function trainingFamilyKey(record = {}) {
  return record.proofPatternRecord?.ignitionFamily?.expectedFamily || record.proofPatternRecord?.ignitionFamily?.key || "unknown";
}

function buildTrainingBacktestRow(record, index) {
  const peers = trainingPeerRecords(index, record);
  const actualParts = trainingActualPartTokens(record);
  const predictedParts = trainingTopCounts(peers.records, (item) => trainingActualPartTokens(item));
  const predictedProgrammers = trainingTopCounts(peers.records, (item) => item.programmer || item.job?.programmer || "");
  const predictedFamilies = trainingTopCounts(peers.records, (item) => trainingFamilyKey(item));
  const predictedPart = predictedParts[0] || null;
  const predictedProgrammer = predictedProgrammers[0] || null;
  const predictedFamily = predictedFamilies[0] || null;
  const actualProgrammer = cleanString(record.programmer || record.job?.programmer);
  const actualFamily = trainingFamilyKey(record);
  const partHit = Boolean(predictedPart?.value && trainingTokensOverlap([predictedPart.value], actualParts));
  const programmerHit = Boolean(
    predictedProgrammer?.value &&
      actualProgrammer &&
      compactToken(predictedProgrammer.value) === compactToken(programmerDisplayName(actualProgrammer) || actualProgrammer),
  );
  const familyHit = Boolean(predictedFamily?.value && compactToken(predictedFamily.value) === compactToken(actualFamily));
  const confidence = Math.min(
    100,
    Math.round(peers.baseConfidence + Math.min(peers.records.length * 3, 12) + (partHit ? 4 : 0) + (programmerHit ? 4 : 0) + (familyHit ? 2 : 0)),
  );
  const hasActualPart = actualParts.length > 0;
  const status = !peers.records.length || !hasActualPart
    ? "needs-proof"
    : partHit && (programmerHit || !actualProgrammer)
      ? "ready"
      : "conflict";
  const blockers = uniqueCleanValues([
    !hasActualPart ? "Missing part identifier" : "",
    !peers.records.length ? "No peer proof" : "",
    predictedPart && !partHit ? "Part mismatch" : "",
    actualProgrammer && predictedProgrammer && !programmerHit ? "Programmer mismatch" : "",
    predictedFamily && !familyHit ? "Key type mismatch" : "",
  ]);
  return {
    id: record.id,
    title: record.title,
    vehicle: record.vehicle?.label || record.job?.vehicle || "",
    vin: record.vins?.[0] || record.job?.vin || "",
    outcome: record.outcome?.label || record.outcome?.key || "",
    source: peers.source,
    peerCount: peers.records.length,
    confidence,
    status,
    blockers,
    actual: {
      part: actualParts[0] || "",
      parts: actualParts.slice(0, 8),
      programmer: actualProgrammer,
      family: actualFamily,
    },
    predicted: {
      part: predictedPart?.value || "",
      partCount: predictedPart?.count || 0,
      programmer: predictedProgrammer?.value || "",
      programmerCount: predictedProgrammer?.count || 0,
      family: predictedFamily?.value || "",
      familyCount: predictedFamily?.count || 0,
    },
  };
}

function buildTrainingClusterConflicts(rows = []) {
  const clusters = new Map();
  for (const row of rows) {
    const key = compactToken(row.vehicle || row.vin || row.title);
    if (!key) continue;
    const cluster = clusters.get(key) || { label: row.vehicle || row.vin || row.title, rows: [] };
    cluster.rows.push(row);
    clusters.set(key, cluster);
  }
  return Array.from(clusters.values())
    .map((cluster) => {
      const parts = trainingTopCounts(cluster.rows, (row) => row.actual?.parts || row.actual?.part || []);
      const programmers = trainingTopCounts(cluster.rows, (row) => row.actual?.programmer || "");
      return {
        label: cluster.label,
        jobs: cluster.rows.length,
        parts: parts.slice(0, 4),
        programmers: programmers.slice(0, 4),
        conflict:
          parts.length > 1 && parts[0].count === parts[1].count
            ? "Part split"
            : programmers.length > 1 && programmers[0].count === programmers[1].count
              ? "Programmer split"
              : "",
      };
    })
    .filter((cluster) => cluster.conflict)
    .slice(0, 12);
}

async function buildTrainingCenter(body = {}, store = { jobs: [] }) {
  const jobs = mergedSearchJobs(store.jobs || [], body.jobs || body.localJobs || []);
  const partsReference = await readPartsCrossReference();
  const index = buildJobEvidenceIndex(jobs, partsReference);
  const rows = index.records
    .filter((record) => record.vehicle?.automotive || record.vins?.length)
    .map((record) => buildTrainingBacktestRow(record, index))
    .sort((a, b) => {
      const statusRank = { conflict: 0, "needs-proof": 1, ready: 2 };
      return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || a.confidence - b.confidence;
    });
  const tested = rows.length;
  const ready = rows.filter((row) => row.status === "ready").length;
  const conflicts = rows.filter((row) => row.status === "conflict").length;
  const needsProof = rows.filter((row) => row.status === "needs-proof").length;
  const partRows = rows.filter((row) => row.actual.parts?.length && row.predicted.part);
  const programmerRows = rows.filter((row) => row.actual.programmer && row.predicted.programmer);
  const partCorrect = partRows.filter((row) => trainingTokensOverlap([row.predicted.part], row.actual.parts)).length;
  const programmerCorrect = programmerRows.filter((row) => compactToken(row.predicted.programmer) === compactToken(programmerDisplayName(row.actual.programmer) || row.actual.programmer)).length;
  const averageConfidence = tested ? Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / tested) : 0;
  return {
    generatedAt: new Date().toISOString(),
    title: "Decision Engine Training Center",
    summary: {
      testedJobs: tested,
      ready,
      conflicts,
      needsProof,
      averageConfidence,
      partAccuracy: partRows.length ? Math.round((partCorrect / partRows.length) * 100) : 0,
      programmerAccuracy: programmerRows.length ? Math.round((programmerCorrect / programmerRows.length) * 100) : 0,
      aiFeedback: store.aiFeedback?.length || 0,
      shopRules: store.shopRules?.length || 0,
    },
    rows: rows.slice(0, 80),
    weakRecords: rows.filter((row) => row.status !== "ready" || row.confidence < 70).slice(0, 16),
    conflicts: buildTrainingClusterConflicts(rows),
    guidance: [
      "Backtest uses saved/imported proof as the shop truth baseline.",
      "Exact VIN peers rank first, then VIN pattern, vehicle, and part-token peers.",
      "Teach AI marks owner review history; saving corrected worked jobs remains the strongest training signal.",
    ],
  };
}

function trainingFeedbackFromBody(body = {}) {
  const verdict = cleanString(body.verdict || body.value || "used").toLowerCase();
  const jobId = cleanString(body.jobId || body.id);
  return cleanAiFeedback({
    value: verdict === "wrong" || verdict === "conflict" ? "wrong" : "used",
    title: `Training review${jobId ? `: ${jobId}` : ""}`,
    note: cleanString(body.note || (verdict === "wrong" ? "Owner marked this Decision Engine row for correction." : "Owner confirmed this training row.")),
    prompt: jobId,
    target: "training-center",
    contextSummary: body.contextSummary || [],
  });
}

async function teachTrainingCenter(body = {}, store = { aiFeedback: [], shopRules: [] }) {
  const feedback = trainingFeedbackFromBody(body);
  store.aiFeedback.unshift(feedback);
  store.aiFeedback = store.aiFeedback.slice(0, 1000);
  let rule = null;
  if (body.saveRule || body.ruleBody || body.ruleTitle) {
    rule = cleanShopRule(
      {
        title: body.ruleTitle || feedback.note || feedback.title,
        body: body.ruleBody || feedback.note || feedback.title,
        target: "training-center",
        tags: uniqueCleanValues(["training-center", body.verdict || body.value || "", body.tags || []]),
        contextSummary: feedback.contextSummary,
      },
      feedback,
    );
    store.shopRules.unshift(rule);
    store.shopRules = store.shopRules.slice(0, 500);
  }
  await writeStore(store);
  return { feedback, rule, memory: aiMemorySummary(store, {}, "") };
}

async function buildStorageExport() {
  const [status, store, vehicleProfiles, referenceVault, publicReferenceSources, proofAttachments, supplierAccounts] = await Promise.all([
    buildStorageStatus(),
    readStore(),
    readVehicleProfiles(),
    readReferenceVault(),
    readPublicReferenceSources(),
    readProofAttachments(),
    readSupplierAccounts(),
  ]);
  return {
    schemaVersion: 1,
    kind: "timlock-server-backup",
    exportedAt: new Date().toISOString(),
    status,
    data: {
      store,
      vehicleProfiles,
      referenceVault,
      publicReferenceSources,
      proofAttachments,
      supplierAccounts: {
        note: "Passwords are not exported.",
        accounts: supplierAccounts.accounts.map(publicSupplierAccount),
      },
    },
    notes: [
      "Proof attachment metadata is included. Local/R2 file objects are not embedded in this JSON backup.",
      "Use Cloudflare R2 for proof files that need to follow the account across devices.",
    ],
  };
}

async function importStorageBundle(body = {}) {
  const bundle = body.bundle && typeof body.bundle === "object" ? body.bundle : body;
  const data = bundle.data && typeof bundle.data === "object" ? bundle.data : bundle;
  const replace = Boolean(body.replace || bundle.replace || body.mode === "replace" || bundle.mode === "replace");
  const result = {};

  if (data.store || data.jobs || data.aiFeedback || data.shopRules) {
    const current = await readStore();
    const incoming = data.store || {
      jobs: data.jobs,
      vehicles: data.vehicles,
      auditLog: data.auditLog,
      aiFeedback: data.aiFeedback,
      shopRules: data.shopRules,
      aiPreferences: data.aiPreferences,
    };
    const next = mergeStorageStore(current, incoming, replace);
    await writeStore(next);
    result.store = {
      jobs: next.jobs.length,
      auditLog: next.auditLog.length,
      aiFeedback: next.aiFeedback.length,
      shopRules: next.shopRules.length,
    };
  }

  if (data.vehicleProfiles) {
    const current = await readVehicleProfiles();
    const next = mergeStoragePayloadArray(current, data.vehicleProfiles, "profiles", ["id", "vin", "year", "make", "model"], "vehicle-profile", replace);
    await writeVehicleProfiles(next);
    result.vehicleProfiles = next.profiles.length;
  }

  if (data.referenceVault) {
    const current = await readReferenceVault();
    const next = mergeStoragePayloadArray(current, data.referenceVault, "entries", ["id", "title", "vehicle", "keyway"], "reference-vault", replace);
    await writeReferenceVault(next);
    result.referenceVault = next.entries.length;
  }

  if (data.publicReferenceSources) {
    const current = await readPublicReferenceSources();
    const next = mergePublicReferenceSources(current, data.publicReferenceSources, replace);
    await writePublicReferenceSources(next);
    result.publicReferenceSources = {
      sources: next.sources?.length || 0,
      communityEvidence: next.communityEvidence?.length || 0,
      autelProducts: next.autel?.products?.length || 0,
      autelCoverage: next.autel?.coverage?.length || 0,
    };
  }

  if (data.proofAttachments) {
    const current = await readProofAttachments();
    const incoming = {
      ...data.proofAttachments,
      attachments: (Array.isArray(data.proofAttachments.attachments) ? data.proofAttachments.attachments : []).filter((attachment) => attachment?.id && attachment?.key),
    };
    const next = mergeStoragePayloadArray(current, incoming, "attachments", ["id", "jobId", "key"], "proof-attachment", replace);
    await writeProofAttachments(next);
    result.proofAttachments = next.attachments.length;
  }

  if (!Object.keys(result).length) {
    throw new Error("Backup did not contain recognized TimLock server data.");
  }

  return {
    importedAt: new Date().toISOString(),
    mode: replace ? "replace" : "merge",
    result,
    status: await buildStorageStatus(),
  };
}

async function decodeVinWithTimeout(vin) {
  const decodeUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const payload = await fetchJson(decodeUrl, { signal: AbortSignal.timeout(8000) });
  return payload.Results?.[0] || null;
}

async function localVinDecodeFallback(vin, error) {
  const parsed = parseVin(vin);
  try {
    const reference = JSON.parse(await readFile(vinReferencePath, "utf8"));
    const exact = (reference.rows || []).find((row) => row.vin === vin);
    if (exact) {
      return {
        ModelYear: exact.year,
        Make: exact.make,
        Model: exact.model,
        Trim: exact.trim,
        BodyClass: exact.bodyClass,
        DriveType: exact.driveType,
        PlantCity: exact.plantCity,
        PlantCountry: exact.plantCountry,
        ErrorCode: "LOCAL",
        ErrorText: `Loaded from local VIN reference because NHTSA was unavailable: ${error.message}`,
      };
    }
  } catch {}

  return {
    ModelYear: parsed.derivedModelYear,
    Make: "",
    Model: "",
    ErrorCode: "LOCAL",
    ErrorText: `NHTSA was unavailable and this VIN is not in the local reference cache: ${error.message}`,
  };
}

function sendBuffer(response, statusCode, buffer, contentType = "application/octet-stream", headers = {}) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Cache-Control": "private, max-age=300",
    "Content-Type": contentType,
    ...headers,
  });
  response.end(buffer);
}

function sanitizeStorageSegment(value) {
  return cleanString(value)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function attachmentPublicFields(attachment) {
  const publicBase = cleanString(process.env.R2_PUBLIC_BASE_URL).replace(/\/$/, "");
  const allowPublicR2Preview =
    publicBase &&
    attachment.storage === "r2" &&
    String(process.env.TIMLOCK_PRIVATE_PROOF_FILES || "").toLowerCase() !== "true" &&
    String(process.env.R2_PUBLIC_PREVIEW || "").toLowerCase() !== "false";
  return {
    id: attachment.id,
    sourceId: attachment.sourceId || "",
    jobId: attachment.jobId,
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    createdAt: attachment.createdAt,
    migratedAt: attachment.migratedAt || "",
    storage: attachment.storage,
    previewUrl: allowPublicR2Preview ? `${publicBase}/${attachment.key.split("/").map(encodeURIComponent).join("/")}` : `/api/proof-vault/attachments/${attachment.id}/file`,
  };
}

function groupAttachmentsByJob(attachments = []) {
  return attachments.reduce((groups, attachment) => {
    const jobId = attachment.jobId || "unlinked";
    groups[jobId] ||= [];
    groups[jobId].push(attachmentPublicFields(attachment));
    return groups;
  }, {});
}

function proofAttachmentStorageMode() {
  if (r2Config()) return "cloudflare-r2";
  return "local-file";
}

function proofAttachmentStorageCounts(attachments = []) {
  return attachments.reduce(
    (counts, attachment) => {
      const storage = attachment.storage === "r2" ? "r2" : attachment.storage === "local" ? "local" : "unknown";
      counts[storage] += 1;
      return counts;
    },
    { r2: 0, local: 0, unknown: 0 },
  );
}

async function readProofAttachments() {
  await mkdir(mutableDataDir, { recursive: true });
  if (!existsSync(proofAttachmentsPath)) {
    return { version: 1, updatedAt: new Date().toISOString(), attachments: [] };
  }
  const vault = JSON.parse(await readFile(proofAttachmentsPath, "utf8"));
  return {
    version: vault.version || 1,
    updatedAt: vault.updatedAt || "",
    attachments: Array.isArray(vault.attachments) ? vault.attachments : [],
  };
}

async function writeProofAttachments(vault) {
  await mkdir(mutableDataDir, { recursive: true });
  await writeFile(proofAttachmentsPath, `${JSON.stringify({ ...vault, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new Error("Attachment upload must include a data URL.");
  const type = cleanString(match[1] || "application/octet-stream");
  const payload = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return { type, buffer: payload };
}

function r2Config() {
  const accountId = cleanString(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID);
  const bucket = cleanString(process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET);
  const accessKeyId = cleanString(process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  const secretAccessKey = cleanString(process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  const host = cleanString(process.env.R2_ENDPOINT || `${accountId}.r2.cloudflarestorage.com`).replace(/^https?:\/\//, "").replace(/\/$/, "");
  return { accountId, bucket, accessKeyId, secretAccessKey, host };
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function r2ObjectPath(config, key) {
  return `/${encodeURIComponent(config.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function r2SignedHeaders(config, method, key, body = Buffer.alloc(0), contentType = "") {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = r2ObjectPath(config, key);
  const payloadHash = sha256Hex(body);
  const headers = {
    host: config.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${headers[name]}\n`)
    .join("");
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  return {
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    url: `https://${config.host}${canonicalUri}`,
  };
}

async function r2Request(method, key, body = Buffer.alloc(0), contentType = "") {
  const config = r2Config();
  if (!config) throw new Error("Cloudflare R2 is not configured.");
  const signed = r2SignedHeaders(config, method, key, body, contentType);
  const response = await fetch(signed.url, {
    method,
    headers: signed.headers,
    body: method === "GET" || method === "DELETE" ? undefined : body,
  });
  if (!response.ok) {
    throw new Error(`R2 ${method} failed with ${response.status}`);
  }
  return response;
}

async function storeProofAttachmentFile(attachment, buffer) {
  const config = r2Config();
  if (config) {
    await r2Request("PUT", attachment.key, buffer, attachment.type);
    return { ...attachment, storage: "r2" };
  }
  await mkdir(proofAttachmentFileDir, { recursive: true });
  const filePath = path.join(proofAttachmentFileDir, attachment.key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return { ...attachment, storage: "local" };
}

async function readProofAttachmentFile(attachment) {
  if (attachment.storage === "r2") {
    const response = await r2Request("GET", attachment.key);
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(path.join(proofAttachmentFileDir, attachment.key));
}

async function deleteProofAttachmentFile(attachment) {
  try {
    if (attachment.storage === "r2") await r2Request("DELETE", attachment.key);
    else await unlink(path.join(proofAttachmentFileDir, attachment.key));
  } catch {
    // Missing file/object should not leave stale metadata behind.
  }
}

function cleanProofAttachmentId(value) {
  const id = sanitizeStorageSegment(value);
  return id && id.length >= 6 ? id : randomUUID();
}

async function saveProofAttachmentUpload(body = {}, vault = null) {
  const jobId = cleanString(body.jobId);
  if (!jobId) throw new Error("Attachment needs a saved job id.");
  const parsed = dataUrlToBuffer(body.dataUrl);
  if (!parsed.buffer.length) throw new Error("Attachment file is empty.");
  if (parsed.buffer.length > attachmentUploadMaxBytes) {
    throw new Error(`Attachment is over ${Math.round(attachmentUploadMaxBytes / 1_000_000)} MB.`);
  }

  const workingVault = vault || (await readProofAttachments());
  const sourceId = cleanString(body.sourceId || body.id);
  const existing = sourceId
    ? workingVault.attachments.find((attachment) => attachment.id === sourceId || attachment.sourceId === sourceId)
    : null;
  if (existing) {
    return { attachment: existing, sourceId, skipped: true };
  }

  let id = cleanProofAttachmentId(body.id);
  if (workingVault.attachments.some((attachment) => attachment.id === id)) id = randomUUID();
  const name = sanitizeStorageSegment(body.name) || `proof-${id}`;
  const type = cleanString(body.type || parsed.type || "application/octet-stream");
  const createdAt = cleanString(body.createdAt) || new Date().toISOString();
  const attachment = await storeProofAttachmentFile(
    {
      id,
      sourceId: sourceId && sourceId !== id ? sourceId : "",
      jobId,
      name,
      type,
      size: parsed.buffer.length,
      key: `proof-vault/${sanitizeStorageSegment(jobId) || "unlinked"}/${id}-${name}`,
      createdAt,
      migratedAt: body.migrated ? new Date().toISOString() : "",
    },
    parsed.buffer,
  );
  workingVault.attachments.unshift(attachment);
  if (!vault) await writeProofAttachments(workingVault);
  return { attachment, sourceId: sourceId || id, skipped: false };
}

async function runStorageDiagnostics() {
  const tests = [];
  const startedAt = new Date().toISOString();
  const id = randomUUID();
  const testPayload = Buffer.from(`timlock-storage-test:${id}`);

  async function capture(label, fn) {
    const started = Date.now();
    try {
      const detail = await fn();
      tests.push({ label, ok: true, ms: Date.now() - started, detail: detail || "" });
    } catch (error) {
      tests.push({ label, ok: false, ms: Date.now() - started, error: error.message });
    }
  }

  await capture("Writable job data directory", async () => {
    await mkdir(mutableDataDir, { recursive: true });
    const filePath = path.join(mutableDataDir, `.storage-test-${id}.txt`);
    await writeFile(filePath, testPayload);
    const readBack = await readFile(filePath);
    await unlink(filePath);
    if (!readBack.equals(testPayload)) throw new Error("Read-back mismatch.");
    return mutableDataDir;
  });

  if (r2Config()) {
    await capture("Cloudflare R2 proof round-trip", async () => {
      const key = `diagnostics/${id}.txt`;
      await r2Request("PUT", key, testPayload, "text/plain");
      const response = await r2Request("GET", key);
      const readBack = Buffer.from(await response.arrayBuffer());
      await r2Request("DELETE", key);
      if (!readBack.equals(testPayload)) throw new Error("R2 read-back mismatch.");
      return "PUT/GET/DELETE passed";
    });
  } else {
    await capture("Server-local proof file round-trip", async () => {
      const key = `diagnostics/${id}.txt`;
      const filePath = path.join(proofAttachmentFileDir, key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, testPayload);
      const readBack = await readFile(filePath);
      await unlink(filePath);
      if (!readBack.equals(testPayload)) throw new Error("Local proof read-back mismatch.");
      return proofAttachmentFileDir;
    });
  }

  const vault = await readProofAttachments();
  const sample = vault.attachments.slice(0, 5);
  let readable = 0;
  let missing = 0;
  for (const attachment of sample) {
    try {
      const file = await readProofAttachmentFile(attachment);
      if (file.length >= 0) readable += 1;
    } catch {
      missing += 1;
    }
  }

  const failed = tests.filter((test) => !test.ok);
  const warnings = [];
  if (missing) warnings.push(`${missing} sampled proof file${missing === 1 ? "" : "s"} could not be read.`);
  if (!r2Config()) warnings.push("R2 is not configured; proof files are not cloud-backed yet.");

  return {
    status: failed.length ? "failed" : warnings.length ? "warning" : "passed",
    startedAt,
    checkedAt: new Date().toISOString(),
    storage: proofAttachmentStorageMode(),
    tests,
    sample: {
      checked: sample.length,
      readable,
      missing,
    },
    warnings,
  };
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
  const jobInput = input.job || {};
  const outcome = cleanString(input.outcome || "worked").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "worked";
  const outcomeLabels = {
    worked: "Worked",
    "failed-program": "Did not program",
    "wrong-fcc": "Wrong FCC",
    "wrong-buttons": "Wrong buttons",
    "ordered-alternate": "Ordered alternate",
    "different-key-style": "Customer had different key style",
  };
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
    part.lishi || jobInput.lishi ? `Lishi ${cleanString(part.lishi || jobInput.lishi)}` : "",
    part.keyway || jobInput.keyway ? `Keyway ${cleanString(part.keyway || jobInput.keyway)}` : "",
    jobInput.exactPart ? `Exact part ${cleanString(jobInput.exactPart)}` : "",
    jobInput.partNumber ? `Part number ${cleanString(jobInput.partNumber)}` : "",
    part.stock ? `Stock ${cleanString(part.stock)}` : "",
    jobInput.keyType ? `Key type ${cleanString(jobInput.keyType)}` : "",
    jobInput.failureReason ? `Failure reason ${cleanString(jobInput.failureReason)}` : "",
  ].filter(Boolean);

  return {
    id: randomUUID(),
    title: `${outcome === "worked" ? "Verified part" : "Part feedback"} - ${year} ${make} ${model}`,
    customer: cleanString(jobInput.customer) || "Shop evidence",
    vehicle: [year, make, model, cleanString(vehicle.trim)].filter(Boolean).join(" "),
    service: outcome === "worked" ? "Verified key part" : "Part selection feedback",
    verification: "Part marked worked in TimLock-App",
    status: outcome === "worked" ? "Completed" : "Review",
    vin: cleanString(input.vin).toUpperCase(),
    programmer: cleanString(jobInput.programmer) || cleanString(part.programmer) || [part.oem, part.sku, part.fcc].map(cleanString).filter(Boolean).join(" / "),
    sequence: cleanString(jobInput.exactPart) || partName,
    price: "",
    payment: "",
    tags: ["part-outcome", `outcome-${outcome}`, supplier, make].filter(Boolean),
    notes: [
      `Outcome ${outcomeLabels[outcome] || outcome}`,
      supplier ? `Supplier ${supplier}` : "",
      partName,
      cleanString(jobInput.lishi || part.lishi) ? `Lishi ${cleanString(jobInput.lishi || part.lishi)}` : "",
      cleanString(jobInput.tool) ? `Tool ${cleanString(jobInput.tool)}` : "",
      cleanString(jobInput.notes),
      ...refs,
    ].filter(Boolean),
    createdAt: new Date().toISOString(),
  };
}

const syncedJobScalarFields = [
  "id",
  "title",
  "customer",
  "vehicle",
  "service",
  "verification",
  "status",
  "schedule",
  "locationName",
  "address",
  "phone",
  "contact",
  "vin",
  "mileage",
  "keyCode",
  "price",
  "payment",
  "programmer",
  "sequence",
  "createdAt",
  "importedAt",
  "sourceLine",
];

function cleanSyncedJob(input = {}) {
  if (!input || typeof input !== "object") return null;
  const job = {};
  for (const field of syncedJobScalarFields) {
    if (input[field] !== undefined && input[field] !== null) job[field] = cleanString(input[field]);
  }
  job.id = job.id || randomUUID();
  job.tags = listFromText(input.tags).slice(0, 24);
  job.notes = listFromText(input.notes).slice(0, 80);
  const usefulText = [job.title, job.vehicle, job.service, job.verification, job.programmer, job.sequence, job.keyCode, job.vin, job.tags, job.notes]
    .flat(Infinity)
    .map(cleanString)
    .filter(Boolean)
    .join(" ");
  if (!usefulText) return null;
  return job;
}

function mergeSyncedJobs(store, incomingJobs = []) {
  const existing = new Map((store.jobs || []).map((job) => [cleanString(job.id), job]));
  const merged = [...(store.jobs || [])];
  let imported = 0;
  let updated = 0;

  for (const raw of incomingJobs.slice(0, 1000)) {
    const job = cleanSyncedJob(raw);
    if (!job) continue;
    const existingJob = existing.get(job.id);
    if (existingJob) {
      const nextJob = { ...existingJob, ...job, tags: uniqueCleanValues([existingJob.tags || [], job.tags || []]), notes: uniqueCleanValues([existingJob.notes || [], job.notes || []]) };
      const index = merged.findIndex((item) => item.id === job.id);
      if (JSON.stringify(merged[index]) !== JSON.stringify(nextJob)) {
        merged[index] = nextJob;
        updated += 1;
      }
    } else {
      existing.set(job.id, job);
      merged.unshift(job);
      imported += 1;
    }
  }

  if (imported || updated) {
    store.jobs = merged.sort((a, b) => (Date.parse(b.createdAt || b.schedule) || 0) - (Date.parse(a.createdAt || a.schedule) || 0));
  }
  return { imported, updated, total: store.jobs?.length || 0 };
}

function mergedSearchJobs(storeJobs = [], extraJobs = []) {
  const store = { jobs: [...storeJobs] };
  mergeSyncedJobs(store, extraJobs);
  return store.jobs || [];
}

function vehicleProfileKey(vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .map((item) => normalizeVehicleText(item).replace(/\s+/g, "-"))
    .filter(Boolean)
    .join(":");
}

function vehicleProfileBaseKey(vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model]
    .map((item) => normalizeVehicleText(item).replace(/\s+/g, "-"))
    .filter(Boolean)
    .join(":");
}

function cleanProfilePart(part = {}) {
  return {
    name: cleanString(part.name),
    supplier: cleanString(part.supplier),
    sku: cleanString(part.sku),
    oem: cleanString(part.oem),
    fcc: cleanString(part.fcc),
    frequency: cleanString(part.frequency),
    chip: cleanString(part.chip),
    buttons: cleanString(part.buttons),
    keyway: cleanString(part.keyway),
    lishi: cleanString(part.lishi),
    programmer: cleanString(part.programmer),
    price: cleanString(part.price),
    stock: cleanString(part.stock),
    family: cleanString(part.family),
  };
}

function profilePartKey(part = {}) {
  return normalizeVehicleText([part.oem, part.sku, part.fcc, part.name].filter(Boolean).join(" ")).replace(/[^A-Z0-9]/g, "");
}

function mergeWorkedPart(existing = {}, nextPart = {}, supplier = "") {
  const suppliers = new Set([...(existing.suppliers || []), supplier || nextPart.supplier].filter(Boolean));
  const supplierOutcomes = { ...(existing.supplierOutcomes || {}) };
  const supplierName = supplier || nextPart.supplier;
  if (supplierName) {
    supplierOutcomes[supplierName] = {
      supplier: supplierName,
      workedCount: (supplierOutcomes[supplierName]?.workedCount || 0) + 1,
      lastWorkedAt: new Date().toISOString(),
      price: nextPart.price || supplierOutcomes[supplierName]?.price || "",
      stock: nextPart.stock || supplierOutcomes[supplierName]?.stock || "",
    };
  }
  return {
    ...existing,
    ...nextPart,
    count: (existing.count || 0) + 1,
    suppliers: Array.from(suppliers),
    supplierOutcomes,
    lastWorkedAt: new Date().toISOString(),
  };
}

function mergeUsageStat(items = [], value = "", extra = {}) {
  const cleanValue = cleanString(value);
  if (!cleanValue) return items;
  const index = items.findIndex((item) => stringsMatch(item.value, cleanValue));
  const nextItems = [...items];
  if (index >= 0) {
    nextItems[index] = {
      ...nextItems[index],
      ...extra,
      value: nextItems[index].value,
      count: (nextItems[index].count || 0) + 1,
      lastWorkedAt: new Date().toISOString(),
    };
  } else {
    nextItems.unshift({
      value: cleanValue,
      count: 1,
      ...extra,
      lastWorkedAt: new Date().toISOString(),
    });
  }
  return nextItems.sort((a, b) => (b.count || 0) - (a.count || 0));
}

function applyVehicleProfileOutcome(profiles, input) {
  const outcome = cleanString(input.outcome || "worked").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "worked";
  const vehicle = {
    year: cleanString(input.vehicle?.year),
    make: cleanString(input.vehicle?.make).toUpperCase(),
    model: cleanString(input.vehicle?.model),
    trim: cleanString(input.vehicle?.trim),
  };
  if (!vehicle.year || !vehicle.make || !vehicle.model) return null;

  profiles.profiles = Array.isArray(profiles.profiles) ? profiles.profiles : [];
  const baseKey = vehicleProfileBaseKey(vehicle);
  const exactKey = vehicleProfileKey(vehicle);
  let profile = profiles.profiles.find((item) => item.key === exactKey) || profiles.profiles.find((item) => item.baseKey === baseKey && !item.trim);
  if (!profile) {
    profile = {
      id: randomUUID(),
      key: exactKey,
      baseKey,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      vins: [],
      verifiedParts: [],
      warnings: [],
      confidence: "learning",
      createdAt: new Date().toISOString(),
    };
    profiles.profiles.unshift(profile);
  }

  const vin = cleanString(input.vin).toUpperCase();
  if (vin && !profile.vins.includes(vin)) profile.vins.push(vin);
  const part = cleanProfilePart(input.part);
  const key = profilePartKey(part);

  if (outcome === "worked") {
    const index = profile.verifiedParts.findIndex((item) => profilePartKey(item) === key);
    if (index >= 0) profile.verifiedParts[index] = mergeWorkedPart(profile.verifiedParts[index], part, part.supplier);
    else profile.verifiedParts.unshift(mergeWorkedPart({ key }, part, part.supplier));
    const lishi = cleanString(part.lishi || input.job?.lishi || part.keyway);
    const programmer = cleanString(part.programmer || input.job?.programmer);
    if (lishi) {
      profile.lishiOutcomes = mergeUsageStat(profile.lishiOutcomes || [], lishi, {
        source: "worked job",
        partKey: key,
      }).slice(0, 10);
      profile.preferredLishi = profile.lishiOutcomes[0] || null;
    }
    if (programmer) {
      profile.programmerOutcomes = mergeUsageStat(profile.programmerOutcomes || [], programmer, {
        source: "worked job",
        partKey: key,
      }).slice(0, 10);
      profile.preferredProgrammer = profile.programmerOutcomes[0] || null;
    }
  } else {
    profile.warnings.unshift({
      id: randomUUID(),
      outcome,
      part,
      key,
      createdAt: new Date().toISOString(),
    });
    profile.warnings = profile.warnings.slice(0, 30);
  }

  profile.verifiedParts.sort((a, b) => (b.count || 0) - (a.count || 0));
  profile.baselinePart = profile.verifiedParts[0] || profile.baselinePart || null;
  profile.confidence =
    (profile.baselinePart?.count || 0) >= 3 || profile.verifiedParts.length >= 3
      ? "verified"
      : profile.verifiedParts.length
        ? "shop-confirmed"
        : "learning";
  profile.updatedAt = new Date().toISOString();
  return profile;
}

async function updateVehicleProfileFromOutcome(input) {
  const profiles = await readVehicleProfiles();
  const profile = applyVehicleProfileOutcome(profiles, input);
  if (!profile) return null;
  await writeVehicleProfiles(profiles);
  return profile;
}

function splitDelimitedLine(line, delimiter) {
  const values = [];
  let current = "";
  let quoted = false;
  const quote = '"';
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === quote && quoted && next === quote) {
      current += quote;
      index += 1;
      continue;
    }
    if (char === quote) {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function workedJobHeaderKey(value) {
  const key = cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const aliases = {
    timestamp: "timestamp",
    date: "timestamp",
    year: "year",
    make: "make",
    model: "model",
    partnumber: "partNumber",
    part: "partNumber",
    programmer: "programmer",
    servicetype: "serviceType",
    service: "serviceType",
    vin: "vin",
    vehiclenumber: "vin",
    technician: "technician",
    tech: "technician",
    pinrequired: "pinRequired",
    pinsuccess: "pinSuccess",
    notes: "notes",
  };
  return aliases[key] || key;
}

function workedJobCleanValue(value) {
  const text = cleanString(value).replace(/\s+/g, " ");
  if (!text || /^(?:n\/?a|na|null|none|0)$/i.test(text)) return "";
  return text;
}

function normalizeWorkedJobYear(value) {
  const digits = cleanString(value).replace(/\D/g, "");
  if (!digits) return "";
  const raw = Number(digits);
  if (digits.length === 4 && raw >= 1900 && raw <= 2035) return String(raw);
  if (digits.length === 3 && digits.startsWith("2")) {
    const corrected = 2000 + Number(digits.slice(1));
    if (corrected >= 2000 && corrected <= 2035) return String(corrected);
  }
  if (digits.length === 2) {
    const corrected = raw <= 35 ? 2000 + raw : 1900 + raw;
    if (corrected >= 1900 && corrected <= 2035) return String(corrected);
  }
  return "";
}

function normalizeWorkedJobMake(value) {
  const text = workedJobCleanValue(value);
  const normalized = normalizeVehicleText(text);
  const aliases = {
    CHEVY: "CHEVROLET",
    CHEV: "CHEVROLET",
    CADILAC: "CADILLAC",
    VW: "VOLKSWAGEN",
    "MISC UNIQUE": "MISC/UNIQUE",
  };
  return aliases[normalized] || text.toUpperCase();
}

function normalizeWorkedJobModel(value) {
  return workedJobCleanValue(value)
    .replace(/\bF150\b/gi, "F-150")
    .replace(/\bCRV\b/gi, "CR-V")
    .replace(/\bRAV4\b/gi, "RAV4")
    .trim();
}

function normalizeWorkedJobVin(value) {
  return normalizeVinCandidate(value) || "";
}

function workedJobServiceLabel(serviceType) {
  const code = normalizeVehicleText(serviceType);
  const labels = {
    AKL: "All keys lost",
    ADD: "Add key",
    DK: "Duplicate key",
    PCP: "Program/check/procedure",
    AUL: "Unlock",
    AUR: "Unlock/referral",
    ARK: "Aftermarket remote/key service",
    ILP: "Ignition/lock path",
    DLP: "Door/lock path",
    SOK: "Special order key",
  };
  return labels[code] || workedJobCleanValue(serviceType) || "Worked locksmith job";
}

function keyFamilyFromWorkedService(serviceType, partNumber = "") {
  const text = normalizeVehicleText(`${serviceType} ${partNumber}`);
  if (/PROX|SMART|PRX|PUSH|PTS|PCP/.test(text)) return "proximity";
  if (/MECH|NO TP|NO_TP|BLADE|ILP|DLP/.test(text)) return "keyed";
  return "keyed";
}

function extractLishiFromWorkedText(...values) {
  const text = values.map((value) => cleanString(value).toUpperCase()).filter(Boolean).join(" ");
  if (!text) return "";
  const tokens = new Set();
  if (/\bK5\s+LISHI\b|\bLISHI\s+K5\b/.test(text)) tokens.add("K5");
  for (const match of text.matchAll(/\b([A-Z]{1,4}\s*-?\s*\d{1,4}[A-Z]?)\s*(?:LISHI|DECODER)\b|\b(?:LISHI|DECODER)\s*([A-Z]{1,4}\s*-?\s*\d{1,4}[A-Z]?)\b/g)) {
    const token = cleanString(match[1] || match[2]).replace(/\s+/g, "").replace("-", "");
    if (token) tokens.add(token);
  }
  for (const match of text.matchAll(/\b(HU|TOY|TR|DAT|NSN|NIS|MIT|MZ|MAZ|BMW|VA|HON|HY|KIA|SUB|CY)\s*-?\s*(\d{1,4}[A-Z]?)\b/g)) {
    tokens.add(`${match[1]}${match[2]}`);
  }
  return Array.from(tokens).slice(0, 3).join(" / ");
}

function parseWorkedJobRows(text) {
  const rawLines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  if (!rawLines.length) return { rows: [], skipped: [{ line: 0, reason: "No spreadsheet rows were provided." }] };

  const headerIndex = rawLines.findIndex((line) => /timestamp|year/i.test(line) && /make/i.test(line) && /model/i.test(line));
  if (headerIndex < 0) return { rows: [], skipped: [{ line: 0, reason: "Could not find a header row with Year, Make, and Model." }] };

  const headerLine = rawLines[headerIndex];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(headerLine, delimiter).map(workedJobHeaderKey);
  const rows = [];
  const skipped = [];

  rawLines.slice(headerIndex + 1).forEach((line, offset) => {
    const lineNumber = headerIndex + offset + 2;
    const values = splitDelimitedLine(line, delimiter);
    const raw = {};
    headers.forEach((header, index) => {
      if (header) raw[header] = values[index] || "";
    });

    const year = normalizeWorkedJobYear(raw.year);
    const make = normalizeWorkedJobMake(raw.make);
    const model = normalizeWorkedJobModel(raw.model);
    const partNumber = workedJobCleanValue(raw.partNumber);
    const programmer = workedJobCleanValue(raw.programmer);
    const serviceType = workedJobCleanValue(raw.serviceType);
    const notes = workedJobCleanValue(raw.notes);
    const lishi = extractLishiFromWorkedText(partNumber, notes);

    if (!year || !make || !model) {
      skipped.push({ line: lineNumber, reason: "Missing or invalid year/make/model." });
      return;
    }
    if (!partNumber && !programmer && !serviceType && !notes) {
      skipped.push({ line: lineNumber, reason: "No job evidence fields were present." });
      return;
    }

    const vin = normalizeWorkedJobVin(raw.vin);
    const key = createHash("sha1")
      .update([raw.timestamp, year, make, model, vin, partNumber, programmer, serviceType, notes].map(cleanString).join("|"))
      .digest("hex")
      .slice(0, 18);

    rows.push({
      id: `worked-import-${key}`,
      sourceLine: lineNumber,
      timestamp: workedJobCleanValue(raw.timestamp),
      year,
      make,
      model,
      vin,
      rawVin: workedJobCleanValue(raw.vin),
      partNumber,
      programmer,
      serviceType,
      serviceLabel: workedJobServiceLabel(serviceType),
      keyFamily: keyFamilyFromWorkedService(serviceType, partNumber),
      lishi,
      notes,
      pinRequired: workedJobCleanValue(raw.pinRequired),
      pinSuccess: workedJobCleanValue(raw.pinSuccess),
    });
  });

  return { rows, skipped };
}

function workedJobOutcomeFromImport(row) {
  const partName = row.partNumber || row.lishi || row.serviceType || `${row.year} ${row.make} ${row.model} worked job`;
  return {
    outcome: "worked",
    vin: row.vin,
    vehicle: {
      year: row.year,
      make: row.make,
      model: row.model,
      trim: "",
    },
    part: {
      name: partName,
      supplier: "Imported worked jobs",
      sku: row.partNumber,
      oem: "",
      fcc: "",
      frequency: "",
      chip: "",
      buttons: "",
      keyway: row.lishi,
      lishi: row.lishi,
      programmer: row.programmer,
      family: row.keyFamily,
    },
    job: {
      exactPart: row.partNumber,
      partNumber: row.partNumber,
      lishi: row.lishi,
      programmer: row.programmer,
      keyType: row.keyFamily,
      notes: [
        row.serviceType ? `Service ${row.serviceType} (${row.serviceLabel})` : "",
        row.pinRequired ? `PIN required ${row.pinRequired}` : "",
        row.pinSuccess ? `PIN success ${row.pinSuccess}` : "",
        row.notes,
      ]
        .filter(Boolean)
        .join(" | "),
    },
  };
}

function workedJobStoreEntry(row, outcomeInput) {
  const job = cleanPartOutcome(outcomeInput);
  return {
    ...job,
    id: row.id,
    title: `${row.serviceType || "JOB"} ${row.year} ${row.make} ${row.model}`.trim(),
    customer: "Imported worked job",
    service: row.serviceLabel,
    verification: "Imported worked job history",
    status: "Completed",
    vin: row.vin || row.rawVin,
    programmer: row.programmer || job.programmer,
    sequence: row.partNumber || row.lishi || job.sequence,
    price: "",
    payment: "",
    tags: [...new Set([...(job.tags || []), "worked-import", row.serviceType, row.make, row.programmer].filter(Boolean))],
    notes: [
      "Imported worked job",
      row.rawVin && !row.vin ? `Raw VIN ${row.rawVin}` : "",
      row.partNumber ? `Part ${row.partNumber}` : "",
      row.lishi ? `Lishi ${row.lishi}` : "",
      row.programmer ? `Programmer ${row.programmer}` : "",
      row.serviceType ? `Service ${row.serviceType} (${row.serviceLabel})` : "",
      row.pinRequired ? `PIN required ${row.pinRequired}` : "",
      row.pinSuccess ? `PIN success ${row.pinSuccess}` : "",
      row.notes,
    ].filter(Boolean),
    schedule: row.timestamp,
    importedAt: new Date().toISOString(),
    sourceLine: row.sourceLine,
  };
}

async function importWorkedJobsFromText(text, store) {
  const parsed = parseWorkedJobRows(text);
  const existingIds = new Set((store.jobs || []).map((job) => job.id));
  const importedJobs = [];
  const profileInputs = [];
  let duplicateCount = 0;

  for (const row of parsed.rows) {
    if (existingIds.has(row.id)) {
      duplicateCount += 1;
      continue;
    }
    const outcomeInput = workedJobOutcomeFromImport(row);
    const job = workedJobStoreEntry(row, outcomeInput);
    importedJobs.push(job);
    profileInputs.push(outcomeInput);
    existingIds.add(job.id);
  }

  if (importedJobs.length) {
    importedJobs.sort((a, b) => (Date.parse(b.schedule) || 0) - (Date.parse(a.schedule) || 0));
    store.jobs = [...importedJobs, ...(store.jobs || [])];
    await writeStore(store);
  }

  let profilesUpdated = 0;
  if (profileInputs.length) {
    const profiles = await readVehicleProfiles();
    for (const input of profileInputs) {
      const profile = applyVehicleProfileOutcome(profiles, input);
      if (profile) profilesUpdated += 1;
    }
    if (profilesUpdated) await writeVehicleProfiles(profiles);
  }

  return {
    imported: importedJobs.length,
    duplicates: duplicateCount,
    skipped: parsed.skipped.length,
    profilesUpdated,
    totalParsed: parsed.rows.length,
    sampleImported: importedJobs.slice(0, 5).map((job) => ({
      id: job.id,
      vehicle: job.vehicle,
      part: job.sequence,
      programmer: job.programmer,
    })),
    skippedSamples: parsed.skipped.slice(0, 10),
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

function aiPersonalityProfile(mode = "owner", preferences = {}) {
  const subscriber = mode === "subscriber";
  return {
    id: "timlock-field-copilot",
    name: "TimLock Field Copilot",
    role: "Senior locksmith dispatcher, proof auditor, and parts/programmer verifier",
    voice: subscriber
      ? "Polished, concise, verification-first, and customer-safe."
      : "Direct, field-smart, proof-hungry, and comfortable calling out weak data.",
    catchphrase: subscriber
      ? "Verify the job, then move clean."
      : "Here is what I would verify before you burn time or money.",
    principles: [
      "Authorization before procedure",
      "Proof beats guesses",
      "VIN/YMM starts the packet; physical verification finishes it",
      "Coverage percentages are shop evidence, not universal promises",
      "Every completed job should teach the next one",
    ],
    preferences: {
      voice: preferences.voice || "field-pro",
      ownerTone: preferences.ownerTone || "direct",
      subscriberTone: preferences.subscriberTone || "polished",
    },
  };
}

function aiFeedbackSummary(feedback = []) {
  const counts = {};
  for (const item of feedback || []) {
    const value = cleanString(item.value || item.feedback || "unknown") || "unknown";
    counts[value] = (counts[value] || 0) + 1;
  }
  return {
    total: feedback.length,
    helpful: counts.helpful || 0,
    wrong: counts.wrong || 0,
    used: counts.used || 0,
    savedRules: counts["save-rule"] || counts.savedRule || 0,
    suppressed: counts.suppress || 0,
    counts,
  };
}

function relevantAiCorrections(feedback = [], snapshot = {}, prompt = "") {
  const haystack = [
    prompt,
    snapshot.query,
    snapshot.vehicleTitle,
    snapshot.vin,
    snapshot.screen,
    snapshot.workbenchTitle,
    snapshot.activeQueries || {},
  ]
    .flat(Infinity)
    .map((item) => (item && typeof item === "object" ? JSON.stringify(item) : item))
    .join(" ");
  const text = compactToken(haystack);
  if (!text) return [];
  return (feedback || [])
    .filter((item) => ["wrong", "suppress"].includes(cleanString(item.value).toLowerCase()))
    .filter((item) => {
      const terms = uniqueCleanValues([item.prompt, item.note, item.target, item.contextSummary || [], item.title]).filter((term) => cleanString(term).length >= 4);
      return terms.some((term) => {
        const token = compactToken(term);
        return token.length >= 4 && text.includes(token.slice(0, 32));
      });
    })
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title || item.prompt || "Prior correction",
      note: item.note || "Marked as wrong or suppressed.",
      target: item.target || "",
      value: item.value || "wrong",
      createdAt: item.createdAt || "",
    }));
}

function aiRuleMatches(rule = {}, haystack = "") {
  if (rule.disabled) return false;
  const text = compactToken(haystack);
  if (!text) return false;
  const terms = uniqueCleanValues([
    rule.matchTerms || [],
    rule.query,
    rule.vehicle,
    rule.tags || [],
    String(rule.title || "")
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  ]);
  return terms.some((term) => {
    const token = compactToken(term);
    return token.length >= 3 && text.includes(token);
  });
}

function relevantAiShopRules(shopRules = [], snapshot = {}, prompt = "") {
  const haystack = [
    prompt,
    snapshot.query,
    snapshot.vehicleTitle,
    snapshot.vin,
    snapshot.screen,
    snapshot.workbenchTitle,
    snapshot.activeQueries || {},
  ]
    .flat(Infinity)
    .map((item) => (item && typeof item === "object" ? JSON.stringify(item) : item))
    .join(" ");
  const activeRules = (shopRules || []).filter((rule) => !rule.disabled);
  const matched = activeRules.filter((rule) => aiRuleMatches(rule, haystack));
  return (matched.length ? matched : activeRules)
    .sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0))
    .slice(0, 5)
    .map((rule) => ({
      id: rule.id,
      title: rule.title,
      body: rule.body,
      scope: rule.scope || "shop",
      query: rule.query || "",
      vehicle: rule.vehicle || "",
      tags: rule.tags || [],
      source: rule.source || "shop-rule",
    }));
}

function aiMemorySummary(store = {}, context = {}, prompt = "") {
  const snapshot = aiContextSnapshot(context);
  const feedback = store.aiFeedback || [];
  const shopRules = store.shopRules || [];
  const summary = aiFeedbackSummary(feedback);
  const relevantRules = relevantAiShopRules(shopRules, snapshot, prompt);
  const corrections = relevantAiCorrections(feedback, snapshot, prompt);
  return {
    personality: aiPersonalityProfile(context.appMode || "owner", store.aiPreferences || {}),
    feedback: summary,
    shopRules: {
      total: shopRules.filter((rule) => !rule.disabled).length,
      relevant: relevantRules,
    },
    corrections,
    learningSignals: [
      summary.used ? `${summary.used} AI recommendation${summary.used === 1 ? "" : "s"} marked used` : "",
      summary.helpful ? `${summary.helpful} helpful response${summary.helpful === 1 ? "" : "s"}` : "",
      summary.wrong ? `${summary.wrong} wrong response${summary.wrong === 1 ? "" : "s"} to avoid repeating` : "",
      relevantRules.length ? `${relevantRules.length} shop rule${relevantRules.length === 1 ? "" : "s"} in play` : "",
      corrections.length ? `${corrections.length} prior correction${corrections.length === 1 ? "" : "s"} matched this context` : "",
    ].filter(Boolean),
  };
}

function cleanAiFeedback(input = {}) {
  const allowed = new Set(["helpful", "wrong", "used", "save-rule", "suppress"]);
  const value = cleanString(input.value || input.feedback || "helpful").toLowerCase();
  return {
    id: randomUUID(),
    responseId: cleanString(input.responseId || input.aiResponseId || ""),
    value: allowed.has(value) ? value : "helpful",
    title: cleanString(input.title || ""),
    note: cleanString(input.note || input.reason || ""),
    prompt: cleanString(input.prompt || ""),
    target: cleanString(input.target || ""),
    contextSummary: Array.isArray(input.contextSummary) ? input.contextSummary.map(cleanString).filter(Boolean).slice(0, 10) : [],
    createdAt: new Date().toISOString(),
  };
}

function cleanShopRule(input = {}, sourceFeedback = null) {
  const tags = uniqueCleanValues([input.tags || [], input.matchTerms || []]).slice(0, 12);
  const contextSummary = Array.isArray(input.contextSummary) ? input.contextSummary.map(cleanString).filter(Boolean) : [];
  const title =
    cleanString(input.title) ||
    cleanString(sourceFeedback?.note) ||
    cleanString(sourceFeedback?.prompt) ||
    "Shop rule";
  const body =
    cleanString(input.body || input.rule || input.note) ||
    cleanString(sourceFeedback?.note) ||
    `Remember this pattern: ${cleanString(sourceFeedback?.prompt || title)}`;
  return {
    id: cleanString(input.id) || randomUUID(),
    title: title.slice(0, 120),
    body,
    scope: cleanString(input.scope || input.target || sourceFeedback?.target || "shop") || "shop",
    query: cleanString(input.query || ""),
    vehicle: cleanString(input.vehicle || ""),
    matchTerms: uniqueCleanValues([input.matchTerms || [], tags, input.query, input.vehicle]).slice(0, 18),
    tags,
    source: cleanString(input.source || (sourceFeedback ? "ai-feedback" : "manual")) || "manual",
    contextSummary: contextSummary.slice(0, 10),
    disabled: Boolean(input.disabled),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function aiContextSnapshot(context = {}) {
  const workbench = context.workbench || {};
  const profile = context.currentProfile || context.profile || {};
  const vehicle = profile.vehicle || workbench.vehicle || {};
  const partHistory = context.partHistory || {};
  const proofVault = context.proofVault || {};
  const codeDesk = context.codeDesk || {};
  const lishi = context.lishi || {};
  const coverage = context.coverage || {};
  const globalSearch = context.globalSearch || {};
  const brief = workbench.aiBrief || context.aiBrief || null;
  const query = cleanString(context.query || workbench.activeQueries?.part || workbench.query || partHistory.primaryIdentifier || globalSearch.query);
  const vehicleTitle = cleanString(profile.title || [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" "));
  return {
    activeView: cleanString(context.activeView || context.screen || "ai"),
    screen: cleanString(context.screen || context.activeView || "AI Bench"),
    query,
    vehicleTitle,
    vin: cleanString(profile.vin || workbench.vin),
    workbenchTitle: cleanString(workbench.title || vehicleTitle || query),
    brief,
    activeQueries: workbench.activeQueries || {},
    partHistory,
    proofVault,
    codeDesk,
    lishi,
    coverage,
    globalSearch,
    profile,
  };
}

function aiIntent(prompt = "") {
  const normalized = prompt.toLowerCase();
  if (/quote|price|estimate|invoice|customer/.test(normalized)) return "quote";
  if (/proof|vault|evidence|authorization|document|photo/.test(normalized)) return "proof";
  if (/part|lr#?|mw#?|ti#?|oe|fcc|sku|order/.test(normalized)) return "parts";
  if (/\blishi\b|keyway|decode|pick|door lock|ignition lock|lock cylinder|cylinder/.test(normalized)) return "lishi";
  if (/code|bitting|cuts|depth|space|cutting/.test(normalized)) return "code";
  if (/coverage|programmer|smart pro|autel|topdon|fdrs|success|worked/.test(normalized)) return "coverage";
  if (/vin|vehicle|ymm|year|make|model/.test(normalized)) return "vin";
  if (/audit|next|now|dispatch|workbench|packet|prep|what should|summary|brief|checklist|field plan|field/.test(normalized)) return "next";
  return "general";
}

function aiChecklistForIntent(intent, snapshot, memory = {}) {
  const common = ["Confirm lawful authorization", "Verify VIN/YMM and customer identity", "Record the exact part/tool used after completion"];
  const ruleSteps = (memory.shopRules?.relevant || [])
    .slice(0, 2)
    .map((rule) => `Apply shop rule: ${rule.title}`);
  const lists = {
    next: [
      "Open or refresh Job Workbench",
      "Check part-history proof before ordering",
      "Confirm Lishi/keyway at the lock or emergency insert",
      "Attach proof photos/docs in Proof Vault",
    ],
    quote: [
      "Confirm ownership and service address",
      "Verify key type, FCC/frequency, blade/keyway, and programmer path",
      "State parts/programming contingencies before final price",
      "Save the customer-safe note with the job",
    ],
    proof: [
      "Attach ID/registration or fleet authorization",
      "Attach before/after key or programmer result photos",
      "Record exact part number, programmer, and outcome",
      "Mark warnings separately from proven outcomes",
    ],
    parts: [
      "Start with LR/MW/TI/OE/FCC cross-reference family",
      "Compare saved jobs for the same part family",
      "Verify button count, frequency, blade, chip, and FCC before order",
      "Log alternate if the first part is wrong",
    ],
    lishi: [
      "Verify keyway from lock, insert, or authorized source",
      "Confirm vehicle application row is the right year/model range",
      "Do not rely on tool name alone",
      "Record the confirmed Lishi/keyway in worked-job proof",
    ],
    code: [
      "Use only authorized code data",
      "Confirm correct depth-space system and blank",
      "Compare bitting/code against vehicle/keyway context",
      "Treat near matches as clues until verified at the lock/key",
    ],
    coverage: [
      "Prioritize missing programmer proof",
      "Clean up unknown outcomes",
      "Add part numbers/OE/FCC to old jobs",
      "Use coverage percentages as observed shop proof only",
    ],
    vin: [
      "Confirm VIN has decoded to the expected vehicle",
      "Select key family before ordering",
      "Verify programmer coverage and keyway",
      "Send the packet to Workbench before dispatch",
    ],
  };
  return uniqueCleanValues([...ruleSteps, ...(lists[intent] || lists.next), ...common]).slice(0, 8);
}

function aiMetric(value, fallback = 0) {
  if (Array.isArray(value)) return value.length;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function aiEvidenceProfile(snapshot = {}) {
  const partHistory = snapshot.partHistory || {};
  const proofVault = snapshot.proofVault || {};
  const codeDesk = snapshot.codeDesk || {};
  const lishi = snapshot.lishi || {};
  const coverage = snapshot.coverage || {};
  const workbench = snapshot.brief || {};
  return {
    hasVehicle: Boolean(snapshot.vehicleTitle || snapshot.vin),
    hasSearch: Boolean(snapshot.query || snapshot.workbenchTitle),
    hasWorkbench: Boolean(workbench.decision || snapshot.workbenchTitle),
    partJobs: aiMetric(partHistory.matchedJobs),
    partReferenceRows: aiMetric(partHistory.matchedReferenceRows),
    proofMatches: aiMetric(proofVault.matchingJobs),
    proofFiles: aiMetric(proofVault.files),
    proofWarnings: aiMetric(proofVault.warningJobs),
    lishiTools: aiMetric(lishi.matchedTools),
    lishiApplications: aiMetric(lishi.matchedApplications),
    codeRows: aiMetric(codeDesk.autoMatches),
    codeCandidates: aiMetric(codeDesk.verifiedCandidates),
    codeImports: aiMetric(codeDesk.importedRecords),
    coveragePercent: Number.isFinite(Number(coverage.observedCoveragePercent)) ? Number(coverage.observedCoveragePercent) : null,
    coverageJobs: aiMetric(coverage.automotiveJobs),
    missingProgrammer: aiMetric(coverage.gaps?.missingProgrammer),
    missingPart: aiMetric(coverage.gaps?.missingPart),
    needsOutcome: aiMetric(coverage.gaps?.needsOutcome),
  };
}

function aiReadinessScore(evidence = {}) {
  let score = 18;
  if (evidence.hasVehicle) score += 14;
  if (evidence.hasSearch) score += 10;
  if (evidence.hasWorkbench) score += 10;
  if (evidence.partReferenceRows) score += 10;
  if (evidence.partJobs) score += Math.min(14, 8 + evidence.partJobs);
  if (evidence.proofMatches) score += 8;
  if (evidence.proofFiles) score += 6;
  if (evidence.lishiTools || evidence.lishiApplications) score += 7;
  if (evidence.codeRows || evidence.codeCandidates || evidence.codeImports) score += 7;
  if (evidence.coveragePercent !== null) score += Math.min(10, Math.round(evidence.coveragePercent / 10));
  return Math.max(0, Math.min(100, score));
}

function aiReadinessLabel(score) {
  if (score >= 85) return "Field-ready with verification";
  if (score >= 70) return "Strong packet";
  if (score >= 52) return "Usable, needs checks";
  if (score >= 35) return "Thin proof";
  return "Build context first";
}

function aiProofGaps(intent, snapshot, evidence) {
  const gaps = [];
  if (!evidence.hasVehicle) gaps.push("Vehicle identity is not loaded yet");
  if (!evidence.hasSearch) gaps.push("No active VIN, part, keyway, or vehicle search is attached");
  if (!evidence.partReferenceRows && ["parts", "next", "quote", "coverage"].includes(intent)) gaps.push("No part cross-reference row is tied to the current question");
  if (!evidence.partJobs && ["parts", "next", "coverage"].includes(intent)) gaps.push("No saved worked-job proof matched this part/search");
  if (!evidence.proofMatches) gaps.push("Proof Vault has no matching job record for this context");
  if (!evidence.proofFiles) gaps.push("No server/browser proof attachments are linked to this context");
  if (!evidence.lishiTools && ["lishi", "vin", "next"].includes(intent)) gaps.push("Lishi/keyway still needs confirmation from the lock or insert");
  if (!evidence.codeRows && !evidence.codeCandidates && intent === "code") gaps.push("No code system or authorized code-data result is active");
  if (evidence.missingProgrammer) gaps.push(`${evidence.missingProgrammer} saved automotive job${evidence.missingProgrammer === 1 ? "" : "s"} still need programmer names`);
  if (evidence.missingPart) gaps.push(`${evidence.missingPart} saved automotive job${evidence.missingPart === 1 ? "" : "s"} still need exact part numbers`);
  if (evidence.needsOutcome) gaps.push(`${evidence.needsOutcome} saved automotive job${evidence.needsOutcome === 1 ? "" : "s"} still need worked/failed outcome cleanup`);
  return uniqueCleanValues(gaps).slice(0, 8);
}

function aiRiskFlags(intent, snapshot, evidence) {
  const warnings = [];
  if (intent === "code") warnings.push("Code/cut data must come from authorized data or your own decoded/imported records");
  if (intent === "lishi") warnings.push("Lishi matches are a shortlist; confirm the actual keyway at the vehicle");
  if (intent === "quote") warnings.push("Quote should stay conditional until part/FCC/blade/programmer path is verified");
  if (evidence.proofWarnings) warnings.push(`${evidence.proofWarnings} matching proof record${evidence.proofWarnings === 1 ? "" : "s"} includes warning/failure language`);
  if (evidence.coveragePercent !== null && evidence.coveragePercent < 70) warnings.push("Observed programmer coverage is below 70% for the current evidence set");
  if (!snapshot.vin && snapshot.vehicleTitle) warnings.push("YMM lookup is useful, but VIN still matters for trim/key package confidence");
  return uniqueCleanValues(warnings).slice(0, 6);
}

function aiRoutePlan(intent, snapshot, evidence) {
  const subject = snapshot.query || snapshot.vehicleTitle || "current job";
  const routes = [
    {
      target: "workbench",
      label: "Job Workbench",
      status: evidence.hasWorkbench ? "Packet built" : "Build packet",
      reason: evidence.hasWorkbench ? "Use the unified packet as the source of truth" : "Unify VIN, parts, proof, Lishi, Code Desk, and coverage",
      prompt: `Run a full field audit for ${subject}`,
    },
    {
      target: "part-history",
      label: "Part History",
      status: evidence.partJobs ? `${evidence.partJobs} worked proof` : "Needs proof",
      reason: evidence.partReferenceRows ? "Cross-reference data exists" : "Search LR/MW/TI/OE/FCC before ordering",
      prompt: `Is ${subject} proven enough to trust?`,
    },
    {
      target: "proof-vault",
      label: "Proof Vault",
      status: evidence.proofMatches ? `${evidence.proofMatches} matches` : "Needs evidence",
      reason: evidence.proofFiles ? "Attachments are present" : "Attach authorization, result photos, and final part/programmer proof",
      prompt: `What proof is missing for ${subject}?`,
    },
    {
      target: "lishi",
      label: "Lishi Lookup",
      status: evidence.lishiTools ? `${evidence.lishiTools} tools` : "Verify keyway",
      reason: "Use as keyway/decode shortlist, not as the only decision",
      prompt: `Build a Lishi verification checklist for ${subject}`,
    },
    {
      target: "code-desk",
      label: "Code Desk",
      status: evidence.codeCandidates ? `${evidence.codeCandidates} candidates` : evidence.codeRows ? `${evidence.codeRows} auto rows` : "Needs authorized data",
      reason: "Use depth/space and bitting only when the system and authorization are verified",
      prompt: `What do I need before using code data for ${subject}?`,
    },
    {
      target: "coverage",
      label: "Coverage",
      status: evidence.coveragePercent !== null ? `${evidence.coveragePercent}% observed` : "Build proof",
      reason: "Coverage is your saved-shop evidence, not a manufacturer guarantee",
      prompt: "Where are my biggest programmer coverage gaps?",
    },
  ];
  if (intent === "parts") return routes.filter((route) => ["workbench", "part-history", "proof-vault", "coverage"].includes(route.target));
  if (intent === "proof") return routes.filter((route) => ["proof-vault", "workbench", "coverage", "part-history"].includes(route.target));
  if (intent === "lishi") return routes.filter((route) => ["lishi", "workbench", "part-history", "proof-vault"].includes(route.target));
  if (intent === "code") return routes.filter((route) => ["code-desk", "workbench", "proof-vault", "part-history"].includes(route.target));
  if (intent === "coverage") return routes.filter((route) => ["coverage", "part-history", "proof-vault", "workbench"].includes(route.target));
  return routes;
}

function aiCopyBlocks(intent, snapshot, checklist, packet) {
  const subject = snapshot.vehicleTitle || snapshot.query || snapshot.workbenchTitle || "current locksmith job";
  const customerNote = `We will verify authorization, confirm the exact vehicle/key system, match the correct part and programming path, and document the completed result before closing the job. ${packet.dispatchDecision}`;
  const workOrderNote = [
    `AI field packet: ${subject}`,
    `Readiness: ${packet.readinessScore}% - ${packet.readinessLabel}`,
    `Decision: ${packet.dispatchDecision}`,
    `Next: ${packet.nextBestAction?.label || "Open Workbench"}`,
    `Proof gaps: ${(packet.proofGaps || []).slice(0, 4).join("; ") || "Normal verification only"}`,
  ].join("\n");
  return {
    customerNote,
    workOrderNote,
    technicianChecklist: checklist.map((item, index) => `${index + 1}. ${item}`).join("\n"),
  };
}

function aiFieldPacket(intent, snapshot, checklist, memory = {}) {
  const evidence = aiEvidenceProfile(snapshot);
  const readinessScore = aiReadinessScore(evidence);
  const readinessLabel = aiReadinessLabel(readinessScore);
  const proofGaps = aiProofGaps(intent, snapshot, evidence);
  const warnings = aiRiskFlags(intent, snapshot, evidence);
  const routePlan = aiRoutePlan(intent, snapshot, evidence);
  const blockers = proofGaps.filter((gap) =>
    /authorization|vehicle identity|No active|authorized code/i.test(gap),
  );
  const dispatchDecision =
    readinessScore >= 85
      ? "Ready to proceed with normal field verification."
      : readinessScore >= 70
        ? "Proceed after the listed proof and part checks are confirmed."
        : readinessScore >= 52
          ? "Usable for planning, but verify missing proof before ordering or programming."
          : "Hold for more context before relying on this packet.";
  const packet = {
    readinessScore,
    readinessLabel,
    priority: blockers.length ? "Fix blockers first" : warnings.length ? "Verify warnings" : "Normal verification",
    dispatchDecision,
    nextBestAction: routePlan[0] || { target: "workbench", label: "Job Workbench", prompt: "Run a full field audit." },
    evidence,
    confidenceDrivers: uniqueCleanValues([
      memory.shopRules?.relevant?.length ? `${memory.shopRules.relevant.length} shop rule${memory.shopRules.relevant.length === 1 ? "" : "s"} matched` : "",
      memory.feedback?.used ? `${memory.feedback.used} prior AI recommendation${memory.feedback.used === 1 ? "" : "s"} marked used` : "",
      memory.corrections?.length ? `${memory.corrections.length} prior correction${memory.corrections.length === 1 ? "" : "s"} matched` : "",
      evidence.hasVehicle ? "Vehicle identity present" : "",
      evidence.hasWorkbench ? "Workbench packet active" : "",
      evidence.partJobs ? `${evidence.partJobs} saved worked-job proof match${evidence.partJobs === 1 ? "" : "es"}` : "",
      evidence.partReferenceRows ? `${evidence.partReferenceRows} part reference row${evidence.partReferenceRows === 1 ? "" : "s"}` : "",
      evidence.proofFiles ? `${evidence.proofFiles} proof attachment${evidence.proofFiles === 1 ? "" : "s"}` : "",
      evidence.lishiTools ? `${evidence.lishiTools} Lishi tool match${evidence.lishiTools === 1 ? "" : "es"}` : "",
      evidence.coveragePercent !== null ? `${evidence.coveragePercent}% observed coverage` : "",
    ]).slice(0, 8),
    blockers,
    warnings,
    proofGaps,
    routePlan,
    shopRules: memory.shopRules?.relevant || [],
    personality: memory.personality || aiPersonalityProfile(),
    learningSignals: memory.learningSignals || [],
    technicianPlan: checklist,
    saveBackChecklist: [
      "Exact LR/MW/TI/OE/FCC/part used",
      "Programmer/tool used and software path if known",
      "Worked/failed outcome with reason",
      "Vehicle VIN/YMM and keyway/Lishi if confirmed",
      "Authorization and final result proof attachment",
    ],
  };
  packet.copyBlocks = aiCopyBlocks(intent, snapshot, checklist, packet);
  return packet;
}

function aiRecentIntentCounts(auditLog = []) {
  const counts = {};
  for (const entry of (auditLog || []).slice(0, 40)) {
    const intent = cleanString(entry.intent || "general") || "general";
    counts[intent] = (counts[intent] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent));
}

function aiAdvisorAction({ id, title, detail, target = "workbench", prompt = "", impact = "medium", priority = 50, source = "TimLock AI" }) {
  return {
    id,
    title,
    detail,
    target,
    prompt,
    impact,
    priority,
    source,
  };
}

function buildAiAdvisor({ jobs = [], partsReference = {}, auditLog = [], proofAttachments = {}, feedback = [], shopRules = [], preferences = {} }) {
  const coverage = buildCoverageDashboard(jobs, partsReference);
  const recentProof = buildProofVault("", jobs, partsReference);
  const summary = coverage.summary || {};
  const intentCounts = aiRecentIntentCounts(auditLog);
  const feedbackSummary = aiFeedbackSummary(feedback);
  const activeRules = (shopRules || []).filter((rule) => !rule.disabled);
  const attachmentJobIds = new Set(Object.entries(proofAttachments || {}).filter(([, files]) => Array.isArray(files) && files.length).map(([jobId]) => jobId));
  const recentAutomotiveJobs = (recentProof.records || []).filter((record) => coverageVehicleForJob(record).automotive).slice(0, 12);
  const recentJobsWithoutFiles = recentAutomotiveJobs.filter((record) => !attachmentJobIds.has(record.id));
  const topProgrammer = (coverage.programmers || []).find((item) => item.key !== "Programmer not recorded");
  const topPart = (coverage.parts || []).find((item) => item.key !== "Part number not recorded");
  const strongestMake = (coverage.makes || [])[0];
  const actions = [];

  if (!summary.totalJobs) {
    actions.push(
      aiAdvisorAction({
        id: "import-worked-jobs",
        title: "Import or save your first worked jobs",
        detail: "The AI becomes dramatically better once it can see real job outcomes, programmers, parts, and notes.",
        target: "learn",
        prompt: "What fields should I capture on every worked job?",
        impact: "high",
        priority: 98,
        source: "Job memory",
      }),
    );
  }

  if ((coverage.gaps?.missingProgrammer || []).length) {
    const first = coverage.gaps.missingProgrammer[0];
    actions.push(
      aiAdvisorAction({
        id: "missing-programmer-proof",
        title: "Add missing programmer proof",
        detail: `${coverage.gaps.missingProgrammer.length} automotive job${coverage.gaps.missingProgrammer.length === 1 ? "" : "s"} need a programmer/tool name. First: ${first.vehicle || first.title || first.id}.`,
        target: "coverage",
        prompt: "Build my cleanup plan for missing programmer proof.",
        impact: "high",
        priority: 94,
        source: "Coverage cleanup",
      }),
    );
  }

  if ((coverage.gaps?.missingPart || []).length) {
    const first = coverage.gaps.missingPart[0];
    actions.push(
      aiAdvisorAction({
        id: "missing-part-proof",
        title: "Add exact part numbers to old jobs",
        detail: `${coverage.gaps.missingPart.length} job${coverage.gaps.missingPart.length === 1 ? "" : "s"} are not feeding part-history confidence yet. First: ${first.vehicle || first.title || first.id}.`,
        target: "coverage",
        prompt: "Build my cleanup plan for missing part numbers.",
        impact: "high",
        priority: 90,
        source: "Part proof",
      }),
    );
  }

  if ((coverage.gaps?.needsOutcome || []).length) {
    actions.push(
      aiAdvisorAction({
        id: "unknown-outcomes",
        title: "Clean up unknown outcomes",
        detail: `${coverage.gaps.needsOutcome.length} job${coverage.gaps.needsOutcome.length === 1 ? "" : "s"} need worked/failed/alternate outcome cleanup so coverage percentages become stronger.`,
        target: "coverage",
        prompt: "Which unknown outcomes should I clean up first?",
        impact: "medium",
        priority: 82,
        source: "Coverage scoring",
      }),
    );
  }

  if (summary.partProofPercent !== undefined && summary.partProofPercent < 85 && summary.automotiveJobs) {
    actions.push(
      aiAdvisorAction({
        id: "part-proof-percent",
        title: "Raise part-proof percentage",
        detail: `Part proof is ${summary.partProofPercent}%. Add LR/MW/TI/OE/FCC/SKU values to saved jobs to make search and subscriber proof sharper.`,
        target: "part-history",
        prompt: "How do I improve part-history proof percentage fastest?",
        impact: "medium",
        priority: 76,
        source: "Parts intelligence",
      }),
    );
  }

  if (summary.programmerProofPercent !== undefined && summary.programmerProofPercent < 90 && summary.automotiveJobs) {
    actions.push(
      aiAdvisorAction({
        id: "programmer-proof-percent",
        title: "Raise programmer-proof percentage",
        detail: `Programmer proof is ${summary.programmerProofPercent}%. Naming the programmer makes coverage claims much more trustworthy.`,
        target: "coverage",
        prompt: "How do I improve programmer coverage proof fastest?",
        impact: "medium",
        priority: 74,
        source: "Programmer coverage",
      }),
    );
  }

  if (recentJobsWithoutFiles.length) {
    actions.push(
      aiAdvisorAction({
        id: "attach-proof-files",
        title: "Attach proof to recent jobs",
        detail: `${recentJobsWithoutFiles.length} recent automotive proof record${recentJobsWithoutFiles.length === 1 ? "" : "s"} have no attachment linked. Start with ${recentJobsWithoutFiles[0].vehicle || recentJobsWithoutFiles[0].title}.`,
        target: "proof-vault",
        prompt: "What attachments should I add to make this proof stronger?",
        impact: "high",
        priority: 88,
        source: "Proof Vault",
      }),
    );
  }

  if (topProgrammer) {
    actions.push(
      aiAdvisorAction({
        id: "top-programmer-proof",
        title: `Promote ${topProgrammer.key} as proven coverage`,
        detail: `${topProgrammer.jobs} saved job${topProgrammer.jobs === 1 ? "" : "s"} with ${coveragePercent(topProgrammer.successes, topProgrammer.warnings) ?? "N/A"}% observed success. This is strong subscriber-facing proof when jobs have parts and outcomes.`,
        target: "coverage",
        prompt: `Create a professional coverage summary for ${topProgrammer.key}.`,
        impact: "medium",
        priority: 62,
        source: "Coverage proof",
      }),
    );
  }

  if (topPart && topPart.key !== "Part number not recorded") {
    actions.push(
      aiAdvisorAction({
        id: "top-part-family",
        title: `Strengthen ${topPart.key} part history`,
        detail: `${topPart.jobs} job${topPart.jobs === 1 ? "" : "s"} feed this part family. Open it and verify aliases/OE sources are clean.`,
        target: "part-history",
        prompt: `Audit part history for ${topPart.key}.`,
        impact: "medium",
        priority: 58,
        source: "Part history",
      }),
    );
  }

  if (intentCounts[0]) {
    actions.push(
      aiAdvisorAction({
        id: "recent-ai-focus",
        title: `Recent AI focus: ${intentCounts[0].intent}`,
        detail: `Your last AI questions lean toward ${intentCounts[0].intent}. Turn that into a repeatable checklist or cleanup workflow.`,
        target: "ai",
        prompt: `Turn my recent ${intentCounts[0].intent} AI questions into a repeatable workflow.`,
        impact: "low",
        priority: 42,
        source: "AI memory",
      }),
    );
  }

  if (!activeRules.length && summary.automotiveJobs) {
    actions.push(
      aiAdvisorAction({
        id: "create-first-shop-rule",
        title: "Save your first shop rule",
        detail: "Mark a useful AI answer as a shop rule so future packets can apply your preferred parts, programmer habits, and verification warnings automatically.",
        target: "ai",
        prompt: "Help me create my first shop rule from recent worked jobs.",
        impact: "medium",
        priority: 68,
        source: "AI learning",
      }),
    );
  }

  if (feedbackSummary.wrong) {
    actions.push(
      aiAdvisorAction({
        id: "review-wrong-ai-feedback",
        title: "Review AI answers marked wrong",
        detail: `${feedbackSummary.wrong} AI response${feedbackSummary.wrong === 1 ? " was" : "s were"} marked wrong. Turn the correction into a shop rule so the app stops repeating it.`,
        target: "ai",
        prompt: "Review my wrong AI feedback and suggest shop rules.",
        impact: "medium",
        priority: 66,
        source: "AI feedback",
      }),
    );
  }

  const sortedActions = actions
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, 10);
  const readiness = aiReadinessScore({
    hasVehicle: Boolean(strongestMake),
    hasSearch: Boolean(topPart && topPart.key !== "Part number not recorded"),
    hasWorkbench: true,
    partJobs: summary.jobsWithPartNumbers || 0,
    partReferenceRows: summary.crossReferenceLinkedJobs || 0,
    proofMatches: recentProof.summary?.matchingJobs || 0,
    proofFiles: attachmentJobIds.size,
    lishiTools: 0,
    lishiApplications: 0,
    codeRows: 0,
    codeCandidates: 0,
    codeImports: 0,
    coveragePercent: summary.observedCoveragePercent,
  });

  return {
    generatedAt: new Date().toISOString(),
    headline: sortedActions[0]?.title || "AI is ready",
    summary: [
      `${summary.automotiveJobs || 0} automotive jobs in memory`,
      `${summary.observedCoveragePercent ?? "N/A"}% observed success across scored jobs`,
      `${summary.programmerProofPercent ?? 0}% programmer proof`,
      `${summary.partProofPercent ?? 0}% part proof`,
      `${attachmentJobIds.size} jobs with proof attachments`,
    ],
    readinessScore: readiness,
    readinessLabel: aiReadinessLabel(readiness),
    topAction: sortedActions[0] || null,
    actions: sortedActions,
    memory: {
      totalJobs: summary.totalJobs || 0,
      automotiveJobs: summary.automotiveJobs || 0,
      topProgrammer: topProgrammer?.key || "",
      topPart: topPart?.key || "",
      strongestMake: strongestMake?.key || "",
      recentIntentCounts: intentCounts.slice(0, 6),
      feedback: feedbackSummary,
      shopRules: activeRules.length,
      personality: aiPersonalityProfile("owner", preferences),
    },
    proofStats: {
      missingProgrammer: coverage.gaps?.missingProgrammer?.length || 0,
      missingPart: coverage.gaps?.missingPart?.length || 0,
      needsOutcome: coverage.gaps?.needsOutcome?.length || 0,
      recentJobsWithoutFiles: recentJobsWithoutFiles.length,
    },
  };
}

function buildAiFieldCommander({ context = {}, store = {}, jobs = [], partsReference = {}, proofAttachments = {} }) {
  const prompt = "Run TimLock Field Commander for the current job context.";
  const memory = aiMemorySummary(store, context, prompt);
  const snapshot = aiContextSnapshot(context);
  const checklist = aiChecklistForIntent("next", snapshot, memory);
  const fieldPacket = aiFieldPacket("next", snapshot, checklist, memory);
  const advisor = buildAiAdvisor({
    jobs,
    partsReference,
    auditLog: store.auditLog,
    feedback: store.aiFeedback,
    shopRules: store.shopRules,
    preferences: store.aiPreferences,
    proofAttachments,
  });
  const subject = snapshot.vehicleTitle || snapshot.query || snapshot.workbenchTitle || "current job";
  const routeActions = (fieldPacket.routePlan || []).map((route) =>
    aiAdvisorAction({
      id: `route-${route.target || route.label}`,
      title: route.label || route.target || "Open tool",
      detail: route.reason || "Use this tool to strengthen the active job packet.",
      target: route.target || "workbench",
      prompt: route.prompt || `Audit ${subject} in ${route.label || route.target || "this tool"}.`,
      impact: route.status === "required" ? "high" : "medium",
      priority: route.status === "required" ? 92 : 70,
      source: "Field Commander route",
    }),
  );
  const combinedActions = [
    ...(fieldPacket.blockers || []).map((blocker, index) =>
      aiAdvisorAction({
        id: `blocker-${index}`,
        title: blocker,
        detail: "Resolve this before relying on the job packet.",
        target: blocker.toLowerCase().includes("proof") || blocker.toLowerCase().includes("authorization") ? "proof-vault" : "workbench",
        prompt: `Help me resolve this blocker: ${blocker}`,
        impact: "high",
        priority: 100 - index,
        source: "Risk radar",
      }),
    ),
    ...routeActions,
    ...(advisor.actions || []).slice(0, 4),
  ];
  const actionStack = [];
  const seenActions = new Set();
  for (const action of combinedActions.sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
    const key = `${action.title}|${action.target}`;
    if (seenActions.has(key)) continue;
    seenActions.add(key);
    actionStack.push(action);
    if (actionStack.length >= 8) break;
  }
  const riskRadar = uniqueCleanValues([
    ...(fieldPacket.blockers || []).map((item) => `Blocker: ${item}`),
    ...(fieldPacket.warnings || []).map((item) => `Warning: ${item}`),
    ...(fieldPacket.proofGaps || []).slice(0, 4).map((item) => `Proof: ${item}`),
  ]).slice(0, 10);
  const dataScorecards = [
    { label: "Vehicle context", value: snapshot.vehicleTitle || snapshot.vin ? "active" : "missing", tone: snapshot.vehicleTitle || snapshot.vin ? "ready" : "danger" },
    { label: "Search context", value: snapshot.query || snapshot.workbenchTitle ? "active" : "missing", tone: snapshot.query || snapshot.workbenchTitle ? "ready" : "warn" },
    { label: "Proof vault", value: `${snapshot.proofVault?.matchingJobs ?? 0} jobs / ${snapshot.proofVault?.files ?? 0} files`, tone: snapshot.proofVault?.files ? "ready" : "warn" },
    { label: "Part history", value: `${snapshot.partHistory?.matchedJobs ?? 0} jobs`, tone: snapshot.partHistory?.matchedJobs ? "ready" : "warn" },
    { label: "AI memory", value: `${memory.feedback?.used || 0} used / ${memory.shopRules?.total || 0} rules`, tone: memory.shopRules?.total ? "ready" : "warn" },
    { label: "Coverage proof", value: snapshot.coverage?.observedCoveragePercent !== undefined ? `${snapshot.coverage.observedCoveragePercent}%` : "not loaded", tone: Number(snapshot.coverage?.observedCoveragePercent || 0) >= 70 ? "ready" : "warn" },
  ];

  return {
    generatedAt: new Date().toISOString(),
    title: "TimLock Field Commander",
    headline:
      fieldPacket.readinessScore >= 85
        ? `${subject}: ready for normal field verification`
        : fieldPacket.blockers?.length
          ? `${subject}: fix blockers before dispatch`
          : `${subject}: usable, but tighten proof before trusting it`,
    mission: {
      subject,
      decision: fieldPacket.dispatchDecision,
      nextBestAction: fieldPacket.nextBestAction,
      customerSafeNote: fieldPacket.copyBlocks?.customerNote || "",
      workOrderNote: fieldPacket.copyBlocks?.workOrderNote || "",
    },
    readinessScore: fieldPacket.readinessScore,
    readinessLabel: fieldPacket.readinessLabel,
    personality: memory.personality,
    fieldPacket,
    actionStack,
    riskRadar,
    dataScorecards,
    learningLoop: {
      signals: memory.learningSignals || [],
      shopRules: memory.shopRules?.relevant || [],
      corrections: memory.corrections || [],
      saveBackChecklist: fieldPacket.saveBackChecklist || [],
      trainingInstruction: "Every worked job, proof attachment, AI feedback mark, and saved shop rule changes future recommendations.",
    },
    advisor,
  };
}

function aiActionsForIntent(intent, snapshot) {
  const actions = [
    { label: "Open Workbench", target: "workbench", prompt: "What should I do next from this packet?" },
    { label: "Proof Vault", target: "proof-vault", prompt: "What proof is missing for this job?" },
  ];
  if (["parts", "next", "quote", "coverage"].includes(intent)) {
    actions.push({ label: "Part History", target: "part-history", prompt: `Is ${snapshot.query || "this part"} proven enough to trust?` });
  }
  if (["lishi", "next", "vin"].includes(intent)) {
    actions.push({ label: "Lishi Lookup", target: "lishi", prompt: "Build a Lishi verification checklist." });
  }
  if (["code", "next", "vin"].includes(intent)) {
    actions.push({ label: "Code Desk", target: "code-desk", prompt: "What do I need before using code data?" });
  }
  if (["coverage", "proof"].includes(intent)) {
    actions.push({ label: "Coverage", target: "coverage", prompt: "Where are my biggest coverage gaps?" });
  }
  return actions.slice(0, 6);
}

function aiSuggestedPrompts(intent, snapshot) {
  const subject = snapshot.query || snapshot.vehicleTitle || "this job";
  return uniqueCleanValues([
    "What is the safest next move?",
    `Create a technician checklist for ${subject}`,
    `What proof is missing for ${subject}?`,
    `Create a customer-facing note for ${subject}`,
    intent !== "coverage" ? "What coverage gaps should I fix?" : "Which proof gaps should I fix first?",
  ]).slice(0, 5);
}

function aiContextFacts(snapshot) {
  return uniqueCleanValues([
    snapshot.screen ? `Screen: ${snapshot.screen}` : "",
    snapshot.vehicleTitle ? `Vehicle: ${snapshot.vehicleTitle}` : "",
    snapshot.vin ? `VIN: ${snapshot.vin}` : "",
    snapshot.query ? `Search: ${snapshot.query}` : "",
    snapshot.brief?.decision ? `Workbench: ${snapshot.brief.decision}` : "",
    snapshot.partHistory?.matchedJobs !== undefined ? `Part proof: ${snapshot.partHistory.matchedJobs} jobs / ${snapshot.partHistory.matchedReferenceRows || 0} reference rows` : "",
    snapshot.proofVault?.matchingJobs !== undefined ? `Vault: ${snapshot.proofVault.matchingJobs} proof records` : "",
    snapshot.lishi?.matchedTools !== undefined ? `Lishi: ${snapshot.lishi.matchedTools} tools` : "",
    snapshot.codeDesk?.autoMatches !== undefined ? `Code Desk: ${snapshot.codeDesk.autoMatches} auto rows` : "",
    snapshot.coverage?.observedCoveragePercent !== undefined ? `Coverage: ${snapshot.coverage.observedCoveragePercent}% observed` : "",
  ]).slice(0, 8);
}

function aiResponseForIntent(intent, snapshot, checklist, fieldPacket = null, memory = {}) {
  const subject = snapshot.vehicleTitle || snapshot.query || snapshot.workbenchTitle || "this job";
  const confidence = snapshot.brief?.confidencePercent ? ` Packet confidence is ${snapshot.brief.confidenceLabel || "developing"} at ${snapshot.brief.confidencePercent}%.` : "";
  const lead = snapshot.brief?.decision || `Use ${subject} as the current job context.`;
  const facts = aiContextFacts(snapshot).slice(0, 4).join(" ");
  const fieldReadiness = fieldPacket
    ? ` AI readiness is ${fieldPacket.readinessScore}% (${fieldPacket.readinessLabel}). ${fieldPacket.dispatchDecision}`
    : "";
  const personaLine = memory.personality?.catchphrase ? `${memory.personality.catchphrase} ` : "";
  const ruleLine = memory.shopRules?.relevant?.length
    ? ` Shop memory in play: ${memory.shopRules.relevant.slice(0, 2).map((rule) => rule.title).join("; ")}.`
    : "";
  const correctionLine = memory.corrections?.length
    ? ` Prior correction to respect: ${memory.corrections.slice(0, 2).map((item) => item.note || item.title).join("; ")}.`
    : "";
  const playbooks = {
    next: `${personaLine}${lead}${confidence}${fieldReadiness} Best next move: verify authorization, then use the Workbench packet to move through part proof, Lishi/keyway verification, Code Desk only if authorized, and Proof Vault documentation.${ruleLine}${correctionLine} ${facts}`,
    quote: `${personaLine}Quote prep for ${subject}:${fieldReadiness} Give a range only after authorization, exact key/FCC/blade confirmation, parts availability, programmer path, trip/after-hours factors, and any module/battery contingencies are clear.${ruleLine}${correctionLine} ${snapshot.brief?.customerNote || ""}`,
    proof: `${personaLine}Proof review for ${subject}:${fieldReadiness} The job is stronger when ID/registration or fleet authorization, exact part number, programmer result, outcome, and photos/docs are attached.${ruleLine}${correctionLine} ${facts}`,
    parts: `${personaLine}Parts guidance for ${subject}:${fieldReadiness} Start from LR/MW/TI/OE/FCC cross-reference, compare saved jobs, and do not order from a single alias until buttons, FCC/frequency, blade/keyway, chip, and condition are verified.${ruleLine}${correctionLine}`,
    lishi: `${personaLine}Lishi guidance for ${subject}:${fieldReadiness} Treat the imported tool match as a shortlist. Confirm keyway from the lock, insert, or authorized code source before using it, then save the confirmed tool/keyway to the worked job.${ruleLine}${correctionLine}`,
    code: `${personaLine}Code Desk guidance for ${subject}:${fieldReadiness} Use only authorized code data, verify the exact depth-space system and blank, and treat reverse/bitting matches as verification clues until confirmed against the vehicle and lock.${ruleLine}${correctionLine}`,
    coverage: `${personaLine}Coverage guidance:${fieldReadiness} Use the percentages as observed shop proof. Improve the score by adding programmer names, exact part numbers, outcomes, and proof attachments to jobs with missing data.${ruleLine}${correctionLine}`,
    vin: `${personaLine}VIN guidance for ${subject}:${fieldReadiness} Make sure the decoded vehicle matches the customer vehicle, select the key family, verify parts/programmer/Lishi, then send the packet to Workbench before dispatch.${ruleLine}${correctionLine}`,
    general: `${personaLine}${lead}${confidence}${fieldReadiness} I can help turn the current screen into a technician checklist, proof audit, quote note, part verification path, or customer-safe summary.${ruleLine}${correctionLine} ${facts}`,
  };
  return `${playbooks[intent] || playbooks.general} Checklist: ${checklist.slice(0, 4).join("; ")}.`;
}

function aiDecision(prompt, context = {}, memory = {}) {
  const normalized = prompt.toLowerCase();
  const blocked = ["bypass", "steal", "break in", "hotwire", "hide from", "no permission"].some((term) =>
    normalized.includes(term),
  );
  const snapshot = aiContextSnapshot(context);
  const intent = aiIntent(prompt);
  const checklist = aiChecklistForIntent(intent, snapshot, memory);
  const fieldPacket = aiFieldPacket(intent, snapshot, checklist, memory);

  if (blocked) {
    return {
      title: "Blocked request",
      riskLevel: "blocked",
      policyDecision: "refused",
      response:
        "I can help with lawful locksmith workflow, verification, quote prep, and documentation. I cannot provide bypass instructions or guidance for unauthorized entry.",
      checklist: ["Confirm authorization", "Keep notes customer-safe", "Use lawful service workflow only"],
      nextActions: [{ label: "Proof Vault", target: "proof-vault", prompt: "What proof is required before this work?" }],
      suggestedPrompts: ["Build a lawful verification checklist", "Create a customer-safe service note"],
      contextSummary: aiContextFacts(snapshot),
      personality: memory.personality || aiPersonalityProfile(),
      memory,
      fieldPacket: {
        ...fieldPacket,
        readinessScore: 0,
        readinessLabel: "Blocked",
        priority: "Refused",
        dispatchDecision: "This request cannot be supported. Use lawful verification and documentation workflow only.",
        copyBlocks: {
          customerNote: "This request requires lawful authorization and cannot proceed as described. We can continue only with verified ownership/authorization and normal locksmith documentation.",
          workOrderNote: "AI blocked an unsafe or unauthorized-style request. Continue only with verified authorization, proof capture, and lawful service workflow.",
          technicianChecklist: "1. Confirm authorization\n2. Document customer identity or fleet approval\n3. Use lawful service workflow only",
        },
      },
    };
  }

  const nextActions = aiActionsForIntent(intent, snapshot);
  return {
    title:
      intent === "quote"
        ? "Quote prep"
        : intent === "proof"
          ? "Proof audit"
          : intent === "parts"
            ? "Parts verification"
            : intent === "lishi"
              ? "Lishi verification"
              : intent === "code"
                ? "Code Desk guidance"
                : intent === "coverage"
                  ? "Coverage guidance"
                  : "AI field brief",
    riskLevel: "low",
    policyDecision: snapshot.brief ? "allowed_with_verified_job_context" : "allowed_with_screen_context",
    intent,
    response: aiResponseForIntent(intent, snapshot, checklist, fieldPacket, memory),
    checklist,
    nextActions,
    suggestedPrompts: aiSuggestedPrompts(intent, snapshot),
    contextSummary: aiContextFacts(snapshot),
    recommendedRoute: nextActions[0]?.target || fieldPacket.nextBestAction?.target || "workbench",
    fieldPacket,
    personality: memory.personality || aiPersonalityProfile(context.appMode || "owner"),
    memory,
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

function decodedFact(result, label, key) {
  const value = valueFromDecode(result, key);
  return value ? { label, value } : null;
}

function decodeLabelFromKey(key) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\bID\b/g, "ID")
    .replace(/\bVIN\b/g, "VIN")
    .trim();
}

function decodedVehicleGroups(decode) {
  if (!decode) return [];
  const groupedKeys = new Set([
    "ModelYear",
    "Make",
    "Model",
    "Trim",
    "Trim2",
    "Series",
    "VehicleType",
    "Manufacturer",
    "BodyClass",
    "CabType",
    "Doors",
    "DriveType",
    "GVWR",
    "BrakeSystemType",
    "EngineModel",
    "DisplacementL",
    "EngineConfiguration",
    "EngineCylinders",
    "FuelTypePrimary",
    "TransmissionStyle",
    "PlantCompanyName",
    "PlantCity",
    "PlantState",
    "PlantCountry",
    "DestinationMarket",
    "SeatBeltsAll",
    "Pretensioner",
    "AirBagLocFront",
    "AirBagLocSide",
    "AirBagLocCurtain",
    "TPMS",
    "ErrorCode",
    "ErrorText",
    "SuggestedVIN",
    "AdditionalErrorText",
  ]);
  const groups = [
    {
      title: "Identity",
      facts: [
        decodedFact(decode, "Model year", "ModelYear"),
        decodedFact(decode, "Make", "Make"),
        decodedFact(decode, "Model", "Model"),
        decodedFact(decode, "Trim", "Trim"),
        decodedFact(decode, "Trim 2", "Trim2"),
        decodedFact(decode, "Series", "Series"),
        decodedFact(decode, "Vehicle type", "VehicleType"),
        decodedFact(decode, "Manufacturer", "Manufacturer"),
      ],
    },
    {
      title: "Body",
      facts: [
        decodedFact(decode, "Body class", "BodyClass"),
        decodedFact(decode, "Cab type", "CabType"),
        decodedFact(decode, "Doors", "Doors"),
        decodedFact(decode, "Drive type", "DriveType"),
        decodedFact(decode, "GVWR", "GVWR"),
        decodedFact(decode, "Brake system", "BrakeSystemType"),
      ],
    },
    {
      title: "Powertrain",
      facts: [
        decodedFact(decode, "Engine", "EngineModel"),
        decodedFact(decode, "Displacement", "DisplacementL"),
        decodedFact(decode, "Engine configuration", "EngineConfiguration"),
        decodedFact(decode, "Cylinders", "EngineCylinders"),
        decodedFact(decode, "Fuel", "FuelTypePrimary"),
        decodedFact(decode, "Transmission", "TransmissionStyle"),
      ],
    },
    {
      title: "Build",
      facts: [
        decodedFact(decode, "Plant company", "PlantCompanyName"),
        decodedFact(decode, "Plant city", "PlantCity"),
        decodedFact(decode, "Plant state", "PlantState"),
        decodedFact(decode, "Plant country", "PlantCountry"),
        decodedFact(decode, "Destination market", "DestinationMarket"),
      ],
    },
    {
      title: "Safety and equipment",
      facts: [
        decodedFact(decode, "Seat belts", "SeatBeltsAll"),
        decodedFact(decode, "Pretensioner", "Pretensioner"),
        decodedFact(decode, "Front airbags", "AirBagLocFront"),
        decodedFact(decode, "Side airbags", "AirBagLocSide"),
        decodedFact(decode, "Curtain airbags", "AirBagLocCurtain"),
        decodedFact(decode, "TPMS", "TPMS"),
      ],
    },
    {
      title: "Decode status",
      facts: [
        decodedFact(decode, "Error code", "ErrorCode"),
        decodedFact(decode, "Error text", "ErrorText"),
        decodedFact(decode, "Suggested VIN", "SuggestedVIN"),
        decodedFact(decode, "Additional error text", "AdditionalErrorText"),
      ],
    },
  ];

  const additionalFacts = Object.keys(decode)
    .filter((key) => !groupedKeys.has(key))
    .map((key) => decodedFact(decode, decodeLabelFromKey(key), key))
    .filter(Boolean)
    .filter((fact) => !/^\d+$/.test(String(fact.value)))
    .slice(0, 36);

  if (additionalFacts.length) {
    groups.push({
      title: "Additional decoded fields",
      facts: additionalFacts,
    });
  }

  return groups
    .map((group) => ({ ...group, facts: group.facts.filter(Boolean) }))
    .filter((group) => group.facts.length);
}

function vehicleFamily(make, model) {
  const text = `${make} ${model}`.toLowerCase();
  if (text.includes("ford") || text.includes("lincoln")) return "ford";
  if (text.includes("toyota") || text.includes("lexus")) return "toyota";
  if (text.includes("honda") || text.includes("acura")) return "honda";
  if (text.includes("chevrolet") || text.includes("gmc") || text.includes("cadillac") || text.includes("buick")) {
    return "gm";
  }
  if (text.includes("chrysler") || text.includes("dodge") || text.includes("jeep") || text.includes("ram")) return "chrysler";
  if (text.includes("fiat") || text.includes("alfa romeo") || text.includes("maserati")) return "chrysler";
  if (text.includes("nissan") || text.includes("infiniti")) return "nissan";
  if (text.includes("hyundai") || text.includes("kia") || text.includes("genesis")) return "hyundai";
  if (text.includes("mazda")) return "mazda";
  if (text.includes("subaru")) return "subaru";
  if (text.includes("volkswagen") || text.includes("audi")) return "vw";
  if (text.includes("bmw") || text.includes("mini")) return "bmw";
  if (text.includes("mercedes")) return "mercedes";
  if (text.includes("mitsubishi")) return "mitsubishi";
  if (text.includes("porsche")) return "porsche";
  if (text.includes("jaguar") || text.includes("land rover") || text.includes("range rover")) return "jlr";
  if (text.includes("volvo") || text.includes("polestar")) return "volvo";
  if (text.includes("tesla")) return "tesla";
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

function lishiTokens(value) {
  return normalizeVehicleText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function lishiTextMatch(haystack, needle) {
  const normalizedHaystack = normalizeVehicleText(haystack);
  const normalizedNeedle = normalizeVehicleText(needle);
  return Boolean(normalizedNeedle && (normalizedHaystack === normalizedNeedle || normalizedHaystack.includes(normalizedNeedle)));
}

function lishiApplicationYearMatches(application, year) {
  const target = Number(year);
  if (!target) return true;
  if (!application.yearStart && !application.yearEnd) return true;
  const start = Number(application.yearStart) || 0;
  const end = Number(application.yearEnd) || (application.yearOpenEnded ? 9999 : start);
  return target >= start && target <= end;
}

function lishiVehicleApplicationScore(application, { make, model, year }) {
  let score = 0;
  if (make) {
    if (!lishiTextMatch(application.manufacturer, make)) return 0;
    score += 80;
  }
  if (model) {
    const modelTokens = lishiTokens(model);
    const applicationText = normalizeVehicleText(`${application.model} ${application.sourceTitle}`);
    const matchedTokens = modelTokens.filter((token) => applicationText.includes(token));
    if (modelTokens.length && !matchedTokens.length) return 0;
    score += matchedTokens.length * 35;
    if (modelTokens.length && matchedTokens.length === modelTokens.length) score += 35;
  }
  if (year) {
    if (!lishiApplicationYearMatches(application, year)) return 0;
    score += application.yearStart || application.yearEnd ? 28 : 8;
  }
  return score;
}

function lishiHasVehicleContext(options = {}) {
  return Boolean(cleanString(options.make) || cleanString(options.model) || cleanString(options.year));
}

function lishiToolAliasTokens(tool = {}) {
  return [tool.tool, tool.canonical, ...(tool.aliases || [])]
    .map((value) => normalizeVehicleText(value).replace(/\s+/g, ""))
    .filter(Boolean);
}

function lishiQueryHasToolAlias(tool = {}, query = "") {
  const queryNorm = normalizeVehicleText(query);
  if (!queryNorm) return false;
  const queryCompact = queryNorm.replace(/\s+/g, "");
  const queryTokens = lishiTokens(query).map((token) => token.replace(/\s+/g, ""));
  return lishiToolAliasTokens(tool).some((alias) => queryCompact === alias || queryTokens.includes(alias));
}

function lishiVehicleApplicationMatches(applications = [], options = {}) {
  return applications
    .map((application) => ({
      application,
      score: lishiVehicleApplicationScore(application, options),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.application.model).localeCompare(String(b.application.model)));
}

function lishiToolEvidence(tool = {}, applications = [], options = {}) {
  const vehicleContext = lishiHasVehicleContext(options);
  const vehicleMatches = lishiVehicleApplicationMatches(applications, options);
  const exactToolQuery = lishiQueryHasToolAlias(tool, options.q);
  const bestVehicleScore = vehicleMatches[0]?.score || 0;
  const vehicleConfirmed = Boolean(vehicleContext && vehicleMatches.length);
  const matchStatus = vehicleConfirmed
    ? "vehicle-confirmed"
    : vehicleContext && exactToolQuery
      ? "keyway-shortlist"
      : vehicleContext
        ? "verify-required"
        : exactToolQuery
          ? "tool-confirmed"
          : "search-match";
  const confidencePercent = vehicleConfirmed
    ? Math.min(98, 72 + Math.min(26, Math.round(bestVehicleScore / 8)))
    : matchStatus === "tool-confirmed"
      ? 90
      : matchStatus === "keyway-shortlist"
        ? 58
        : matchStatus === "search-match"
          ? 54
          : 30;
  const warnings = uniqueCleanValues([
    vehicleContext && !vehicleConfirmed ? "No imported vehicle/application row confirmed this exact year/make/model." : "",
    matchStatus === "keyway-shortlist" ? "Tool/keyway token matched, but the vehicle row did not confirm it. Verify at the lock or insert." : "",
    matchStatus === "verify-required" ? "Confirm the mechanical keyway at the vehicle before choosing a Lishi." : "",
  ]);
  return {
    vehicleConfirmed,
    matchStatus,
    matchLabel:
      matchStatus === "vehicle-confirmed"
        ? "Vehicle match"
        : matchStatus === "keyway-shortlist"
          ? "Verify keyway"
          : matchStatus === "tool-confirmed"
            ? "Tool match"
            : matchStatus === "verify-required"
              ? "Verify required"
              : "Search match",
    confidencePercent,
    vehicleMatches,
    warnings,
  };
}

function lishiToolSearchText(tool, applications = []) {
  return [
    tool.tool,
    tool.canonical,
    ...(tool.aliases || []),
    ...(tool.categories || []),
    tool.primaryFunction,
    ...(tool.manufacturers || []),
    tool.closestYears,
    ...applications.slice(0, 12).flatMap((application) => [application.manufacturer, application.model, application.yearsText]),
  ]
    .filter(Boolean)
    .join(" ");
}

function lishiToolScore(tool, applications, options) {
  const query = cleanString(options.q);
  const category = cleanString(options.category);
  let score = 0;
  let queryMatched = false;
  if (query) {
    const queryNorm = normalizeVehicleText(query);
    const exactAliases = [tool.tool, tool.canonical, ...(tool.aliases || [])].map(normalizeVehicleText);
    if (exactAliases.includes(queryNorm)) {
      score += 240;
      queryMatched = true;
    }
    const haystack = normalizeVehicleText(lishiToolSearchText(tool, applications));
    const tokens = lishiTokens(query);
    const tokenHits = tokens.filter((token) => haystack.includes(token)).length;
    if (!tokenHits && !haystack.includes(queryNorm)) return 0;
    queryMatched = true;
    score += tokenHits * 32 + (haystack.includes(queryNorm) ? 60 : 0);
  }
  if (category && !(tool.categories || []).some((item) => lishiTextMatch(item, category))) return 0;
  const vehicleScores = applications.map((application) => lishiVehicleApplicationScore(application, options)).filter(Boolean);
  if (lishiHasVehicleContext(options) && !vehicleScores.length && !lishiQueryHasToolAlias(tool, query)) return 0;
  if ((options.make || options.model || options.year) && !vehicleScores.length && !queryMatched) return 0;
  score += vehicleScores.reduce((total, item) => total + item, 0);
  score += Math.min(60, Number(tool.pdfCoverageRows || tool.applicationCount || 0));
  return score || (query || category || options.make || options.model || options.year ? 0 : 1);
}

function publicLishiTool(tool, applications = [], score = 0, evidence = {}) {
  return {
    id: tool.id,
    score,
    confidencePercent: evidence.confidencePercent || 0,
    matchStatus: evidence.matchStatus || "search-match",
    matchLabel: evidence.matchLabel || "Search match",
    vehicleConfirmed: Boolean(evidence.vehicleConfirmed),
    warnings: evidence.warnings || [],
    tool: tool.tool,
    canonical: tool.canonical,
    categories: tool.categories || [],
    primaryFunction: tool.primaryFunction,
    manufacturers: tool.manufacturers || [],
    closestYears: tool.closestYears,
    pdfCoverageRows: tool.pdfCoverageRows || 0,
    aliases: tool.aliases || [],
    sourceNote: tool.sourceNote,
    applicationCount: applications.length || tool.applicationCount || 0,
    vehicleMatchedApplications: (evidence.vehicleMatches || []).slice(0, 6).map((item) => item.application),
    applications: applications.slice(0, 10),
  };
}

function buildLishiLookup(reference, options = {}) {
  const limit = Math.max(1, Math.min(150, Number(options.limit) || 60));
  const applicationsByTool = new Map();
  for (const application of reference.applications || []) {
    if (!applicationsByTool.has(application.canonicalId)) applicationsByTool.set(application.canonicalId, []);
    applicationsByTool.get(application.canonicalId).push(application);
  }
  const scoredTools = (reference.tools || [])
    .map((tool) => {
      const applications = applicationsByTool.get(tool.id) || [];
      const evidence = lishiToolEvidence(tool, applications, options);
      return { tool, applications, evidence, score: lishiToolScore(tool, applications, options) };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        Number(b.evidence.vehicleConfirmed) - Number(a.evidence.vehicleConfirmed) ||
        b.evidence.confidencePercent - a.evidence.confidencePercent ||
        b.score - a.score ||
        String(a.tool.canonical).localeCompare(String(b.tool.canonical)),
    );

  const matchedApplications = (reference.applications || [])
    .map((application) => {
      const queryText = `${application.canonical} ${application.toolFromPdf} ${application.manufacturer} ${application.model} ${application.yearsText} ${application.sourceTitle}`;
      const vehicleScore = lishiVehicleApplicationScore(application, options);
      let score = vehicleScore;
      if (options.q && lishiTextMatch(queryText, options.q)) score += lishiHasVehicleContext(options) ? (vehicleScore ? 20 : 0) : 80;
      return { ...application, score };
    })
    .filter((application) => application.score > 0)
    .sort((a, b) => b.score - a.score || String(a.manufacturer).localeCompare(String(b.manufacturer)));
  const confirmedTools = scoredTools.filter((item) => item.evidence.vehicleConfirmed).length;
  const keywayShortlistTools = scoredTools.filter((item) => item.evidence.matchStatus === "keyway-shortlist").length;
  const vehicleContext = lishiHasVehicleContext(options);
  const matchStatus = confirmedTools
    ? "vehicle-confirmed"
    : vehicleContext && keywayShortlistTools
      ? "keyway-shortlist"
      : vehicleContext
        ? "verify-required"
        : scoredTools.length
          ? "search-match"
          : "no-match";

  return {
    generatedAt: reference.generatedAt,
    sourceWorkbook: reference.sourceWorkbook,
    sourcePathNote: reference.sourcePathNote,
    stats: reference.stats || { tools: 0, applications: 0 },
    categories: reference.categories || [],
    manufacturers: reference.manufacturers || [],
    query: {
      q: cleanString(options.q),
      year: cleanString(options.year),
      make: cleanString(options.make),
      model: cleanString(options.model),
      category: cleanString(options.category),
    },
    returnedTools: Math.min(limit, scoredTools.length),
    matchedTools: scoredTools.length,
    confirmedTools,
    keywayShortlistTools,
    matchStatus,
    decision:
      matchStatus === "vehicle-confirmed"
        ? "Use the vehicle-confirmed Lishi shortlist, then verify at the lock."
        : matchStatus === "keyway-shortlist"
          ? "Treat these as keyway candidates only. Confirm at the lock or insert before use."
          : vehicleContext
            ? "No vehicle-confirmed Lishi row was found. Verify the mechanical keyway at the vehicle."
            : "Search results are not vehicle-confirmed until year/make/model are supplied.",
    matchedApplications: matchedApplications.length,
    tools: scoredTools.slice(0, limit).map((item) => publicLishiTool(item.tool, item.applications, item.score, item.evidence)),
    applications: matchedApplications.slice(0, limit),
    cleanupNotes: (reference.cleanupNotes || []).slice(0, 20),
    sources: reference.sources || [],
  };
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
  if (/F\s?150|F150/.test(base)) tokens.add("F 150").add("F150").add("F-150").add("F SERIES").add("F-SERIES");
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
  const normalizedToken = normalizeVehicleText(token);
  const compactProduct = productText.replace(/[^A-Z0-9]/g, "");
  const compactToken = normalizedToken.replace(/[^A-Z0-9]/g, "");
  const trailingNumericToken = compactToken.match(/[A-Z]+(\d{4,})$/)?.[1] || "";
  return (
    productText.includes(normalizedToken) ||
    compactProduct.includes(compactToken) ||
    (trailingNumericToken.length >= 4 && compactProduct.includes(trailingNumericToken))
  );
}

function jobReferenceTokens(job) {
  const tokens = new Set();
  const text = partHistoryJobText(job);
  for (const match of text.matchAll(/\b(?:[A-Z]{2,5}\d{3,5}|\d{3}-R\d{4}R?|[A-Z0-9]{3,}-[A-Z0-9]{3,})\b/gi)) {
    tokens.add(match[0].toUpperCase());
  }
  lishiKeywayTokensFromText(text).forEach((token) => tokens.add(token));
  return Array.from(tokens);
}

function normalizeLishiKeywayToken(value) {
  const text = cleanString(value).toUpperCase();
  if (!text) return "";
  const cleaned = text
    .replace(/\b(?:LISHI|DECODER|PICK|READER|KEYWAY|VERIFY|CONFIRM|GENUINE|CLASSIC)\b/g, " ")
    .replace(/\bV\s*\.\s*(\d)\b/g, "V$1")
    .replace(/\s+/g, " ")
    .trim();
  const compact = cleaned.replace(/[^A-Z0-9]+/g, "");
  if (/^(?:HU|FO|CY|TOY|TR|DAT|NSN|NIS|NI|MIT|MZ|MAZ|HON|HO|HD|HY|KIA|SUB|VA|VAG|SIP|GM|BW|BMW|B|H|Y|KK)\d{2,4}[A-Z]?(?:V\d|GEN\d|SINGLE|TWIN)?$/.test(compact)) {
    return compact;
  }
  return "";
}

function lishiKeywayTokensFromText(value) {
  const text = normalizeVehicleText(value);
  const tokens = new Set();
  const patterns = [
    /\b(?:HU|FO|CY|TOY|TR|DAT|NSN|NIS|NI|MIT|MZ|MAZ|HON|HO|HD|HY|KIA|SUB|VA|VAG|SIP|GM|BW|BMW)\s*[- ]?\s*\d{2,4}[A-Z]?(?:\s*(?:V\.?\s*\d|GEN(?:ERATION)?\s*\d|SINGLE|TWIN))?\b/g,
    /\b(?:B|H|Y|KK)\s*[- ]?\s*\d{2,4}[A-Z]?(?:PT|P)?\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const token = normalizeLishiKeywayToken(match[0]);
      if (token) tokens.add(token);
    }
  }
  return Array.from(tokens);
}

function jobOutcome(job) {
  const tags = (job.tags || []).map((tag) => String(tag).toLowerCase());
  const tag = tags.find((item) => item.startsWith("outcome-"));
  if (tag) return tag.replace("outcome-", "");
  if (tags.includes("verified-part")) return "worked";
  return "";
}

function proofPatternFromVin(vin) {
  const normalized = normalizeVinCandidate(vin);
  if (!normalized) return null;
  return {
    vin: normalized,
    wmi: normalized.slice(0, 3),
    vds: normalized.slice(3, 8),
    yearCode: normalized[9],
    plantCode: normalized[10],
    key: `${normalized.slice(0, 8)}*${normalized[9]}`,
    label: `${normalized.slice(0, 8)}-${normalized[9]} VIN pattern`,
  };
}

function proofVehiclePatternKey(vehicle = {}) {
  return [vehicle.year, vehicle.make, vehicle.model]
    .map((item) => normalizeVehicleText(item).replace(/\s+/g, "-"))
    .filter(Boolean)
    .join(":");
}

function proofIgnitionFamilyFromText(value) {
  const text = normalizeVehicleText(value);
  if (!text) return { key: "unknown", label: "Unknown" };
  const compact = text.replace(/[^A-Z0-9]/g, "");
  if (/\b(?:REMOTE HEAD|REMOTEHEAD|FLIP|SWITCHBLADE|RHK)\b/.test(text) || /(?:N5F|IYZ|OUC|OHT|KOB|GQ4|M3N5WY|M3NA2C)/.test(compact)) {
    return { key: "remote-head", label: "Remote head / flip" };
  }
  if (/\b(?:PROX|PROXIMITY|SMART|PUSH|PEPS|PKE|FOBIK|FOB|KEYLESS)\b/.test(text) || /(?:HYQ|KR5|CWTWB|NBG|TQ8|SY5|WAZSKE|CQOFN|M3N)/.test(compact)) {
    return { key: "proximity", label: "Prox / smart key" };
  }
  if (/\b(?:TRANSPONDER|CHIP|KEYED|H92|H94|H75|Y164|Y160|B111|B119|B120|PT|ILCO|HU101|TOY44|HO03|NI04|MIT17|HY18|KK12)\b/.test(text)) {
    return { key: "keyed", label: "Keyed / transponder" };
  }
  if (/\b(?:UNLOCK|LOCKOUT|LKP|LOCK REPAIR|REKEY)\b/.test(text)) return { key: "service-only", label: "Service-only job" };
  return { key: "unknown", label: "Unknown" };
}

function proofPatternFamilyForExpected(familyKey) {
  if (familyKey === "proximity") return "proximity";
  if (familyKey === "remote-head") return "remote-head";
  if (familyKey === "keyed") return "transponder";
  return "";
}

function countProofValue(map, value, record) {
  const clean = cleanString(value);
  if (!clean) return;
  const key = clean.toUpperCase();
  const current = map.get(key) || { value: clean, count: 0, jobIds: new Set(), vehicles: new Set() };
  current.count += 1;
  if (record?.id) current.jobIds.add(record.id);
  if (record?.vehicle?.label) current.vehicles.add(record.vehicle.label);
  map.set(key, current);
}

function proofPatternJobRecord(job, partsReference = {}) {
  const vehicle = coverageVehicleForJob(job);
  if (!vehicle.automotive) return null;
  const vins = jobVins(job);
  const patterns = vins.map(proofPatternFromVin).filter(Boolean);
  const tokens = extractPartHistoryJobTokens(job);
  const referenceRows = lookupPartsCrossReferenceRows(partsReference, tokens);
  const references = referenceRows.map(crossReferenceSummary).slice(0, 5);
  const referenceTokens = uniqueCleanValues(
    references.flatMap((reference) => [
      reference.primary,
      reference.primaryLabel,
      reference.identifiers || [],
      reference.oemPartNumbers || [],
      reference.aliases || [],
      (reference.labeledIdentifiers || []).map((item) => item.value),
    ]),
  );
  const partTokens = uniqueCleanValues([
    tokens,
    referenceTokens,
  ]).filter((token) => !normalizeVinCandidate(token));
  const lishiKeyways = uniqueCleanValues(
    [job.title, job.vehicle, job.service, job.programmer, job.sequence, job.keyCode, job.tags || [], job.notes || [], partTokens, referenceTokens]
      .flat(Infinity)
      .flatMap(lishiKeywayTokensFromText),
  );
  const family = proofIgnitionFamilyFromText(
    [job.title, job.vehicle, job.service, job.programmer, job.sequence, job.tags || [], job.notes || [], partTokens, referenceTokens].flat(Infinity).join(" "),
  );
  const outcome = partHistoryOutcome(job);
  return {
    id: job.id,
    title: job.title || job.vehicle || "Saved proof",
    vehicle,
    vins,
    patterns,
    vehicleKey: proofVehiclePatternKey(vehicle),
    partTokens,
    lishiKeyways,
    references,
    ignitionFamily: family,
    programmer: programmerDisplayName(job.programmer) || cleanString(job.programmer),
    outcome,
    schedule: job.schedule || job.createdAt || "",
  };
}

function summarizeProofPatternGroup(kind, label, records = [], partsReference = {}) {
  const partCounts = new Map();
  const lishiCounts = new Map();
  const familyCounts = new Map();
  const programmerCounts = new Map();
  const vehicleCounts = new Map();
  const vins = new Set();
  let successes = 0;
  let warnings = 0;
  let unknown = 0;

  for (const record of records) {
    (record.partTokens || []).forEach((token) => countProofValue(partCounts, token, record));
    (record.lishiKeyways || []).forEach((token) => countProofValue(lishiCounts, token, record));
    countProofValue(familyCounts, record.ignitionFamily?.label || "Unknown", record);
    countProofValue(programmerCounts, record.programmer || "Programmer not recorded", record);
    countProofValue(vehicleCounts, record.vehicle?.label || "Unknown vehicle", record);
    (record.vins || []).forEach((vin) => vins.add(vin));
    if (record.outcome?.key === "success") successes += 1;
    else if (record.outcome?.key === "warning") warnings += 1;
    else unknown += 1;
  }

  const sortedValues = (map) =>
    Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .map((item) => ({
        value: item.value,
        count: item.count,
        jobIds: Array.from(item.jobIds).slice(0, 8),
        vehicles: Array.from(item.vehicles).slice(0, 5),
      }));
  const topParts = sortedValues(partCounts).slice(0, 8).map((item) => {
    const crossRows = lookupPartsCrossReferenceRows(partsReference, [item.value]);
    const crossReferences = crossRows.map(crossReferenceSummary).slice(0, 3);
    return {
      ...item,
      crossReferences,
      oemSources: uniqueCleanValues(crossReferences.flatMap((reference) => reference.oemPartNumbers || [])).slice(0, 6),
    };
  });
  const topFamilies = sortedValues(familyCounts);
  const topFamilyLabel = topFamilies[0]?.value || "Unknown";
  const familyKey = proofIgnitionFamilyFromText(topFamilyLabel).key;
  const outcomeCoveragePercent = coveragePercent(successes, warnings);
  const base = kind === "exact-vin" ? 72 : kind === "vin-pattern" ? 58 : 44;
  const confidencePercent = records.length
    ? Math.min(98, base + Math.min(records.length * 8, 24) + (topParts.length ? 6 : 0) + (outcomeCoveragePercent !== null ? Math.min(Math.round(outcomeCoveragePercent / 8), 10) : 0))
    : 0;

  return {
    kind,
    label,
    records: records.length,
    successes,
    warnings,
    unknown,
    outcomeCoveragePercent,
    confidencePercent,
    ignitionFamily: {
      key: familyKey,
      label: topFamilyLabel,
      expectedFamily: proofPatternFamilyForExpected(familyKey),
      count: topFamilies[0]?.count || 0,
    },
    topParts,
    lishiKeyways: sortedValues(lishiCounts).slice(0, 6),
    programmers: sortedValues(programmerCounts).slice(0, 6),
    vehicles: sortedValues(vehicleCounts).slice(0, 6),
    vins: Array.from(vins).slice(0, 8),
    jobs: records.slice(0, 8).map((record) => ({
      id: record.id,
      title: record.title,
      vehicle: record.vehicle?.label || "",
      programmer: record.programmer || "",
      ignitionFamily: record.ignitionFamily?.label || "Unknown",
      lishiKeyways: (record.lishiKeyways || []).slice(0, 4),
      partTokens: (record.partTokens || []).slice(0, 8),
      outcome: record.outcome,
      schedule: record.schedule,
    })),
  };
}

function buildProofPatternBaseline(jobs = [], partsReference = {}, options = {}) {
  const targetVin = normalizeVinCandidate(options.vin);
  const targetPattern = proofPatternFromVin(targetVin);
  const targetVehicle = options.vehicle || {};
  const targetVehicleKey = proofVehiclePatternKey(targetVehicle);
  const index = jobEvidenceIndex(jobs, partsReference);
  const records = index.records.map((record) => record.proofPatternRecord).filter(Boolean);
  const exactVinRecords = targetVin
    ? (index.byVin.get(targetVin) || []).map((record) => record.proofPatternRecord).filter(Boolean)
    : [];
  const exactIds = new Set(exactVinRecords.map((record) => record.id));
  const vinPatternRecords = targetPattern
    ? (index.byPattern.get(targetPattern.key) || []).map((record) => record.proofPatternRecord).filter((record) => record && !exactIds.has(record.id))
    : [];
  const patternIds = new Set([...exactIds, ...vinPatternRecords.map((record) => record.id)]);
  const vehicleRecords = targetVehicleKey
    ? (index.byVehicle.get(targetVehicleKey.toUpperCase()) || []).map((record) => record.proofPatternRecord).filter((record) => record && !patternIds.has(record.id))
    : [];
  const groups = [
    summarizeProofPatternGroup("exact-vin", targetVin ? `Exact VIN ${targetVin}` : "Exact VIN", exactVinRecords, partsReference),
    summarizeProofPatternGroup("vin-pattern", targetPattern?.label || "VIN structure pattern", vinPatternRecords, partsReference),
    summarizeProofPatternGroup("vehicle", workbenchVehicleLabel({ vehicle: targetVehicle }, "Decoded vehicle"), vehicleRecords, partsReference),
  ];
  const best = groups.find((group) => group.records) || groups[0];
  return {
    generatedAt: new Date().toISOString(),
    totalProofJobs: records.length,
    target: {
      vin: targetVin,
      pattern: targetPattern,
      vehicle: {
        year: cleanString(targetVehicle.year),
        make: cleanString(targetVehicle.make),
        model: cleanString(targetVehicle.model),
        trim: cleanString(targetVehicle.trim),
        key: targetVehicleKey,
      },
    },
    best,
    groups,
    proofNote:
      "Proof Pattern learns from imported/saved Proof Vault jobs. It ranks exact VIN first, then VIN structure pattern, then same year/make/model. Always verify FCC, keyway, trim, and authorization before ordering or programming.",
  };
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
  const tokenOutcomes = evidenceJobs.flatMap((job) => {
    const outcome = jobOutcome(job);
    if (!outcome) return [];
    return jobReferenceTokens(job).map((token) => ({ token, outcome, jobId: job.id }));
  });
  const positiveTokens = [...new Set(tokenOutcomes.filter((item) => item.outcome === "worked").map((item) => item.token))];
  const negativeTokens = [
    ...new Set(tokenOutcomes.filter((item) => item.outcome && item.outcome !== "worked" && item.outcome !== "ordered-alternate").map((item) => item.token)),
  ];
  const programmers = [...new Set(evidenceJobs.map((job) => job.programmer).filter(Boolean))];
  const lishiKeyways = uniqueCleanValues(evidenceJobs.flatMap((job) => lishiKeywayTokensFromText(partHistoryJobText(job))));
  const tools = [...new Set([...tokens.filter((token) => /[A-Z]{2,5}\d{3,5}/.test(token)), ...lishiKeyways])];
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
    lishiKeyways,
    keyCodes,
    tokens,
    positiveTokens,
    negativeTokens,
    tokenOutcomes,
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
      outcome: jobOutcome(job),
    })),
    summary: evidenceJobs.length
      ? `${evidenceJobs.length} completed shop job${evidenceJobs.length === 1 ? "" : "s"} matched this lookup.`
      : "No completed shop job matched this exact vehicle yet.",
  };
}

function partHistoryIdentifierBuckets(referenceRows, query) {
  const buckets = {
    lr: [],
    gsi: [],
    mw: [],
    ml: [],
    ti: [],
    ki: [],
    oe: [],
    aliases: [],
    all: [],
  };
  for (const row of referenceRows || []) {
    buckets.lr.push(row.lrId);
    if (/^ULK/i.test(cleanString(row.gsiPartNumber))) buckets.lr.push(row.gsiPartNumber);
    else buckets.gsi.push(row.gsiPartNumber);
    buckets.mw.push(row.mwId, row.mwPartNumber);
    buckets.ml.push(row.mlPartNumber);
    buckets.ti.push(row.tiPartNumber);
    buckets.ki.push(row.kiPartNumber);
    buckets.oe.push(row.oemPartNumbers || []);
    buckets.aliases.push(row.aliases || []);
  }
  Object.keys(buckets).forEach((key) => {
    buckets[key] = uniqueCleanValues(buckets[key]);
  });
  buckets.all = uniqueCleanValues([
    buckets.lr,
    buckets.gsi,
    buckets.mw,
    buckets.ml,
    buckets.ti,
    buckets.ki,
    buckets.oe,
    buckets.aliases,
    query && !referenceRows?.length ? query : "",
  ]);
  return buckets;
}

function partHistoryPrimaryIdentifier(identifiers, query) {
  const queryToken = compactToken(query);
  const exactBucket = [
    ["LR#", identifiers.lr],
    ["MW#", identifiers.mw],
    ["GSI#", identifiers.gsi],
    ["ML#", identifiers.ml],
    ["TI#", identifiers.ti],
    ["OE#", identifiers.oe],
  ].find(([, values]) => (values || []).some((value) => compactToken(value) === queryToken));
  if (exactBucket) return `${exactBucket[0]} ${exactBucket[1].find((value) => compactToken(value) === queryToken)}`;
  if (identifiers.lr?.[0]) return `LR# ${identifiers.lr[0]}`;
  if (identifiers.mw?.[0]) return `MW# ${identifiers.mw[0]}`;
  if (identifiers.gsi?.[0]) return `GSI# ${identifiers.gsi[0]}`;
  if (identifiers.ml?.[0]) return `ML# ${identifiers.ml[0]}`;
  if (identifiers.ti?.[0]) return `TI# ${identifiers.ti[0]}`;
  if (identifiers.oe?.[0]) return `OE# ${identifiers.oe[0]}`;
  return cleanString(query) || "Part history";
}

function partHistoryUsefulToken(token) {
  const clean = compactToken(token);
  if (clean.length < 4) return false;
  if (/^\d+$/.test(clean)) return clean.length >= 5;
  if (/^(?:FORD|TOYOTA|HONDA|NISSAN|CHEVROLET|DODGE|JEEP|KIA|HYUNDAI|MAZDA|SUBARU|ACURA|LEXUS)$/.test(clean)) return false;
  return true;
}

function findPartHistoryReferenceRows(partsReference, query) {
  const exactRows = lookupPartsCrossReferenceRows(partsReference, [query]);
  if (exactRows.length) return exactRows;
  const queryTokens = partReferenceTokenVariants(query).filter((token) => token.length >= 4);
  if (!queryTokens.length) return [];
  const matches = [];
  for (const row of partsReference?.rows || []) {
    const rowTokens = (row.tokens || []).map((token) => token.normalized || compactToken(token.value)).filter(partHistoryUsefulToken);
    const matched = rowTokens.some((rowToken) =>
      queryTokens.some((queryToken) => rowToken === queryToken || (queryToken.length >= 5 && rowToken.includes(queryToken)) || (rowToken.length >= 5 && queryToken.includes(rowToken))),
    );
    if (matched) matches.push(row);
    if (matches.length >= 50) break;
  }
  return matches;
}

function partHistorySearchTokens(query, referenceRows) {
  const tokens = new Set(partReferenceTokenVariants(query));
  for (const row of referenceRows || []) {
    for (const token of row.tokens || []) tokens.add(token.normalized || compactToken(token.value));
    [
      row.mlPartNumber,
      row.lrId,
      row.gsiPartNumber,
      row.mwId,
      row.mwPartNumber,
      row.kiPartNumber,
      row.tiPartNumber,
      row.oemPartNumbers || [],
      row.aliases || [],
    ]
      .flat(Infinity)
      .forEach((value) => partReferenceTokenVariants(value).forEach((token) => tokens.add(token)));
  }
  return Array.from(tokens).filter(partHistoryUsefulToken).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function flattenSearchValues(value, depth = 0) {
  if (depth > 3 || value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenSearchValues(item, depth + 1));
  if (typeof value === "object") return Object.values(value).flatMap((item) => flattenSearchValues(item, depth + 1));
  return [cleanString(value)];
}

function partHistoryJobText(job) {
  const knownValues = [
    job.title,
    job.vehicle,
    job.vin,
    job.service,
    job.status,
    job.verification,
    job.programmer,
    job.sequence,
    job.keyCode,
    job.mileage,
    job.exactPart,
    job.partNumber,
    job.sku,
    job.oem,
    job.fcc,
    job.tags || [],
    job.notes || [],
    job.part || {},
    job.parts || [],
    job.reference || {},
    job.outcome || {},
    job.job || {},
  ];
  return knownValues
    .flat(Infinity)
    .flatMap((value) => flattenSearchValues(value))
    .filter(Boolean)
    .join(" ");
}

function partHistoryMatchedTokens(job, searchTokens) {
  const compactText = compactToken(partHistoryJobText(job));
  return searchTokens.filter((token) => compactText.includes(token) || (token.length >= 6 && compactText.includes(token.replace(/^OEM/, ""))));
}

function evidenceMatchedTokens(record, searchTokens = []) {
  const compactText = record?.compactText || "";
  if (!compactText) return [];
  return searchTokens.filter((token) => compactText.includes(token) || (token.length >= 6 && compactText.includes(token.replace(/^OEM/, ""))));
}

function extractPartHistoryJobTokens(job) {
  const tokens = new Set(jobReferenceTokens(job));
  const text = partHistoryJobText(job).toUpperCase();
  const patterns = [
    /\bTIK-[A-Z]{2,5}-\d{1,4}[A-Z]?\b/g,
    /\b(?:ULK|FRD|HON|TOY|LEX|NIS|INF|KIA|HYU|MAZ|MIT|SUB|BMW|GM|CAD|CHRY|MOP|FBK|ACU)\d{2,6}[A-Z0-9#-]*\b/g,
    /\b[A-Z]{2,8}-R?\d{2,6}[A-Z0-9-]*\b/g,
    /\b\d{3}-R\d{4}R?\b/g,
    /\b\d{5,}[A-Z0-9-]*\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (partHistoryUsefulToken(match[0])) tokens.add(match[0].replace(/,$/, ""));
    }
  }
  return Array.from(tokens).slice(0, 32);
}

function partHistoryOutcome(job) {
  const outcome = jobOutcome(job);
  if (outcome === "worked") return { key: "success", label: "Worked" };
  if (outcome && !["worked", "ordered-alternate"].includes(outcome)) return { key: "warning", label: outcome.replace(/-/g, " ") };
  const text = normalizeVehicleText([job.status, job.service, job.verification, job.tags || [], job.notes || []].flat(Infinity).join(" "));
  if (/DID NOT|FAILED|FAIL|WRONG|REVIEW|CANCEL|HOLD/.test(text)) return { key: "warning", label: "Review" };
  if (/COMPLETED|VERIFIED|WORKED|IMPORTED WORKED/.test(text)) return { key: "success", label: "Completed" };
  return { key: "unknown", label: "Unknown" };
}

function buildProgrammerHistoryEvidence(historyJobs) {
  const groups = new Map();
  for (const job of historyJobs) {
    const name = cleanString(job.programmer) || "Programmer not recorded";
    if (!groups.has(name)) {
      groups.set(name, {
        name,
        jobs: 0,
        successes: 0,
        warningsOrFailures: 0,
        unknown: 0,
        vehicles: new Set(),
        partNumbers: new Set(),
      });
    }
    const group = groups.get(name);
    group.jobs += 1;
    if (job.outcome?.key === "success") group.successes += 1;
    else if (job.outcome?.key === "warning") group.warningsOrFailures += 1;
    else group.unknown += 1;
    if (job.vehicle) group.vehicles.add(job.vehicle);
    (job.partNumbers || []).forEach((part) => group.partNumbers.add(part));
  }
  const programmers = Array.from(groups.values())
    .map((group) => {
      const denominator = group.successes + group.warningsOrFailures;
      return {
        name: group.name,
        jobs: group.jobs,
        successes: group.successes,
        warningsOrFailures: group.warningsOrFailures,
        unknown: group.unknown,
        observedCoveragePercent: denominator ? Math.round((group.successes / denominator) * 100) : null,
        vehicles: Array.from(group.vehicles).slice(0, 6),
        partNumbers: Array.from(group.partNumbers).slice(0, 10),
      };
    })
    .sort((a, b) => b.jobs - a.jobs || (b.observedCoveragePercent || 0) - (a.observedCoveragePercent || 0) || a.name.localeCompare(b.name));
  return {
    totalJobs: historyJobs.length,
    jobsWithProgrammer: historyJobs.filter((job) => cleanString(job.programmer)).length,
    programmers,
    proofNote: "Observed coverage is calculated only from saved TimLock-App job records that matched this part/cross-reference family.",
  };
}

function buildJobEvidenceRecord(job = {}, partsReference = {}) {
  const text = partHistoryJobText(job);
  const compactText = compactToken(text);
  const tokens = extractPartHistoryJobTokens(job);
  const vehicle = coverageVehicleForJob(job);
  const vins = jobVins(job);
  const patterns = vins.map(proofPatternFromVin).filter(Boolean);
  const proofPatternRecord = proofPatternJobRecord(job, partsReference);
  return {
    job,
    id: cleanString(job.id),
    title: job.title || job.vehicle || "Saved job",
    text,
    compactText,
    tokens,
    vehicle,
    vins,
    patterns,
    patternKeys: patterns.map((pattern) => pattern.key),
    vehicleKey: proofVehiclePatternKey(vehicle),
    outcome: partHistoryOutcome(job),
    programmer: programmerDisplayName(job.programmer) || cleanString(job.programmer),
    sortTime: Date.parse(job.createdAt || job.importedAt || job.schedule || "") || 0,
    proofPatternRecord,
  };
}

function buildJobEvidenceIndex(jobs = [], partsReference = {}) {
  const records = (jobs || []).map((job) => buildJobEvidenceRecord(job, partsReference));
  const byVin = new Map();
  const byPattern = new Map();
  const byVehicle = new Map();
  const byToken = new Map();
  const add = (map, key, record) => {
    if (!key) return;
    const normalized = String(key).toUpperCase();
    if (!map.has(normalized)) map.set(normalized, []);
    map.get(normalized).push(record);
  };
  for (const record of records) {
    (record.vins || []).forEach((vin) => add(byVin, vin, record));
    (record.patternKeys || []).forEach((key) => add(byPattern, key, record));
    add(byVehicle, record.vehicleKey, record);
    (record.tokens || []).forEach((token) => add(byToken, compactToken(token), record));
  }
  const sortedRecords = records.sort((a, b) => b.sortTime - a.sortTime);
  return {
    [jobEvidenceIndexMarker]: true,
    jobs,
    records: sortedRecords,
    byVin,
    byPattern,
    byVehicle,
    byToken,
  };
}

function jobEvidenceIndex(jobsOrIndex = [], partsReference = {}) {
  if (jobsOrIndex?.[jobEvidenceIndexMarker]) return jobsOrIndex;
  return buildJobEvidenceIndex(Array.isArray(jobsOrIndex) ? jobsOrIndex : [], partsReference);
}

function uniqueById(items = [], keyFn = (item) => item?.id) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = cleanString(keyFn(item));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPartHistory(query, jobs, partsReference) {
  const cleanQuery = cleanString(query);
  const referenceRows = findPartHistoryReferenceRows(partsReference, cleanQuery);
  const searchTokens = partHistorySearchTokens(cleanQuery, referenceRows);
  const crossSummaries = referenceRows.map(crossReferenceSummary);
  const index = jobEvidenceIndex(jobs, partsReference);
  const strictVin = normalizeVinCandidate(cleanQuery);
  const candidateRecords = strictVin
    ? index.byVin.get(strictVin) || []
    : searchTokens.length
      ? uniqueById(searchTokens.flatMap((token) => index.byToken.get(compactToken(token)) || []), (record) => record.id || record.title).length
        ? uniqueById(searchTokens.flatMap((token) => index.byToken.get(compactToken(token)) || []), (record) => record.id || record.title)
        : index.records
      : index.records;
  const historyJobs = candidateRecords
    .map((record) => {
      const job = record.job;
      const matchedTokens = strictVin ? [strictVin] : evidenceMatchedTokens(record, searchTokens);
      if (!matchedTokens.length) return null;
      const matchedReferenceRows = referenceRows.filter((row) =>
        (row.tokens || []).some((token) => matchedTokens.includes(token.normalized || compactToken(token.value))),
      );
      const matchedReferences = (matchedReferenceRows.length ? matchedReferenceRows : referenceRows).map(crossReferenceSummary).slice(0, 5);
      const oemSources = uniqueCleanValues(matchedReferences.flatMap((item) => item.oemPartNumbers || []));
      const partNumbers = uniqueCleanValues([
        record.tokens,
        matchedReferences.flatMap((item) => item.labeledIdentifiers?.map((entry) => `${entry.label} ${entry.value}`) || []),
      ]).slice(0, 18);
      return {
        id: job.id,
        title: job.title || job.vehicle || "Saved job",
        customer: job.customer || "",
        vehicle: job.vehicle || "",
        vin: job.vin || "",
        service: job.service || "",
        schedule: job.schedule || job.createdAt || "",
        status: job.status || "",
        programmer: job.programmer || "",
        keyCode: job.keyCode || "",
        price: job.price || "",
        payment: job.payment || "",
        partNumbers,
        matchedTokens,
        matchedReferences,
        oemSources,
        notes: job.notes || [],
        outcome: partHistoryOutcome(job),
      };
    })
    .filter(Boolean);

  const identifiers = partHistoryIdentifierBuckets(referenceRows, cleanQuery);
  return {
    query: cleanQuery,
    primaryIdentifier: partHistoryPrimaryIdentifier(identifiers, cleanQuery),
    identifiers,
    crossReferences: crossSummaries.slice(0, 12),
    searchTokens: searchTokens.slice(0, 40),
    jobs: historyJobs,
    programmerEvidence: buildProgrammerHistoryEvidence(historyJobs),
    referenceStats: {
      totalReferenceRows: partsReference?.totalRows || partsReference?.rows?.length || 0,
      matchedReferenceRows: referenceRows.length,
      searchableJobCount: index.records.length,
    },
  };
}

const coverageMakeAliases = [
  ["LAND ROVER", "Land Rover"],
  ["RANGE ROVER", "Land Rover"],
  ["CHEVROLET", "Chevrolet"],
  ["CHEVY", "Chevrolet"],
  ["CADILLAC", "Cadillac"],
  ["BUICK", "Buick"],
  ["GMC", "GMC"],
  ["CHRYSLER", "Chrysler"],
  ["DODGE", "Dodge"],
  ["JEEP", "Jeep"],
  ["RAM", "Ram"],
  ["FORD", "Ford"],
  ["LINCOLN", "Lincoln"],
  ["TOYOTA", "Toyota"],
  ["LEXUS", "Lexus"],
  ["HONDA", "Honda"],
  ["ACURA", "Acura"],
  ["NISSAN", "Nissan"],
  ["INFINITI", "Infiniti"],
  ["HYUNDAI", "Hyundai"],
  ["KIA", "Kia"],
  ["MAZDA", "Mazda"],
  ["SUBARU", "Subaru"],
  ["MITSUBISHI", "Mitsubishi"],
  ["BMW", "BMW"],
  ["MINI", "Mini"],
  ["VOLVO", "Volvo"],
  ["VOLKSWAGEN", "Volkswagen"],
  ["VW", "Volkswagen"],
  ["AUDI", "Audi"],
  ["JAGUAR", "Jaguar"],
  ["FIAT", "Fiat"],
  ["TESLA", "Tesla"],
];

const coverageModelStopWords = new Set([
  "A",
  "ADD",
  "AKL",
  "ALL",
  "AUTO",
  "BLACK",
  "BLK",
  "BLUE",
  "CUSTOMER",
  "DEALER",
  "DK",
  "DUP",
  "GRAY",
  "GREY",
  "GRY",
  "KEY",
  "KEYS",
  "LOCK",
  "RED",
  "REMOTE",
  "SMART",
  "THE",
  "UNLOCK",
  "WHITE",
  "WHT",
]);

function coverageOutcome(job) {
  const outcome = partHistoryOutcome(job);
  return outcome?.key || "unknown";
}

function coveragePercent(successes, warnings) {
  const denominator = Number(successes || 0) + Number(warnings || 0);
  return denominator ? Math.round((Number(successes || 0) / denominator) * 100) : null;
}

function coverageVehicleForJob(job = {}) {
  const source = job.vehicle || job.title || "";
  const text = normalizeVehicleText(source);
  const year = text.match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
  const alias = coverageMakeAliases.find(([needle]) => text.includes(needle));
  const make = alias?.[1] || "";
  const tokens = text.split(/\s+/).filter(Boolean);
  const aliasTokens = alias?.[0]?.split(/\s+/) || [];
  let start = -1;
  if (aliasTokens.length) {
    start = tokens.findIndex((_, index) => aliasTokens.every((part, offset) => tokens[index + offset] === part));
    if (start >= 0) start += aliasTokens.length;
  }
  if (start < 0 && year) start = tokens.indexOf(year) + 1;
  const model = tokens
    .slice(Math.max(start, 0))
    .filter((token) => token !== year && !aliasTokens.includes(token) && !coverageModelStopWords.has(token))
    .slice(0, 3)
    .join(" ");
  return {
    year,
    make,
    model,
    label: [year, make, model].filter(Boolean).join(" ") || cleanString(job.vehicle || job.title || "Unknown vehicle"),
    automotive: Boolean(make || normalizeVinCandidate(job.vin) || jobVins(job).length),
  };
}

function coverageGroup() {
  return {
    jobs: 0,
    successes: 0,
    warnings: 0,
    unknown: 0,
    vehicles: new Set(),
    programmers: new Set(),
    partNumbers: new Set(),
    jobIds: new Set(),
  };
}

function programmerDisplayName(value) {
  const text = cleanString(value);
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  if (!normalized) return "";
  if (/\bSMART\s*PRO\b/.test(normalized) || /ADVANCED DIAGNOSTICS/.test(normalized) || /\bMYKEYS\b/.test(normalized)) {
    return "Advanced Diagnostics Smart Pro";
  }
  if (/AUTEL|MAXIIM|\bIM508\b|\bIM608\b|\bKM100\b/.test(normalized)) return "Autel MaxiIM";
  if (/XHORSE|\bVVDI\b|KEY TOOL/.test(normalized)) return "Xhorse VVDI";
  if (/OBDSTAR|\bX300\b/.test(normalized)) return "OBDSTAR";
  if (/XTOOL|\bX100\b/.test(normalized)) return "XTOOL";
  if (/LONSDOR|\bK518\b/.test(normalized)) return "Lonsdor K518";
  if (/SMARTBOX/.test(normalized)) return "SmartBox";
  if (/LAUNCH|X431/.test(normalized)) return "Launch X-431";
  if (/TOPDON/.test(normalized)) return "Topdon";
  if (/TIS|TECHSTREAM/.test(normalized)) return "Toyota TIS / Techstream";
  if (/FDRS|FJDS|FORD IDS|MOTORCRAFT/.test(normalized)) return "Ford FDRS / IDS";
  if (/TECHLINE|SPS|GDS2|GM MDI/.test(normalized)) return "GM Techline / SPS";
  if (/WITECH|TECHAUTHORITY/.test(normalized)) return "Stellantis wiTECH";
  if (/\bI HDS\b|\bIHDS\b|HONDA SERVICE EXPRESS/.test(normalized)) return "Honda i-HDS";
  if (/CONSULT/.test(normalized)) return "Nissan CONSULT";
  if (/\bGDS\b|HYUNDAI TECHLINE|KIA TECHLINE/.test(normalized)) return "Hyundai/Kia GDS";
  if (/ODIS/.test(normalized)) return "VW/Audi ODIS";
  if (/ISTA|BMW AOS|ICOM/.test(normalized)) return "BMW ISTA";
  if (/XENTRY/.test(normalized)) return "Mercedes-Benz XENTRY";
  return text;
}

function isGenericProgrammerName(value) {
  return /^(ADVANCED AFTERMARKET PROGRAMMER|VALIDATED AFTERMARKET PROGRAMMER|COVERAGE-VERIFIED PROGRAMMER|PROGRAMMING PATH)$/i.test(
    cleanString(value),
  );
}

function addCoverageJob(group, job, vehicle, partNumbers) {
  group.jobs += 1;
  group.jobIds.add(job.id);
  const outcome = coverageOutcome(job);
  if (outcome === "success") group.successes += 1;
  else if (outcome === "warning") group.warnings += 1;
  else group.unknown += 1;
  if (vehicle?.label) group.vehicles.add(vehicle.label);
  if (job.programmer) group.programmers.add(programmerDisplayName(job.programmer));
  for (const part of partNumbers || []) group.partNumbers.add(part);
}

function serializeCoverageGroup(key, group) {
  return {
    key,
    jobs: group.jobs,
    successes: group.successes,
    warnings: group.warnings,
    unknown: group.unknown,
    observedCoveragePercent: coveragePercent(group.successes, group.warnings),
    vehicles: Array.from(group.vehicles).slice(0, 8),
    programmers: Array.from(group.programmers).slice(0, 8),
    partNumbers: Array.from(group.partNumbers).slice(0, 12),
  };
}

function coveragePartNumbersForJob(job, partsReference) {
  const tokens = extractPartHistoryJobTokens(job);
  const rows = lookupPartsCrossReferenceRows(partsReference, tokens);
  const references = rows.map(crossReferenceSummary);
  return uniqueCleanValues([
    references.map((reference) => reference.primaryLabel || reference.primary),
    references.flatMap((reference) => reference.identifiers || []),
    tokens,
  ]).slice(0, 16);
}

function buildCoverageDashboard(jobs = [], partsReference = {}) {
  const automotiveJobs = [];
  const makeGroups = new Map();
  const programmerGroups = new Map();
  const partGroups = new Map();
  const missingProgrammer = [];
  const missingPart = [];
  const needsOutcome = [];
  let jobsWithProgrammer = 0;
  let jobsWithPartNumbers = 0;
  let crossReferenceLinkedJobs = 0;
  let successes = 0;
  let warnings = 0;
  let unknown = 0;

  for (const job of jobs || []) {
    const vehicle = coverageVehicleForJob(job);
    if (!vehicle.automotive) continue;
    automotiveJobs.push(job);
    const outcome = coverageOutcome(job);
    if (outcome === "success") successes += 1;
    else if (outcome === "warning") warnings += 1;
    else unknown += 1;

    const partNumbers = coveragePartNumbersForJob(job, partsReference);
    const hasProgrammer = Boolean(cleanString(job.programmer));
    if (hasProgrammer) jobsWithProgrammer += 1;
    else missingProgrammer.push({ id: job.id, title: job.title || vehicle.label, vehicle: vehicle.label });
    if (partNumbers.length) jobsWithPartNumbers += 1;
    else missingPart.push({ id: job.id, title: job.title || vehicle.label, vehicle: vehicle.label });
    if (lookupPartsCrossReferenceRows(partsReference, partNumbers).length) crossReferenceLinkedJobs += 1;
    if (outcome === "unknown") needsOutcome.push({ id: job.id, title: job.title || vehicle.label, vehicle: vehicle.label });

    const makeKey = vehicle.make || "Unknown make";
    if (!makeGroups.has(makeKey)) makeGroups.set(makeKey, coverageGroup());
    addCoverageJob(makeGroups.get(makeKey), job, vehicle, partNumbers);

    const programmerKey = programmerDisplayName(job.programmer) || "Programmer not recorded";
    if (!programmerGroups.has(programmerKey)) programmerGroups.set(programmerKey, coverageGroup());
    addCoverageJob(programmerGroups.get(programmerKey), job, vehicle, partNumbers);

    const primaryPart = partNumbers[0] || "Part number not recorded";
    if (!partGroups.has(primaryPart)) partGroups.set(primaryPart, coverageGroup());
    addCoverageJob(partGroups.get(primaryPart), job, vehicle, partNumbers);
  }

  const sortCoverage = (left, right) =>
    right.jobs - left.jobs ||
    (right.observedCoveragePercent ?? -1) - (left.observedCoveragePercent ?? -1) ||
    left.key.localeCompare(right.key);
  const makeCoverage = Array.from(makeGroups.entries()).map(([key, group]) => serializeCoverageGroup(key, group)).sort(sortCoverage);
  const programmerCoverage = Array.from(programmerGroups.entries()).map(([key, group]) => serializeCoverageGroup(key, group)).sort(sortCoverage);
  const partCoverage = Array.from(partGroups.entries()).map(([key, group]) => serializeCoverageGroup(key, group)).sort(sortCoverage);
  const totalAutomotiveJobs = automotiveJobs.length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalJobs: (jobs || []).length,
      automotiveJobs: totalAutomotiveJobs,
      provenJobs: successes,
      warningJobs: warnings,
      unknownJobs: unknown,
      jobsWithProgrammer,
      jobsWithPartNumbers,
      crossReferenceLinkedJobs,
      observedCoveragePercent: coveragePercent(successes, warnings),
      programmerProofPercent: totalAutomotiveJobs ? Math.round((jobsWithProgrammer / totalAutomotiveJobs) * 100) : 0,
      partProofPercent: totalAutomotiveJobs ? Math.round((jobsWithPartNumbers / totalAutomotiveJobs) * 100) : 0,
      crossReferencePercent: totalAutomotiveJobs ? Math.round((crossReferenceLinkedJobs / totalAutomotiveJobs) * 100) : 0,
      referenceRows: partsReference?.totalRows || partsReference?.rows?.length || 0,
      referenceTokens: partsReference?.totalTokens || Object.keys(partsReference?.tokenIndex || {}).length,
    },
    makes: makeCoverage.slice(0, 18),
    programmers: programmerCoverage.slice(0, 18),
    parts: partCoverage.slice(0, 24),
    gaps: {
      missingProgrammer: missingProgrammer.slice(0, 8),
      missingPart: missingPart.slice(0, 8),
      needsOutcome: needsOutcome.slice(0, 8),
    },
    proofNote:
      "Coverage is observed from saved TimLock-App jobs. Percentages are proof of recorded shop history, not a universal guarantee for every trim or immobilizer variant.",
  };
}

function proofVaultJobRecord(job, partsReference, searchTokens = [], referenceRows = [], options = {}) {
  const includeReferences = options.includeReferences !== false;
  const extractedTokens = extractPartHistoryJobTokens(job);
  const matchedTokens = searchTokens.length ? partHistoryMatchedTokens(job, searchTokens) : [];
  const directRows = includeReferences ? lookupPartsCrossReferenceRows(partsReference, extractedTokens) : [];
  const matchedReferenceRows = matchedTokens.length
    ? referenceRows.filter((row) => (row.tokens || []).some((token) => matchedTokens.includes(token.normalized || compactToken(token.value))))
    : [];
  const rowsById = new Map([...matchedReferenceRows, ...directRows].filter(Boolean).map((row) => [row.id, row]));
  const references = Array.from(rowsById.values())
    .map(crossReferenceSummary)
    .slice(0, 6);
  const partNumbers = uniqueCleanValues([
    extractedTokens,
    references.flatMap((reference) => reference.labeledIdentifiers?.map((entry) => `${entry.label} ${entry.value}`) || []),
  ]).slice(0, 24);
  const vehicle = coverageVehicleForJob(job);
  return {
    id: job.id,
    title: job.title || job.vehicle || "Saved job",
    customer: job.customer || "",
    vehicle: job.vehicle || vehicle.label || "",
    vin: job.vin || "",
    service: job.service || "",
    schedule: job.schedule || job.createdAt || "",
    status: job.status || "",
    programmer: job.programmer || "",
    keyCode: job.keyCode || "",
    price: job.price || "",
    payment: job.payment || "",
    partNumbers,
    oemSources: uniqueCleanValues(references.flatMap((reference) => reference.oemPartNumbers || [])).slice(0, 16),
    matchedTokens,
    matchedReferences: references,
    notes: job.notes || [],
    outcome: partHistoryOutcome(job),
    proofText: partHistoryJobText(job),
  };
}

function proofVaultEvidenceRecord(record, partsReference, searchTokens = [], referenceRows = [], options = {}) {
  const job = record.job || {};
  const includeReferences = options.includeReferences !== false;
  const matchedTokens = searchTokens.length ? evidenceMatchedTokens(record, searchTokens) : [];
  const directRows = includeReferences ? lookupPartsCrossReferenceRows(partsReference, record.tokens || []) : [];
  const matchedReferenceRows = matchedTokens.length
    ? referenceRows.filter((row) => (row.tokens || []).some((token) => matchedTokens.includes(token.normalized || compactToken(token.value))))
    : [];
  const rowsById = new Map([...matchedReferenceRows, ...directRows].filter(Boolean).map((row) => [row.id, row]));
  const references = Array.from(rowsById.values())
    .map(crossReferenceSummary)
    .slice(0, 6);
  const partNumbers = uniqueCleanValues([
    record.tokens || [],
    references.flatMap((reference) => reference.labeledIdentifiers?.map((entry) => `${entry.label} ${entry.value}`) || []),
  ]).slice(0, 24);
  return {
    id: job.id,
    title: job.title || job.vehicle || "Saved job",
    customer: job.customer || "",
    vehicle: job.vehicle || record.vehicle?.label || "",
    vin: job.vin || "",
    service: job.service || "",
    schedule: job.schedule || job.createdAt || "",
    status: job.status || "",
    programmer: job.programmer || "",
    keyCode: job.keyCode || "",
    price: job.price || "",
    payment: job.payment || "",
    partNumbers,
    oemSources: uniqueCleanValues(references.flatMap((reference) => reference.oemPartNumbers || [])).slice(0, 16),
    matchedTokens,
    matchedReferences: references,
    notes: job.notes || [],
    outcome: record.outcome || partHistoryOutcome(job),
    proofText: record.text || partHistoryJobText(job),
  };
}

function proofVaultJobMatches(record, compactQuery, searchTokens) {
  if (!compactQuery && !searchTokens.length) return true;
  const compactText = compactToken([
    record.proofText,
    record.partNumbers || [],
    record.oemSources || [],
    record.programmer,
    record.vehicle,
    record.vin,
  ].flat(Infinity).join(" "));
  return compactText.includes(compactQuery) || searchTokens.some((token) => compactText.includes(token));
}

function buildProofVault(query, jobs = [], partsReference = {}) {
  const cleanQuery = cleanString(query);
  const referenceRows = cleanQuery ? findPartHistoryReferenceRows(partsReference, cleanQuery) : [];
  const searchTokens = cleanQuery ? partHistorySearchTokens(cleanQuery, referenceRows) : [];
  const compactQuery = compactToken(cleanQuery);
  const index = jobEvidenceIndex(jobs, partsReference);
  const strictVin = normalizeVinCandidate(cleanQuery);
  const tokenCandidates = cleanQuery && !strictVin
    ? uniqueById(searchTokens.flatMap((token) => index.byToken.get(compactToken(token)) || []), (record) => record.id || record.title)
    : [];
  const candidateRecords = strictVin
    ? index.byVin.get(strictVin) || []
    : tokenCandidates.length
      ? tokenCandidates
      : index.records;
  const matchedEvidence = cleanQuery
    ? candidateRecords.filter((record) => {
        if (strictVin) return record.vins.includes(strictVin);
        if (searchTokens.length && evidenceMatchedTokens(record, searchTokens).length) return true;
        return compactQuery && record.compactText.includes(compactQuery);
      })
    : candidateRecords;
  const matchedRecords = matchedEvidence.map((record) =>
    proofVaultEvidenceRecord(record, partsReference, searchTokens, referenceRows, { includeReferences: Boolean(cleanQuery) }),
  );
  const records = cleanQuery ? matchedRecords.slice(0, 80) : matchedRecords.slice(0, 16);
  const history = cleanQuery ? buildPartHistory(cleanQuery, index, partsReference) : null;
  return {
    generatedAt: new Date().toISOString(),
    query: cleanQuery,
    mode: cleanQuery ? "search" : "recent",
    summary: {
      totalJobs: index.records.length,
      matchingJobs: matchedRecords.length,
      shownJobs: records.length,
      referenceRows: partsReference?.totalRows || partsReference?.rows?.length || 0,
      matchedReferenceRows: referenceRows.length,
      provenJobs: records.filter((record) => record.outcome?.key === "success").length,
      warningJobs: records.filter((record) => record.outcome?.key === "warning").length,
      unknownJobs: records.filter((record) => record.outcome?.key === "unknown").length,
    },
    records,
    coverage: null,
    partHistory: history,
    proofNote:
      cleanQuery
        ? "Proof Vault searched saved jobs, attachments, aliases, and the parts cross-reference. Use exact LR#, MW#, OE#, VIN, FCC, or programmer terms for the cleanest proof packet."
        : "Showing recent proof only so the vault opens fast. Search an LR#, MW#, OE#, VIN, FCC, programmer, or vehicle to build a focused proof packet.",
  };
}

function applyShopEvidenceToProducts(liveSupplierLookup, shopEvidence) {
  if (!liveSupplierLookup?.products?.length || !shopEvidence?.tokens?.length) return liveSupplierLookup;
  return {
    ...liveSupplierLookup,
    products: liveSupplierLookup.products.map((product) => {
      const matchedTokens = (shopEvidence.positiveTokens?.length ? shopEvidence.positiveTokens : shopEvidence.tokens).filter((token) =>
        tokenMatchesProduct(token, product),
      );
      const negativeTokens = (shopEvidence.negativeTokens || []).filter((token) => tokenMatchesProduct(token, product));
      if (!matchedTokens.length && !negativeTokens.length) return product;
      return {
        ...product,
        score: (product.score || 0) + (matchedTokens.length ? 35 : 0) - (negativeTokens.length ? 30 : 0),
        keyInfo: {
          ...(product.keyInfo || {}),
          shopMatch: matchedTokens.slice(0, 3).join(", "),
          shopWarning: negativeTokens.slice(0, 3).join(", "),
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
    product.keyInfo?.crossReference,
    product.keyInfo?.crossReferenceOe,
    product.keyInfo?.crossReferenceAliases,
    product.customFields?.description,
  ].filter(Boolean).join(" "));
}

function referenceValuesForProduct(product = {}) {
  return uniqueCleanValues([
    product.name,
    product.id,
    product.sku,
    product.brand,
    product.source,
    product.keyInfo?.sku,
    product.keyInfo?.itemNumber,
    product.keyInfo?.oem,
    product.keyInfo?.fcc,
    product.customFields?.itemId,
    product.customFields?.displayName,
    product.customFields?.description,
  ]);
}

function applyPartsCrossReferenceToProducts(liveSupplierLookup, partsReference) {
  if (!liveSupplierLookup?.products?.length || !partsReference?.rows?.length) return liveSupplierLookup;
  return {
    ...liveSupplierLookup,
    products: liveSupplierLookup.products.map((product) => {
      const crossRows = lookupPartsCrossReferenceRows(partsReference, referenceValuesForProduct(product));
      if (!crossRows.length) return product;
      const summaries = crossRows.map(crossReferenceSummary);
      const crossIds = summaries.flatMap((item) => item.identifiers || []);
      const crossOems = summaries.flatMap((item) => item.oemPartNumbers || []);
      const crossAliases = summaries.flatMap((item) => item.aliases || []);
      return {
        ...product,
        score: (product.score || 0) + 30,
        keyInfo: {
          ...(product.keyInfo || {}),
          oem: product.keyInfo?.oem || crossOems[0] || "",
          crossReference: uniqueCleanValues(crossIds).slice(0, 6).join(", "),
          crossReferenceOe: uniqueCleanValues(crossOems).slice(0, 5).join(", "),
          crossReferenceAliases: uniqueCleanValues(crossAliases).slice(0, 6).join(", "),
        },
        customFields: {
          ...(product.customFields || {}),
          crossReferenceSource: "Parts cross-reference",
        },
      };
    }),
  };
}

function productFamily(product) {
  const text = productText(product);
  const nameText = normalizeVehicleText([product.name, product.keyInfo?.productType].filter(Boolean).join(" "));
  if (/INSERT|BLADE|EMERGENCY/.test(nameText)) return "insert";
  if (/TOOL|MACHINE|LISHI|PICK|DECODER/.test(text)) return "tool";
  if (/PROX|PROXIMITY|SMART|PUSH|PEPS/.test(nameText)) return "proximity";
  if (/FLIP|REMOTE HEAD|REMOTEHEAD|SWITCHBLADE/.test(nameText)) return "remote-head";
  if (/TRANSPONDER|CHIP/.test(nameText)) return "transponder";
  if (/\bREMOTE\b/.test(nameText)) return "remote-head";
  if (/INSERT|BLADE|EMERGENCY/.test(text)) return "insert";
  return "unknown";
}

function familyFromShopEvidence(shopEvidence) {
  const patternFamily = shopEvidence?.proofPatterns?.best?.ignitionFamily?.expectedFamily || "";
  if (patternFamily) return patternFamily;
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

function familyFromProofPatternBaseline(proofPatterns) {
  const best = proofPatterns?.best || {};
  const expectedFamily = best.ignitionFamily?.expectedFamily || "";
  if (!expectedFamily || best.ignitionFamily?.key === "unknown") return "";
  const records = Number(best.records || 0);
  const confidence = Number(best.confidencePercent || 0);
  if (best.kind === "exact-vin" && records >= 1) return expectedFamily;
  if (best.kind === "vin-pattern" && records >= 1 && confidence >= 60) return expectedFamily;
  if (best.kind === "vehicle" && records >= 3 && confidence >= 70) return expectedFamily;
  return "";
}

function expectedFamilySource(programmingReference, shopEvidence) {
  if (shopEvidence?.exactVinCount && familyFromShopEvidence(shopEvidence)) return "exact shop proof";
  if (familyFromProofPatternBaseline(shopEvidence?.proofPatterns)) return "proof pattern baseline";
  return programmingReference ? "programming reference" : "vehicle pattern";
}

function expectedFamily(vehicle, programmingReference, shopEvidence) {
  const shopFamily = shopEvidence?.exactVinCount ? familyFromShopEvidence(shopEvidence) : "";
  if (shopFamily) return shopFamily;
  const proofPatternFamily = familyFromProofPatternBaseline(shopEvidence?.proofPatterns);
  if (proofPatternFamily) return proofPatternFamily;
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

function compactToken(value) {
  return normalizeVehicleText(value).replace(/[^A-Z0-9]/g, "");
}

function directProfilePartTokens(part = {}) {
  return [part.oem, part.sku]
    .filter(Boolean)
    .flatMap((value) => {
      const text = normalizeVehicleText(value);
      const tokens = [compactToken(text)];
      for (const match of text.matchAll(/\b\d{3}-R\d{4}R?\b/g)) tokens.push(match[0].replace(/[^A-Z0-9]/g, "").replace(/R$/, ""));
      for (const match of text.matchAll(/\b[A-Z]{2,5}-?R?\d{3,5}\b/g)) tokens.push(match[0].replace(/[^A-Z0-9]/g, "").replace(/R$/, ""));
      return tokens;
    })
    .filter((token) => token && token.length >= 5);
}

function buttonCount(value) {
  return String(value || "").match(/\b([2-7])\s*(?:B|BUTTON|BTN)?\b/i)?.[1] || "";
}

function productMatchesProfilePart(product, part) {
  const text = normalizeVehicleText([
    product.name,
    product.id,
    product.sku,
    product.keyInfo?.sku,
    product.keyInfo?.itemNumber,
    product.keyInfo?.oem,
    product.keyInfo?.fcc,
  ].filter(Boolean).join(" "));
  const compact = text.replace(/[^A-Z0-9]/g, "");
  if (directProfilePartTokens(part).some((token) => compact.includes(token))) return true;

  const profileFcc = compactToken(part.fcc);
  if (!profileFcc || !compact.includes(profileFcc)) return false;
  const family = productFamily(product);
  if (["insert", "tool"].includes(family)) return false;
  const expectedButtons = buttonCount(part.buttons);
  const productButtons = buttonCount([product.keyInfo?.buttons, product.name].filter(Boolean).join(" "));
  return expectedButtons ? productButtons === expectedButtons : true;
}

function applyVehicleProfileToProducts(liveSupplierLookup, verifiedProfile) {
  if (!liveSupplierLookup?.products?.length || !verifiedProfile) return liveSupplierLookup;
  return {
    ...liveSupplierLookup,
    products: liveSupplierLookup.products.map((product) => {
      const matchedParts = (verifiedProfile.verifiedParts || []).filter((part) => productMatchesProfilePart(product, part));
      const warnedParts = (verifiedProfile.warnings || []).filter((warning) => productMatchesProfilePart(product, warning.part));
      if (!matchedParts.length && !warnedParts.length) return product;
      return {
        ...product,
        score: (product.score || 0) + (matchedParts.length ? 65 : 0) - (warnedParts.length ? 35 : 0),
        keyInfo: {
          ...(product.keyInfo || {}),
          profileMatch: matchedParts[0] ? [matchedParts[0].oem, matchedParts[0].fcc, matchedParts[0].sku].filter(Boolean).join(" / ") : "",
          profileWorkedCount: matchedParts[0]?.count || 0,
          profileSuppliers: matchedParts[0]?.suppliers || [],
          profileWarning: warnedParts[0]?.outcome || "",
        },
      };
    }),
  };
}

function evaluatePartSelection(product, vehicle, shopEvidence, programmingReference, verifiedProfile) {
  const reasons = [];
  const warnings = [];
  const missing = [];
  const text = productText(product);
  const family = productFamily(product);
  const expected = expectedFamily(vehicle, programmingReference, shopEvidence);
  const expectedSource = expectedFamilySource(programmingReference, shopEvidence);
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

  if (product.keyInfo?.shopWarning) {
    score -= shopEvidence?.exactVinCount ? 36 : 24;
    warnings.push(`shop feedback warned on ${product.keyInfo.shopWarning}`);
  }

  if (product.keyInfo?.profileMatch) {
    score += 42;
    reasons.push(`verified profile matched ${product.keyInfo.profileMatch}`);
  }

  if (product.keyInfo?.profileWarning) {
    score -= 35;
    warnings.push(`profile warning: ${product.keyInfo.profileWarning}`);
  }

  if (product.keyInfo?.crossReference) {
    score += 14;
    reasons.push("parts cross-reference linked aliases/OE");
  }

  if (expected !== "unknown") {
    if (family === expected || (expected === "transponder" && ["remote-head", "transponder"].includes(family))) {
      score += /shop proof|proof pattern/i.test(expectedSource) ? 22 : 14;
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
    : ["parts fitment", "FCC/frequency", "button layout", "blade/keyway"];
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

function applyPartSelectionEngine(liveSupplierLookup, vehicle, shopEvidence, programmingReference, verifiedProfile) {
  if (!liveSupplierLookup?.products?.length) return liveSupplierLookup;
  const products = liveSupplierLookup.products
    .map((product) => {
      const selection = evaluatePartSelection(product, vehicle, shopEvidence, programmingReference, verifiedProfile);
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

function autoCodeTemplateForVehicle(vehicle = {}) {
  const family = vehicleFamily(vehicle.make, vehicle.model);
  const year = Number(vehicle.year) || 0;
  const text = normalizeVehicleText(`${vehicle.make} ${vehicle.model} ${vehicle.trim || ""} ${vehicle.bodyClass || ""}`);
  if (["chrysler"].includes(family)) {
    return {
      id: "auto-y164",
      name: "Y164 / Chrysler-Dodge-Jeep-Ram 8-cut",
      blanks: ["Y164", "Y164-PT", "MOPAR"],
      codeCardStatus: "template-ready",
      confidence: year >= 2008 ? "medium" : "verify",
    };
  }
  if (family === "ford") {
    return {
      id: "auto-h92",
      name: year >= 2015 || /F150|F 150|EXPEDITION|NAVIGATOR|SUPER DUTY|F250|F350|BRONCO/.test(text) ? "H92/H94/H128 / Ford-Lincoln 8-cut family" : "Ford H-series edge cut family",
      blanks: ["H92", "H94", "H128", "164-R"],
      codeCardStatus: "template-ready",
      confidence: "medium",
    };
  }
  if (family === "gm") {
    return {
      id: "auto-hu100",
      name: year >= 2010 ? "HU100 / GM side-mill family" : "GM B-series edge cut family",
      blanks: year >= 2010 ? ["HU100", "B111", "B119", "B120"] : ["B86", "B97", "B99", "B106"],
      codeCardStatus: "template-ready",
      confidence: year >= 2010 ? "medium" : "verify",
    };
  }
  if (["toyota", "lexus"].includes(family)) {
    return {
      id: "auto-toy44",
      name: year >= 2010 ? "TOY44/TOY48 / Toyota-Lexus family" : "Toyota/Lexus TR/TOY family",
      blanks: ["TOY44", "TOY48", "TR47", "LXP90"],
      codeCardStatus: "template-ready",
      confidence: "medium",
    };
  }
  if (family === "honda") {
    return {
      id: "auto-honda",
      name: year >= 2003 ? "HO03/HO05/HD103 / Honda-Acura family" : "HO01 / Honda-Acura edge cut family",
      blanks: ["HO01", "HO03", "HO05", "HD103"],
      codeCardStatus: "template-ready",
      confidence: "medium",
    };
  }
  if (family === "nissan") {
    return {
      id: "auto-nissan",
      name: "NI04/NI07/DA34 / Nissan-Infiniti family",
      blanks: ["NI04", "NI07", "DA34", "X237"],
      codeCardStatus: "template-ready",
      confidence: "medium",
    };
  }
  if (family === "hyundai") {
    return {
      id: "auto-hyundai-kia",
      name: "HY/KIA laser and edge-cut family",
      blanks: ["HY15", "HY18", "HY18R", "HY20", "KK12"],
      codeCardStatus: "template-ready",
      confidence: "verify",
    };
  }
  if (family === "mazda") {
    return {
      id: "auto-mazda",
      name: "MAZ24/MZ31 Mazda family",
      blanks: ["MAZ24", "MAZ24R", "MZ31", "X249"],
      codeCardStatus: "template-ready",
      confidence: "verify",
    };
  }
  if (family === "subaru") {
    return {
      id: "auto-subaru",
      name: "SUB/DAT Subaru family",
      blanks: ["SUB4", "DAT17", "B110"],
      codeCardStatus: "template-ready",
      confidence: "verify",
    };
  }
  if (family === "vw") {
    return {
      id: "auto-vw-audi",
      name: "HU66/HU162 / VW-Audi family",
      blanks: ["HU66", "HU66T6", "HU162T"],
      codeCardStatus: "template-ready",
      confidence: "verify",
    };
  }
  if (["bmw", "mercedes"].includes(family)) {
    return {
      id: "auto-euro-high-security",
      name: "European high-security family",
      blanks: family === "bmw" ? ["HU92", "HU100R", "BMW emergency insert"] : ["HU64", "Mercedes emergency insert"],
      codeCardStatus: "template-ready",
      confidence: "verify",
    };
  }
  return {
    id: "auto-generic",
    name: "Verify keyway/card",
    blanks: [],
    codeCardStatus: "needs-template",
    confidence: "low",
  };
}

function autoDatabaseSupport(row = {}, vpicRow = null, jobs = [], observedJobCount = null) {
  const securityFlags = [
    row.requiresPin ? "PIN/passcode" : "",
    row.requiresOnline ? "online/OEM" : "",
    row.requiresBypass ? "bypass/security procedure" : "",
  ].filter(Boolean);
  const vehicle = { year: row.year, make: row.make, model: row.model };
  const matchingJobCount = Number.isFinite(Number(observedJobCount))
    ? Number(observedJobCount)
    : jobs.filter((job) => jobMatchesVehicle(job, vehicle) || jobMatchesMakeModel(job, vehicle)).length;
  return [
    {
      name: "NHTSA vPIC identity",
      status: vpicRow ? "available" : "VIN decode only",
      gives: "VIN/YMM identity, vehicle type, manufacturer model metadata",
    },
    {
      name: "Local programming reference",
      status: row.vpicOnly ? "needs import" : "available",
      gives: row.vpicOnly
        ? "vehicle identity row only; add or import programming coverage to make this production-useful"
        : [row.ignitionType, row.programMethod, row.immobilizerSystem, securityFlags.join(" + ")].filter(Boolean).join(" | ") || "programming path flags",
    },
    {
      name: "Authorized code database import",
      status: "import-ready",
      gives: "code-to-bitting, bitting-to-code, code series, and locksmith notes when you import authorized records",
    },
    {
      name: "Depth-space card import",
      status: "import-ready",
      gives: "spaces, depths, MACS, stop, and cutting card details for exact key system",
    },
    {
      name: "Proof Vault / saved jobs",
      status: matchingJobCount ? `${matchingJobCount} observed job${matchingJobCount === 1 ? "" : "s"}` : "ready",
      gives: "what worked in your shop, programmer proof, parts proof, photos/docs",
    },
  ];
}

function serverCodeDeskList(value = []) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean);
  return cleanString(value)
    .split(/[|;,/]+/)
    .map(cleanString)
    .filter(Boolean);
}

function serverCodeDeskNumberList(value = []) {
  const raw = Array.isArray(value) ? value : cleanString(value).match(/\d+(?:\.\d+)?/g) || [];
  return raw
    .map(Number)
    .map((number) => (number > 1 ? number / 1000 : number))
    .filter((number) => Number.isFinite(number));
}

function serverCodeDeskDepthMap(value = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([cut, depth]) => [cleanString(cut).toUpperCase(), Number(depth) > 1 ? Number(depth) / 1000 : Number(depth)])
        .filter(([cut, depth]) => cut && Number.isFinite(depth)),
    );
  }
  const depths = {};
  cleanString(value)
    .split(/[|;,]+/)
    .forEach((pair) => {
      const match = pair.match(/([0-9A-Z?]+)\s*[:=]\s*(\d+(?:\.\d+)?)/i);
      if (!match) return;
      const depth = Number(match[2]);
      if (Number.isFinite(depth)) depths[match[1].toUpperCase()] = depth > 1 ? depth / 1000 : depth;
    });
  return depths;
}

function serverNormalizeBitting(value = "") {
  return cleanString(value).replace(/[^0-9?]/g, "");
}

function cleanCodeDeskRecord(input = {}) {
  const system = cleanString(input.system || input.keyway || input.blank || input.card);
  const code = cleanString(input.code || input.keyCode || input.lockCode || input.factoryCode);
  const bitting = serverNormalizeBitting(input.bitting || input.cuts || input.depths);
  if (!code && !bitting) return null;
  const base = {
    system,
    keyway: cleanString(input.keyway || input.blank || ""),
    code,
    bitting,
    vehicle: cleanString(input.vehicle || input.application || ""),
    partNumber: cleanString(input.partNumber || input.part || input.sku || ""),
    source: cleanString(input.source || input.origin || ""),
    notes: cleanString(input.notes || input.note || ""),
    importedAt: cleanString(input.importedAt) || new Date().toISOString(),
  };
  return {
    id: cleanString(input.id) || `cdr-${sha256Hex(JSON.stringify(base)).slice(0, 18)}`,
    ...base,
  };
}

function cleanCodeDeskSystem(input = {}) {
  const name = cleanString(input.name || input.system || input.card || input.keyway || input.description);
  if (!name) return null;
  const base = {
    name,
    category: cleanString(input.category || input.type) || "Imported",
    family: cleanString(input.family || input.format || input.style) || "Depth-space card",
    blanks: uniqueCleanValues(serverCodeDeskList(input.blanks || input.blank || input.keyway)),
    spaces: serverCodeDeskNumberList(input.spaces || input.space || input.spaceList || input.space_list),
    depths: serverCodeDeskDepthMap(input.depths || input.depthMap || input.depth_map || input.depthsByCut),
    macs: cleanString(input.macs || input.mac) || "Verify",
    cuts: cleanString(input.cuts || input.positions || ""),
    stop: cleanString(input.stop || input.stopType || "") || "Card-specific",
    source: cleanString(input.source || input.origin || "") || "Owner import",
    notes: uniqueCleanValues(serverCodeDeskList(input.notes || input.note)).slice(0, 12),
    custom: true,
    importedAt: cleanString(input.importedAt) || new Date().toISOString(),
  };
  const id = cleanString(input.id) || `cds-${sha256Hex(JSON.stringify({ name, blanks: base.blanks, spaces: base.spaces, depths: base.depths })).slice(0, 16)}`;
  return { id, ...base };
}

function cleanCodeDeskLesson(input = {}) {
  const base = {
    system: cleanString(input.system || ""),
    mode: cleanString(input.mode || ""),
    code: cleanString(input.code || ""),
    bitting: serverNormalizeBitting(input.bitting || ""),
    outcome: cleanString(input.outcome || input.value || "reviewed").toLowerCase(),
    confidence: Number.isFinite(Number(input.confidence)) ? Math.max(0, Math.min(100, Math.round(Number(input.confidence)))) : null,
    vehicle: cleanString(input.vehicle || ""),
    partNumber: cleanString(input.partNumber || ""),
    notes: cleanString(input.notes || input.note || ""),
    createdAt: cleanString(input.createdAt) || new Date().toISOString(),
  };
  return {
    id: cleanString(input.id) || `cdl-${sha256Hex(JSON.stringify(base)).slice(0, 18)}`,
    ...base,
  };
}

function codeDeskLibrarySummary(store = {}) {
  const records = Array.isArray(store.codeDeskRecords) ? store.codeDeskRecords : [];
  const systems = Array.isArray(store.codeDeskSystems) ? store.codeDeskSystems : [];
  const lessons = Array.isArray(store.codeDeskLessons) ? store.codeDeskLessons : [];
  const systemCount = new Set(records.map((record) => cleanString(record.system || record.keyway)).filter(Boolean)).size;
  return {
    records: records.length,
    systems: systems.length,
    lessons: lessons.length,
    recordSystems: systemCount,
    learnedWorked: lessons.filter((lesson) => /worked|confirmed|used|correct/.test(cleanString(lesson.outcome))).length,
    learnedWrong: lessons.filter((lesson) => /wrong|failed|reject|bad/.test(cleanString(lesson.outcome))).length,
  };
}

function publicCodeDeskLibrary(store = {}) {
  return {
    generatedAt: new Date().toISOString(),
    summary: codeDeskLibrarySummary(store),
    records: (store.codeDeskRecords || []).map(cleanCodeDeskRecord).filter(Boolean).slice(0, 20000),
    systems: (store.codeDeskSystems || []).map(cleanCodeDeskSystem).filter(Boolean).slice(0, 1000),
    lessons: (store.codeDeskLessons || []).map(cleanCodeDeskLesson).filter(Boolean).slice(0, 2000),
  };
}

async function importCodeDeskLibrary(body = {}, store = {}) {
  const incomingRecords = (body.records || body.codeRecords || []).map(cleanCodeDeskRecord).filter(Boolean);
  const incomingSystems = (body.systems || body.cards || body.depthSpaceCards || []).map(cleanCodeDeskSystem).filter(Boolean);
  const incomingLessons = (body.lessons || body.learning || []).map(cleanCodeDeskLesson).filter(Boolean);
  const replace = Boolean(body.replace);
  store.codeDeskRecords = replace
    ? incomingRecords
    : mergeStorageRecords(store.codeDeskRecords, incomingRecords, ["system", "code", "bitting"], "code-desk-record");
  store.codeDeskSystems = replace
    ? incomingSystems
    : mergeStorageRecords(store.codeDeskSystems, incomingSystems, ["name", "id"], "code-desk-system");
  store.codeDeskLessons = replace
    ? incomingLessons
    : mergeStorageRecords(store.codeDeskLessons, incomingLessons, ["createdAt", "system", "code", "bitting", "outcome"], "code-desk-lesson");
  await writeStore(store);
  return publicCodeDeskLibrary(store);
}

async function learnCodeDesk(body = {}, store = {}) {
  const lesson = cleanCodeDeskLesson(body);
  store.codeDeskLessons = mergeStorageRecords([lesson], store.codeDeskLessons, ["createdAt", "system", "code", "bitting", "outcome"], "code-desk-lesson").slice(0, 2000);
  const feedback = cleanAiFeedback({
    value: /wrong|failed|reject|bad/.test(lesson.outcome) ? "wrong" : "used",
    title: `Code Desk ${lesson.outcome}`,
    note: lesson.notes || `${lesson.system || "Code Desk"} ${lesson.code || lesson.bitting || "reviewed"}`,
    prompt: [lesson.system, lesson.code, lesson.bitting].filter(Boolean).join(" "),
    target: "code-desk",
    contextSummary: [lesson.vehicle, lesson.partNumber, lesson.mode, lesson.outcome].filter(Boolean),
  });
  store.aiFeedback.unshift(feedback);
  store.aiFeedback = store.aiFeedback.slice(0, 1000);
  await writeStore(store);
  return { lesson, feedback, summary: codeDeskLibrarySummary(store) };
}

function autoJobVehicleCounts(jobs = []) {
  const makeModel = new Map();
  for (const job of jobs || []) {
    const vehicle = coverageVehicleForJob(job);
    if (!vehicle.make || !vehicle.model) continue;
    const key = `${normalizeVehicleText(vehicle.make)}|${normalizeVehicleText(vehicle.model)}`;
    makeModel.set(key, (makeModel.get(key) || 0) + 1);
  }
  return makeModel;
}

function autoObservedJobCount(counts, row = {}) {
  const key = `${normalizeVehicleText(row.make)}|${normalizeVehicleText(row.model)}`;
  return counts.get(key) || 0;
}

async function buildAutoCodeBaseline(options = {}) {
  const query = normalizeVehicleText(options.query || options.q || "");
  const make = normalizeVehicleText(options.make || "");
  const year = Number(options.year) || 0;
  const limit = Math.max(25, Math.min(Number(options.limit) || 250, 20000));
  const [programming, vpic, store] = await Promise.all([
    readJsonCached(programmingReferencePath, { rows: [] }),
    readJsonCached(vpicCatalogPath, { rows: [] }),
    readStore().catch(() => ({ jobs: [] })),
  ]);
  const jobVehicleCounts = autoJobVehicleCounts(store.jobs || []);
  const vpicMap = new Map(
    (vpic.rows || []).map((row) => [`${row.year}|${normalizeVehicleText(row.make)}|${normalizeVehicleText(row.model)}`, row]),
  );
  const programmingRows = (programming.rows || []).map((row) => ({
    year: Number(row.year) || "",
    make: cleanString(row.make).toUpperCase(),
    model: cleanString(row.model),
    ignitionType: cleanString(row.ignitionType),
    immobilizerSystem: cleanString(row.immobilizerSystem),
    programMethod: cleanString(row.programMethod),
    requiresPin: Boolean(row.requiresPin),
    requiresBypass: Boolean(row.requiresBypass),
    requiresOnline: Boolean(row.requiresOnline),
    allKeysLostSupported: Boolean(row.allKeysLostSupported),
    notes: cleanString(row.notes),
    sourceFile: cleanString(row.sourceFile),
  }));
  const keyedProgramming = new Set(programmingRows.map((row) => `${row.year}|${normalizeVehicleText(row.make)}|${normalizeVehicleText(row.model)}`));
  const vpicOnlyRows = (vpic.rows || [])
    .filter((row) => !keyedProgramming.has(`${row.year}|${normalizeVehicleText(row.make)}|${normalizeVehicleText(row.model)}`))
    .map((row) => ({
      year: Number(row.year) || "",
      make: cleanString(row.make).toUpperCase(),
      model: cleanString(row.model),
      ignitionType: "",
      immobilizerSystem: "",
      programMethod: "",
      requiresPin: false,
      requiresBypass: false,
      requiresOnline: false,
      allKeysLostSupported: false,
      notes: cleanString(row.verifyBeforeDispatch),
      sourceFile: "vpic-catalog.json",
      vpicOnly: true,
    }));
  const rows = [...programmingRows, ...vpicOnlyRows]
    .map((row) => {
      const vehicle = { year: row.year, make: row.make, model: row.model };
      const vpicRow = vpicMap.get(`${row.year}|${normalizeVehicleText(row.make)}|${normalizeVehicleText(row.model)}`) || null;
      const template = autoCodeTemplateForVehicle(vehicle);
      const searchable = normalizeVehicleText([
        row.year,
        row.make,
        row.model,
        row.ignitionType,
        row.immobilizerSystem,
        row.programMethod,
        template.name,
        template.blanks,
        row.sourceFile,
      ]);
      return {
        ...row,
        vehicleType: vpicRow?.vehicleType || "",
        template,
        _vpicRow: vpicRow,
        security: [
          row.requiresPin ? "PIN" : "",
          row.requiresOnline ? "Online/OEM" : "",
          row.requiresBypass ? "Bypass" : "",
        ].filter(Boolean),
        sourceReadiness: {
          vehicleIdentity: vpicRow ? "available" : "VIN/YMM lookup",
          programming: row.vpicOnly ? "needs programming data" : "available",
          depthSpace: template.codeCardStatus === "needs-template" ? "needs template/card" : "template ready; exact card import recommended",
          codeLookup: "authorized import ready",
          proof: "saved-job proof ready",
        },
        searchable,
      };
    })
    .filter((row) => (!year || Number(row.year) === year) && (!make || normalizeVehicleText(row.make) === make))
    .filter((row) => !query || row.searchable.includes(query))
    .sort((a, b) => Number(b.year) - Number(a.year) || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
  const makes = [...new Set(rows.map((row) => row.make).filter(Boolean))].sort();
  const years = [...new Set(rows.map((row) => row.year).filter(Boolean))].sort((a, b) => b - a);
  const returnedRows = rows.slice(0, limit).map((row) => {
    const { _vpicRow, ...publicRow } = row;
    return {
      ...publicRow,
      databaseSupport: autoDatabaseSupport(publicRow, _vpicRow, [], autoObservedJobCount(jobVehicleCounts, publicRow)),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    source: "Local programming-reference plus vPIC identity catalog",
    totalRows: rows.length,
    returnedRows: returnedRows.length,
    limit,
    makes,
    years,
    supportedImports: {
      codeRecords: ["system", "keyway", "code", "bitting", "vehicle", "partNumber", "source", "notes"],
      depthSpaceCards: ["type=system", "name", "category", "family", "blanks", "spaces", "depths", "cuts", "stop", "macs", "source", "notes"],
    },
    rows: returnedRows,
  };
}

function compactReferenceValue(value) {
  if (Array.isArray(value)) {
    return value
      .slice(0, 8)
      .map((item) => (typeof item === "object" && item !== null ? compactReferenceRow(item) : cleanString(item)))
      .filter((item) => (typeof item === "object" ? Object.keys(item).length : item))
      .concat(value.length > 8 ? [`+${value.length - 8} more`] : []);
  }
  if (value && typeof value === "object") return compactReferenceRow(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return cleanString(value);
}

function compactReferenceRow(row = {}) {
  if (!row || typeof row !== "object") return { value: cleanString(row) };
  const entries = Object.entries(row)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 18)
    .map(([key, value]) => [key, compactReferenceValue(value)]);
  return Object.fromEntries(entries);
}

function referenceRowSearchText(row = {}) {
  return normalizeVehicleText(JSON.stringify(row));
}

function filterReferenceRows(rows = [], query = "", limit = 100) {
  const normalizedQuery = normalizeVehicleText(query);
  const filtered = normalizedQuery ? rows.filter((row) => referenceRowSearchText(row).includes(normalizedQuery)) : rows;
  return {
    totalRows: rows.length,
    matchedRows: filtered.length,
    returnedRows: filtered.slice(0, limit).length,
    rows: filtered.slice(0, limit).map(compactReferenceRow),
  };
}

function referenceListSources() {
  return [
    { id: "parts", label: "Parts cross-reference", note: "ML/LR/MW/TI/OE aliases and imported part identifiers." },
    { id: "lishi-tools", label: "Lishi master tools", note: "Imported Lishi tool list, aliases, functions, and categories." },
    { id: "lishi-applications", label: "Lishi applications", note: "Vehicle coverage rows from the Lishi master reference." },
    { id: "programming", label: "Programming reference", note: "Local year/make/model programmer and security rows." },
    { id: "auto-baseline", label: "Auto Code Desk baseline", note: "Merged programming/vPIC/code-readiness view." },
    { id: "code-desk-library", label: "Code Desk library", note: "Owner synced authorized codes, depth-space cards, and AI learning marks." },
    { id: "key-intelligence", label: "Key intelligence", note: "Built-in verified key systems, tools, programmers, and source records." },
    { id: "master-catalog", label: "Master parts catalog", note: "Imported master catalog identifiers and application clues." },
    { id: "key-innovations", label: "Key Innovations labels", note: "Imported supplier label/SKU extraction." },
    { id: "reference-vault", label: "Reference Vault", note: "Owner-created vehicle/keyway/programmer notes." },
    { id: "jobs", label: "Saved jobs", note: "Server saved and imported worked-job records." },
    { id: "vehicle-profiles", label: "Vehicle profiles", note: "Shop-confirmed per-vehicle profile upgrades." },
    { id: "public-sources", label: "Public sources", note: "Synced public reference source summaries." },
  ];
}

async function buildReferenceList(options = {}, store = { jobs: [] }) {
  const source = cleanString(options.source || "parts") || "parts";
  const query = cleanString(options.q || options.query || "");
  const limit = Math.max(10, Math.min(Number(options.limit) || 100, 500));
  let rows = [];
  let generatedAt = "";
  let sourceNote = "";

  if (source === "parts") {
    const reference = await readPartsCrossReference();
    rows = reference.rows || [];
    generatedAt = reference.generatedAt || reference.updatedAt || "";
    sourceNote = `${reference.totalRows || rows.length} rows, ${reference.totalTokens || Object.keys(reference.tokenIndex || {}).length} searchable tokens.`;
  } else if (source === "lishi-tools" || source === "lishi-applications") {
    const reference = await readLishiMasterReference();
    rows = source === "lishi-tools" ? reference.tools || [] : reference.applications || [];
    generatedAt = reference.generatedAt || "";
    sourceNote = reference.sourceWorkbook || "Imported Lishi master reference.";
  } else if (source === "programming") {
    const reference = await readFile(programmingReferencePath, "utf8").then(JSON.parse).catch(() => ({ rows: [] }));
    rows = reference.rows || [];
    generatedAt = reference.generatedAt || "";
    sourceNote = "Local programming-reference.json.";
  } else if (source === "auto-baseline") {
    const baseline = await buildAutoCodeBaseline({ q: query, limit });
    rows = baseline.rows || [];
    generatedAt = baseline.generatedAt || "";
    sourceNote = baseline.source || "";
  } else if (source === "code-desk-library") {
    rows = [
      ...(store.codeDeskSystems || []).map((row) => ({ recordType: "Depth-space card", ...row })),
      ...(store.codeDeskRecords || []).map((row) => ({ recordType: "Code record", ...row })),
      ...(store.codeDeskLessons || []).map((row) => ({ recordType: "Learning mark", ...row })),
    ];
    generatedAt = new Date().toISOString();
    const summary = codeDeskLibrarySummary(store);
    sourceNote = `${summary.records} code records, ${summary.systems} cards, ${summary.lessons} learning marks.`;
  } else if (source === "key-intelligence") {
    const reference = await readKeyIntelligence().catch(() => ({ records: [] }));
    rows = Array.isArray(reference) ? reference : reference.records || reference.keyIntelligence || [];
    generatedAt = reference.generatedAt || reference.updatedAt || "";
    sourceNote = "Built-in key-intelligence reference.";
  } else if (source === "master-catalog") {
    const reference = await readMasterCatalog();
    rows = reference.rows || [];
    generatedAt = reference.generatedAt || "";
    sourceNote = "Imported master catalog.";
  } else if (source === "key-innovations") {
    const reference = await readKeyInnovationsLabels();
    rows = reference.entries || [];
    generatedAt = reference.generatedAt || "";
    sourceNote = "Imported Key Innovations label rows.";
  } else if (source === "reference-vault") {
    const vault = await readReferenceVault();
    rows = vault.entries || [];
    generatedAt = vault.updatedAt || "";
    sourceNote = "Owner-created Reference Vault entries.";
  } else if (source === "jobs") {
    rows = store.jobs || [];
    sourceNote = "Server saved jobs and imported worked jobs.";
  } else if (source === "vehicle-profiles") {
    const profiles = await readVehicleProfiles();
    rows = profiles.profiles || [];
    generatedAt = profiles.updatedAt || profiles.generatedAt || "";
    sourceNote = "Shop-confirmed vehicle profiles.";
  } else if (source === "public-sources") {
    const publicSources = await readPublicReferenceSources();
    rows = [
      ...(publicSources.sources || []).map((row) => ({ type: "source", ...row })),
      ...(publicSources.communityEvidence || []).map((row) => ({ type: "community", ...row })),
      ...((publicSources.autel?.products || []).map((row) => ({ type: "autel-product", ...row })) || []),
      ...((publicSources.autel?.coverage || []).map((row) => ({ type: "autel-coverage", ...row })) || []),
    ];
    generatedAt = publicSources.generatedAt || "";
    sourceNote = "Public source sync summary rows.";
  } else {
    rows = [];
    sourceNote = "Unknown list source.";
  }

  const filtered = source === "auto-baseline" ? { totalRows: rows.length, matchedRows: rows.length, returnedRows: rows.length, rows: rows.map(compactReferenceRow) } : filterReferenceRows(rows, query, limit);
  return {
    generatedAt: generatedAt || new Date().toISOString(),
    sources: referenceListSources(),
    selectedSource: source,
    sourceNote,
    query,
    limit,
    ...filtered,
  };
}

function workbenchVehicleLabel(profile = {}, fallback = "") {
  const vehicle = profile.vehicle || {};
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].map(cleanString).filter(Boolean).join(" ") || cleanString(fallback || profile.vin || "Current job");
}

function explicitWorkbenchVin(body = {}) {
  return normalizeVinCandidate(body.vin) || normalizeVinCandidate(body.q) || normalizeVinCandidate(body.query) || normalizeVinCandidate(body.proofQuery);
}

async function decodeWorkbenchVin(vin, store) {
  let decode;
  try {
    decode = await decodeVinWithTimeout(vin);
  } catch (error) {
    decode = await localVinDecodeFallback(vin, error);
  }
  return buildLocksmithProfile(vin, decode, store);
}

async function resolveWorkbenchProfile(body = {}, store = { jobs: [] }) {
  const incomingProfile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const requestedVin = explicitWorkbenchVin(body);
  const profileVin = normalizeVinCandidate(incomingProfile.vin);
  const profileMatchesVin = requestedVin && profileVin === requestedVin;
  if (!requestedVin) return incomingProfile;
  if (profileMatchesVin && incomingProfile.vehicle?.year && incomingProfile.vehicle?.make && incomingProfile.vehicle?.model) return incomingProfile;
  return decodeWorkbenchVin(requestedVin, store);
}

function usefulWorkbenchPartValue(value) {
  const text = cleanString(value);
  const compact = compactToken(text);
  if (!compact || compact.length < 4) return false;
  if (normalizeVinCandidate(text)) return false;
  if (!/\d/.test(compact)) return false;
  if (/^(?:OEMPART|PARTOUTCOME|OUTCOMEWORKED|WORKED|SAVEDJOB|SHOPPROOF|PROGRAMMINGPATH|VALIDATEDAFTERMARKETPROGRAMMER|ADVANCEDAFTERMARKETPROGRAMMER)$/.test(compact)) {
    return false;
  }
  return true;
}

function workbenchPrimaryPartQuery(profile = {}, body = {}) {
  const values = uniqueCleanValues([
    body.partQuery,
    normalizeVinCandidate(body.q) ? "" : body.q,
    normalizeVinCandidate(body.query) ? "" : body.query,
    profile.partQuery,
    profile.selectedPart?.sku,
    profile.selectedPart?.oem,
    profile.selectedPart?.fcc,
    profile.keys?.flatMap((item) => [item.partNumber, item.fccId, item.fcc, item.sku, item.name]),
    profile.supplierCandidates?.flatMap((item) => [
      item.legacyPartNumber,
      item.activePartNumber,
      item.supplierSku,
      item.hlPartNumber,
      item.fccId,
      item.oemPartNumbers,
    ]),
  ]).filter(usefulWorkbenchPartValue);
  return (
    values.find((value) => /\b(?:ULK|FRD|HON|TOY|LEX|GM|CHRY|NIS|INF|HYU|KIA|MAZ|MIT|SUB|FORD|BMW|CAD|TIK|OEM)[A-Z0-9#\- ]{2,}\b/i.test(value)) ||
    values.find((value) => compactToken(value).length >= 4) ||
    ""
  );
}

function workbenchLishiQuery(profile = {}, body = {}) {
  const vehicle = profile.vehicle || body.vehicle || {};
  const reference = profile.vehicleReference || {};
  return uniqueCleanValues([
    body.lishiQuery,
    reference.keyway?.primary,
    reference.lishi?.primary,
    reference.keyway?.alternates,
    profile.lishiLookup?.tools?.map((tool) => tool.canonical || tool.tool),
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
    body.q,
  ])
    .slice(0, 8)
    .join(" ");
}

function workbenchAutoQuery(profile = {}, body = {}) {
  const vehicle = profile.vehicle || body.vehicle || {};
  const reference = profile.vehicleReference || {};
  return uniqueCleanValues([
    body.codeQuery,
    body.autoQuery,
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
    reference.keyway?.primary,
    body.q,
  ])
    .slice(0, 5)
    .join(" ");
}

function compactPartHistory(payload = {}) {
  return {
    query: payload.query || "",
    primaryIdentifier: payload.primaryIdentifier || "",
    identifiers: payload.identifiers || {},
    crossReferences: (payload.crossReferences || []).slice(0, 8),
    jobs: (payload.jobs || []).slice(0, 10),
    programmerEvidence: {
      ...(payload.programmerEvidence || {}),
      programmers: (payload.programmerEvidence?.programmers || []).slice(0, 8),
    },
    referenceStats: payload.referenceStats || {},
  };
}

function compactProofVault(payload = {}) {
  return {
    query: payload.query || "",
    summary: payload.summary || {},
    records: (payload.records || []).slice(0, 10),
    proofNote: payload.proofNote || "",
  };
}

function compactLishiLookup(payload = {}) {
  return {
    query: payload.query || {},
    stats: payload.stats || {},
    categories: payload.categories || [],
    returnedTools: payload.returnedTools || 0,
    matchedTools: payload.matchedTools || 0,
    confirmedTools: payload.confirmedTools || 0,
    keywayShortlistTools: payload.keywayShortlistTools || 0,
    matchStatus: payload.matchStatus || "",
    decision: payload.decision || "",
    matchedApplications: payload.matchedApplications || 0,
    tools: (payload.tools || []).slice(0, 12),
    applications: (payload.applications || []).slice(0, 12),
    sources: payload.sources || [],
  };
}

function compactAutoBaseline(payload = {}) {
  return {
    generatedAt: payload.generatedAt,
    source: payload.source,
    totalRows: payload.totalRows || 0,
    returnedRows: payload.returnedRows || 0,
    makes: (payload.makes || []).slice(0, 25),
    years: (payload.years || []).slice(0, 25),
    supportedImports: payload.supportedImports || {},
    rows: (payload.rows || []).slice(0, 18),
  };
}

function compactProofPatternGroup(group = {}) {
  return {
    kind: group.kind || "",
    label: group.label || "",
    records: group.records || 0,
    successes: group.successes || 0,
    warnings: group.warnings || 0,
    unknown: group.unknown || 0,
    outcomeCoveragePercent: group.outcomeCoveragePercent,
    confidencePercent: group.confidencePercent || 0,
    ignitionFamily: group.ignitionFamily || {},
    topParts: (group.topParts || []).slice(0, 8),
    lishiKeyways: (group.lishiKeyways || []).slice(0, 6),
    programmers: (group.programmers || []).slice(0, 6),
    vehicles: (group.vehicles || []).slice(0, 6),
    vins: (group.vins || []).slice(0, 8),
    jobs: (group.jobs || []).slice(0, 8),
  };
}

function compactProofPatterns(payload = {}) {
  return {
    generatedAt: payload.generatedAt,
    totalProofJobs: payload.totalProofJobs || 0,
    target: payload.target || {},
    best: compactProofPatternGroup(payload.best || {}),
    groups: (payload.groups || []).map(compactProofPatternGroup),
    proofNote: payload.proofNote || "",
  };
}

function lishiTokensAgree(left, right) {
  const a = normalizeLishiKeywayToken(left) || compactToken(left);
  const b = normalizeLishiKeywayToken(right) || compactToken(right);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
}

function buildShopLishiEvidence({ profile = {}, verifiedProfile = null, shopEvidence = null, proofPatterns = null, lishiLookup = null } = {}) {
  const counts = new Map();
  const add = (value, count = 1, source = "", confidenceBase = 72) => {
    const token = normalizeLishiKeywayToken(value);
    if (!token) return;
    const current = counts.get(token) || { value: token, count: 0, sources: new Set(), confidenceBase: 0 };
    current.count = Math.max(current.count || 0, Math.max(1, Number(count) || 1));
    current.confidenceBase = Math.max(current.confidenceBase || 0, confidenceBase);
    if (source) current.sources.add(source);
    counts.set(token, current);
  };

  const vehicleProfile = verifiedProfile || profile.verifiedProfile || null;
  for (const item of vehicleProfile?.lishiOutcomes || []) {
    add(item.value, item.count || 1, item.source || "worked vehicle profile", item.count >= 3 ? 90 : 82);
  }
  if (vehicleProfile?.preferredLishi?.value) {
    add(vehicleProfile.preferredLishi.value, vehicleProfile.preferredLishi.count || 1, "preferred vehicle profile", vehicleProfile.preferredLishi.count >= 3 ? 94 : 86);
  }

  const bestPattern = proofPatterns?.best || profile.proofPatterns?.best || {};
  const patternBase = bestPattern.kind === "exact-vin" ? 88 : bestPattern.kind === "vin-pattern" ? 80 : bestPattern.records ? 72 : 0;
  for (const item of bestPattern.lishiKeyways || []) {
    add(item.value, item.count || 1, `${bestPattern.kind || "proof"} proof pattern`, patternBase);
  }
  for (const group of proofPatterns?.groups || profile.proofPatterns?.groups || []) {
    for (const item of group.lishiKeyways || []) {
      add(item.value, item.count || 1, `${group.kind || "proof"} evidence`, group.kind === "exact-vin" ? 84 : 68);
    }
  }
  for (const token of shopEvidence?.lishiKeyways || profile.shopEvidence?.lishiKeyways || []) {
    add(token, 1, "matched saved job", 70);
  }

  const ranked = Array.from(counts.values())
    .map((item) => ({
      value: item.value,
      count: item.count,
      sources: Array.from(item.sources).slice(0, 5),
      confidencePercent: Math.min(98, Math.max(item.confidenceBase || 0, 68) + Math.min(item.count * 3, 12)),
    }))
    .sort((a, b) => b.confidencePercent - a.confidencePercent || b.count - a.count || a.value.localeCompare(b.value));

  const primary = ranked[0] || null;
  const importedConfirmed = (lishiLookup?.tools || []).find((tool) => tool.vehicleConfirmed || tool.matchStatus === "vehicle-confirmed");
  const importedToken = normalizeLishiKeywayToken(importedConfirmed?.canonical || importedConfirmed?.tool || "");
  const importedAgrees = primary && importedToken ? lishiTokensAgree(primary.value, importedToken) : null;
  const conflicts = uniqueCleanValues([
    ...ranked.slice(1).filter((item) => primary && !lishiTokensAgree(item.value, primary.value)).map((item) => `${item.value} (${item.count})`),
    importedAgrees === false ? `Imported vehicle row: ${importedToken}` : "",
  ]).slice(0, 6);
  const status = conflicts.length ? "conflict" : primary ? "shop-confirmed" : "none";

  return {
    status,
    primary: primary?.value || "",
    count: primary?.count || 0,
    confidencePercent: primary ? (conflicts.length ? Math.min(primary.confidencePercent, 68) : primary.confidencePercent) : 0,
    sources: primary?.sources || [],
    alternates: ranked.slice(1, 6),
    conflicts,
    importedConfirmed: importedToken,
    importedAgrees,
    decision: conflicts.length
      ? `Shop proof and imported Lishi evidence disagree. Verify ${primary?.value || "shop keyway"} against the lock before using.`
      : primary
        ? `Shop proof supports ${primary.value} from ${primary.count} observed record${primary.count === 1 ? "" : "s"}.`
        : "",
  };
}

function workbenchClampPercent(value, fallback = 55) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function workbenchConfidenceLabel(percent) {
  const value = Number(percent) || 0;
  if (value >= 90) return "High";
  if (value >= 78) return "Strong";
  if (value >= 62) return "Verify";
  return "Low";
}

function workbenchChoice(id, label, value, confidence, source = "", detail = "", ownerEvidence = []) {
  return {
    id,
    label,
    value: cleanString(value) || "Verify",
    confidence: workbenchClampPercent(confidence, 55),
    source: cleanString(source),
    detail: cleanString(detail),
    ownerEvidence: uniqueCleanValues(ownerEvidence).slice(0, 8),
  };
}

function proofPatternGroupLabel(group = {}) {
  if (!Number(group.records || 0)) return "No proof";
  if (group.kind === "exact-vin") return "Exact VIN";
  if (group.kind === "vin-pattern") return "VIN pattern";
  if (group.kind === "vehicle") return "Vehicle history";
  return group.label || "Proof";
}

function proofFamilyDisplay(family = {}) {
  const expected = cleanString(family.expectedFamily);
  if (expected === "proximity") return "Prox / smart";
  if (expected === "remote-head") return "Remote head / flip";
  if (expected === "transponder" || expected === "keyed") return "Keyed / transponder";
  return cleanString(family.label) || "Verify key type";
}

function bestPartDecisionValue(partHistory, proofPatterns, partQuery) {
  const topPart = proofPatterns?.best?.topParts?.[0];
  if (topPart?.value) return topPart.value;
  const firstReference = partHistory?.crossReferences?.[0];
  return (
    firstReference?.primaryLabel ||
    firstReference?.primary ||
    partHistory?.primaryIdentifier ||
    partQuery ||
    ""
  );
}

function bestProgrammerDecisionValue(partHistory, proofPatterns, coverage) {
  const proofProgrammer = proofPatterns?.best?.programmers?.[0];
  if (proofProgrammer?.value) return proofProgrammer.value;
  const historyProgrammer = partHistory?.programmerEvidence?.programmers?.[0];
  if (historyProgrammer?.name) return historyProgrammer.name;
  const coverageProgrammer = coverage?.programmers?.[0];
  return coverageProgrammer?.name || "";
}

function bestDecodeDecisionValue(lishiLookup, profile, lishiEvidence = {}) {
  if (lishiEvidence.status === "conflict" && lishiEvidence.primary) return `Verify ${lishiEvidence.primary}`;
  if (lishiEvidence.primary && lishiEvidence.confidencePercent >= 78) return lishiEvidence.primary;
  const vehicleConfirmed = (lishiLookup?.tools || []).find((tool) => tool.vehicleConfirmed || tool.matchStatus === "vehicle-confirmed");
  if (vehicleConfirmed?.canonical || vehicleConfirmed?.tool) return vehicleConfirmed.canonical || vehicleConfirmed.tool;
  const shortlist = (lishiLookup?.tools || []).find((tool) => tool.matchStatus === "keyway-shortlist");
  if (shortlist?.canonical || shortlist?.tool) return `Verify ${shortlist.canonical || shortlist.tool}`;
  const reference = profile?.vehicleReference || {};
  return reference.keyway?.primary || reference.lishi?.primary || "";
}

function buildWorkbenchDecisionEngine({ body = {}, profile = {}, vehicle = {}, partQuery = "", partHistory, proofVault, lishiLookup, lishiEvidence = {}, autoBaseline, coverage, proofPatterns, warnings = [] }) {
  const title = workbenchVehicleLabel(profile, body.q);
  const bestPattern = proofPatterns?.best || {};
  const patternRecords = Number(bestPattern.records || 0);
  const patternConfidence = Number(bestPattern.confidencePercent || 0);
  const exactProof = Number(bestPattern.kind === "exact-vin" ? bestPattern.records || 0 : 0);
  const partRows = Number(partHistory?.referenceStats?.matchedReferenceRows || partHistory?.crossReferences?.length || 0);
  const partJobs = Number(partHistory?.jobs?.length || 0);
  const proofRecords = Number(proofVault?.summary?.matchingJobs || 0);
  const lishiTools = Number(lishiLookup?.tools?.length || 0);
  const lishiConfirmedTools = Number(lishiLookup?.confirmedTools || (lishiLookup?.tools || []).filter((tool) => tool.vehicleConfirmed).length || 0);
  const lishiShortlistTools = Number(lishiLookup?.keywayShortlistTools || (lishiLookup?.tools || []).filter((tool) => tool.matchStatus === "keyway-shortlist").length || 0);
  const autoRows = Number(autoBaseline?.rows?.length || 0);
  const hasVin = Boolean(profile.vin || body.vin);
  const hasVehicle = Boolean(vehicle?.year && vehicle?.make && vehicle?.model);
  const partValue = bestPartDecisionValue(partHistory, proofPatterns, partQuery);
  const programmerValue = bestProgrammerDecisionValue(partHistory, proofPatterns, coverage);
  const decodeValue = bestDecodeDecisionValue(lishiLookup, profile, lishiEvidence);
  const proofValue = proofPatternGroupLabel(bestPattern);
  const keyTypeValue = proofFamilyDisplay(bestPattern.ignitionFamily);
  const partOnlySearch = Boolean(partQuery && !hasVehicle && !hasVin);

  const choices = [
    workbenchChoice(
      "vehicle",
      "Vehicle",
      title,
      hasVin ? 94 : hasVehicle ? 82 : 58,
      hasVin ? "VIN" : hasVehicle ? "YMM" : "Search",
      profile.vin || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
      [profile.confidence, profile.vinDetails?.checkDigitValid === false ? "VIN check digit flagged by local parser." : ""],
    ),
    workbenchChoice(
      "key-type",
      "Key Type",
      keyTypeValue,
      patternRecords ? patternConfidence : partRows ? 66 : 52,
      patternRecords ? "Shop proof" : "Reference",
      patternRecords ? `${patternRecords} proof record${patternRecords === 1 ? "" : "s"}` : "",
      [bestPattern.label, bestPattern.ignitionFamily?.label],
    ),
    workbenchChoice(
      "part",
      "Part",
      partValue || "Part needed",
      Math.max(patternRecords && partValue ? patternConfidence : 0, partJobs ? evidenceConfidenceFromCount(partJobs, 78) : 0, partRows ? 68 + Math.min(partRows * 4, 18) : 0, partQuery ? 58 : 42),
      patternRecords && partValue ? "Proof pattern" : partRows ? "Cross-reference" : partJobs ? "Part history" : "Needed",
      partJobs ? `${partJobs} matching saved job${partJobs === 1 ? "" : "s"}` : "",
      [
        bestPattern.topParts?.[0] ? `${bestPattern.topParts[0].value} seen ${bestPattern.topParts[0].count} time${bestPattern.topParts[0].count === 1 ? "" : "s"}.` : "",
        partRows ? `${partRows} cross-reference row${partRows === 1 ? "" : "s"}.` : "",
      ],
    ),
    workbenchChoice(
      "programmer",
      "Programmer",
      programmerValue || "Verify coverage",
      programmerValue ? Math.max(patternRecords ? patternConfidence - 4 : 0, partHistory?.programmerEvidence?.programmers?.[0]?.observedCoveragePercent || 0, coverage?.programmers?.[0]?.observedCoveragePercent || 0, 64) : 42,
      programmerValue ? "Observed" : "Needed",
      partHistory?.programmerEvidence?.programmers?.[0]?.jobs ? `${partHistory.programmerEvidence.programmers[0].jobs} job record${partHistory.programmerEvidence.programmers[0].jobs === 1 ? "" : "s"}` : "",
      [
        partHistory?.programmerEvidence?.programmers?.[0]?.vehicles || [],
        coverage?.programmers?.[0]?.jobs ? `${coverage.programmers[0].jobs} total saved jobs mention ${coverage.programmers[0].name}.` : "",
      ],
    ),
    workbenchChoice(
      "decode",
      "Decode",
      decodeValue || "Verify keyway",
      lishiEvidence?.status === "conflict"
        ? Math.min(Number(lishiEvidence.confidencePercent || 62), 68)
        : lishiConfirmedTools && lishiEvidence?.importedAgrees
          ? 96
          : lishiConfirmedTools
            ? 90 + Math.min(lishiConfirmedTools * 2, 8)
            : lishiEvidence?.primary
              ? Number(lishiEvidence.confidencePercent || 78)
              : lishiShortlistTools ? 58 : autoRows ? 54 : 42,
      lishiEvidence?.status === "conflict"
        ? "Lishi conflict"
        : lishiConfirmedTools
          ? "Vehicle-confirmed Lishi"
          : lishiEvidence?.primary
            ? "Shop-confirmed Lishi"
            : lishiShortlistTools ? "Keyway shortlist" : "Manual verify",
      lishiEvidence?.status === "conflict"
        ? lishiEvidence.decision
        : lishiConfirmedTools
        ? `${lishiConfirmedTools} vehicle-confirmed tool${lishiConfirmedTools === 1 ? "" : "s"}`
        : lishiEvidence?.primary
          ? `${lishiEvidence.count} shop proof record${lishiEvidence.count === 1 ? "" : "s"}`
        : lishiShortlistTools
          ? `${lishiShortlistTools} keyway candidate${lishiShortlistTools === 1 ? "" : "s"}`
          : "",
      [lishiEvidence?.decision, lishiLookup?.decision, profile.vehicleReference?.keyway?.primary, profile.vehicleReference?.lishi?.primary],
    ),
    workbenchChoice(
      "proof",
      "Proof",
      proofValue,
      exactProof ? 100 : patternRecords ? patternConfidence : proofRecords ? evidenceConfidenceFromCount(proofRecords, 74) : 35,
      exactProof ? "Exact" : patternRecords ? "Pattern" : proofRecords ? "Vault" : "None",
      patternRecords ? `${patternRecords} proof record${patternRecords === 1 ? "" : "s"}` : "",
      [
        bestPattern.label,
        proofVault?.summary?.matchingJobs ? `${proofVault.summary.matchingJobs} Proof Vault match${proofVault.summary.matchingJobs === 1 ? "" : "es"}.` : "",
      ],
    ),
  ];
  const weightedChoices = choices.filter((choice) => choice.confidence > 0);
  const overall = weightedChoices.length
    ? workbenchClampPercent(weightedChoices.reduce((sum, choice) => sum + choice.confidence, 0) / weightedChoices.length, 0)
    : 0;
  const blockers = uniqueCleanValues([
    !hasVin && !partOnlySearch ? "VIN" : "",
    choices.find((choice) => choice.id === "part")?.confidence < 65 ? "part proof" : "",
    choices.find((choice) => choice.id === "decode")?.confidence < 65 ? "keyway" : "",
    choices.find((choice) => choice.id === "programmer")?.confidence < 65 ? "programmer" : "",
  ]).slice(0, 5);
  const bestMove = blockers.length
    ? `Verify ${blockers[0]}`
    : partOnlySearch
      ? "Use part proof"
    : choices.find((choice) => choice.id === "part")?.value
      ? "Proceed with verified path"
      : "Build proof packet";
  return {
    generatedAt: new Date().toISOString(),
    title,
    overall,
    confidenceLabel: workbenchConfidenceLabel(overall),
    bestMove,
    blockers,
    advisories: uniqueCleanValues(warnings || []).slice(0, 5),
    choices,
    fieldSteps: uniqueCleanValues([
      "Authorize",
      choices.find((choice) => choice.id === "part")?.value,
      choices.find((choice) => choice.id === "decode")?.value,
      choices.find((choice) => choice.id === "programmer")?.value,
      "Save proof",
    ]).slice(0, 5),
  };
}

async function buildJobWorkbench(body = {}, store = { jobs: [] }) {
  const requestedVin = explicitWorkbenchVin(body);
  const profile = await resolveWorkbenchProfile(body, store);
  const vehicle = profile.vehicle || body.vehicle || {};
  const cleanJobs = mergedSearchJobs(store.jobs || [], body.jobs || body.localJobs || []);
  const partsReference = await readPartsCrossReference();
  const lishiReference = await readLishiMasterReference();
  const referenceVault = await readReferenceVault();
  const keyIntelligence = await readKeyIntelligence().catch(() => ({ records: [] }));
  const keyIntelligenceRecords = Array.isArray(keyIntelligence) ? keyIntelligence : keyIntelligence.records || [];
  const evidenceIndex = buildJobEvidenceIndex(cleanJobs, partsReference);
  const proofPatterns = buildProofPatternBaseline(evidenceIndex, partsReference, {
    vin: profile.vin || requestedVin,
    vehicle,
  });
  const computedShopEvidence = buildShopEvidence(vehicle, profile.vin || requestedVin, cleanJobs);
  const shopEvidence = profile.shopEvidence
    ? {
        ...computedShopEvidence,
        ...profile.shopEvidence,
        lishiKeyways: uniqueCleanValues([computedShopEvidence.lishiKeyways || [], profile.shopEvidence.lishiKeyways || []]),
        tools: uniqueCleanValues([computedShopEvidence.tools || [], profile.shopEvidence.tools || []]),
        jobs: uniqueById([computedShopEvidence.jobs || [], profile.shopEvidence.jobs || []].flat(), (job) => job.id || `${job.vehicle}|${job.vin}|${job.title}`),
        totalMatches: Math.max(Number(computedShopEvidence.totalMatches || 0), Number(profile.shopEvidence.totalMatches || 0)),
      }
    : computedShopEvidence;
  profile.proofPatterns = proofPatterns;
  profile.shopEvidence = shopEvidence;
  profile.shopEvidence.proofPatterns = proofPatterns;
  const partQuery = workbenchPrimaryPartQuery(profile, body);
  const lishiQuery = workbenchLishiQuery(profile, body);
  const autoQuery = workbenchAutoQuery(profile, body);
  const proofQuery = cleanString(body.proofQuery || requestedVin || partQuery || body.q || profile.vin || workbenchVehicleLabel(profile));
  const [partHistory, proofVault, lishiLookup, autoBaseline] = await Promise.all([
    partQuery ? Promise.resolve(buildPartHistory(partQuery, evidenceIndex, partsReference)) : Promise.resolve(null),
    Promise.resolve(buildProofVault(proofQuery, evidenceIndex, partsReference)),
    Promise.resolve(buildLishiLookup(lishiReference, {
      q: lishiQuery,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      category: "Automotive",
      limit: 24,
    })),
    buildAutoCodeBaseline({
      q: autoQuery,
      year: vehicle.year,
      make: vehicle.make,
      limit: 80,
    }),
  ]);
  const lishiEvidence = buildShopLishiEvidence({
    profile,
    verifiedProfile: profile.verifiedProfile,
    shopEvidence,
    proofPatterns,
    lishiLookup,
  });
  profile.lishiEvidence = lishiEvidence;
  const coverage = buildCoverageDashboard(cleanJobs, partsReference);
  const matchedJobs = uniqueCleanValues([
    partHistory?.jobs?.map((job) => job.id),
    proofVault?.records?.map((record) => record.id),
    profile.matchedJobs?.map((job) => job.id),
  ]);
  const directProofJobs = uniqueCleanValues([partHistory?.jobs?.map((job) => job.id), proofVault?.records?.map((record) => record.id)]);
  const relatedProfileJobs = uniqueCleanValues(profile.matchedJobs?.map((job) => job.id));
  const warnings = uniqueCleanValues([
    ...(profile.vehicleReference?.warnings || []),
    profile.confidence && /verify|partial|inconclusive/i.test(profile.confidence) ? profile.confidence : "",
    !partHistory?.jobs?.length && partQuery ? "No saved job proof matched this part yet." : "",
    lishiEvidence.status === "conflict" ? lishiEvidence.decision : "",
    !lishiLookup?.confirmedTools ? lishiLookup?.decision || "No vehicle-confirmed Lishi tool matched the current vehicle/keyway query." : "",
  ]).slice(0, 8);
  const aiBrief = buildWorkbenchAiBrief({
    body,
    profile,
    vehicle,
    partQuery,
    partHistory,
    proofVault,
    lishiLookup,
    lishiEvidence,
    autoBaseline,
    coverage,
    proofPatterns,
    warnings,
  });
  const decisionEngine = buildWorkbenchDecisionEngine({
    body,
    profile,
    vehicle,
    partQuery,
    partHistory,
    proofVault,
    lishiLookup,
    lishiEvidence,
    autoBaseline,
    coverage,
    proofPatterns,
    warnings,
  });
  return {
    generatedAt: new Date().toISOString(),
    title: workbenchVehicleLabel(profile, body.q),
    query: cleanString(body.q || body.query || ""),
    vehicle,
    vin: profile.vin || body.vin || "",
    activeQueries: {
      part: partQuery,
      proof: proofQuery,
      lishi: lishiQuery,
      auto: autoQuery,
    },
    overview: {
      savedJobs: cleanJobs.length,
      matchedJobs: matchedJobs.length,
      exactProofMatches: directProofJobs.length,
      relatedProfileMatches: relatedProfileJobs.filter((id) => !directProofJobs.includes(id)).length,
      partReferenceRows: partsReference.totalRows || partsReference.rows?.length || 0,
      lishiTools: lishiReference.stats?.tools || lishiReference.tools?.length || 0,
      lishiApplications: lishiReference.stats?.applications || lishiReference.applications?.length || 0,
      codeBaselineRows: autoBaseline.totalRows || 0,
      referenceVaultEntries: referenceVault.entries?.length || 0,
      keyIntelligenceRecords: keyIntelligenceRecords.length || 0,
      observedCoveragePercent: coverage.summary?.observedCoveragePercent,
    },
    decisionEngine,
    lishiEvidence,
    nextActions: [
      { label: "Verify authorization and attach proof", target: "proof-vault", tone: "required" },
      { label: partQuery ? `Check part history for ${partQuery}` : "Search LR/MW/TI/OE part history", target: "part-history", tone: partHistory?.jobs?.length ? "ready" : "verify" },
      {
        label: lishiEvidence.status === "conflict"
          ? "Resolve Lishi conflict at lock"
          : lishiLookup?.confirmedTools
            ? "Open vehicle-confirmed Lishi tools"
            : lishiEvidence.primary
              ? `Verify shop-confirmed ${lishiEvidence.primary}`
              : lishiLookup?.keywayShortlistTools
                ? "Verify Lishi keyway shortlist"
                : "Confirm keyway before Lishi use",
        target: "lishi",
        tone: lishiEvidence.status === "conflict" ? "required" : lishiLookup?.confirmedTools || lishiEvidence.primary ? "ready" : "verify",
      },
      { label: "Review auto code/programming baseline", target: "code-desk", tone: autoBaseline.rows?.length ? "ready" : "verify" },
      { label: "Save worked job when complete", target: "learn", tone: "required" },
    ],
    aiBrief,
    warnings,
    partHistory: partHistory ? compactPartHistory(partHistory) : null,
    proofVault: compactProofVault(proofVault),
    proofPatterns: compactProofPatterns(proofPatterns),
    lishi: compactLishiLookup(lishiLookup),
    autoBaseline: compactAutoBaseline(autoBaseline),
    coverage: {
      summary: coverage.summary || {},
      programmers: (coverage.programmers || []).slice(0, 8),
      parts: (coverage.parts || []).slice(0, 8),
      gaps: coverage.gaps || {},
      proofNote: coverage.proofNote,
    },
    sourceMap: {
      parts: { rows: partsReference.totalRows || partsReference.rows?.length || 0, status: "connected" },
      lishi: { tools: lishiReference.stats?.tools || lishiReference.tools?.length || 0, applications: lishiReference.stats?.applications || lishiReference.applications?.length || 0, status: "connected" },
      codeDesk: { rows: autoBaseline.totalRows || 0, status: "baseline connected; authorized code imports remain separate" },
      proofVault: { jobs: cleanJobs.length, matchingRecords: proofVault.summary?.matchingJobs || 0, status: "connected" },
      referenceVault: { entries: referenceVault.entries?.length || 0, status: "connected" },
    },
  };
}

function globalJobMatches(query, jobs = [], limit = 8) {
  const normalizedQuery = normalizeVehicleText(query);
  if (!normalizedQuery) return [];
  return (jobs || [])
    .filter((job) => normalizeVehicleText(JSON.stringify(job)).includes(normalizedQuery))
    .sort((a, b) => (Date.parse(b.createdAt || b.schedule || "") || 0) - (Date.parse(a.createdAt || a.schedule || "") || 0))
    .slice(0, limit)
    .map((job) => ({
      id: job.id,
      title: job.title || job.vehicle || "Saved job",
      subtitle: [job.vehicle, job.vin].filter(Boolean).join(" | "),
      detail: [job.service, job.programmer, job.sequence].filter(Boolean).join(" | "),
      badge: job.status || "Job",
      target: "proof-vault",
      query: job.vin || job.sequence || job.vehicle || query,
    }));
}

function globalGroup(id, label, target, results = [], note = "") {
  return {
    id,
    label,
    target,
    note,
    count: results.length,
    results,
  };
}

function buildWorkbenchAiBrief({ body = {}, profile = {}, vehicle = {}, partQuery = "", partHistory, proofVault, lishiLookup, lishiEvidence = {}, autoBaseline, coverage, proofPatterns, warnings = [] }) {
  const directProof = Math.max(Number(partHistory?.jobs?.length || 0), Number(proofVault?.summary?.matchingJobs || 0));
  const relatedProof = Number(profile.matchedJobs?.length || 0);
  const matchedProof = Math.max(directProof, relatedProof);
  const bestPattern = proofPatterns?.best || {};
  const patternProof = Number(bestPattern.records || 0);
  const patternConfidence = Number(bestPattern.confidencePercent || 0);
  const partRows = Number(partHistory?.referenceStats?.matchedReferenceRows || partHistory?.crossReferences?.length || 0);
  const lishiTools = Number(lishiLookup?.tools?.length || 0);
  const lishiConfirmedTools = Number(lishiLookup?.confirmedTools || (lishiLookup?.tools || []).filter((tool) => tool.vehicleConfirmed).length || 0);
  const shopLishiConfidence = Number(lishiEvidence?.confidencePercent || 0);
  const autoRows = Number(autoBaseline?.rows?.length || 0);
  const observedCoverage = Number(coverage?.summary?.observedCoveragePercent);
  const hasVehicle = Boolean(vehicle?.year && vehicle?.make && vehicle?.model);
  const hasVin = Boolean(profile.vin || body.vin);
  const confidencePercent = Math.max(
    38,
    Math.min(
      100,
      42 +
        (hasVin ? 10 : 0) +
        (hasVehicle ? 8 : 0) +
        Math.min(directProof * 8 + relatedProof * 4, 28) +
        Math.min(Math.round(patternConfidence / 8), 12) +
        Math.min(partRows * 5, 12) +
        (lishiEvidence?.status === "conflict" ? -4 : lishiEvidence?.primary ? Math.min(Math.round(shopLishiConfidence / 14), 7) : 0) +
        (lishiConfirmedTools ? 6 : lishiTools ? 2 : 0) +
        (autoRows ? 4 : 0) +
        (Number.isFinite(observedCoverage) ? Math.min(observedCoverage / 10, 8) : 0),
    ),
  );
  const title = workbenchVehicleLabel(profile, body.q) || cleanString(body.q || "current job");
  const decision = directProof
    ? `Start from saved proof for ${title}.`
    : relatedProof
      ? `Use related saved proof for ${title}, then verify exact VIN/key package.`
      : patternProof
        ? `Use the Proof Pattern baseline for ${title}, then verify the exact key package.`
    : partRows
      ? `Use the part cross-reference as the starting point for ${title}.`
      : hasVehicle
        ? `Use vehicle identity first, then verify keyway/FCC before ordering.`
        : `Start with a VIN, YMM, LR#, MW#, TI#, OE#, FCC, or keyway search.`;
  const evidence = uniqueCleanValues([
    directProof ? `${directProof} direct proof record${directProof === 1 ? "" : "s"} matched this packet.` : "",
    !directProof && relatedProof ? `${relatedProof} related saved job${relatedProof === 1 ? "" : "s"} matched the decoded vehicle/profile; verify before trusting it.` : "",
    !directProof && !relatedProof && patternProof
      ? `${patternProof} Proof Pattern record${patternProof === 1 ? "" : "s"} matched ${bestPattern.label || "this baseline"}; observed family: ${bestPattern.ignitionFamily?.label || "unknown"}.`
      : "",
    bestPattern.topParts?.[0]
      ? `Most observed part clue: ${bestPattern.topParts[0].value} (${bestPattern.topParts[0].count} proof record${bestPattern.topParts[0].count === 1 ? "" : "s"}).`
      : "",
    partRows ? `${partRows} part cross-reference row${partRows === 1 ? "" : "s"} matched ${partQuery || body.q || "the search"}.` : "",
    lishiConfirmedTools
      ? `${lishiConfirmedTools} vehicle-confirmed Lishi tool match${lishiConfirmedTools === 1 ? "" : "es"} are available from the imported master reference.`
      : lishiEvidence?.primary && lishiEvidence?.status !== "conflict"
        ? lishiEvidence.decision
        : lishiTools
        ? `${lishiTools} Lishi keyway candidate${lishiTools === 1 ? "" : "s"} need lock/insert verification.`
        : "",
    autoRows ? `${autoRows} automotive code/programming baseline row${autoRows === 1 ? "" : "s"} matched.` : "",
    Number.isFinite(observedCoverage) ? `${observedCoverage}% observed shop coverage is represented in the saved-job set.` : "",
  ]).slice(0, 5);
  const gaps = uniqueCleanValues([
    !matchedProof ? "No saved worked-job proof matched yet." : "",
    !patternProof ? "No proof-pattern baseline matched this VIN/vehicle yet." : "",
    !partRows && partQuery ? "No cross-reference row matched the part query." : "",
    lishiEvidence?.status === "conflict" ? lishiEvidence.decision : "",
    !lishiConfirmedTools && !lishiEvidence?.primary ? "No vehicle-confirmed Lishi/keyway match is confirmed from the current query." : "",
    !hasVin ? "VIN-level identity is not attached to this packet yet." : "",
    ...(warnings || []),
  ]).slice(0, 5);
  const nextSteps = uniqueCleanValues([
    "Confirm authorization and attach proof before sensitive work.",
    partQuery ? `Review part history for ${partQuery}.` : "Search the part number family if a key is selected.",
    lishiEvidence?.status === "conflict"
      ? "Resolve the Lishi conflict at the lock before decode."
      : lishiConfirmedTools || lishiEvidence?.primary
        ? "Open the Lishi match and verify against the lock/keyway."
        : "Confirm keyway from the lock, insert, or decoded source.",
    autoRows ? "Review Code Desk auto baseline before importing/using authorized code data." : "Use Code Desk only after the correct system/depth-space card is verified.",
    "Save the worked job outcome after completion so coverage percentages improve.",
  ]).slice(0, 5);

  return {
    headline: "AI field brief",
    decision,
    confidencePercent: Math.round(confidencePercent),
    confidenceLabel: confidencePercent >= 88 ? "High" : confidencePercent >= 70 ? "Good" : confidencePercent >= 55 ? "Developing" : "Needs proof",
    evidence,
    gaps,
    nextSteps,
    technicianNote: `Best move: ${decision} ${nextSteps[0] || "Keep the job tied to verified proof."}`,
    customerNote: "We will verify the exact key, authorization, and programming path before finalizing parts or pricing.",
  };
}

function globalPartResults(partHistory = {}) {
  const references = (partHistory.crossReferences || []).slice(0, 5).map((reference) => ({
    id: reference.id || reference.primary,
    title: reference.primaryLabel || reference.primary || "Cross-reference",
    subtitle: (reference.labeledIdentifiers || []).map((item) => `${item.label} ${item.value}`).join(" | "),
    detail: (reference.oemPartNumbers || []).slice(0, 5).join(" | "),
    badge: reference.sourceTable || "Part",
    target: "part-history",
    query: partHistory.primaryIdentifier || partHistory.query,
  }));
  const jobs = (partHistory.jobs || []).slice(0, 4).map((job) => ({
    id: job.id,
    title: job.title || job.vehicle || "Saved job",
    subtitle: [job.vehicle, job.vin].filter(Boolean).join(" | "),
    detail: [job.programmer, (job.partNumbers || []).slice(0, 3).join(" | ")].filter(Boolean).join(" | "),
    badge: job.outcome?.label || "Job proof",
    target: "part-history",
    query: partHistory.primaryIdentifier || partHistory.query,
  }));
  return [...references, ...jobs].slice(0, 8);
}

function globalProofResults(proofVault = {}) {
  return (proofVault.records || []).slice(0, 8).map((record) => ({
    id: record.id,
    title: record.title || record.vehicle || "Proof record",
    subtitle: [record.vehicle, record.vin].filter(Boolean).join(" | "),
    detail: [record.programmer, (record.partNumbers || []).slice(0, 3).join(" | ")].filter(Boolean).join(" | "),
    badge: record.outcome?.label || "Proof",
    target: "proof-vault",
    query: proofVault.query || record.vin || record.vehicle,
  }));
}

function globalLishiResults(lookup = {}, query = "") {
  return (lookup.tools || []).slice(0, 8).map((tool) => ({
    id: tool.id || tool.canonical || tool.tool,
    title: tool.canonical || tool.tool || "Lishi tool",
    subtitle: (tool.categories || []).slice(0, 3).join(" | "),
    detail: (tool.applications || [])
      .slice(0, 3)
      .map((application) => [application.manufacturer, application.model, application.yearsText].filter(Boolean).join(" "))
      .join(" | "),
    badge: `${tool.applicationCount || 0} apps`,
    target: "lishi",
    query: query || tool.canonical || tool.tool,
  }));
}

function globalAutoResults(baseline = {}, query = "") {
  return (baseline.rows || []).slice(0, 8).map((row) => ({
    id: [row.year, row.make, row.model].filter(Boolean).join("-"),
    title: [row.year, row.make, row.model].filter(Boolean).join(" ") || "Auto baseline row",
    subtitle: row.template?.name || row.ignitionType || "Verify key system",
    detail: [row.programMethod, row.immobilizerSystem, (row.security || []).join(" / ")].filter(Boolean).join(" | "),
    badge: row.vpicOnly ? "Identity only" : "Programming",
    target: "code-desk",
    query,
  }));
}

async function buildGlobalSearch(body = {}, store = { jobs: [] }) {
  const query = cleanString(body.q || body.query || "");
  if (!query) return { generatedAt: new Date().toISOString(), query, mode: body.mode === "subscriber" ? "subscriber" : "owner", groups: [] };
  const mode = body.mode === "subscriber" ? "subscriber" : "owner";
  const cleanJobs = mergedSearchJobs(store.jobs || [], body.jobs || body.localJobs || []);
  const partsReference = await readPartsCrossReference();
  const evidenceIndex = buildJobEvidenceIndex(cleanJobs, partsReference);
  const lishiReference = await readLishiMasterReference();
  const vin = normalizeVinCandidate(query);
  const [partHistory, proofVault, lishiLookup, autoBaseline] = await Promise.all([
    Promise.resolve(buildPartHistory(query, evidenceIndex, partsReference)),
    Promise.resolve(buildProofVault(query, evidenceIndex, partsReference)),
    Promise.resolve(buildLishiLookup(lishiReference, { q: query, limit: 16 })),
    buildAutoCodeBaseline({ q: query, limit: 30 }),
  ]);
  const groups = [];

  if (vin || /\b(?:19|20)\d{2}\b/.test(query) || normalizeVehicleText(query).split(/\s+/).length >= 2) {
    groups.push(
      globalGroup("vehicle", "Vehicle / VIN", "vin", [
        {
          id: vin || "vehicle-search",
          title: vin ? `Decode VIN ${vin}` : `Search vehicle ${query}`,
          subtitle: vin ? "Run VIN lookup" : "Use this as a year/make/model clue",
          detail: "Sends the query into the vehicle workflow.",
          badge: vin ? "VIN" : "Vehicle",
          target: "vin",
          query,
        },
      ]),
    );
  }

  groups.push(globalGroup("workbench", "Job Workbench", "workbench", [
    {
      id: "workbench",
      title: `Build packet for ${query}`,
      subtitle: "Parts, proof, Lishi, Code Desk, and coverage in one place",
      detail: "Best first stop when you are not sure which tool should own the search.",
      badge: "Unified",
      target: "workbench",
      query,
    },
  ]));

  const partResults = globalPartResults(partHistory);
  if (partResults.length) groups.push(globalGroup("parts", "Parts and saved jobs", "part-history", partResults, `${partHistory.referenceStats?.matchedReferenceRows || 0} cross-reference rows matched.`));

  const proofResults = globalProofResults(proofVault);
  if (proofResults.length) groups.push(globalGroup("proof", "Proof Vault", "proof-vault", proofResults, `${proofVault.summary?.matchingJobs || 0} proof records matched.`));

  const directJobs = globalJobMatches(query, cleanJobs);
  if (directJobs.length) groups.push(globalGroup("jobs", "Direct job text", "proof-vault", directJobs, "Matched raw saved job text."));

  const lishiResults = globalLishiResults(lishiLookup, query);
  if (lishiResults.length) groups.push(globalGroup("lishi", "Lishi tools", "lishi", lishiResults, `${lishiLookup.matchedApplications || 0} application rows matched.`));

  const autoResults = globalAutoResults(autoBaseline, query);
  if (autoResults.length) groups.push(globalGroup("auto", "Auto Code Desk", "code-desk", autoResults, `${autoBaseline.totalRows || 0} automotive baseline rows matched.`));

  if (mode === "owner") {
    groups.push(
      globalGroup("owner-lists", "Owner reference lists", "reference-lists", [
        { id: "parts-list", title: "Search parts cross-reference list", subtitle: `${partsReference.totalRows || partsReference.rows?.length || 0} rows`, detail: "Raw ML/LR/MW/TI/OE aliases.", badge: "Owner", target: "reference-lists", source: "parts", query },
        { id: "lishi-list", title: "Search Lishi tools list", subtitle: `${lishiReference.stats?.tools || lishiReference.tools?.length || 0} tools`, detail: "Raw Lishi master import.", badge: "Owner", target: "reference-lists", source: "lishi-tools", query },
        { id: "programming-list", title: "Search programming reference", subtitle: "Year/make/model baseline", detail: "Raw programming and source rows.", badge: "Owner", target: "reference-lists", source: "programming", query },
      ]),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    query,
    mode,
    summary: {
      groups: groups.length,
      results: groups.reduce((total, group) => total + group.count, 0),
      ownerListsVisible: mode === "owner",
    },
    groups,
  };
}

async function findVerifiedVehicleProfile(vehicle) {
  const profiles = await readVehicleProfiles();
  const baseKey = vehicleProfileBaseKey(vehicle);
  const exactKey = vehicleProfileKey(vehicle);
  return (
    profiles.profiles
      .filter((profile) => profile.key === exactKey || profile.baseKey === baseKey)
      .sort((a, b) => {
        if ((a.key === exactKey) !== (b.key === exactKey)) return a.key === exactKey ? -1 : 1;
        return (b.verifiedParts?.length || 0) - (a.verifiedParts?.length || 0) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      })[0] || null
  );
}

async function readMasterCatalog() {
  return readJsonCached(masterCatalogPath, { rows: [] });
}

async function readKeyInnovationsLabels() {
  return readJsonCached(keyInnovationsLabelsPath, { entries: [] });
}

async function readPartsCrossReference() {
  return readJsonCached(partsCrossReferencePath, { rows: [], tokenIndex: {} });
}

async function readLishiMasterReference() {
  return readJsonCached(lishiMasterReferencePath, () => ({
    stats: { tools: 0, applications: 0 },
    categories: [],
    manufacturers: [],
    tools: [],
    applications: [],
    cleanupNotes: [],
    sources: [],
  }));
}

const catalogBrandPrefixes = {
  ACURA: ["ACURA", "AC"],
  HONDA: ["HON", "HONDA", "HO"],
  FORD: ["FORD", "FRD", "FD"],
  LINCOLN: ["FORD", "LINCOLN", "FRD", "FD", "LIN"],
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

const partsReferenceMakePrefixes = {
  ACURA: ["ACU", "ACURA", "HA", "HON"],
  AUDI: ["AUDI", "AUD", "VW"],
  BMW: ["BMW", "BM"],
  BUICK: ["GM", "GMP", "GMR", "ULK", "BUK"],
  CADILLAC: ["CAD", "GM", "GMP", "GMR", "ULK"],
  CHEVROLET: ["GM", "GMP", "GMR", "CHV", "CHEV"],
  CHRYSLER: ["CH", "CHRY", "MOP", "FBK", "ULK"],
  DODGE: ["CH", "DOD", "MOP", "FBK", "ULK"],
  FORD: ["FD", "FRD", "FORD"],
  GMC: ["GM", "GMC", "GMP", "GMR", "ULK"],
  HONDA: ["HA", "HON", "HONDA"],
  HYUNDAI: ["HG", "HK", "HYU", "HKG"],
  INFINITI: ["NS", "NIS", "INF", "ULK"],
  JEEP: ["CH", "JEP", "MOP", "FBK", "ULK"],
  KIA: ["KA", "HK", "KIA", "ULK"],
  LEXUS: ["TX", "TOY", "LEX"],
  LINCOLN: ["FD", "FRD", "FORD", "LIN"],
  MAZDA: ["MZ", "MAZ"],
  MITSUBISHI: ["MT", "MIT", "ULK"],
  NISSAN: ["NS", "NIS", "ULK"],
  RAM: ["CH", "RAM", "MOP", "FBK", "ULK"],
  SUBARU: ["SB", "SUB"],
  TOYOTA: ["TX", "TOY", "LEX"],
  VOLKSWAGEN: ["VW", "VWP", "VWF", "VWS"],
  VOLVO: ["VL", "VOLVO"],
};

function referencePrefixesForMake(make) {
  const key = String(make || "").toUpperCase();
  return [...new Set([...(prefixesForMake(key) || []), ...(partsReferenceMakePrefixes[key] || [])])]
    .map((value) => compactToken(value))
    .filter(Boolean);
}

function partNumbersOverlap(left = [], right = []) {
  const rightSet = new Set(right.map(compactToken));
  return left.some((item) => rightSet.has(compactToken(item)));
}

function catalogKeyTypeMatches(hlPartNumber, programmingReference) {
  const part = String(hlPartNumber || "").toUpperCase();
  const type = String(programmingReference?.ignitionType || "").toLowerCase();
  if (!part || !type) return false;
  if (type === "smart") return part.includes("-P");
  if (type === "keyed") return part.includes("-K");
  return false;
}

function uniqueCleanValues(values = []) {
  return [...new Set(values.flat(Infinity).map(cleanString).filter(Boolean))];
}

function partReferenceTokenVariants(value) {
  const compact = compactToken(value);
  if (!compact || compact.length < 2) return [];
  const variants = new Set([compact]);
  if (compact.startsWith("OEM") && compact.length > 5) variants.add(compact.slice(3));
  if (/^TIK[A-Z]+\d+[RN]$/.test(compact)) variants.add(compact.slice(0, -1));
  if (/^[A-Z]{2,5}\d{3,5}[RN]$/.test(compact)) variants.add(compact.slice(0, -1));
  return Array.from(variants);
}

function partsReferenceRowsById(partsReference = {}) {
  if (!partsReference || typeof partsReference !== "object") return new Map();
  let rowsById = partsReferenceRowsByIdCache.get(partsReference);
  if (!rowsById) {
    rowsById = new Map((partsReference.rows || []).map((row) => [row.id, row]));
    partsReferenceRowsByIdCache.set(partsReference, rowsById);
  }
  return rowsById;
}

function lookupPartsCrossReferenceRows(partsReference, values = []) {
  const rowsById = partsReferenceRowsById(partsReference);
  const matches = new Map();
  for (const value of uniqueCleanValues(values)) {
    for (const token of partReferenceTokenVariants(value)) {
      for (const rowId of partsReference?.tokenIndex?.[token] || []) {
        const row = rowsById.get(rowId);
        if (row) matches.set(row.id, row);
      }
    }
  }
  return Array.from(matches.values());
}

function labeledPartsRowIdentifiers(row = {}) {
  const gsiLabel = /^ULK/i.test(cleanString(row.gsiPartNumber)) ? "LR#" : "GSI#";
  const entries = [
    ["LR#", row.lrId],
    [gsiLabel, row.gsiPartNumber],
    ["MW#", row.mwId || row.mwPartNumber],
    ["ML#", row.mlPartNumber],
    ["KI#", row.kiPartNumber],
    ["TI#", row.tiPartNumber],
  ];
  const seen = new Set();
  return entries
    .map(([label, value]) => ({ label, value: cleanString(value) }))
    .filter((entry) => entry.value)
    .filter((entry) => {
      const key = compactToken(entry.value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function preferredPartsIdentifier(row = {}) {
  return labeledPartsRowIdentifiers(row)[0] || { label: "Part#", value: "" };
}

function crossReferenceSummary(row) {
  const labeledIdentifiers = labeledPartsRowIdentifiers(row);
  const preferred = preferredPartsIdentifier(row);
  const identifiers = uniqueCleanValues(labeledIdentifiers.map((item) => item.value)).slice(0, 10);
  return {
    id: row.id,
    sourceTable: row.sourceTable || "Parts cross-reference",
    primary: preferred.value || row.mlPartNumber || row.mwPartNumber || row.mwId || row.gsiPartNumber || row.lrId || row.tiPartNumber || identifiers[0] || "Cross-reference",
    primaryLabel: preferred.value ? `${preferred.label} ${preferred.value}` : identifiers[0] || "Cross-reference",
    identifiers,
    labeledIdentifiers,
    oemPartNumbers: uniqueCleanValues(row.oemPartNumbers || []).slice(0, 8),
    aliases: uniqueCleanValues(row.aliases || []).slice(0, 12),
  };
}

function referenceValuesForCandidate(candidate = {}) {
  return uniqueCleanValues([
    candidate.hlPartNumber,
    candidate.legacyPartNumber,
    candidate.activePartNumber,
    candidate.supplierSku,
    candidate.supplierBrand,
    candidate.fccId,
    candidate.oemPartNumbers || [],
    candidate.crossReferences?.flatMap((item) => [item.identifiers || [], item.oemPartNumbers || [], item.aliases || []]) || [],
  ]);
}

function referenceValuesForMasterRow(row = {}, linkedLabel = null) {
  return uniqueCleanValues([
    row.hlPartNumber,
    row.fccId,
    row.mwLegacyPartNumber,
    row.lrLegacyPartNumber,
    row.tiActivePartNumber,
    row.klrActivePartNumber,
    row.oemPartNumbers || [],
    linkedLabel?.sku,
    linkedLabel?.fccIds || [],
    linkedLabel?.oemPartNumbers || [],
    linkedLabel?.rawText,
  ]);
}

function mergeCrossReferenceIntoCandidate(candidate, crossRows) {
  if (!crossRows.length) return candidate;
  const summaries = crossRows.map(crossReferenceSummary);
  const crossOems = summaries.flatMap((item) => item.oemPartNumbers || []);
  const crossIds = summaries.flatMap((item) => item.identifiers || []);
  const crossLabels = summaries.flatMap((item) => (item.labeledIdentifiers || []).map((entry) => `${entry.label} ${entry.value}`));
  return {
    ...candidate,
    score: (candidate.score || 0) + 28,
    reasons: [...new Set([...(candidate.reasons || []), "parts cross-reference match"])],
    confidence: (candidate.score || 0) >= 55 ? candidate.confidence : "medium",
    oemPartNumbers: uniqueCleanValues([candidate.oemPartNumbers || [], crossOems]).slice(0, 12),
    crossReferenceIds: crossIds.slice(0, 10),
    crossReferenceLabels: uniqueCleanValues(crossLabels).slice(0, 10),
    crossReferences: summaries.slice(0, 4),
    preferredPartNumber: summaries[0]?.primary || candidate.preferredPartNumber || "",
    preferredPartNumberLabel: summaries[0]?.primaryLabel || candidate.preferredPartNumberLabel || "",
    source: candidate.source?.includes("parts cross-reference")
      ? candidate.source
      : `${candidate.source || "Parts candidate"} + parts cross-reference`,
  };
}

function referenceRowMatchesMake(row, make) {
  const prefixes = referencePrefixesForMake(make);
  if (!prefixes.length) return false;
  const tokens = (row.tokens || []).map((token) => token.normalized || compactToken(token.value));
  return tokens.some((token) =>
    prefixes.some((prefix) => token.startsWith(prefix) || (prefix.length >= 3 && token.includes(prefix))),
  );
}

function candidateFromCrossReferenceRow(row) {
  const summary = crossReferenceSummary(row);
  const ids = summary.identifiers;
  return {
    score: 44,
    confidence: "medium",
    reasons: ["parts cross-reference row"],
    hlPartNumber: row.mlPartNumber || "",
    fccId: "",
    attributes: "",
    oemPartNumbers: summary.oemPartNumbers,
    legacyPartNumber: row.mwPartNumber || row.mwId || row.lrId || row.gsiPartNumber || "",
    activePartNumber: row.tiPartNumber || row.kiPartNumber || "",
    supplierSku: row.gsiPartNumber || row.lrId || row.kiPartNumber || row.mwPartNumber || row.mwId || row.mlPartNumber || "",
    supplierBrand: "",
    descriptor: summary.aliases.slice(0, 3).join(", "),
    source: "Parts cross-reference",
    verify: ["vehicle application", "button layout", "FCC/frequency", "blade/keyway", "supplier stock"],
    crossReferenceIds: ids.slice(0, 10),
    crossReferenceLabels: (summary.labeledIdentifiers || []).map((entry) => `${entry.label} ${entry.value}`).slice(0, 10),
    crossReferences: [summary],
    preferredPartNumber: summary.primary,
    preferredPartNumberLabel: summary.primaryLabel,
  };
}

function mergeSupplierCandidates(candidates) {
  const merged = [];
  for (const candidate of candidates) {
    const tokens = new Set(referenceValuesForCandidate(candidate).flatMap(partReferenceTokenVariants));
    const existing = merged.find((item) => referenceValuesForCandidate(item).flatMap(partReferenceTokenVariants).some((token) => tokens.has(token)));
    if (!existing) {
      merged.push(candidate);
      continue;
    }
    existing.score = Math.max(existing.score || 0, candidate.score || 0) + 8;
    existing.confidence = existing.score >= 75 ? "medium-high" : existing.score >= 55 ? "medium" : existing.confidence || candidate.confidence || "low";
    existing.reasons = [...new Set([...(existing.reasons || []), ...(candidate.reasons || [])])];
    existing.oemPartNumbers = uniqueCleanValues([existing.oemPartNumbers || [], candidate.oemPartNumbers || []]).slice(0, 12);
    existing.crossReferenceIds = uniqueCleanValues([existing.crossReferenceIds || [], candidate.crossReferenceIds || []]).slice(0, 12);
    existing.crossReferenceLabels = uniqueCleanValues([existing.crossReferenceLabels || [], candidate.crossReferenceLabels || []]).slice(0, 12);
    existing.crossReferences = [...(existing.crossReferences || []), ...(candidate.crossReferences || [])].slice(0, 5);
    existing.preferredPartNumber ||= candidate.preferredPartNumber;
    existing.preferredPartNumberLabel ||= candidate.preferredPartNumberLabel;
    existing.legacyPartNumber ||= candidate.legacyPartNumber;
    existing.activePartNumber ||= candidate.activePartNumber;
    existing.supplierSku ||= candidate.supplierSku;
    existing.descriptor ||= candidate.descriptor;
    if (!existing.source.includes(candidate.source || "")) existing.source = `${existing.source} + ${candidate.source}`;
  }
  return merged;
}

async function findSupplierCandidates(vehicle, record, programmingReference) {
  const [masterCatalog, keyInnovations, partsReference] = await Promise.all([readMasterCatalog(), readKeyInnovationsLabels(), readPartsCrossReference()]);
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

  const masterCandidates = masterRows.map((row) => {
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

    const candidate = {
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
      source: linkedLabel ? "Master parts database + imported label" : "Master parts database",
      verify: ["vehicle application", "button layout", "FCC/frequency", "blade/keyway", "supplier stock"],
    };
    return mergeCrossReferenceIntoCandidate(candidate, lookupPartsCrossReferenceRows(partsReference, referenceValuesForMasterRow(row, linkedLabel)));
  });

  const referenceCandidates = (partsReference.rows || [])
    .filter((row) => referenceRowMatchesMake(row, vehicle.make))
    .map(candidateFromCrossReferenceRow);
  const candidates = mergeSupplierCandidates([...masterCandidates, ...referenceCandidates]);

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

function vehicleReferenceFor(vehicle, programmingReference, shopEvidence) {
  const family = vehicleFamily(vehicle.make, vehicle.model);
  const year = Number(vehicle.year);
  const text = normalizeVehicleText(`${vehicle.make} ${vehicle.model} ${vehicle.trim} ${vehicle.bodyClass}`);
  const lateFord = ["ford", "lincoln"].includes(family) && year >= 2015;
  const fordTruck = lateFord && /F150|F 150|EXPEDITION|NAVIGATOR|SUPER DUTY|F250|F350/.test(text);
  const fordEscape = family === "ford" && /ESCAPE/.test(text) && year >= 2013 && year <= 2019;
  const hondaOlder = family === "honda" && year <= 2005;
  const toyotaLate = ["toyota", "lexus"].includes(family) && year >= 2018;
  const gmLate = family === "gm" && year >= 2015;
  const gmHu100Truck =
    family === "gm" &&
    year >= 2014 &&
    year <= 2022 &&
    /SILVERADO|SIERRA|TAHOE|SUBURBAN|YUKON|ESCALADE/.test(text);
  const chryslerLate = family === "chrysler" && year >= 2011;
  const nissanLate = family === "nissan" && year >= 2013;
  const hyundaiLate = family === "hyundai" && year >= 2015;

  const reference = {
    keyway: {
      primary: "Verify by door/ignition/insert blade before cutting",
      alternates: [],
      confidence: "verify",
    },
    lishi: {
      primary: "Use keyway-confirmed Lishi/decoder only after authorization",
      alternates: [],
      confidence: "verify",
    },
    origination: [
      "Confirm ownership/authorization",
      "Confirm keyway from lock or emergency insert",
      "Use code source or decode path",
      "Cut test/mechanical blade before programming",
    ],
    unlock: [
      "Use non-destructive automotive entry kit",
      "Air wedge/pump wedge, long reach, protective sleeve",
      "Verify lockout authorization before entry",
    ],
    programming: [
      programmingReference?.programMethod || "Verify programmer coverage by exact year/model/key system",
      programmingReference?.requiresOnline ? "Online/OEM path may be required" : "",
      programmingReference?.requiresPin ? "PIN/passcode/security access may be required" : "",
    ].filter(Boolean),
    access: [
      "Photo/document authorization before entry or key generation",
      "Confirm lockout vs lost key vs duplicate key request",
      "Document VIN plate, door jamb label, and customer approval",
    ],
    fieldPhotos: [
      "VIN plate",
      "Door jamb label",
      "Ignition/slot or push button area",
      "Customer key or visible button layout when available",
      "Emergency insert blade/profile when available",
    ],
    fieldTools: [
      "Battery maintainer before module communication",
      "OBD access check and stable connection",
      "Key machine jaw/adapter by confirmed blade profile",
      "Non-destructive entry tools with trim protection",
    ],
    jobFlow: [
      "Verify vehicle identity and authorization",
      "Confirm key system from visible hardware and customer request",
      "Confirm keyway or insert before cutting",
      "Confirm programmer coverage before opening security functions",
      "Cut/test mechanical function before programming electronics",
    ],
    decodePlan: [
      "Confirm mechanical keyway before choosing a Lishi",
      "Prefer code/source when available and authorized",
      "If decoding, compare door read against ignition/insert behavior before final cut",
    ],
    cutting: [
      "Choose machine jaw/adapter by confirmed blade profile",
      "Cut a mechanical test blade first when possible",
      "Verify smooth lock operation before programming expensive electronics",
    ],
    partVerification: [
      "Match FCC, frequency, board, button count, and emergency insert",
      "Compare customer-visible buttons against reference photos",
      "Check remote start, tailgate/hatch, panic, and trunk options",
      "Avoid choosing a final key from VIN alone when trim/package is unclear",
    ],
    warnings: [
      "VIN alone does not prove keyway, FCC, button layout, or lock cylinder changes",
      "Low voltage, replaced locks, or swapped modules can turn a normal job into a diagnostic job",
    ],
    source: "Brand/year reference; verify on vehicle",
  };

  if (fordEscape) {
    reference.keyway = { primary: "HU101", alternates: [], confidence: "medium-high" };
    reference.lishi = { primary: "HU101 Lishi / decoder", alternates: [], confidence: "medium-high" };
    reference.origination.push("For this Escape generation, start with HU101 from the key/blank fitment, then confirm on the door/insert before cutting");
    reference.decodePlan.push("Use HU101 path only unless the actual lock or replacement cylinder proves otherwise");
    reference.cutting.push("Cut/test HU101 mechanical operation before programming electronics");
    reference.partVerification.push("Confirm supplier key/blank fitment shows HU101 before finalizing the job kit");
  } else if (fordTruck) {
    reference.keyway = { primary: "HU101 / HU198 family likely", alternates: ["Confirm center mill profile", "Emergency insert may differ by package"], confidence: "medium" };
    reference.lishi = { primary: "HU101 or HU198 Lishi/decoder by confirmed keyway", alternates: ["Confirm 4-depth/10-cut vs newer profile before use"], confidence: "medium" };
    reference.origination.push("Common Ford truck path: decode/source code, cut HU101/HU198 blade, then program remote/prox");
    reference.unlock.push("Ford truck long-reach entry setup; protect weatherstrip and wiring");
    reference.access.push("Check truck cab configuration and where customer key/lockout access is needed");
    reference.decodePlan.push("For F-Series, confirm HU101 vs HU198 at the door/insert before pulling parts");
    reference.cutting.push("Verify center-mill profile and depth system before final blade");
    reference.partVerification.push("Ford truck tailgate, remote start, panic, and button count can split otherwise similar remotes");
    reference.warnings.push("Late Ford prox/flip can vary by trim, remote start, tailgate, and FCC");
    reference.fieldPhotos.push("Tailgate/hatch buttons and remote-start button if equipped");
    reference.fieldTools.push("FDRS/OEM path readiness check for newer module-sensitive jobs");
    reference.jobFlow.push("For late Ford trucks, decide FDRS/OEM path vs verified aftermarket coverage before programming");
  } else if (hondaOlder) {
    reference.keyway = { primary: "Honda high-security keyway likely", alternates: ["Verify door/ignition wear", "Older ignition/door mismatch is possible"], confidence: "medium" };
    reference.lishi = { primary: "Honda-compatible high-security Lishi by confirmed keyway", alternates: [], confidence: "medium" };
    reference.unlock.push("Honda inside-handle/lock layout varies; use damage-free reach method");
    reference.decodePlan.push("Check for worn/replaced door locks before trusting a decode");
    reference.cutting.push("High-security Honda cuts need clean calibration and lock-wear verification");
    reference.warnings.push("Older Honda locks may be worn or replaced; verify mechanical operation first");
    reference.fieldPhotos.push("Ignition wear and door lock condition");
  } else if (toyotaLate) {
    reference.keyway = { primary: "Toyota/Lexus emergency insert keyway must be confirmed", alternates: ["Hybrid/prox trims vary"], confidence: "low-medium" };
    reference.lishi = { primary: "Toyota/Lexus keyway-specific Lishi after insert verification", alternates: [], confidence: "verify" };
    reference.programming.push("Techstream/TIS path may be preferred for late Toyota/Lexus risk");
    reference.partVerification.push("Hybrid/prox package, FCC, and emergency insert must match exactly");
    reference.warnings.push("Hybrid/prox and trim package can change FCC, board, and emergency insert");
    reference.fieldPhotos.push("Hybrid badge/trim clue and push-button area");
    reference.fieldTools.push("TIS/Techstream or equivalent coverage check");
  } else if (gmHu100Truck) {
    reference.keyway = { primary: "HU100", alternates: [], confidence: "medium-high" };
    reference.lishi = { primary: "HU100 Lishi / decoder", alternates: [], confidence: "medium-high" };
    reference.programming.push("SPS/OEM or security wait may apply depending on platform");
    reference.origination.push("For this GM truck/SUV range, start with HU100 from key/blank fitment, then confirm on the door or emergency insert before cutting");
    reference.decodePlan.push("Use HU100 path only unless the actual lock or replacement cylinder proves otherwise");
    reference.cutting.push("Cut/test HU100 mechanical operation before programming electronics");
    reference.partVerification.push("Compare PEPS/prox, remote head, FCC, button count, and HU100 emergency insert before selecting the final key");
    reference.fieldTools.push("HU100 Lishi / decoder");
    reference.fieldTools.push("Battery support and SPS/GM security path readiness");
    reference.warnings.push("GM prox and remote-head options can split by trim, tailgate, remote start, and FCC even when the Lishi stays HU100");
  } else if (gmLate) {
    reference.keyway = { primary: "GM side-mill/emergency insert keyway must be confirmed", alternates: ["Blade/prox varies by platform"], confidence: "verify" };
    reference.lishi = { primary: "GM keyway-specific Lishi after lock/insert verification", alternates: [], confidence: "verify" };
    reference.programming.push("SPS/OEM or security wait may apply depending on platform");
    reference.partVerification.push("Compare PEPS/prox, remote head, blade, and FCC before selecting supplier part");
    reference.fieldTools.push("Battery support and SPS/GM security path readiness");
  } else if (chryslerLate) {
    reference.keyway = { primary: "Chrysler/Dodge/Jeep/Ram emergency blade keyway must be confirmed", alternates: ["Remote head and prox packages vary by trim"], confidence: "verify" };
    reference.lishi = { primary: "Chrysler-family keyway-specific Lishi after door/insert verification", alternates: [], confidence: "verify" };
    reference.origination.push("Check whether vehicle uses WIN/Fobik, prox, or conventional transponder path");
    reference.programming.push("Confirm PIN/security access and module coverage before dispatch");
    reference.partVerification.push("Fobik/prox case style and button layout matter as much as model year");
    reference.warnings.push("Fobik/prox style, button layout, hatch, and remote start can change the correct part");
    reference.fieldPhotos.push("WIN/Fobik slot, prox push button, or keyed ignition style");
  } else if (nissanLate) {
    reference.keyway = { primary: "Nissan/Infiniti emergency insert keyway must be confirmed", alternates: ["Prox blade and transponder blade can differ"], confidence: "verify" };
    reference.lishi = { primary: "Nissan/Infiniti keyway-specific Lishi after insert/door verification", alternates: [], confidence: "verify" };
    reference.programming.push("Confirm BCM/security coverage and slot/prox behavior before programming");
    reference.partVerification.push("Slot/prox behavior, FCC, and hatch/trunk buttons can split parts matches");
    reference.warnings.push("Nissan prox FCC and button configuration often varies inside the same model year");
    reference.fieldPhotos.push("Slot/prox behavior and hatch/trunk button layout");
  } else if (hyundaiLate) {
    reference.keyway = { primary: "Hyundai/Kia/Genesis keyway must be confirmed from lock or insert", alternates: ["Flip, remote head, and prox variants may share vehicle fitment"], confidence: "verify" };
    reference.lishi = { primary: "Hyundai/Kia keyway-specific Lishi after lock/insert verification", alternates: [], confidence: "verify" };
    reference.programming.push("Confirm immobilizer presence and programmer coverage by exact trim/key system");
    reference.partVerification.push("Confirm immobilizer/prox equipment before assuming a chip key is required");
    reference.warnings.push("Some trims in the same year can be non-immobilizer, transponder, or prox");
    reference.fieldPhotos.push("Ignition style, prox button, or flip key evidence");
  }

  return reference;
}

function modelMatchesVault(entryVehicle, vehicleModel) {
  const model = normalizeVehicleText(vehicleModel);
  const candidates = [entryVehicle?.model, ...(Array.isArray(entryVehicle?.aliases) ? entryVehicle.aliases : [])]
    .flat()
    .filter(Boolean)
    .map(normalizeVehicleText);
  return candidates.some((candidate) => candidate && (model === candidate || model.includes(candidate) || candidate.includes(model)));
}

function vaultEntryMatchesVehicle(entry, vehicle) {
  if (!entry || !entry.vehicle) return false;
  const year = Number(vehicle.year);
  const startYear = Number(entry.vehicle.startYear || entry.vehicle.year || 0);
  const endYear = Number(entry.vehicle.endYear || entry.vehicle.year || 9999);
  if (Number.isFinite(year) && year && (year < startYear || year > endYear)) return false;
  if (entry.vehicle.make && !stringsMatch(entry.vehicle.make, vehicle.make)) return false;
  if (entry.vehicle.model && !modelMatchesVault(entry.vehicle, vehicle.model)) return false;
  return true;
}

async function findReferenceVaultEntries(vehicle) {
  const vault = await readReferenceVault();
  return vault.entries
    .filter((entry) => entry.status !== "retired")
    .filter((entry) => vaultEntryMatchesVehicle(entry, vehicle))
    .sort((a, b) => {
      const confidenceWeight = { high: 4, "medium-high": 3, medium: 2, low: 1 };
      return (confidenceWeight[b.confidence] || 0) - (confidenceWeight[a.confidence] || 0);
    })
    .slice(0, 5);
}

function appendUnique(target, items) {
  if (!Array.isArray(target)) return;
  const seen = new Set(target.map((item) => String(item).toLowerCase()));
  for (const item of items || []) {
    const clean = cleanString(item);
    if (!clean || seen.has(clean.toLowerCase())) continue;
    target.push(clean);
    seen.add(clean.toLowerCase());
  }
}

function applyReferenceVault(reference, entries) {
  if (!entries?.length) return reference;
  const next = structuredClone(reference);
  const strongest = entries[0];
  if (strongest.keyway?.primary) {
    next.keyway = {
      primary: strongest.keyway.primary,
      alternates: strongest.keyway.alternates || next.keyway?.alternates || [],
      confidence: strongest.confidence || next.keyway?.confidence || "verify",
    };
  }
  if (strongest.lishi?.primary) {
    next.lishi = {
      primary: strongest.lishi.primary,
      alternates: strongest.lishi.alternates || next.lishi?.alternates || [],
      confidence: strongest.confidence || next.lishi?.confidence || "verify",
    };
  }
  for (const entry of entries) {
    appendUnique(next.keySystems, entry.keySystems);
    appendUnique(next.vaultKeys, entry.keys?.map((key) => [key.name, key.fcc, key.chip, key.buttons].filter(Boolean).join(" | ")));
    appendUnique(next.vaultProgrammers, entry.programmers?.map((programmer) => [programmer.name, programmer.coverage, programmer.notes].filter(Boolean).join(" | ")));
    appendUnique(next.eeprom, entry.eeprom);
    appendUnique(next.origination, entry.origination);
    appendUnique(next.unlock, entry.unlock);
    appendUnique(next.programming, entry.programming);
    appendUnique(next.access, entry.access);
    appendUnique(next.fieldPhotos, entry.fieldPhotos);
    appendUnique(next.fieldTools, entry.fieldTools);
    appendUnique(next.jobFlow, entry.jobFlow);
    appendUnique(next.decodePlan, entry.decodePlan);
    appendUnique(next.cutting, entry.cutting);
    appendUnique(next.partVerification, entry.partVerification);
    appendUnique(next.warnings, entry.warnings);
  }
  next.vaultNotes = entries
    .map((entry) => [entry.title, entry.summary].filter(Boolean).join(": "))
    .filter(Boolean)
    .slice(0, 5);
  next.vaultSources = entries
    .flatMap((entry) => entry.sources || [])
    .map((source) => ({
      label: source.label || "Reference source",
      citation: source.citation || "",
      sourceType: source.sourceType || "reference",
    }))
    .slice(0, 8);
  next.referenceVault = {
    matched: entries.length,
    confidence: strongest.confidence || "medium",
    sourcePolicy: "Original TimLock-App summaries only; source citations are for audit/verification.",
  };
  next.source = `${next.source}; ${entries.length} TimLock-App vault match${entries.length === 1 ? "" : "es"}`;
  return next;
}

function applyVerifiedProfileReference(reference, verifiedProfile) {
  if (!verifiedProfile?.preferredLishi?.value) return reference;
  const next = structuredClone(reference);
  const lishi = cleanString(verifiedProfile.preferredLishi.value);
  const count = verifiedProfile.preferredLishi.count || 1;
  next.keyway = {
    primary: lishi,
    alternates: next.keyway?.alternates || [],
    confidence: count >= 3 ? "high" : "shop-confirmed",
  };
  next.lishi = {
    primary: `${lishi} Lishi / decoder`,
    alternates: next.lishi?.alternates || [],
    confidence: count >= 3 ? "high" : "shop-confirmed",
  };
  appendUnique(next.decodePlan, [`Shop-confirmed Lishi/keyway: ${lishi} from ${count} worked job${count === 1 ? "" : "s"}`]);
  appendUnique(next.partVerification, [`Prefer saved shop keyway ${lishi} unless the actual lock or replacement cylinder proves otherwise`]);
  next.source = `${next.source}; shop-confirmed Lishi/keyway`;
  return next;
}

function listFromInput(value) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean);
  return cleanString(value)
    .split(/\r?\n|;/)
    .map(cleanString)
    .filter(Boolean);
}

function sanitizeReferenceVaultEntry(input) {
  const vehicle = input.vehicle || {};
  const id =
    cleanString(input.id) ||
    [
      cleanString(vehicle.startYear || vehicle.year),
      cleanString(vehicle.endYear && vehicle.endYear !== vehicle.startYear ? vehicle.endYear : ""),
      cleanString(vehicle.make),
      cleanString(vehicle.model),
      cleanString(input.title),
    ]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    randomUUID();
  return {
    id,
    title: cleanString(input.title) || "Vehicle reference entry",
    summary: cleanString(input.summary),
    status: cleanString(input.status) || "draft",
    confidence: cleanString(input.confidence) || "medium",
    vehicle: {
      make: cleanString(vehicle.make).toUpperCase(),
      model: cleanString(vehicle.model),
      aliases: listFromInput(vehicle.aliases),
      startYear: cleanString(vehicle.startYear || vehicle.year),
      endYear: cleanString(vehicle.endYear || vehicle.year || vehicle.startYear),
    },
    keyway: {
      primary: cleanString(input.keyway?.primary),
      alternates: listFromInput(input.keyway?.alternates),
    },
    lishi: {
      primary: cleanString(input.lishi?.primary),
      alternates: listFromInput(input.lishi?.alternates),
    },
    keySystems: listFromInput(input.keySystems),
    keys: (Array.isArray(input.keys) ? input.keys : [])
      .map((key) => ({
        name: cleanString(key.name),
        type: cleanString(key.type),
        fcc: cleanString(key.fcc),
        chip: cleanString(key.chip),
        buttons: cleanString(key.buttons),
        insert: cleanString(key.insert),
        notes: cleanString(key.notes),
        confidence: cleanString(key.confidence) || "verify",
      }))
      .filter((key) => key.name || key.fcc || key.chip || key.buttons),
    programmers: (Array.isArray(input.programmers) ? input.programmers : [])
      .map((programmer) => ({
        name: cleanString(programmer.name),
        coverage: cleanString(programmer.coverage),
        addKey: cleanString(programmer.addKey),
        allKeysLost: cleanString(programmer.allKeysLost),
        pin: cleanString(programmer.pin),
        online: cleanString(programmer.online),
        notes: cleanString(programmer.notes),
        confidence: cleanString(programmer.confidence) || "verify",
      }))
      .filter((programmer) => programmer.name || programmer.coverage || programmer.notes),
    eeprom: listFromInput(input.eeprom),
    origination: listFromInput(input.origination),
    unlock: listFromInput(input.unlock),
    programming: listFromInput(input.programming),
    access: listFromInput(input.access),
    fieldPhotos: listFromInput(input.fieldPhotos),
    fieldTools: listFromInput(input.fieldTools),
    jobFlow: listFromInput(input.jobFlow),
    decodePlan: listFromInput(input.decodePlan),
    cutting: listFromInput(input.cutting),
    partVerification: listFromInput(input.partVerification),
    warnings: listFromInput(input.warnings),
    sources: (Array.isArray(input.sources) ? input.sources : [])
      .map((source) => ({
        label: cleanString(source.label),
        citation: cleanString(source.citation),
        sourceType: cleanString(source.sourceType) || "reference",
        notes: cleanString(source.notes),
      }))
      .filter((source) => source.label || source.citation),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "user-agent": "TimLock-App public source indexer", ...(options.headers || {}) },
    signal: options.signal || AbortSignal.timeout(20000),
    ...options,
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

const publicReferenceTargets = [
  ["xtool-vehicle-coverage", "XTOOL public vehicle coverage", "programmer coverage", "https://www.xtoolonline.com/support/vehicle-coverage", "XTOOL make/model coverage clue for diagnosis, key programming, special functions, and IMMO where publicly accessible."],
  ["xtool-key-programming-manual", "XTOOL key programming manual", "programmer / EEPROM tool", "https://www.xtooltech.com/official/product_document/1661416059950.pdf", "Public manual availability clue for XTOOL key programming workflow and EEPROM/IMMO tool capability."],
  ["advanced-diagnostics-smart-pro", "Advanced Diagnostics Smart Pro", "programmer coverage", "https://www.hickleys.com/diagnostics/smartpro.php", "Public Smart Pro / Info Quest capability clue. Verify exact vehicle coverage inside licensed AD resources before dispatch."],
  ["toyota-tis-techstream", "Toyota TIS / Techstream", "OEM programmer", "https://techinfo.toyota.com/", "Official Toyota service-info clue for Techstream, key code, immobilizer/smart reset, and security-professional workflow."],
  ["gm-techline-connect", "GM Techline Connect / SPS", "OEM programmer", "https://www.gmparts.com/trade-professionals/diagnostic-support-resources", "Official GM clue for Techline Connect, SPS, calibrations, GDS software, and scan-tool update workflow."],
  ["ford-motorcraft-service", "Ford Motorcraft Service / FDRS", "OEM programmer", "https://www.motorcraft-service.com/contact/index.html", "Official Ford service-info clue for IDS/FJDS/FDRS diagnostic support and account-based service access."],
  ["honda-techinfo", "Honda Service Express / i-HDS", "OEM programmer", "https://techinfo.honda.com/", "Official Honda service-info entry point. Verify immobilizer and module workflows through authorized service resources."],
  ["nissan-techinfo", "Nissan TechInfo", "OEM programmer", "https://www.nissan-techinfo.com/", "Official Nissan service-info entry point. Verify CONSULT/security workflows through authorized resources."],
  ["stellantis-techauthority", "Stellantis TechAuthority", "OEM programmer", "https://www.techauthority.com/", "Official Stellantis service-info entry point for Chrysler/Dodge/Jeep/Ram security and programming references."],
  ["autel-xp400-pro", "Autel XP400 Pro", "EEPROM tool", "https://autel.com/au/immo/xp400-pro/", "Public EEPROM/MCU/IMMO ECU read-write tool capability clue for Autel IM508/IM608 workflows."],
  ["xhorse-key-tool-plus-manual", "Xhorse Key Tool Plus manual", "EEPROM tool", "https://www.xhorsetool.com/upload/pro/22120916705811783595.pdf", "Public manual availability clue for Xhorse OBD IMMO, EEPROM read/write, and immo data tooling."],
  ["obdstar-x300-dp-plus", "OBDSTAR X300 DP Plus", "EEPROM tool", "https://www.obdstarstore.com/wholesale/obdstar-x300-dp-plus-full-configuration.html", "Public IMMO/EEPROM/key-renewing adapter capability clue. Verify vehicle-specific coverage before quoting."],
].map(([id, name, category, url, use]) => ({ id, name, category, url, use }));

async function probePublicReferenceTarget(target) {
  try {
    const response = await fetch(target.url, {
      headers: { "user-agent": "TimLock-App public source indexer" },
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
      ...target,
      status: response.ok ? "available" : "unavailable",
      httpStatus: response.status,
      contentType,
      signals: response.ok ? keywords.filter((keyword) => haystack.includes(keyword)).slice(0, 12) : [],
      publicTextIndexed: Boolean(text),
    };
  } catch (error) {
    return { ...target, status: "probe failed", error: error.message, signals: [], publicTextIndexed: false };
  }
}

async function syncPublicReferenceSources() {
  const commonMakes = ["Acura", "Chevrolet", "Chrysler", "Dodge", "Ford", "Honda", "Hyundai", "Jeep", "Kia", "Lexus", "Nissan", "Ram", "Subaru", "Toyota", "Volkswagen"];
  const autelProductsPayload = await fetchJson("https://www.autel.com/ev-coverage/getProduct?lg=en");
  const autelProducts = (autelProductsPayload.data || [])
    .filter((product) => /IMMO|MaxiIM|IM508|IM608/i.test(`${product.proName} ${product.systemName}`))
    .map((product) => ({ name: product.proName, systemName: product.systemName }));
  const coverageProducts = autelProducts.filter((product) => /IM508|IM608/i.test(product.name)).slice(0, 4);
  const coverage = [];
  for (const product of coverageProducts) {
    const makesPayload = await fetchJson(`https://www.autel.com/vehicle-coverage/getModel?lg=en&language=en&product=${encodeURIComponent(product.name)}`).catch(() => ({ data: [] }));
    const makes = (makesPayload.data || []).filter((make) => commonMakes.some((common) => stringsMatch(common, make)));
    coverage.push({ product: product.name, supportedMakes: makes, supportedMakeCount: makes.length });
  }
  const nhtsaVariables = await fetchJson("https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleVariableList?format=json").catch(() => ({ Results: [] }));
  const sourceProbes = [];
  for (const target of publicReferenceTargets) {
    sourceProbes.push(await probePublicReferenceTarget(target));
  }
  const payload = {
    sources: [
      {
        id: "nhtsa-vpic",
        name: "NHTSA vPIC",
        type: "official public vehicle identity",
        use: "VIN/YMM identity, body, engine, trim, plant, drive, fuel, GVWR, and manufacturer facts",
      },
      {
        id: "autel-coverage",
        name: "Autel public vehicle coverage",
        type: "public programmer coverage clue",
        use: "Programmer availability clues by product/make/model/year where the public endpoint returns data",
      },
      {
        id: "xtool-public",
        name: "XTOOL public sources",
        type: "public programmer coverage clue",
        use: "Public XTOOL pages/manuals for key programming, IMMO, and EEPROM capability clues",
      },
      {
        id: "advanced-diagnostics-public",
        name: "Advanced Diagnostics public sources",
        type: "public programmer coverage clue",
        use: "Public Smart Pro / Info Quest capability clues; exact coverage still must be verified in licensed resources",
      },
      {
        id: "oem-programmer-sources",
        name: "OEM programmer sources",
        type: "official service-info clue",
        use: "Official Ford/Toyota/GM/Honda/Nissan/Stellantis entry points for OEM/security programming paths",
      },
      {
        id: "eeprom-tool-sources",
        name: "EEPROM tool sources",
        type: "public tool capability clue",
        use: "Public tool pages/manuals for EEPROM/MCU/IMMO ECU read-write capability",
      },
      {
        id: "fcc-equipment",
        name: "FCC equipment authorization data",
        type: "public FCC ID clue",
        use: "FCC grantee/product clues after a candidate FCC is known from supplier or field data",
      },
      {
        id: "supplier-public-parts",
        name: "Supplier public parts sources",
        type: "public/live parts facts",
        use: "Product names, fitment, FCC/chip/button clues, images, and stock where access is allowed",
      },
      {
        id: "community-field-reports",
        name: "Public community field reports",
        type: "anecdotal success/failure clue",
        use: "Public forum, Reddit, YouTube, or article comments can be captured as lower-confidence clues when the source is public and linkable",
      },
    ],
    autel: {
      products: autelProducts,
      coverage,
    },
    aftermarketProgrammers: aftermarketProgrammerCatalog.map((programmer) => ({
      platform: programmer.platform,
      name: programmer.name,
      models: programmer.models,
      sourceId: programmer.sourceId,
      sourceUrl: programmer.sourceUrl,
      detail: programmer.detail,
      confidencePercent: programmer.confidencePercent,
    })),
    probes: sourceProbes,
    programmerSources: sourceProbes.filter((probe) => /programmer|OEM/i.test(probe.category)),
    eepromSources: sourceProbes.filter((probe) => /EEPROM/i.test(probe.category)),
    communityEvidence: [],
    nhtsa: {
      vehicleVariableCount: nhtsaVariables.Results?.length || 0,
      usefulVariables: (nhtsaVariables.Results || [])
        .filter((item) => /Model Year|Make|Model|Trim|Series|Body Class|Engine|Fuel|Drive|GVWR|Plant|Transmission/i.test(item.Name || ""))
        .map((item) => ({ id: item.ID, name: item.Name, group: item.GroupName }))
        .slice(0, 80),
    },
  };
  await writePublicReferenceSources(payload);
  return payload;
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
      label: "Parts confidence",
      value: recordKey?.partNumber && !recordKey.partNumber.startsWith("VERIFY") ? recordKey.partNumber : "Parts lookup required",
      confidence: recordKey?.partNumber && !recordKey.partNumber.startsWith("VERIFY") ? "high" : "not verified",
      source: recordKey?.partNumber && !recordKey.partNumber.startsWith("VERIFY") ? "Key DB" : "Needs parts/API verification",
    },
  ];

  const blockers = [
    "VIN usually does not expose FCC, blade, transponder, or exact remote board by itself",
    "Trim/package can change key system",
    "Parts confirmation is required before ordering",
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

const aftermarketProgrammerCatalog = [
  {
    platform: "Autel MaxiIM",
    name: "Autel MaxiIM family",
    models: ["IM508S", "IM608 II", "IM608 Pro II", "IM608S II", "KM100/KM100E"],
    sourceId: "autel",
    sourceUrl: "https://autel.us/product-category/key-and-immobilizer-programming/professional-key-and-immobilizer-programming/",
    detail: "Public Autel IMMO line lists key/immobilizer programming coverage; verify exact year/model/add-key/AKL path in Autel coverage before dispatch.",
    confidencePercent: 58,
  },
  {
    platform: "XTOOL / AutoProPAD",
    name: "XTOOL / AutoProPAD family",
    models: ["X100 PAD series", "AutoProPAD G3", "AutoProPAD G2", "AutoProPAD Core"],
    sourceId: "xtool-autopropad",
    sourceUrl: "https://www.autopropad.com/autopropad-g3-series",
    detail: "US locksmith-focused XTOOL/AutoProPAD family. Verify supported-vehicle coverage and required adapters in AutoProPAD/XTOOL resources.",
    confidencePercent: 55,
  },
  {
    platform: "Advanced Diagnostics / Ilco",
    name: "Advanced Diagnostics Smart Pro",
    models: ["Smart Pro", "Smart Pro Lite"],
    sourceId: "advanced-diagnostics",
    sourceUrl: "https://www.ilco.us/products/smart-pro",
    detail: "Smart Pro/MYKEYS Pro public material lists vehicle key programming coverage for most makes and models worldwide; verify tokens/software path.",
    confidencePercent: 58,
  },
  {
    platform: "SmartBox",
    name: "SmartBox Automotive",
    models: ["SmartBox Gen 3"],
    sourceId: "smartbox",
    sourceUrl: "https://smartboxauto.com/faq",
    detail: "SmartBox public resources describe key/remote programming device workflows and combined PIN/program functions. Verify exact vehicle coverage in SmartBox.",
    confidencePercent: 52,
  },
  {
    platform: "OBDSTAR",
    name: "OBDSTAR Key Master / X300",
    models: ["Key Master DP Plus", "X300 DP Plus"],
    sourceId: "obdstar",
    sourceUrl: "https://www.obdstar.com/Products_266.html",
    detail: "OBDSTAR public product data lists immobilizer, EEPROM, key-renewing, diagnostics, and built-in help/coverage notes. Verify by vehicle on device.",
    confidencePercent: 52,
  },
  {
    platform: "Xhorse VVDI",
    name: "Xhorse VVDI family",
    models: ["VVDI Key Tool Plus", "VVDI2", "Key Tool Max Pro", "VVDI Prog"],
    sourceId: "xhorse",
    sourceUrl: "https://www.xhorsevvdi.com/wholesale/xhorse-vvdi-key-tool-plus.html",
    detail: "Xhorse VVDI tools cover OBD IMMO, remote generation, transponder cloning, and EEPROM/module workflows depending on model and adapter.",
    confidencePercent: 52,
  },
  {
    platform: "Lonsdor",
    name: "Lonsdor K518 family",
    models: ["K518 PRO", "K518 ISE"],
    sourceId: "lonsdor",
    sourceUrl: "https://en.lonsdor.com/html",
    detail: "Lonsdor K518 family is a professional key programming/matching platform. Verify exact vehicle functions and updates inside Lonsdor coverage.",
    confidencePercent: 52,
  },
  {
    platform: "Launch X-431 IMMO",
    name: "Launch X-431 IMMO family",
    models: ["IMMO Plus", "IMMO Elite", "X-PROG3"],
    sourceId: "launch",
    sourceUrl: "https://us.launchx431pro.com/products/launch-x431-immo-plus",
    detail: "Launch IMMO tools combine immobilizer programming/matching, diagnostics, and X-PROG style adapter workflows. Verify exact vehicle coverage.",
    confidencePercent: 50,
  },
  {
    platform: "TOPDON T-Ninja",
    name: "TOPDON T-Ninja",
    models: ["T-Ninja Pro"],
    sourceId: "topdon",
    sourceUrl: "https://www.topdon.us/products/t-ninja-pro",
    detail: "TOPDON public material positions T-Ninja Pro as a locksmith key/immobilizer programming tool for broad vehicle coverage. Verify exact functions.",
    confidencePercent: 50,
  },
  {
    platform: "Abrites AVDI",
    name: "Abrites AVDI",
    models: ["AVDI", "AVDI Plus"],
    sourceId: "abrites",
    sourceUrl: "https://www.abritesusa.com/avdi-specs",
    detail: "Abrites AVDI is a diagnostics/programming interface with brand-specific special functions, PIN reading, and key programming where licensed.",
    confidencePercent: 48,
  },
  {
    platform: "CGDI / CG",
    name: "CGDI / CG key tools",
    models: ["CGDI MB", "CGDI BMW", "CG FC200", "CG Pro 9S12"],
    sourceId: "cgdi",
    sourceUrl: "https://www.cgdiprog.com/",
    detail: "CGDI/CG tools are mostly brand/module-specific BMW, Mercedes, ECU, MCU, and bench/key workflows. Treat as specialist support, not broad OBD coverage.",
    confidencePercent: 45,
  },
  {
    platform: "Yanhua Mini ACDP",
    name: "Yanhua Mini ACDP",
    models: ["Mini ACDP"],
    sourceId: "yanhua",
    sourceUrl: "https://www.yanhuaacdp.com/service/yanhua-mini-acdp-key-programmer-user-manual-1.html",
    detail: "Yanhua Mini ACDP public material focuses on BMW CAS/FEM/BDC, EEPROM, module, and adapter-based workflows. Treat as specialist support.",
    confidencePercent: 45,
  },
  {
    platform: "TMPro2",
    name: "TMPro2",
    models: ["Transponder Maker Pro 2"],
    sourceId: "tmpro2",
    sourceUrl: "https://tmpro2.com/",
    detail: "TMPro2 public material describes transponder key programming/copying, PIN/security code calculation, EEPROM reading, and EEPROM programming.",
    confidencePercent: 44,
  },
  {
    platform: "Keyline",
    name: "Keyline cloning tools",
    models: ["884 Decryptor Mini", "884 Decryptor Ultegra"],
    sourceId: "keyline",
    sourceUrl: "https://www.keyline-usa.com/en_US/software-and-keycoin/categories-2/keyline-cloning-tool",
    detail: "Keyline public resources focus on transponder cloning/pre-coding rather than broad vehicle OBD programming. Use as clone/prep support.",
    confidencePercent: 40,
  },
  {
    platform: "KeylessRide HotWire",
    name: "KeylessRide HotWire",
    models: ["HotWire"],
    sourceId: "hotwire",
    sourceUrl: "https://www.locksmithledger.com/keys-tools/article/10229397/keyless-ride-hotwire-pc-based-key-and-remote-programmer",
    detail: "Legacy PC-based key and remote programming platform seen in US locksmith market. Verify current availability before relying on it.",
    confidencePercent: 35,
  },
];

function publicProgrammerCluesFor(vehicle, publicSources) {
  const clues = [];
  const autelMatches = (publicSources?.autel?.coverage || []).filter((item) =>
    (item.supportedMakes || []).some((supportedMake) => stringsMatch(supportedMake, vehicle.make)),
  );
  if (autelMatches.length) {
    const autelCatalog = aftermarketProgrammerCatalog.find((item) => item.platform === "Autel MaxiIM");
    clues.push({
      ...autelCatalog,
      models: [...new Set(autelMatches.map((item) => item.product).filter(Boolean))],
      role: "Aftermarket coverage clue",
      detail: `Public Autel coverage lists ${vehicle.make || "this make"} across ${autelMatches.length} MaxiIM product${autelMatches.length === 1 ? "" : "s"}. Verify exact model/year IMMO functions before dispatch.`,
      confidence: "public clue",
      evidence: [
        `Official Autel public coverage data matched ${vehicle.make || "this make"}.`,
        "Coverage data is a proof clue, not a completed-job success report.",
      ],
    });
  }
  for (const item of aftermarketProgrammerCatalog) {
    if (item.platform === "Autel MaxiIM" && autelMatches.length) continue;
    clues.push({
      ...item,
      role: "Aftermarket platform",
      confidence: "public clue",
      evidence: [
        "Public manufacturer/supplier material lists locksmith IMMO/key programming capability.",
        "No saved worked-job outcome for this exact vehicle yet.",
      ],
    });
  }
  return clues;
}

function evidenceConfidenceFromCount(count, base = 84, options = {}) {
  const numeric = Number(count) || 0;
  if (numeric >= 1 && options.provenWorkedJob) return 100;
  if (numeric >= 1 && options.exactVin) return 100;
  if (numeric >= 5) return 98;
  if (numeric >= 3) return 94;
  if (numeric >= 2) return 90;
  if (numeric >= 1) return base;
  return 55;
}

function shopEvidenceProgrammerItems(shopEvidence) {
  const total = Number(shopEvidence?.totalMatches || 0);
  if (!total || !shopEvidence?.programmers?.length) return [];
  return shopEvidence.programmers.slice(0, 4).map((programmer) => ({
    name: cleanString(programmer),
    role: "Shop-success evidence",
    detail: `${total} matching completed shop job${total === 1 ? "" : "s"} mentioned this programmer/tool family.`,
    confidence: "shop evidence",
    confidencePercent: evidenceConfidenceFromCount(total, 86, { exactVin: Number(shopEvidence?.exactVinCount || 0) > 0 }),
    evidence: [
      `${total} matching job-history record${total === 1 ? "" : "s"} for this VIN/YMM pattern.`,
      Number(shopEvidence?.exactVinCount || 0) > 0 ? "Exact VIN was seen in completed job history." : "",
      "This is your field history, so it outranks broad public coverage clues.",
    ].filter(Boolean),
    source: "shop history",
  }));
}

function verifiedProfileProgrammerItems(verifiedProfile) {
  const outcomes = verifiedProfile?.programmerOutcomes || (verifiedProfile?.preferredProgrammer ? [verifiedProfile.preferredProgrammer] : []);
  return outcomes
    .filter((item) => cleanString(item.value))
    .slice(0, 5)
    .map((item) => {
      const count = Number(item.count || 1);
      return {
        name: cleanString(item.value),
        role: "Worked job outcome",
        detail: `${count} saved worked-job outcome${count === 1 ? "" : "s"} confirmed this programmer on this vehicle profile. Treat as shop-confirmed; still verify subscriptions, tokens, security access, and exact job type before dispatch.`,
        confidence: "shop-confirmed",
        confidencePercent: evidenceConfidenceFromCount(count, 100, { provenWorkedJob: true }),
        evidence: [
          `${count} saved worked-job outcome${count === 1 ? "" : "s"} from the app form, so this is 100% confirmed in your records.`,
          item.partKey ? `Tied to saved part/key record ${item.partKey}.` : "Tied to this saved vehicle profile.",
        ],
        source: "worked job form",
      };
    });
}

function communityProgrammerCluesFor(vehicle, publicSources) {
  const communityEvidence = Array.isArray(publicSources?.communityEvidence) ? publicSources.communityEvidence : [];
  return communityEvidence
    .filter((item) => {
      const makeOk = !item.make || stringsMatch(item.make, vehicle.make);
      const modelOk = !item.model || stringsMatch(item.model, vehicle.model);
      const yearOk = !item.year || String(item.year) === String(vehicle.year);
      return makeOk && modelOk && yearOk && cleanString(item.programmer);
    })
    .slice(0, 6)
    .map((item) => {
      const outcome = cleanString(item.outcome).toLowerCase();
      const worked = !outcome || /work|success|programmed|added|akl/i.test(outcome);
      return {
        name: cleanString(item.programmer),
        role: worked ? "Community success clue" : "Community warning clue",
        detail: cleanString(item.summary || "Public community report captured as an anecdotal clue. Verify with official coverage before relying on it."),
        confidence: "community clue",
        confidencePercent: worked ? 62 : 38,
        evidence: [
          cleanString(item.sourceName || item.sourceType || "Public community source"),
          worked ? "Anecdotal success report, not controlled coverage proof." : "Anecdotal failure/warning report; use as a caution flag.",
        ],
        sourceUrl: cleanString(item.url),
      };
    });
}

function publicEepromToolClues(publicSources) {
  return (publicSources?.eepromSources || [])
    .filter((source) => source.status === "available")
    .map((source) => ({
      name: source.name,
      role: "EEPROM / bench clue",
      detail: `${source.use} Treat as advanced fallback after OBD/OEM path is verified unsuitable.`,
      confidence: "verify",
    }))
    .slice(0, 4);
}

function oemProgrammerInfoFor(vehicle) {
  const make = cleanString(vehicle.make).toLowerCase();
  const family = vehicleFamily(vehicle.make, vehicle.model);
  const oemByFamily = {
    ford: {
      name: "Ford FDRS",
      detail: "Use Ford Motorcraft Service/FDRS for late Ford security, module, immobilizer, and OEM fallback workflows.",
      passThru: "Ford VCM 3 or VCM II preferred; validated J2534 pass-thru such as Mongoose-Plus Ford/Cardaq where supported.",
      matchTokens: ["FDRS", "IDS", "FJDS", "MOTORCRAFT", "FORD VCM"],
    },
    toyota: {
      name: "Toyota TIS / Techstream",
      detail: "Use Toyota TIS/Techstream for Toyota/Lexus immobilizer, smart reset, and security-professional workflows.",
      passThru: "Toyota validated J2534 interface such as Mongoose-Plus Toyota3/MongoosePro MFC3 or OEM-supported Techstream VIM.",
      matchTokens: ["TECHSTREAM", "TOYOTA TIS", "LEXUS TIS"],
    },
    gm: {
      name: "GM Techline Connect / SPS2",
      detail: "Use GM Techline Connect/SPS2 when GM module, immobilizer, or security programming requires OEM workflow.",
      passThru: "GM MDI 2 preferred; certified J2534 pass-thru where Techline Connect supports it.",
      matchTokens: ["TECHLINE", "SPS", "MDI", "GDS2"],
    },
    chrysler: {
      name: "Stellantis wiTECH 2.0 / TechAuthority",
      detail: "Use Stellantis TechAuthority/wiTECH when PIN, module, SGW, or OEM security workflow requires it.",
      passThru: "Mopar Diagnostic Pod Plus/MDP+ preferred for newer coverage; wiTECH-supported J2534 path where allowed.",
      matchTokens: ["WITECH", "TECHAUTHORITY", "MDP", "MOPAR"],
    },
    honda: {
      name: "Honda i-HDS",
      detail: "Use Honda Service Express/i-HDS when Honda/Acura immobilizer or module programming requires OEM workflow.",
      passThru: "Honda DST-i or validated SAE J2534 VCI such as MongoosePro Honda.",
      matchTokens: ["I-HDS", "IHDS", "HONDA SERVICE EXPRESS", "DST-I"],
    },
    nissan: {
      name: "Nissan CONSULT-III plus",
      detail: "Use Nissan TechInfo/CONSULT path when BCM, prox, PIN, or security workflow requires OEM verification.",
      passThru: "CONSULT-III plus VI or Nissan-validated J2534 interface for R2R/J2534 applications.",
      matchTokens: ["CONSULT", "NISSAN TECHINFO"],
    },
    hyundai: {
      name: "Hyundai/Kia GDS / Techline",
      detail: "Use Hyundai/Kia OEM service software when immobilizer, smart key, or module security workflow requires OEM access.",
      passThru: "Hyundai/Kia VCI or validated J2534 pass-thru supported by the OEM application.",
      matchTokens: ["GDS", "HYUNDAI TECHLINE", "KIA TECHLINE", "VCI"],
    },
    mazda: {
      name: "Mazda MDARS / Mazda Service Info",
      detail: "Use Mazda MDARS/OEM service-info path when security or module programming needs OEM coverage.",
      passThru: "Mazda VCM/J2534-compatible interface supported by MDARS for the model year.",
      matchTokens: ["MDARS", "MAZDA SERVICE", "MAZDA VCM"],
    },
    subaru: {
      name: "Subaru SSM / Techinfo",
      detail: "Use Subaru Select Monitor/OEM Techinfo when immobilizer, smart key, or module workflow requires OEM coverage.",
      passThru: "Subaru DST-i or validated J2534 pass-thru supported by Subaru SSM.",
      matchTokens: ["SSM", "SUBARU SELECT MONITOR", "DST-I"],
    },
    vw: {
      name: "VW/Audi ODIS Service",
      detail: "Use ODIS Service when immobilizer, component protection, module, or key/security workflow requires OEM access.",
      passThru: "VAS 6154/6154A or ODIS-supported pass-thru interface.",
      matchTokens: ["ODIS", "VAS 6154", "VW", "AUDI"],
    },
    bmw: {
      name: "BMW ISTA / AOS",
      detail: "Use BMW ISTA/AOS when BMW/MINI security, module, or service programming requires OEM workflow.",
      passThru: "BMW ICOM Next preferred; supported J2534/PassThru only where BMW service application allows it.",
      matchTokens: ["ISTA", "AOS", "ICOM", "BMW"],
    },
    mercedes: {
      name: "Mercedes-Benz XENTRY",
      detail: "Use Mercedes-Benz XENTRY for OEM diagnostic, security, DAS/drive authorization, and module programming workflows.",
      passThru: "Mercedes-Benz VCI/DoIP-capable XENTRY interface; pass-thru only where explicitly supported.",
      matchTokens: ["XENTRY", "DAS", "MERCEDES VCI"],
    },
    mitsubishi: {
      name: "Mitsubishi MUT-III / OEM service path",
      detail: "Use Mitsubishi MUT-III/OEM service-info path when immobilizer or module security workflow requires OEM coverage.",
      passThru: "MUT-III VCI or Mitsubishi-supported J2534 pass-thru for the model year.",
      matchTokens: ["MUT-III", "MUT3", "MITSUBISHI"],
    },
    porsche: {
      name: "Porsche PIWIS / PPN",
      detail: "Use Porsche PIWIS/OEM portal when security, immobilizer, or module programming requires OEM workflow.",
      passThru: "Porsche PIWIS tester/VCI or Porsche-supported pass-thru interface where allowed.",
      matchTokens: ["PIWIS", "PORSCHE"],
    },
    jlr: {
      name: "Jaguar Land Rover TOPIx Cloud / Pathfinder",
      detail: "Use JLR TOPIx/Pathfinder where security, smart key, or module workflow requires OEM access.",
      passThru: "JLR DoIP VCI or JLR-supported pass-thru interface for the model year.",
      matchTokens: ["TOPIX", "PATHFINDER", "JLR", "DOIP"],
    },
    volvo: {
      name: "Volvo VIDA",
      detail: "Use Volvo VIDA when immobilizer, key, or module workflow requires OEM software and account access.",
      passThru: "Volvo DiCE for legacy vehicles or VIDA-supported J2534/DoIP interface for newer coverage.",
      matchTokens: ["VIDA", "DICE", "VOLVO"],
    },
    tesla: {
      name: "Tesla Toolbox",
      detail: "Use Tesla Toolbox/service path when vehicle security or module workflow requires OEM diagnostics.",
      passThru: "Tesla-supported diagnostic cable/interface for the exact platform; confirm service mode and Toolbox requirements.",
      matchTokens: ["TESLA TOOLBOX", "TOOLBOX"],
    },
  };
  const match = oemByFamily[family] || (make.includes("lexus") ? oemByFamily.toyota : null);
  return match
    ? { family, ...match }
    : {
        name: "Manufacturer service-info programmer",
        detail: "Use the manufacturer service-info path as the highest-confidence fallback when aftermarket coverage is not proven.",
        passThru: "Validated J2534 pass-thru or OEM vehicle communication interface listed by the manufacturer for the exact vehicle.",
        matchTokens: ["OEM", "SERVICE INFO", "J2534"],
        family,
      };
}

function confidencePercentFromLabel(value, fallback = 55) {
  const text = cleanString(value).toLowerCase();
  const numeric = Number(text.match(/\d{2,3}/)?.[0]);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(100, numeric));
  if (/certain/.test(text)) return 100;
  if (/verified|high/.test(text)) return 88;
  if (/medium-high/.test(text)) return 80;
  if (/vault|shop/.test(text)) return 78;
  if (/medium/.test(text)) return 68;
  if (/public/.test(text)) return 58;
  if (/low/.test(text)) return 42;
  if (/verify|unknown/.test(text)) return 50;
  return fallback;
}

function programmerCoverageKey(item) {
  const name = programmerDisplayName([item.platform, item.name].filter(Boolean).join(" ")) || cleanString(item.name || item.platform);
  return cleanString(name).toUpperCase();
}

function normalizeProgrammerCoverageItem(item, programmingReference) {
  const sourcePercent = Number(item.confidencePercent);
  const confidencePercent = Number.isFinite(sourcePercent)
    ? Math.max(0, Math.min(100, sourcePercent))
    : confidencePercentFromLabel([item.confidence, item.role, item.detail].filter(Boolean).join(" "), programmingReference ? 70 : 55);
  return {
    ...item,
    name: programmerDisplayName([item.platform, item.name].filter(Boolean).join(" ")) || cleanString(item.name || item.platform || "Programmer path"),
    models: Array.isArray(item.models) ? item.models.filter(Boolean) : [],
    confidence: `${confidencePercent}%`,
    confidencePercent,
    oemKeyLikelihood: Number.isFinite(Number(item.oemKeyLikelihood)) ? Number(item.oemKeyLikelihood) : 0,
    evidence: Array.isArray(item.evidence) ? [...new Set(item.evidence.map(cleanString).filter(Boolean))] : [],
  };
}

function itemMatchesOemProgrammer(item, oem) {
  const text = cleanString([item.name, item.role, item.detail, item.platform].filter(Boolean).join(" ")).toUpperCase();
  return (oem.matchTokens || []).some((token) => text.includes(cleanString(token).toUpperCase()));
}

function mergeProgrammerCoverage(existing, item) {
  const models = [...new Set([...(existing.models || []), ...(item.models || [])].filter(Boolean))];
  const better = item.confidencePercent > existing.confidencePercent ? item : existing;
  const supporting = better === item ? existing : item;
  return {
    ...existing,
    ...better,
    detail: cleanString(better.detail || supporting.detail),
    models,
    sourceUrl: existing.sourceUrl || item.sourceUrl,
    evidence: [...new Set([...(existing.evidence || []), ...(item.evidence || [])].filter(Boolean))].slice(0, 5),
  };
}

function buildProgrammerCoverageList(vehicle, programmerItems, programmingReference) {
  const oem = oemProgrammerInfoFor(vehicle);
  const oemRequired = Boolean(
    programmingReference?.requiresOnline ||
      /OEM|ONLINE|SECURITY|SERVICE INFO|NASTF/i.test(
        [programmingReference?.programMethod, programmingReference?.notes, programmingReference?.immobilizerSystem].filter(Boolean).join(" "),
      ),
  );
  const incomingProgrammers = programmerItems || [];
  const oemProgrammerMatches = incomingProgrammers.filter((item) => itemMatchesOemProgrammer(item, oem));
  const oemWorkedMatches = oemProgrammerMatches.filter((item) => /worked|shop-success|shop evidence/i.test([item.role, item.source, item.confidence].filter(Boolean).join(" ")));
  const oemEvidence = [
    `${oem.name} is the OEM/manufacturer path for ${vehicle.make || "this make"}.`,
    `Pass-through/interface: ${oem.passThru}`,
    ...oemProgrammerMatches.flatMap((item) => item.evidence || []),
  ];
  const oemDetail = [
    oem.detail,
    `Pass-through/interface: ${oem.passThru}`,
    "If this OEM path is needed, plan on an OEM key about 90% of the time until field/parts proof says otherwise.",
    oemWorkedMatches.length
      ? `${oemWorkedMatches.length} saved worked-job outcome${oemWorkedMatches.length === 1 ? "" : "s"} matched this OEM/SPS path.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const coverage = [
    {
      name: oem.name,
      role: "OEM programmer",
      detail: oemDetail,
      passThru: oem.passThru,
      confidence: "100%",
      confidencePercent: 100,
      oemKeyLikelihood: 90,
      source: oemWorkedMatches.length ? "worked job form" : oemRequired ? "OEM likely required" : "OEM fallback",
      evidence: [...new Set(oemEvidence.filter(Boolean))].slice(0, 5),
    },
    ...incomingProgrammers.filter((item) => !itemMatchesOemProgrammer(item, oem)),
  ];
  if (programmingReference?.programMethod && !coverage.some((item) => /OBD|EEPROM|BENCH|OEM/i.test(`${item.name} ${item.role}`))) {
    coverage.push({
      name: `${programmingReference.programMethod} programming path`,
      role: "Programming reference",
      detail: "Reference row found for this year/make/model. Use exact tool coverage before dispatch.",
      confidence: programmingReference.allKeysLostSupported ? "78%" : "68%",
      confidencePercent: programmingReference.allKeysLostSupported ? 78 : 68,
    });
  }
  const merged = new Map();
  coverage.map((item) => normalizeProgrammerCoverageItem(item, programmingReference)).forEach((item) => {
    const key = programmerCoverageKey(item);
    const existing = merged.get(key);
    if (!existing) merged.set(key, item);
    else merged.set(key, mergeProgrammerCoverage(existing, item));
  });
  return Array.from(merged.values())
    .sort((a, b) => b.confidencePercent - a.confidencePercent || cleanString(a.name).localeCompare(cleanString(b.name)))
    .slice(0, 18);
}

function buildJobKit(vehicle, selected, record, programmingReference, reference, referenceVaultEntries, publicSources, verifiedProfile, shopEvidence) {
  const vehicleTitle = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const vaultKeyItems = (referenceVaultEntries || [])
    .flatMap((entry) => entry.keys || [])
    .map((key) => ({
      name: cleanString(key.name || key.fcc || "Vault key clue"),
      role: cleanString(key.type || "Key clue"),
      detail: cleanString([key.fcc ? `FCC ${key.fcc}` : "", key.chip ? `Chip ${key.chip}` : "", key.buttons ? `${key.buttons} buttons` : "", key.insert ? `Insert ${key.insert}` : "", key.notes].filter(Boolean).join(" | ")),
      confidence: cleanString(key.confidence || "vault"),
    }));
  const keyItems = [...vaultKeyItems, ...(selected.keys || [])
    .map((item) => ({
      name: cleanString(item.name || item.partNumber || "Verify key package"),
      role: cleanString(item.position || item.type || "Key option"),
      detail: cleanString(item.notes || item.fccId || item.partNumber || "Confirm FCC, buttons, chip, and blade before final selection."),
      confidence: cleanString(item.confidence || record?.keySystem?.confidence || "verify"),
    }))]
    .slice(0, 4);
  const vaultProgrammerItems = (referenceVaultEntries || [])
    .flatMap((entry) => entry.programmers || [])
    .map((programmer) => ({
      name: cleanString(programmer.name || "Vault programmer clue"),
      role: cleanString(programmer.coverage || "Coverage clue"),
      detail: cleanString(
        [
          programmer.addKey ? `Add key: ${programmer.addKey}` : "",
          programmer.allKeysLost ? `AKL: ${programmer.allKeysLost}` : "",
          programmer.pin ? `PIN: ${programmer.pin}` : "",
          programmer.online ? `Online: ${programmer.online}` : "",
          programmer.notes,
        ]
          .filter(Boolean)
          .join(" | "),
      ),
      confidence: cleanString(programmer.confidence || "vault"),
    }));
  const profileProgrammerItems = verifiedProfileProgrammerItems(verifiedProfile);
  const shopProgrammerItems = shopEvidenceProgrammerItems(shopEvidence);
  const publicProgrammerItems = publicProgrammerCluesFor(vehicle, publicSources);
  const communityProgrammerItems = communityProgrammerCluesFor(vehicle, publicSources);
  const actionableProgrammerItems = [...profileProgrammerItems, ...shopProgrammerItems, ...vaultProgrammerItems, ...communityProgrammerItems, ...publicProgrammerItems];
  const selectedProgrammerItems = (selected.programmers || [])
    .map((item) => ({
      name: cleanString(item.name || "Coverage-verified programmer"),
      role: cleanString(item.type || "Programming path"),
      detail: cleanString(item.notes || programmingReference?.programMethod || "Confirm exact year/model/key-system coverage before programming."),
      confidence: cleanString(item.confidence || (programmingReference ? "high" : "verify")),
      evidence: ["Local key-intelligence record matched this vehicle pattern."],
    }))
    .filter((item) => !actionableProgrammerItems.length || !isGenericProgrammerName(item.name));
  const rawProgrammerItems = [...actionableProgrammerItems, ...selectedProgrammerItems];
  const programmerCoverage = buildProgrammerCoverageList(vehicle, rawProgrammerItems, programmingReference);
  const programmerItems = programmerCoverage.slice(0, 4);
  const toolItems = [
    ...(selected.tools || []).map((item) => ({
      name: cleanString(item.name || "Keyway-specific originator"),
      role: cleanString(item.type || "Origination"),
      detail: cleanString(item.notes || "Confirm keyway and cutting path before making the key."),
      confidence: cleanString(item.confidence || "verify"),
    })),
    {
      name: reference.lishi?.primary || "Keyway-confirmed Lishi / decoder",
      role: "Decode",
      detail: "Choose from the confirmed lock or emergency insert profile, not VIN alone.",
      confidence: reference.lishi?.confidence || "verify",
    },
    ...(reference.fieldTools || []).slice(0, 3).map((tool) => ({
      name: tool,
      role: "Field tool",
      detail: "Bring or verify before dispatch.",
      confidence: "workflow",
    })),
    ...publicEepromToolClues(publicSources),
  ].slice(0, 7);
  const securityFlags = [
    programmingReference?.requiresPin ? "PIN/passcode may be required" : "",
    programmingReference?.requiresOnline ? "Online/OEM path may be required" : "",
    programmingReference?.requiresBypass ? "Bypass/security procedure may be required" : "",
  ].filter(Boolean);
  const verify = [
    ...(reference.partVerification || []),
    ...(reference.decodePlan || []).slice(0, 2),
    "Confirm ownership/authorization",
    "Confirm customer-visible key style",
  ];
  const warnings = [...(reference.warnings || []), ...(reference.eeprom || []).map((item) => `EEPROM/IMMO: ${item}`), ...securityFlags].filter(Boolean);
  const confidence = record
    ? "verified"
    : referenceVaultEntries?.length
      ? referenceVaultEntries[0].confidence || "medium"
      : programmingReference
        ? "medium"
        : "verify";
  return {
    headline: `${vehicleTitle || "Vehicle"} job kit`,
    confidence,
    summary:
      "Use this as the dispatch and field checklist. It tells the locksmith what key package to verify, what programmer path to trust, and what tools to bring.",
    keys: keyItems.length
      ? keyItems
      : [
          {
            name: "Verify key package",
            role: "Key option",
            detail: "Select prox, flip/remote-head, or transponder after checking ignition style, FCC, buttons, and blade.",
            confidence: "verify",
          },
        ],
    programmers: programmerItems.length
      ? programmerItems
      : [
          {
            name: programmingReference?.programmer || "Coverage-verified programmer",
            role: programmingReference?.programMethod || "Programming path",
            detail: "Confirm exact vehicle coverage before dispatch.",
            confidence: programmingReference ? "68%" : "50%",
            confidencePercent: programmingReference ? 68 : 50,
          },
        ],
    programmerCoverage,
    tools: toolItems,
    verify: [...new Set(verify)].slice(0, 8),
    warnings: [...new Set(warnings)].slice(0, 7),
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
      sourceId: "supplier-parts",
      label: "Parts sources",
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
    trim2: valueFromDecode(decode, "Trim2"),
    series: valueFromDecode(decode, "Series"),
    manufacturer: valueFromDecode(decode, "Manufacturer"),
    vehicleType: valueFromDecode(decode, "VehicleType"),
    bodyClass: valueFromDecode(decode, "BodyClass"),
    doors: valueFromDecode(decode, "Doors"),
    cabType: valueFromDecode(decode, "CabType"),
    engine: [valueFromDecode(decode, "DisplacementL"), valueFromDecode(decode, "EngineConfiguration")]
      .filter(Boolean)
      .join("L "),
    engineModel: valueFromDecode(decode, "EngineModel"),
    engineCylinders: valueFromDecode(decode, "EngineCylinders"),
    fuelType: valueFromDecode(decode, "FuelTypePrimary"),
    transmission: valueFromDecode(decode, "TransmissionStyle"),
    driveType: valueFromDecode(decode, "DriveType"),
    gvwr: valueFromDecode(decode, "GVWR"),
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
    vehicleDecodeGroups: decodedVehicleGroups(decode),
    skipSupplierLookup: true,
  });
}

async function buildVehicleProfile(vehicle, store, options = {}) {
  vehicle.make = cleanString(vehicle.make).toUpperCase();
  vehicle.model = cleanString(vehicle.model);
  vehicle.year = cleanString(vehicle.year);

  const family = vehicleFamily(vehicle.make, vehicle.model);
  const catalogApplication = await findCatalogApplication(vehicle);
  const programmingReference = await findProgrammingReference(vehicle);
  const verifiedProfile = await findVerifiedVehicleProfile(vehicle);
  const intelligence = await readKeyIntelligence();
  const record = findIntelligenceRecord(vehicle, intelligence);
  const partsReference = await readPartsCrossReference();
  const shopEvidence = buildShopEvidence(vehicle, options.vin || "", store.jobs);
  const proofPatterns = buildProofPatternBaseline(store.jobs, partsReference, { vin: options.vin || "", vehicle });
  shopEvidence.proofPatterns = proofPatterns;
  const matchedJobsByRecord = summarizeMatchedJobs(record, store.jobs);
  const matchedJobs = matchedJobsByRecord.length ? matchedJobsByRecord : shopEvidence.jobs;
  const referenceVaultEntries = await findReferenceVaultEntries(vehicle);
  const publicSources = await readPublicReferenceSources();
  const supplierCandidates = await findSupplierCandidates(vehicle, record, programmingReference);
  const liveSupplierLookup = options.skipSupplierLookup
    ? await pendingSupplierLookup("Vehicle decoded. Parts sources are searching in the background.")
    : await buildProfileSupplierLookup(vehicle, store, options, programmingReference, verifiedProfile, shopEvidence);
  const vehicleReference = applyVerifiedProfileReference(
    applyReferenceVault(vehicleReferenceFor(vehicle, programmingReference, shopEvidence), referenceVaultEntries),
    verifiedProfile,
  );
  const lishiEvidence = buildShopLishiEvidence({
    profile: { verifiedProfile, shopEvidence, proofPatterns },
    verifiedProfile,
    shopEvidence,
    proofPatterns,
  });
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
    vehicleDecodeGroups: options.vehicleDecodeGroups || [],
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
    verifiedProfile,
    shopEvidence,
    proofPatterns,
    lishiEvidence,
    liveSupplierLookup,
    referenceVault: referenceVaultEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      confidence: entry.confidence,
      sourceCount: entry.sources?.length || 0,
    })),
    vehicleReference,
    jobKit: buildJobKit(vehicle, selected, record, programmingReference, vehicleReference, referenceVaultEntries, publicSources, verifiedProfile, shopEvidence),
    keyRequirements: inferKeyRequirements(vehicle, record, catalogApplication, matchedJobs, programmingReference),
    sourceReadiness: sourceReadiness(record, options.sourceReadinessIdentity),
    catalogApplication,
    source: record
      ? options.source || "Vehicle details from year/make/model; key/programmer/tool guidance from local verified key intelligence database."
      : options.fallbackSource || "Vehicle details from year/make/model; parts fitment and locksmith workflow guidance need verification.",
  };
}

function isOwnerOnlyApiRequest(request, pathname) {
  const method = request.method || "GET";
  const writeMethod = method !== "GET";
  const ownerOnlyPrefixes = [
    "/api/storage",
    "/api/reference-lists",
    "/api/reference-vault",
    "/api/public-reference-sources",
    "/api/supplier-accounts",
    "/api/audit-log",
  ];
  if (ownerOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  if (pathname === "/api/mission-control" || pathname === "/api/training-center" || pathname === "/api/training-center/teach") return true;
  if (pathname === "/api/code-desk/library" || pathname === "/api/code-desk/learn") return true;
  if (pathname === "/api/jobs" || pathname.startsWith("/api/jobs/")) return true;
  if (pathname === "/api/jobs/sync" || pathname === "/api/part-outcomes" || pathname === "/api/worked-jobs/import") return true;
  if (pathname.startsWith("/api/proof-vault/attachments") && writeMethod) return true;
  if (pathname.startsWith("/api/ai/feedback") || pathname.startsWith("/api/ai/shop-rules")) return true;
  if (pathname === "/api/key-intelligence" && writeMethod) return true;
  return false;
}

async function enforceApiAuth(request, response, pathname) {
  const auth = await requestAuth(request);
  if (!auth.enabled) return auth;
  if (!auth.authenticated) {
    sendError(response, 401, "Sign in required.", { code: "AUTH_REQUIRED", auth: authPublicStatus(auth) });
    return null;
  }
  if (auth.role !== "owner" && isOwnerOnlyApiRequest(request, pathname)) {
    sendError(response, 403, "Owner access required for this tool.", { code: "OWNER_REQUIRED", auth: authPublicStatus(auth) });
    return null;
  }
  return auth;
}

async function handleAuthApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/auth/status") {
    sendJson(response, 200, authPublicStatus(await requestAuth(request)));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJsonBody(request);
    const role = body.role === "subscriber" ? "subscriber" : "owner";
    if (!authEnabled()) {
      sendJson(response, 200, authPublicStatus(await requestAuth(request)));
      return true;
    }
    const expected = authPasswordForRole(role);
    if (!expected) {
      sendError(response, 403, `${role === "owner" ? "Owner" : "Subscriber"} login is not configured.`, { code: "ROLE_NOT_CONFIGURED" });
      return true;
    }
    if (!safeTextEquals(body.password || body.pin, expected)) {
      sendError(response, 401, "Incorrect password.", { code: "BAD_LOGIN" });
      return true;
    }
    const token = await signAuthSession(role);
    const session = await verifyAuthSession(token);
    sendJson(
      response,
      200,
      authPublicStatus({ enabled: true, authenticated: true, role, mode: "session", expiresAt: new Date(Number(session.exp) * 1000).toISOString() }),
      { "Set-Cookie": authCookie(token, request) },
    );
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    sendJson(
      response,
      200,
      { ok: true, auth: authPublicStatus({ enabled: authEnabled(), authenticated: false, role: "guest", mode: "locked" }) },
      { "Set-Cookie": authCookie("", request, 0) },
    );
    return true;
  }

  return false;
}

async function handleApi(request, response, pathname) {
  if (await handleAuthApi(request, response, pathname)) return;

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, await buildHealthStatus());
    return;
  }

  const auth = await enforceApiAuth(request, response, pathname);
  if (!auth) return;

  if (request.method === "GET" && pathname === "/api/storage/status") {
    sendJson(response, 200, await buildStorageStatus());
    return;
  }

  if (request.method === "POST" && pathname === "/api/storage/diagnostics") {
    sendJson(response, 200, await runStorageDiagnostics());
    return;
  }

  if (request.method === "GET" && pathname === "/api/storage/export") {
    sendJson(response, 200, await buildStorageExport());
    return;
  }

  if (request.method === "POST" && pathname === "/api/storage/import") {
    sendJson(response, 200, await importStorageBundle(await readJsonBody(request)));
    return;
  }

  const store = await readStore();

  if ((request.method === "GET" || request.method === "POST") && pathname === "/api/mission-control") {
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    sendJson(response, 200, await buildMissionControl(body, store));
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && pathname === "/api/training-center") {
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    sendJson(response, 200, await buildTrainingCenter(body, store));
    return;
  }

  if (request.method === "POST" && pathname === "/api/training-center/teach") {
    sendJson(response, 201, await teachTrainingCenter(await readJsonBody(request), store));
    return;
  }

  if (request.method === "GET" && pathname === "/api/jobs") {
    sendJson(response, 200, { jobs: store.jobs });
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && pathname === "/api/part-history") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const query = cleanString(request.method === "POST" ? body.q || body.query : url.searchParams.get("q"));
    if (!query) {
      sendError(response, 400, "Enter an LR#, MW#, OE#, TI#, FCC, or part number.");
      return;
    }
    const partsReference = await readPartsCrossReference();
    sendJson(response, 200, buildPartHistory(query, mergedSearchJobs(store.jobs, body.jobs || body.localJobs || []), partsReference));
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && pathname === "/api/coverage-dashboard") {
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const partsReference = await readPartsCrossReference();
    sendJson(response, 200, buildCoverageDashboard(mergedSearchJobs(store.jobs, body.jobs || body.localJobs || []), partsReference));
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && pathname === "/api/proof-vault") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const query = cleanString(request.method === "POST" ? body.q || body.query : url.searchParams.get("q"));
    const partsReference = await readPartsCrossReference();
    sendJson(response, 200, buildProofVault(query, mergedSearchJobs(store.jobs, body.jobs || body.localJobs || []), partsReference));
    return;
  }

  if (request.method === "POST" && pathname === "/api/job-workbench") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await buildJobWorkbench(body, store));
    return;
  }

  if (request.method === "POST" && pathname === "/api/global-search") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await buildGlobalSearch(body, store));
    return;
  }

  if (request.method === "GET" && pathname === "/api/reference-lists") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    sendJson(
      response,
      200,
      await buildReferenceList(
        {
          source: url.searchParams.get("source"),
          q: url.searchParams.get("q"),
          limit: url.searchParams.get("limit"),
        },
        store,
      ),
    );
    return;
  }

  if (request.method === "GET" && pathname === "/api/proof-vault/attachments") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const jobId = cleanString(url.searchParams.get("jobId"));
    const vault = await readProofAttachments();
    const attachments = vault.attachments
      .filter((attachment) => !jobId || attachment.jobId === jobId)
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
    sendJson(response, 200, {
      storage: proofAttachmentStorageMode(),
      maxBytes: attachmentUploadMaxBytes,
      attachments: attachments.map(attachmentPublicFields),
      byJob: groupAttachmentsByJob(attachments),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/proof-vault/attachments") {
    const body = await readJsonBody(request);
    const result = await saveProofAttachmentUpload(body);
    sendJson(response, 201, {
      storage: proofAttachmentStorageMode(),
      attachment: attachmentPublicFields(result.attachment),
      skipped: result.skipped,
      sourceId: result.sourceId,
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/proof-vault/attachments/migrate") {
    const body = await readJsonBody(request);
    const attachments = Array.isArray(body.attachments)
      ? body.attachments
      : body.attachment && typeof body.attachment === "object"
        ? [body.attachment]
        : [];
    if (!attachments.length) {
      sendError(response, 400, "No browser-local proof attachments were provided.");
      return;
    }
    if (attachments.length > 5) {
      sendError(response, 413, "Migrate proof in batches of 5 files or fewer.");
      return;
    }
    const vault = await readProofAttachments();
    const uploaded = [];
    const skipped = [];
    const failed = [];
    for (const item of attachments) {
      try {
        const result = await saveProofAttachmentUpload({ ...item, migrated: true }, vault);
        const publicAttachment = attachmentPublicFields(result.attachment);
        if (result.skipped) skipped.push({ sourceId: result.sourceId, attachment: publicAttachment });
        else uploaded.push({ sourceId: result.sourceId, attachment: publicAttachment });
      } catch (error) {
        failed.push({ sourceId: cleanString(item?.sourceId || item?.id), name: cleanString(item?.name), error: error.message });
      }
    }
    if (uploaded.length) await writeProofAttachments(vault);
    sendJson(response, failed.length ? 207 : 200, {
      storage: proofAttachmentStorageMode(),
      uploaded,
      skipped,
      failed,
      byJob: groupAttachmentsByJob(vault.attachments),
      summary: {
        uploaded: uploaded.length,
        skipped: skipped.length,
        failed: failed.length,
        totalServerAttachments: vault.attachments.length,
      },
    });
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/proof-vault/attachments/") && pathname.endsWith("/file")) {
    const id = decodeURIComponent(pathname.replace("/api/proof-vault/attachments/", "").replace(/\/file$/, ""));
    const vault = await readProofAttachments();
    const attachment = vault.attachments.find((item) => item.id === id);
    if (!attachment) {
      sendError(response, 404, "Attachment not found.");
      return;
    }
    const file = await readProofAttachmentFile(attachment);
    sendBuffer(response, 200, file, attachment.type || "application/octet-stream", {
      "Content-Disposition": `inline; filename="${sanitizeStorageSegment(attachment.name) || "proof"}"`,
    });
    return;
  }

  if (request.method === "DELETE" && pathname.startsWith("/api/proof-vault/attachments/")) {
    const id = decodeURIComponent(pathname.replace("/api/proof-vault/attachments/", ""));
    const vault = await readProofAttachments();
    const index = vault.attachments.findIndex((item) => item.id === id);
    if (index < 0) {
      sendError(response, 404, "Attachment not found.");
      return;
    }
    const [attachment] = vault.attachments.splice(index, 1);
    await deleteProofAttachmentFile(attachment);
    await writeProofAttachments(vault);
    sendJson(response, 200, { deleted: true, id });
    return;
  }

  if (request.method === "GET" && pathname === "/api/vehicle-profiles") {
    sendJson(response, 200, await readVehicleProfiles());
    return;
  }

  if (request.method === "POST" && pathname === "/api/jobs") {
    const job = cleanJob(await readJsonBody(request));
    store.jobs.unshift(job);
    await writeStore(store);
    sendJson(response, 201, { job });
    return;
  }

  if (request.method === "POST" && pathname === "/api/jobs/sync") {
    const body = await readJsonBody(request);
    const result = mergeSyncedJobs(store, Array.isArray(body.jobs) ? body.jobs : []);
    if (result.imported || result.updated) await writeStore(store);
    sendJson(response, 200, { ...result, jobs: store.jobs });
    return;
  }

  if (request.method === "POST" && pathname === "/api/part-outcomes") {
    const body = await readJsonBody(request);
    const job = cleanPartOutcome(body);
    store.jobs.unshift(job);
    await writeStore(store);
    const profile = await updateVehicleProfileFromOutcome(body);
    sendJson(response, 201, { job, profile });
    return;
  }

  if (request.method === "POST" && pathname === "/api/worked-jobs/import") {
    const body = await readJsonBody(request);
    const result = await importWorkedJobsFromText(body.text || body.tsv || body.csv || "", store);
    sendJson(response, 201, result);
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

  if (request.method === "POST" && pathname === "/api/ai/advisor") {
    const body = await readJsonBody(request);
    const partsReference = await readPartsCrossReference();
    const proofAttachmentVault = await readProofAttachments();
    const jobs = mergedSearchJobs(store.jobs, body.jobs || body.localJobs || []);
    sendJson(
      response,
      200,
      buildAiAdvisor({
        jobs,
        partsReference,
        auditLog: store.auditLog,
        feedback: store.aiFeedback,
        shopRules: store.shopRules,
        preferences: store.aiPreferences,
        proofAttachments: groupAttachmentsByJob(proofAttachmentVault.attachments),
      }),
    );
    return;
  }

  if (request.method === "POST" && pathname === "/api/ai/commander") {
    const body = await readJsonBody(request);
    const partsReference = await readPartsCrossReference();
    const proofAttachmentVault = await readProofAttachments();
    const jobs = mergedSearchJobs(store.jobs, body.jobs || body.localJobs || []);
    sendJson(
      response,
      200,
      buildAiFieldCommander({
        context: body.context || {},
        store,
        jobs,
        partsReference,
        proofAttachments: groupAttachmentsByJob(proofAttachmentVault.attachments),
      }),
    );
    return;
  }

  if (request.method === "POST" && pathname === "/api/ai/feedback") {
    const body = await readJsonBody(request);
    const feedback = cleanAiFeedback(body);
    store.aiFeedback.unshift(feedback);
    store.aiFeedback = store.aiFeedback.slice(0, 1000);
    let rule = null;
    if (feedback.value === "save-rule") {
      rule = cleanShopRule(
        {
          title: body.ruleTitle || feedback.note || feedback.prompt,
          body: body.ruleBody || feedback.note || feedback.prompt,
          query: body.query || "",
          vehicle: body.vehicle || "",
          target: feedback.target || body.target,
          tags: body.tags || [],
          contextSummary: feedback.contextSummary,
        },
        feedback,
      );
      store.shopRules.unshift(rule);
      store.shopRules = store.shopRules.slice(0, 500);
    }
    await writeStore(store);
    sendJson(response, 201, { feedback, rule, memory: aiMemorySummary(store, {}, "") });
    return;
  }

  if (request.method === "GET" && pathname === "/api/ai/memory") {
    sendJson(response, 200, aiMemorySummary(store, {}, ""));
    return;
  }

  if (request.method === "GET" && pathname === "/api/ai/shop-rules") {
    sendJson(response, 200, {
      rules: store.shopRules.filter((rule) => !rule.disabled),
      personality: aiPersonalityProfile("owner", store.aiPreferences),
      feedback: aiFeedbackSummary(store.aiFeedback),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/ai/shop-rules") {
    const body = await readJsonBody(request);
    const rule = cleanShopRule(body);
    store.shopRules.unshift(rule);
    store.shopRules = store.shopRules.slice(0, 500);
    await writeStore(store);
    sendJson(response, 201, { rule, memory: aiMemorySummary(store, {}, "") });
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
      sendError(response, 404, "vPIC parts reference has not been generated. Run npm run sync:vpic first.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/code-desk/auto-baseline") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    sendJson(
      response,
      200,
      await buildAutoCodeBaseline({
        q: url.searchParams.get("q"),
        make: url.searchParams.get("make"),
        year: url.searchParams.get("year"),
        limit: url.searchParams.get("limit"),
      }),
    );
    return;
  }

  if (request.method === "GET" && pathname === "/api/code-desk/library") {
    sendJson(response, 200, publicCodeDeskLibrary(store));
    return;
  }

  if (request.method === "POST" && pathname === "/api/code-desk/library") {
    sendJson(response, 200, await importCodeDeskLibrary(await readJsonBody(request), store));
    return;
  }

  if (request.method === "POST" && pathname === "/api/code-desk/learn") {
    sendJson(response, 201, await learnCodeDesk(await readJsonBody(request), store));
    return;
  }

  if (request.method === "GET" && pathname === "/api/lishi-reference") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const reference = await readLishiMasterReference();
    sendJson(
      response,
      200,
      buildLishiLookup(reference, {
        q: url.searchParams.get("q"),
        year: url.searchParams.get("year"),
        make: url.searchParams.get("make"),
        model: url.searchParams.get("model"),
        category: url.searchParams.get("category"),
        limit: url.searchParams.get("limit"),
      }),
    );
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/lishi-reference/tool/")) {
    const toolId = normalizeVehicleText(decodeURIComponent(pathname.replace("/api/lishi-reference/tool/", ""))).replace(/\s+/g, "-");
    const reference = await readLishiMasterReference();
    const applications = (reference.applications || []).filter((application) => application.canonicalId === toolId);
    const tool = (reference.tools || []).find((item) => item.id === toolId || normalizeVehicleText(item.canonical).replace(/\s+/g, "-") === toolId);
    if (!tool) {
      sendError(response, 404, "Lishi tool not found in the imported master reference.");
      return;
    }
    sendJson(response, 200, {
      generatedAt: reference.generatedAt,
      sourceWorkbook: reference.sourceWorkbook,
      tool: publicLishiTool(tool, applications, 100),
      applications,
      sources: reference.sources || [],
      cleanupNotes: reference.cleanupNotes || [],
    });
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/vin-reference/")) {
    const vin = normalizeVinCandidate(decodeURIComponent(pathname.replace("/api/vin-reference/", "")));
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

  if (request.method === "GET" && pathname === "/api/reference-vault") {
    sendJson(response, 200, await readReferenceVault());
    return;
  }

  if (request.method === "GET" && pathname === "/api/public-reference-sources") {
    sendJson(response, 200, await readPublicReferenceSources());
    return;
  }

  if (request.method === "POST" && pathname === "/api/public-reference-sources/sync") {
    try {
      sendJson(response, 200, await syncPublicReferenceSources());
    } catch (error) {
      sendError(response, 502, `Public source sync failed: ${error.message}`);
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/reference-vault") {
    const body = await readJsonBody(request);
    const entry = sanitizeReferenceVaultEntry(body);
    if (!entry.vehicle.make || !entry.vehicle.model || !entry.vehicle.startYear) {
      sendError(response, 400, "Reference vault entries need at least startYear, make, and model.");
      return;
    }
    const vault = await readReferenceVault();
    const existingIndex = vault.entries.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) {
      vault.entries[existingIndex] = { ...vault.entries[existingIndex], ...entry };
    } else {
      vault.entries.unshift(entry);
    }
    await writeReferenceVault(vault);
    sendJson(response, existingIndex >= 0 ? 200 : 201, { entry });
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
      sendError(response, 404, "Key Innovations parts reference has not been imported. Run npm run import:key-innovations first.");
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
      sendError(response, 404, "Master parts database has not been imported. Run npm run import:master-catalog first.");
    }
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/api/vin/")) {
    const vin = normalizeVinCandidate(decodeURIComponent(pathname.replace("/api/vin/", "")));
    if (!validateVin(vin)) {
      sendError(response, 400, "Enter a valid 17-character VIN. Letters I, O, and Q are not used.");
      return;
    }

    let decode = null;
    try {
      decode = await decodeVinWithTimeout(vin);
    } catch (error) {
      decode = await localVinDecodeFallback(vin, error);
    }
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
      trim2: "",
      series: "",
      manufacturer: "",
      vehicleType: "",
      bodyClass: "",
      doors: "",
      cabType: "",
      engine: "",
      engineModel: "",
      engineCylinders: "",
      fuelType: "",
      transmission: "",
      driveType: "",
      gvwr: "",
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
        skipSupplierLookup: true,
      }),
    );
    return;
  }

  if (request.method === "GET" && pathname === "/api/supplier-lookup") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const vehicle = {
      year: cleanString(url.searchParams.get("year")),
      make: cleanString(url.searchParams.get("make")),
      model: cleanString(url.searchParams.get("model")),
      trim: cleanString(url.searchParams.get("trim")),
      trim2: cleanString(url.searchParams.get("trim2")),
      series: cleanString(url.searchParams.get("series")),
      manufacturer: cleanString(url.searchParams.get("manufacturer")),
      vehicleType: cleanString(url.searchParams.get("vehicleType")),
      bodyClass: cleanString(url.searchParams.get("bodyClass")),
      doors: cleanString(url.searchParams.get("doors")),
      cabType: cleanString(url.searchParams.get("cabType")),
      engine: cleanString(url.searchParams.get("engine")),
      engineModel: cleanString(url.searchParams.get("engineModel")),
      engineCylinders: cleanString(url.searchParams.get("engineCylinders")),
      fuelType: cleanString(url.searchParams.get("fuelType")),
      transmission: cleanString(url.searchParams.get("transmission")),
      driveType: cleanString(url.searchParams.get("driveType")),
      gvwr: cleanString(url.searchParams.get("gvwr")),
      plantCity: cleanString(url.searchParams.get("plantCity")),
      plantCountry: cleanString(url.searchParams.get("plantCountry")),
      identitySource: cleanString(url.searchParams.get("identitySource")) || "Vehicle profile supplier lookup",
    };
    const vin = normalizeVinCandidate(url.searchParams.get("vin"));

    if (!/^(19|20)\d{2}$/.test(vehicle.year) || !vehicle.make || !vehicle.model) {
      sendError(response, 400, "Supplier lookup needs year, make, and model.");
      return;
    }

    vehicle.make = vehicle.make.toUpperCase();
    const programmingReference = await findProgrammingReference(vehicle);
    const verifiedProfile = await findVerifiedVehicleProfile(vehicle);
    const shopEvidence = buildShopEvidence(vehicle, vin, store.jobs);
    sendJson(response, 200, await buildProfileSupplierLookup(vehicle, store, { vin }, programmingReference, verifiedProfile, shopEvidence));
    return;
  }

  if (request.method === "POST" && pathname === "/api/ai") {
    const body = await readJsonBody(request);
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      sendError(response, 400, "Prompt is required");
      return;
    }

    const memory = aiMemorySummary(store, body.context || {}, prompt);
    const decision = aiDecision(prompt, body.context || {}, memory);
    const entry = {
      id: randomUUID(),
      jobId: body.jobId || null,
      prompt,
      title: decision.title || "AI Bench",
      response: decision.response,
      riskLevel: decision.riskLevel,
      policyDecision: decision.policyDecision,
      intent: decision.intent || "general",
      checklist: decision.checklist || [],
      nextActions: decision.nextActions || [],
      suggestedPrompts: decision.suggestedPrompts || [],
      contextSummary: decision.contextSummary || [],
      recommendedRoute: decision.recommendedRoute || "",
      fieldPacket: decision.fieldPacket || null,
      personality: decision.personality || memory.personality,
      memory: decision.memory || memory,
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
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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
  console.log(`TimLock-App running at http://${host}:${port}/`);
});
