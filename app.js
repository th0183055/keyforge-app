let jobs = [];
let vehicles = [];
let calendarAnalysis = null;
let keyIntelligence = [];
let sourceConnectors = [];
let supplierAccounts = [];
let referenceVaultEntries = [];
let publicReferenceSources = null;
let selectedSupplierId = "key-innovations";
let selectedJobId = null;
let latestVinProfile = null;
let vinWorkflowStep = "entry";
let selectedKeyFamily = "";
let selectedKeyPackage = "";
let selectedPartChoiceKey = "";
let selectedProgrammerKey = "";
let supplierLookupRequestId = 0;
let activeVinScan = null;
let pendingJobOfferId = "";
let deferredInstallPrompt = null;
let latestPartHistory = null;
let latestCoverageDashboard = null;
let latestProofVault = null;
let proofVaultServerAttachments = {};
let proofVaultStorageMode = "browser-local";
let proofVaultAttachmentMaxBytes = 1_500_000;
let codeDeskImportedRecords = [];
let codeDeskCustomSystems = [];
let latestCodeDeskAutoBaseline = null;
let latestCodeDeskResult = null;
let latestApiHealth = null;
let latestLishiLookup = null;
let lishiLookupRequestId = 0;
let vinLishiLookupRequestId = 0;
let latestWorkbench = null;
let latestReferenceList = null;
let latestGlobalSearch = null;
let latestAiResponse = null;
let latestAiAdvisor = null;
let latestAiMemory = null;
let latestAiCommander = null;
let latestStorageStatus = null;
let latestStorageDiagnostics = null;
let latestAuthStatus = null;
let authRoleSelection = "owner";
let appMode = "owner";
const partHistoryRecentsKey = "timlockPartHistoryRecentSearches";
const localJobArchiveKey = "timlockSavedJobsArchiveV1";
const proofVaultAttachmentsKey = "timlockProofVaultAttachmentsV1";
const codeDeskImportKey = "timlockCodeDeskImportsV1";
const codeDeskSystemKey = "timlockCodeDeskSystemsV1";
const fieldLookupCacheKey = "timlockFieldLookupCacheV1";
const dispatchPackArchiveKey = "timlockDispatchPacksV1";
const currentJobContextKey = "timlockCurrentJobContextV1";
const appModeKey = "timlockAppModeV1";
const liveProductFilters = {
  condition: new Set(),
  stock: new Set(),
  type: new Set(),
  supplier: new Set(),
  buttons: new Set(),
};
const apiFallbackOrigin = "https://keyforge-app-x7o0.onrender.com";

const chatLog = [
  {
    role: "assistant",
    title: "TimLock Field Copilot",
    text: "Pick a VIN, part, job, or workflow and I will help with safe prep: proof, parts, programmer readiness, quote notes, and what to save back so the next job gets easier.",
  },
];

function loadAppMode() {
  try {
    return localStorage.getItem(appModeKey) === "subscriber" ? "subscriber" : "owner";
  } catch {
    return "owner";
  }
}

function isOwnerOnlyView(id) {
  return Boolean(document.querySelector(`.nav-item[data-view="${id}"][data-owner-only]`));
}

function applyAppMode(mode = loadAppMode()) {
  if (latestAuthStatus?.enabled && latestAuthStatus.authenticated && latestAuthStatus.role === "subscriber") {
    mode = "subscriber";
  }
  appMode = mode === "subscriber" ? "subscriber" : "owner";
  try {
    localStorage.setItem(appModeKey, appMode);
  } catch {}
  document.body.classList.toggle("mode-owner", appMode === "owner");
  document.body.classList.toggle("mode-subscriber", appMode === "subscriber");
  modeButtons.forEach((button) => {
    const active = button.dataset.setMode === appMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (modeCaption) {
    modeCaption.textContent =
      appMode === "owner"
        ? "Owner tools visible."
        : "Subscriber view hides raw/admin tools.";
  }
  const activeOwnerView = document.querySelector(".view.active")?.id;
  if (appMode === "subscriber" && isOwnerOnlyView(activeOwnerView)) {
    showView("workbench");
  }
}

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const mainElement = document.querySelector("main");
const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
const mobileMenuBackdrop = document.querySelector(".mobile-menu-backdrop");
const primarySidebar = document.querySelector("#primarySidebar");
const modeButtons = document.querySelectorAll("[data-set-mode]");
const modeCaption = document.querySelector("#modeCaption");
const appBackButton = document.querySelector("#appBackButton");
const topbarEyebrow = document.querySelector(".topbar .eyebrow");
const topbarTitle = document.querySelector(".topbar h2");
const authGate = document.querySelector("#authGate");
const authForm = document.querySelector("#authForm");
const authStatus = document.querySelector("#authStatus");
const authStatusPill = document.querySelector("#authStatusPill");
const logoutButton = document.querySelector("#logoutButton");
const authRoleButtons = document.querySelectorAll("[data-auth-role]");
const globalSearchForm = document.querySelector("#globalSearchForm");
const globalSearchStatus = document.querySelector("#globalSearchStatus");
const globalSearchResult = document.querySelector("#globalSearchResult");
const dashboardJobs = document.querySelector("#dashboardJobs");
const jobBoard = document.querySelector("#jobBoard");
const vehicleGrid = document.querySelector("#vehicleGrid");
const insightsMetrics = document.querySelector("#insightsMetrics");
const jobCodeList = document.querySelector("#jobCodeList");
const featureList = document.querySelector("#featureList");
const jobForm = document.querySelector("#jobForm");
const jobDetail = document.querySelector("#jobDetail");
const keyIntelForm = document.querySelector("#keyIntelForm");
const keyRecordList = document.querySelector("#keyRecordList");
const sourceList = document.querySelector("#sourceList");
const supplierSettingsForm = document.querySelector("#supplierSettingsForm");
const supplierSettingsStatus = document.querySelector("#supplierSettingsStatus");
const supplierAccountList = document.querySelector("#supplierAccountList");
const supplierSelect = document.querySelector("#supplierSelect");
const storageStatusPanel = document.querySelector("#storageStatusPanel");
const storageSettingsStatus = document.querySelector("#storageSettingsStatus");
const refreshStorageStatusButton = document.querySelector("#refreshStorageStatus");
const runStorageDiagnosticsButton = document.querySelector("#runStorageDiagnostics");
const migrateStorageProofButton = document.querySelector("#migrateStorageProof");
const exportServerBackupButton = document.querySelector("#exportServerBackup");
const importServerBackupButton = document.querySelector("#importServerBackup");
const serverBackupImportInput = document.querySelector("#serverBackupImportInput");
const referenceVaultForm = document.querySelector("#referenceVaultForm");
const referenceVaultStatus = document.querySelector("#referenceVaultStatus");
const referenceVaultList = document.querySelector("#referenceVaultList");
const syncPublicSourcesButton = document.querySelector("#syncPublicSourcesButton");
const publicSourceStatus = document.querySelector("#publicSourceStatus");
const publicSourceList = document.querySelector("#publicSourceList");
const workedJobForm = document.querySelector("#workedJobForm");
const workedJobStatus = document.querySelector("#workedJobStatus");
const workedJobImportForm = document.querySelector("#workedJobImportForm");
const workedJobImportStatus = document.querySelector("#workedJobImportStatus");
const fillWorkedJobFromLookupButton = document.querySelector("#fillWorkedJobFromLookup");
const partHistoryForm = document.querySelector("#partHistoryForm");
const partHistoryStatus = document.querySelector("#partHistoryStatus");
const partHistoryResult = document.querySelector("#partHistoryResult");
const partHistoryRecents = document.querySelector("#partHistoryRecents");
const coverageDashboard = document.querySelector("#coverageDashboard");
const coverageDashboardStatus = document.querySelector("#coverageDashboardStatus");
const refreshCoverageDashboardButton = document.querySelector("#refreshCoverageDashboard");
const proofVaultForm = document.querySelector("#proofVaultForm");
const proofVaultStatus = document.querySelector("#proofVaultStatus");
const proofVault = document.querySelector("#proofVault");
const syncProofVaultButton = document.querySelector("#syncProofVault");
const migrateProofVaultButton = document.querySelector("#migrateProofVault");
const exportProofVaultButton = document.querySelector("#exportProofVault");
const importProofVaultButton = document.querySelector("#importProofVault");
const proofVaultImportInput = document.querySelector("#proofVaultImportInput");
const codeDeskForm = document.querySelector("#codeDeskForm");
const codeDeskStatus = document.querySelector("#codeDeskStatus");
const codeDeskResult = document.querySelector("#codeDeskResult");
const importCodeDeskButton = document.querySelector("#importCodeDesk");
const exportCodeDeskButton = document.querySelector("#exportCodeDesk");
const clearCodeDeskButton = document.querySelector("#clearCodeDesk");
const codeDeskImportInput = document.querySelector("#codeDeskImportInput");
const codeDeskAutoForm = document.querySelector("#codeDeskAutoForm");
const codeDeskAutoStatus = document.querySelector("#codeDeskAutoStatus");
const codeDeskAutoBaseline = document.querySelector("#codeDeskAutoBaseline");
const exportCodeDeskAutoButton = document.querySelector("#exportCodeDeskAuto");
const lishiLookupForm = document.querySelector("#lishiLookupForm");
const lishiLookupStatus = document.querySelector("#lishiLookupStatus");
const lishiLookupResult = document.querySelector("#lishiLookupResult");
const workbenchForm = document.querySelector("#workbenchForm");
const workbenchStatus = document.querySelector("#workbenchStatus");
const workbenchResult = document.querySelector("#workbenchResult");
const refreshWorkbenchButton = document.querySelector("#refreshWorkbench");
const clearWorkbenchButton = document.querySelector("#clearWorkbench");
const referenceListForm = document.querySelector("#referenceListForm");
const referenceListStatus = document.querySelector("#referenceListStatus");
const referenceListResult = document.querySelector("#referenceListResult");
const vinForm = document.querySelector("#vinForm");
const ymmForm = document.querySelector("#ymmForm");
const scanButton = document.querySelector(".scan-action");
const vinResult = document.querySelector("#vinResult");
const vinRecommendation = document.querySelector("#vinRecommendation");
const appStatusBanner = document.querySelector("#appStatusBanner");
const connectionStatus = document.querySelector("#connectionStatus");
const installAppButton = document.querySelector("#installAppButton");
const aiForm = document.querySelector("#aiForm");
const chatLogElement = document.querySelector("#chatLog");
const aiRouteCard = document.querySelector("#aiRouteCard");
const aiRouteEyebrow = document.querySelector("#aiRouteEyebrow");
const aiRouteTitle = document.querySelector("#aiRouteTitle");
const aiRouteSummary = document.querySelector("#aiRouteSummary");
const aiRouteActions = document.querySelector("#aiRouteActions");
const aiContextChips = document.querySelector("#aiContextChips");
const aiOpportunityPanel = document.querySelector("#aiOpportunityPanel");
const aiQuickPrompts = document.querySelector("#aiQuickPrompts");
const aiContextPanel = document.querySelector("#aiContextPanel");
const aiActionPanel = document.querySelector("#aiActionPanel");
const aiCommanderPanel = document.querySelector("#aiCommanderPanel");
const refreshAiCommanderButton = document.querySelector("#refreshAiCommander");
const routeMeta = {
  command: {
    eyebrow: "Command center",
    title: "Search everything. Open the exact tool as a clean page.",
  },
  vin: {
    eyebrow: "VIN to key",
    title: "Scan a VIN. See the vehicle, keys, tools, and programming path.",
  },
  workbench: {
    eyebrow: "Unified job context",
    title: "Build one packet for parts, proof, tools, and the next move.",
  },
  "part-history": {
    eyebrow: "Proof trail",
    title: "Search part numbers against cross-reference and saved jobs.",
  },
  "proof-vault": {
    eyebrow: "Evidence locker",
    title: "Find job proof, attachments, authorization, and coverage evidence.",
  },
  "code-desk": {
    eyebrow: "Lock decode",
    title: "Look up code systems, bitting, cuts, and automotive code baseline.",
  },
  lishi: {
    eyebrow: "Pick / decode reference",
    title: "Find Lishi tools and vehicle applications from your master list.",
  },
  "reference-lists": {
    eyebrow: "Owner reference shelf",
    title: "Inspect the raw lists that power the app.",
  },
  coverage: {
    eyebrow: "Observed proof",
    title: "See programmer and part coverage from saved work.",
  },
  learn: {
    eyebrow: "Teach TimLock-App",
    title: "Save worked jobs so the app gets sharper.",
  },
  settings: {
    eyebrow: "Parts setup",
    title: "Connect suppliers and app data sources.",
  },
  about: {
    eyebrow: "TimLock-App",
    title: "Professional locksmith intelligence, built around verified work.",
  },
  ai: {
    eyebrow: "Professional assistant",
    title: "Ask for safe prep, quote, and technician workflow help.",
  },
};
let activeViewId = document.querySelector(".view.active")?.id || "command";
const appRouteStack = [];

function routeExists(id) {
  return Array.from(views).some((view) => view.id === id);
}

function routeFromLocation() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, "") || "");
  return routeExists(id) ? id : "";
}

function updateRouteChrome(id) {
  const meta = routeMeta[id] || routeMeta.command;
  if (topbarEyebrow) topbarEyebrow.textContent = meta.eyebrow;
  if (topbarTitle) topbarTitle.textContent = meta.title;
  if (appBackButton) appBackButton.hidden = id === "command";
}

function replaceRouteHash(id) {
  const hash = `#${encodeURIComponent(id)}`;
  if (window.location.hash !== hash) {
    window.history.replaceState({ view: id, timlock: true }, "", hash);
  }
}

function pushRouteHash(id) {
  const hash = `#${encodeURIComponent(id)}`;
  if (window.location.hash !== hash) {
    window.history.pushState({ view: id, timlock: true }, "", hash);
  }
}

function showView(id, options = {}) {
  const { push = true, scroll = true } = options;
  if (appMode === "subscriber" && isOwnerOnlyView(id)) id = "workbench";
  if (!routeExists(id)) id = "command";
  const previousViewId = activeViewId;
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === id));
  activeViewId = id;
  updateRouteChrome(id);
  if (push && previousViewId && previousViewId !== id) {
    appRouteStack.push(previousViewId);
    pushRouteHash(id);
  } else if (!push) {
    replaceRouteHash(id);
  }
  closeMobileMenu();
  if (scroll) mainElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (id === "coverage" && !latestCoverageDashboard) loadCoverageDashboard();
  if (id === "proof-vault" && !latestProofVault) loadProofVault();
  if (id === "workbench" && !latestWorkbench) loadJobWorkbench();
  if (id === "code-desk") {
    renderCodeDesk();
    if (!latestCodeDeskAutoBaseline) loadCodeDeskAutoBaseline();
  }
  if (id === "lishi" && !latestLishiLookup) loadLishiLookup();
  if (id === "reference-lists" && !latestReferenceList) loadReferenceList();
  if (id === "settings") loadStorageStatus({ quiet: true });
  updateAiContextUi();
}

function goBackInApp() {
  const previous = appRouteStack.pop();
  if (previous && routeExists(previous)) {
    showView(previous, { push: false });
    replaceRouteHash(previous);
    return;
  }
  showView("command", { push: false });
  replaceRouteHash("command");
}

function setMobileMenu(open) {
  document.body.classList.toggle("mobile-menu-open", open);
  primarySidebar?.classList.toggle("is-open", open);
  if (mobileMenuToggle) mobileMenuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (mobileMenuBackdrop) mobileMenuBackdrop.hidden = !open;
}

function closeMobileMenu() {
  setMobileMenu(false);
}

function setAppStatus(label, tone = "online", detail = "") {
  if (connectionStatus) {
    connectionStatus.textContent = label;
    connectionStatus.title = detail || label;
  }
  if (!appStatusBanner) return;
  ["online", "busy", "degraded", "offline"].forEach((state) => {
    appStatusBanner.classList.toggle(state, tone === state);
  });
  appStatusBanner.dataset.statusDetail = detail || "";
}

function updateConnectionStatus() {
  const online = navigator.onLine !== false;
  if (!online) {
    setAppStatus("Offline field mode", "offline", "Cached lookups and saved jobs remain available on this device.");
    return;
  }
  if (latestApiHealth?.status === "ok") {
    setAppStatus("Field ready", "online", `Server healthy. ${latestApiHealth?.summary || ""}`.trim());
    return;
  }
  if (latestApiHealth?.status === "degraded") {
    setAppStatus("Server waking", "degraded", latestApiHealth.error || "The cloud app is slow, but local field cache stays available.");
    return;
  }
  setAppStatus("Checking server", "busy", "Confirming the API is awake.");
}

function renderAuthStatus() {
  const status = latestAuthStatus || { enabled: false, authenticated: true, role: "owner", mode: "open-dev" };
  const locked = Boolean(status.enabled && !status.authenticated);
  document.body.classList.toggle("auth-required", locked);
  if (authGate) authGate.hidden = !locked;
  if (authStatusPill) {
    authStatusPill.textContent = status.enabled
      ? status.authenticated
        ? `${status.role === "owner" ? "Owner" : "Subscriber"} session`
        : "Sign in required"
      : "Open owner mode";
    authStatusPill.title = status.warning || (status.enabled ? "Role-protected API is active." : "Set TIMLOCK_OWNER_PASSWORD to enforce sign-in.");
  }
  if (logoutButton) logoutButton.hidden = !(status.enabled && status.authenticated);
  authRoleButtons.forEach((button) => {
    const active = button.dataset.authRole === authRoleSelection;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.disabled = Boolean(status.enabled && status.roles && !status.roles[button.dataset.authRole]);
  });
  if (authStatus && locked && !authStatus.textContent) {
    authStatus.textContent = status.roles?.owner ? "Owner password required." : "Auth is enabled but no owner login is configured.";
  }
}

async function loadAuthStatus() {
  try {
    latestAuthStatus = await api("/api/auth/status", { timeoutMs: 6000, noStatus: true, noFallback: true });
    if (latestAuthStatus.enabled && latestAuthStatus.authenticated) {
      applyAppMode(latestAuthStatus.role === "subscriber" ? "subscriber" : loadAppMode());
    } else if (!latestAuthStatus.enabled) {
      applyAppMode(loadAppMode());
    }
  } catch (error) {
    latestAuthStatus = { enabled: true, authenticated: false, role: "guest", mode: "locked", warning: error.message };
  } finally {
    renderAuthStatus();
  }
}

async function signIn(role, password) {
  if (authStatus) authStatus.textContent = "Signing in...";
  latestAuthStatus = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ role, password }),
    timeoutMs: 8000,
    noStatus: true,
    noFallback: true,
  });
  renderAuthStatus();
  applyAppMode(latestAuthStatus.role === "subscriber" ? "subscriber" : "owner");
  if (authStatus) authStatus.textContent = "Signed in.";
  await Promise.allSettled([loadJobs(), loadAiAdvisor(), loadAiMemory(), loadAiCommander({ quiet: true }), loadStorageStatus({ quiet: true })]);
}

async function signOut() {
  await api("/api/auth/logout", { method: "POST", timeoutMs: 6000, noStatus: true, noFallback: true }).catch(() => null);
  latestAuthStatus = { enabled: true, authenticated: false, role: "guest", mode: "locked" };
  renderAuthStatus();
  applyAppMode("subscriber");
}

function updateInstallButton() {
  if (!installAppButton) return;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
  installAppButton.hidden = standalone;
  installAppButton.disabled = !deferredInstallPrompt;
  installAppButton.textContent = deferredInstallPrompt ? "Install app" : "Install ready";
}

function statusClass(status) {
  if (status === "Hold") return "danger";
  if (status === "Needs photos") return "warn";
  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function catalogSourceLabelFromName(name = "") {
  const lookupProducts = latestVinProfile?.liveSupplierLookup?.products || [];
  const names = [
    ...new Set(
      lookupProducts
        .map((product) => product.supplier || product.brand)
        .filter(Boolean),
    ),
  ];
  const index = names.indexOf(name);
  return index >= 0 ? `Parts source ${index + 1}` : "Parts source";
}

function catalogAccountLabel(account, fallbackIndex = 0) {
  const index = supplierAccounts.findIndex((item) => item.id === account?.id);
  return `Parts source ${(index >= 0 ? index : fallbackIndex) + 1}`;
}

function customerSafeCatalogText(value = "") {
  const replacements = [
    [/Key Innovations/gi, "parts source"],
    [/Golden Supply Inc\.?/gi, "parts source"],
    [/Golden Supply/gi, "parts source"],
    [/UHS Hardware/gi, "parts source"],
    [/\bUHS\b/g, "parts source"],
    [/Transponder Island/gi, "parts source"],
    [/\bKey4\b/gi, "parts source"],
    [/IDN-H\.?\s*Hoffman/gi, "parts source"],
    [/IDN-Hoffman/gi, "parts source"],
    [/IDN public/gi, "parts"],
    [/\bKI\b/g, "parts"],
  ];
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value ?? ""))
    .replace(/\bcatalog sources\b/gi, "parts sources")
    .replace(/\bcatalog source\b/gi, "parts source")
    .replace(/\bcatalogs\b/gi, "parts")
    .replace(/\bcatalog\b/gi, "parts")
    .replace(/\bsuppliers\b/gi, "parts sources")
    .replace(/\bsupplier\b/gi, "parts source")
    .replace(/parts source search/gi, "parts search")
    .replace(/parts source lookup/gi, "parts lookup");
}

function formatMoney(value, payment) {
  if (!value) return "Not recorded";
  const amount = Number(value).toFixed(2);
  return payment ? `$${amount} [${escapeHtml(payment)}]` : `$${amount}`;
}

function jobSubtitle(job) {
  const pieces = [job.customer, job.service, job.verification].filter(Boolean);
  return pieces.map(escapeHtml).join(" &middot; ");
}

function renderJobs() {
  if (!jobs.length) {
    const emptyState = `<article class="job-row"><div><strong>No jobs yet</strong><span>Create the first job to start the workflow.</span></div></article>`;
    dashboardJobs.innerHTML = emptyState;
    jobBoard.innerHTML = emptyState;
    jobDetail.innerHTML = "";
    return;
  }

  if (!selectedJobId || !jobs.some((job) => job.id === selectedJobId)) {
    selectedJobId = jobs[0].id;
  }

  const html = jobs
    .map(
      (job) => `
        <button class="job-row job-button ${job.id === selectedJobId ? "selected" : ""}" data-job-id="${job.id}">
          <div>
            <strong>${escapeHtml(job.title || job.vehicle)}</strong>
            <span>${jobSubtitle(job)}</span>
          </div>
          <span class="status ${statusClass(job.status)}">${escapeHtml(job.status)}</span>
        </button>
      `,
    )
    .join("");

  dashboardJobs.innerHTML = html;
  jobBoard.innerHTML = html;
  renderJobDetail();
  wireJobButtons();
}

function renderDetailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${label}</span>
      <strong>${value ? escapeHtml(value) : "Not recorded"}</strong>
    </div>
  `;
}

function renderJobDetail() {
  const job = jobs.find((item) => item.id === selectedJobId);
  if (!job) {
    jobDetail.innerHTML = "";
    return;
  }

  const facts = [
    renderDetailItem("Schedule", job.schedule),
    renderDetailItem("Location", job.locationName || job.address),
    renderDetailItem("Contact", [job.contact, job.phone].filter(Boolean).join(" - ")),
    renderDetailItem("VIN / serial", job.vin),
    renderDetailItem("Key code", job.keyCode),
    renderDetailItem("Mileage", job.mileage),
    renderDetailItem("Programmer / method", job.programmer),
    renderDetailItem("Sequence", job.sequence),
    renderDetailItem("Total", formatMoney(job.price, job.payment)),
  ].join("");

  const notes = (job.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  const tags = (job.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

  jobDetail.innerHTML = `
    <section class="detail-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Completed job record</p>
          <h3>${escapeHtml(job.title || job.vehicle)}</h3>
        </div>
        <span class="status ${statusClass(job.status)}">${escapeHtml(job.status)}</span>
      </div>
      <div class="tag-row">${tags}</div>
      <div class="detail-grid">${facts}</div>
      <div class="notes-block">
        <p class="eyebrow">Raw field notes</p>
        <ul>${notes}</ul>
      </div>
    </section>
  `;
}

function wireJobButtons() {
  document.querySelectorAll("[data-job-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedJobId = button.dataset.jobId;
      renderJobs();
      showView("jobs");
    });
  });
}

function renderVehicles() {
  if (!vehicles.length) {
    vehicleGrid.innerHTML = `<article class="vehicle-card"><strong>Loading vehicle data</strong><span>Reference records are coming online.</span></article>`;
    return;
  }

  vehicleGrid.innerHTML = vehicles
    .map(
      ([name, description]) => `
        <article class="vehicle-card">
          <strong>${name}</strong>
          <span>${description}</span>
        </article>
      `,
    )
    .join("");
}

function compactNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function renderInsights() {
  if (!calendarAnalysis) {
    insightsMetrics.innerHTML = `<article class="metric"><span>Import</span><strong>Loading</strong><p>Reading calendar analysis</p></article>`;
    return;
  }

  const { revenueSignals, timeSignals, dateRange } = calendarAnalysis;
  insightsMetrics.innerHTML = `
    <article class="metric">
      <span>Imported events</span>
      <strong>${compactNumber(calendarAnalysis.totalEvents)}</strong>
      <p>${dateRange.start?.slice(0, 10)} to ${dateRange.end?.slice(0, 10)}</p>
    </article>
    <article class="metric">
      <span>Visible revenue</span>
      <strong>${currency(revenueSignals.visibleTotal)}</strong>
      <p>${compactNumber(revenueSignals.eventsWithAmounts)} events with prices</p>
    </article>
    <article class="metric">
      <span>Avg ticket</span>
      <strong>${currency(revenueSignals.averageVisibleTicket)}</strong>
      <p>From calendar price notes</p>
    </article>
    <article class="metric">
      <span>Avg duration</span>
      <strong>${timeSignals.averageDurationMinutes}m</strong>
      <p>${compactNumber(timeSignals.eventsWithDuration)} timed events</p>
    </article>
  `;

  jobCodeList.innerHTML = calendarAnalysis.jobCodes
    .slice(0, 12)
    .map(
      (item) => `
        <div class="rank-row">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${compactNumber(item.count)} jobs</span>
        </div>
      `,
    )
    .join("");

  featureList.innerHTML = calendarAnalysis.sampleSellableFeatures
    .map((feature) => `<article>${escapeHtml(feature)}</article>`)
    .join("");
}

function renderKeyRecords() {
  if (!keyIntelligence.length) {
    keyRecordList.innerHTML = `<article class="option-card"><strong>No key records yet</strong><p>Add your first verified year/make/model key system.</p></article>`;
    return;
  }

  keyRecordList.innerHTML = keyIntelligence
    .map(
      (record) => `
        <article class="key-record">
          <div>
            <strong>${escapeHtml(record.match.yearStart)}${record.match.yearEnd !== record.match.yearStart ? `-${escapeHtml(record.match.yearEnd)}` : ""} ${escapeHtml(record.match.make)} ${escapeHtml(record.match.model)}</strong>
            <span>${escapeHtml(record.keySystem.name)} · ${escapeHtml(record.keySystem.confidence)} confidence</span>
          </div>
          <div class="key-record-grid">
            ${renderDetailItem("Key", record.keyOptions?.[0]?.name)}
            ${renderDetailItem("Part", record.keyOptions?.[0]?.partNumber)}
            ${renderDetailItem("Programmer", record.programmers?.[0]?.name)}
            ${renderDetailItem("Tool", record.tools?.[0]?.name)}
          </div>
          <p>${escapeHtml(record.keySystem.notes)}</p>
        </article>
      `,
    )
    .join("");
}

function renderSources() {
  if (!sourceConnectors.length) {
    sourceList.innerHTML = `<article class="option-card"><strong>No sources loaded</strong><p>Connector registry is unavailable.</p></article>`;
    return;
  }

  sourceList.innerHTML = sourceConnectors
    .map(
      (source) => `
        <article class="source-card-row">
          <div>
            <strong>${escapeHtml(source.name)}</strong>
            <span>${escapeHtml(source.category)} · ${escapeHtml(source.connectionType)} · ${escapeHtml(source.status)}</span>
          </div>
          <p>${escapeHtml(source.notes)}</p>
          <div class="tag-row">
            ${(source.whatItCanProvide || []).slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderSupplierAccounts() {
  if (!supplierAccountList || !supplierSettingsForm) return;

  if (!supplierAccounts.length) {
    supplierAccountList.innerHTML = `<article class="source-card-row"><strong>No parts accounts</strong><p>Parts registry has not loaded yet.</p></article>`;
    return;
  }

  if (!supplierAccounts.some((account) => account.id === selectedSupplierId)) {
    selectedSupplierId = supplierAccounts[0].id;
  }
  const selectedAccount = supplierAccounts.find((account) => account.id === selectedSupplierId) || supplierAccounts[0];
  if (supplierSelect) {
    supplierSelect.innerHTML = supplierAccounts
      .map((account, index) => `<option value="${escapeHtml(account.id)}">${escapeHtml(catalogAccountLabel(account, index))}</option>`)
      .join("");
    supplierSelect.value = selectedAccount.id;
  }

  supplierSettingsForm.elements.loginUrl.value = selectedAccount.loginUrl || "";
  supplierSettingsForm.elements.username.value = selectedAccount.username || "";
  supplierSettingsForm.elements.password.value = "";
  supplierSettingsForm.elements.enabled.checked = Boolean(selectedAccount.enabled);

  supplierAccountList.innerHTML = supplierAccounts
    .map(
      (account, index) => `
        <article class="source-card-row supplier-account-row ${account.id === selectedAccount.id ? "selected" : ""}">
          <div>
            <strong>${escapeHtml(catalogAccountLabel(account, index))}</strong>
            <span>${account.connected ? "Enabled with saved login" : account.hasPassword ? "Login saved, disabled" : "Not connected"}</span>
          </div>
          <p>${escapeHtml(account.username || "No username saved")} · ${escapeHtml(account.lookupMode || "planned connector")}</p>
          <div class="tag-row">
            <span>${account.enabled ? "Live lookup on" : "Live lookup off"}</span>
            <span>${account.hasPassword ? "Password saved" : "Password missing"}</span>
            <span>${account.updatedAt ? `Updated ${new Date(account.updatedAt).toLocaleDateString()}` : "Not updated"}</span>
          </div>
          <button class="secondary-action small" type="button" data-edit-supplier="${escapeHtml(account.id)}">Edit</button>
        </article>
      `,
    )
    .join("");
}

function renderOptionList(title, options) {
  return `
    <section class="option-section">
      <p class="eyebrow">${title}</p>
      <div class="option-list">
        ${options
          .map(
            (option) => `
              <article class="option-card">
                <strong>${escapeHtml(option.name)}</strong>
                <span>${escapeHtml(option.position || option.type || "")}</span>
                <p>${escapeHtml(option.notes)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderReferenceVault() {
  if (!referenceVaultList) return;
  if (!referenceVaultEntries.length) {
    referenceVaultList.innerHTML = `<article class="source-card-row"><strong>No reference entries yet</strong><p>Add original TimLock-App summaries with citations to grow VIN/YMM guidance.</p></article>`;
    return;
  }
  referenceVaultList.innerHTML = referenceVaultEntries
    .slice(0, 12)
    .map(
      (entry) => `
        <article class="source-card-row">
          <strong>${escapeHtml(entry.title || "Reference entry")}</strong>
          <p>${escapeHtml([entry.vehicle?.startYear, entry.vehicle?.endYear && entry.vehicle.endYear !== entry.vehicle.startYear ? `-${entry.vehicle.endYear}` : "", entry.vehicle?.make, entry.vehicle?.model].filter(Boolean).join(" "))}</p>
          <span>${escapeHtml(`${entry.confidence || "medium"} confidence | ${entry.sources?.length || 0} source${entry.sources?.length === 1 ? "" : "s"}`)}</span>
        </article>
      `,
    )
    .join("");
}

function renderPublicReferenceSources() {
  if (!publicSourceList) return;
  const sources = publicReferenceSources?.sources || [];
  const autel = publicReferenceSources?.autel || {};
  const nhtsa = publicReferenceSources?.nhtsa || {};
  const probes = publicReferenceSources?.probes || [];
  const rows = [
    ...sources.map((source) => ({
      title: source.name,
      body: source.use,
      meta: source.type,
    })),
    ...probes.map((probe) => ({
      title: probe.name,
      body: probe.status === "available" ? `${probe.use} Signals: ${(probe.signals || []).join(", ") || "public page reachable"}` : `${probe.use} Probe status: ${probe.status}`,
      meta: `${probe.category || "source"} | ${probe.httpStatus || probe.error || "checked"}`,
    })),
    {
      title: "Autel IMMO products found",
      body: `${autel.products?.length || 0} key/IMMO-related public products indexed.`,
      meta: `${autel.coverage?.length || 0} coverage samples`,
    },
    {
      title: "NHTSA variables found",
      body: `${nhtsa.vehicleVariableCount || 0} public vehicle variables available for VIN/YMM identity.`,
      meta: "Official public data",
    },
  ];
  publicSourceList.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <article class="source-card-row">
              <strong>${escapeHtml(row.title)}</strong>
              <p>${escapeHtml(row.body || "")}</p>
              <span>${escapeHtml(row.meta || "")}</span>
            </article>
          `,
        )
        .join("")
    : `<article class="source-card-row"><strong>No public data pulled yet</strong><p>Tap Pull Free Public Data to index available web sources.</p></article>`;
}

function renderCheckList(title, items) {
  if (!items?.length) return "";
  return `
    <section class="option-section">
      <p class="eyebrow">${title}</p>
      <div class="check-list">
        ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>
  `;
}

function renderMatchedJobs(jobs) {
  if (!jobs?.length) {
    return `
      <section class="option-section">
        <p class="eyebrow">Matched past jobs</p>
        <div class="assistant-card">
          <strong>No exact local match yet</strong>
          <p>This VIN still gets brand-level guidance. Add a verified job record to improve confidence for this vehicle.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="option-section matched-jobs">
      <p class="eyebrow">Matched past jobs</p>
      <div class="option-list">
        ${jobs
          .map(
            (job) => `
              <article class="option-card">
                <strong>${escapeHtml(job.title)}</strong>
                <span>${escapeHtml(job.programmer || "Method not recorded")}</span>
                <p>${escapeHtml(formatMoney(job.price, job.payment))} · ${escapeHtml(job.schedule || "No schedule")}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCatalogApplication(application) {
  if (!application) {
    return `
      <section class="option-section">
        <p class="eyebrow">Local vPIC parts</p>
        <div class="assistant-card">
          <strong>No local application match</strong>
          <p>Live VIN decode still worked. Run or widen the vPIC sync to add this year/make/model locally.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="option-section">
      <p class="eyebrow">Local vPIC parts</p>
      <div class="assistant-card">
        <strong>${escapeHtml(application.year)} ${escapeHtml(application.make)} ${escapeHtml(application.model)}</strong>
        <p>${escapeHtml(application.vehicleType)} · ${escapeHtml(application.locksmithDataStatus)} · ${escapeHtml(application.keySystemStatus)}</p>
      </div>
    </section>
  `;
}

function renderProgrammingReference(reference) {
  if (!reference) {
    return `
      <section class="option-section">
        <p class="eyebrow">Programming reference</p>
        <div class="assistant-card">
          <strong>No exact programming record</strong>
          <p>Import or verify year/make/model programming data for stronger ignition and immobilizer guidance.</p>
        </div>
      </section>
    `;
  }

  const flags = [
    reference.requiresPin ? "PIN required" : "No PIN flag",
    reference.requiresOnline ? "Online required" : "Offline flag",
    reference.requiresBypass ? "Bypass required" : "No bypass flag",
    reference.allKeysLostSupported ? "AKL supported" : "AKL not flagged",
  ];

  return `
    <section class="option-section">
      <p class="eyebrow">Programming reference</p>
      <div class="assistant-card">
        <strong>${escapeHtml(reference.ignitionType)} · ${escapeHtml(reference.immobilizerSystem)}</strong>
        <p>${escapeHtml(reference.programMethod)} · ${flags.map(escapeHtml).join(" · ")}</p>
      </div>
    </section>
  `;
}

function renderSourceReadiness(items) {
  if (!items?.length) return "";
  return `
    <section class="source-readiness">
      <p class="eyebrow">Lookup source readiness</p>
      <div class="rank-list">
        ${items
          .map(
            (item) => `
              <div class="rank-row">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.status)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSupplierCandidates(candidates = [], compact = false) {
  if (!candidates.length) {
    return `
      <section class="option-section">
        <p class="eyebrow">Possible keys</p>
        <div class="assistant-card">
          <strong>No parts candidates yet</strong>
          <p>Add parts fitment or Key DB part clues to improve candidate matching.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="supplier-candidates">
      <p class="eyebrow">${compact ? "Step 3" : "Parts candidates"}</p>
      ${compact ? "<h3>Possible parts matches</h3>" : ""}
      <div class="supplier-list">
        ${candidates
          .slice(0, compact ? 4 : candidates.length)
          .map(
            (candidate, index) => `
              <article class="supplier-card ${index === 0 ? "best" : ""}">
                <div>
                  <span>${index === 0 ? "Best candidate" : candidate.confidence}</span>
                  <strong>${escapeHtml(candidate.preferredPartNumberLabel || candidate.hlPartNumber || candidate.supplierSku || "Candidate")}</strong>
                </div>
                <dl>
                  <div><dt>SKU</dt><dd>${escapeHtml(candidate.supplierSku || "Verify")}</dd></div>
                  <div><dt>FCC</dt><dd>${escapeHtml(candidate.fccId || "Verify")}</dd></div>
                  <div><dt>OEM</dt><dd>${escapeHtml((candidate.oemPartNumbers || []).slice(0, 3).join(", ") || "Verify")}</dd></div>
                  <div><dt>Cross IDs</dt><dd>${escapeHtml((candidate.crossReferenceLabels || candidate.crossReferenceIds || []).slice(0, 4).join(", ") || candidate.activePartNumber || "None")}</dd></div>
                </dl>
                <p>${candidate.reasons.map(escapeHtml).join(" · ")}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function conditionBucket(product) {
  const text = String(product.keyInfo?.condition || product.name || "").toLowerCase();
  if (!product.keyInfo?.condition) return "Unlisted";
  if (text.includes("refurb")) return "Refurbished";
  if (text.includes("oem") || text === "new") return "OEM / new";
  if (text.includes("aftermarket")) return "Aftermarket";
  return "Other condition";
}

function stockBucket(product) {
  const text = String(product.keyInfo?.stock || "").toLowerCase();
  if (text.startsWith("in stock")) return "In stock";
  if (text.includes("out of stock")) return "Out of stock";
  return "Stock unknown";
}

function partTypeBucket(product) {
  const text = [product.name, product.keyInfo?.productType, product.keyInfo?.buttons, product.keyInfo?.chip]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/prox|proximity|smart/.test(text)) return "Proximity / smart";
  if (/flip|remote head|switchblade/.test(text)) return "Flip / remote head";
  if (/insert|blade|emergency/.test(text)) return "Insert / blade";
  if (/transponder|chip/.test(text)) return "Transponder key";
  if (/tool|machine|lishi|pick|decoder/.test(text)) return "Tools / machines";
  return "Other key item";
}

function buttonLayoutBucket(product) {
  const source = [
    product.keyInfo?.buttons,
    product.buttons,
    product.name,
    product.keyInfo?.productType,
    product.description,
  ]
    .filter(Boolean)
    .join(" ");
  const actions = buttonActionTokens(product);
  const count = buttonCountFromText(source) || (actions.length >= 2 ? String(actions.length) : "");
  if (!count && !actions.length) return "Button layout unknown";
  const actionLabel = actions.length ? `: ${actions.join(" / ")}` : "";
  if (count) return `${count} button${actionLabel}`;
  return actions.join(" / ");
}

function buttonActionTokens(product) {
  const text = productSearchText(product).toLowerCase();
  const tokens = [];
  const add = (label, pattern) => {
    if (pattern.test(text) && !tokens.includes(label)) tokens.push(label);
  };
  add("Lock", /\block\b|\block\/unlock\b/);
  add("Unlock", /\bunlock\b|\block\/unlock\b/);
  add("Panic", /\bpanic\b/);
  add("Trunk", /\btrunk\b/);
  add("Hatch", /\bhatch\b|\bliftgate\b|\brear gate\b/);
  add("Tailgate", /\btailgate\b/);
  add("Remote start", /\bremote start\b|\br\/s\b|\brs\b/);
  add("Sliding door", /\bsliding door\b|\bslide door\b|\bpower door\b/);
  return tokens.slice(0, 7);
}

function productSearchText(product) {
  return [
    product.name,
    product.brand,
    product.keyInfo?.productType,
    product.keyInfo?.sku,
    product.keyInfo?.oem,
    product.keyInfo?.fcc,
    product.keyInfo?.chip,
    product.keyInfo?.buttons,
    product.keyInfo?.fitment,
    product.description,
    ...(product.fitmentLines || []),
    ...Object.values(product.customFields || {}).slice(0, 80),
  ]
    .filter(Boolean)
    .join(" ");
}

function isNonKeyReferenceProduct(product) {
  const text = productSearchText(product).toLowerCase();
  return /\b(pinning|pinning kit|pin kit|ignition|lock cylinder|cylinder|spring|clip|retainer|roll pin|battery|button pad|pad|case|shell|cover|repair|refill|adapter|programmer|machine|tool|lishi|pick|decoder|2-in-1|2 in 1|reader|tester)\b/.test(text);
}

function isStandaloneChipProduct(product) {
  const text = productSearchText(product).toLowerCase();
  return /\b(chip|transponder chip|clone chip|id4\d|id6\d|pcf)\b/.test(text) && !/\b(key|remote|fob|prox|proximity|smart|flip|head)\b/.test(text);
}

function isDisplayKeyProduct(product) {
  if (!product) return false;
  const text = productSearchText(product).toLowerCase();
  if (isNonKeyReferenceProduct(product) || isStandaloneChipProduct(product)) return false;
  if (/\b(insert|emergency blade|blade only|key blade|mechanical blade|blank blade)\b/.test(text)) return false;
  return /\b(key|remote|fob|prox|proximity|smart|flip|transponder|remote head|rhk|peps|push)\b/.test(text);
}

function liveFilterValue(product, group) {
  if (group === "condition") return conditionBucket(product);
  if (group === "stock") return stockBucket(product);
  if (group === "type") return partTypeBucket(product);
  if (group === "supplier") return catalogSourceLabelFromName(product.supplier || product.brand || "Parts source");
  if (group === "buttons") return buttonLayoutBucket(product);
  return "Unlisted";
}

function liveFilterOptions(products, group) {
  const counts = products.reduce((bucketCounts, product) => {
    const value = liveFilterValue(product, group);
    if (value) bucketCounts[value] = (bucketCounts[value] || 0) + 1;
    return bucketCounts;
  }, {});
  const preferredOrder = {
    condition: ["OEM / new", "Refurbished", "Aftermarket", "Unlisted", "Other condition"],
    stock: ["In stock", "Out of stock", "Stock unknown"],
    type: ["Proximity / smart", "Flip / remote head", "Transponder key", "Insert / blade", "Tools / machines", "Other key item"],
    buttons: ["2 button", "3 button", "4 button", "5 button", "6 button", "7 button", "Remote start", "Button layout unknown"],
  };
  return Object.keys(counts)
    .sort((a, b) => {
      const order = preferredOrder[group] || [];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex >= 0 || bIndex >= 0) return (aIndex >= 0 ? aIndex : 999) - (bIndex >= 0 ? bIndex : 999);
      return a.localeCompare(b);
    })
    .map((value) => ({ value, count: counts[value] }));
}

function productPassesLiveFilters(product) {
  return Object.entries(liveProductFilters).every(([group, selected]) => {
    if (!selected.size) return true;
    return selected.has(liveFilterValue(product, group));
  });
}

function productKeyFamily(product) {
  const serverFamily = product.selection?.family || product.keyInfo?.selectionFamily || "";
  const text = [product.name, product.keyInfo?.productType, product.keyInfo?.buttons, product.keyInfo?.chip]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (serverFamily === "proximity") return "proximity";
  if (["remote-head", "transponder"].includes(serverFamily)) return "keyed";
  if (["tool", "supporting"].includes(serverFamily)) return "supporting";
  if (serverFamily === "insert" && !/prox|smart|peps|proximity|remote|fob|flip|switchblade|transponder/.test(text)) return "supporting";
  if (text.includes("prox") || text.includes("smart") || text.includes("peps") || text.includes("proximity")) return "proximity";
  if (text.includes("flip") || text.includes("remote head") || text.includes("switchblade") || text.includes("transponder") || text.includes("chip")) return "keyed";
  if (text.includes("tool") || text.includes("lishi") || text.includes("decoder") || text.includes("insert") || text.includes("blade")) return "supporting";
  return "keyed";
}

function keyFamilyLabel(family) {
  if (family === "proximity") return "Proximity keys";
  if (family === "supporting") return "Supporting items";
  return "Flip / transponder keys";
}

function productsForFamily(products, family) {
  return products.filter((product) => productKeyFamily(product) === family && (family === "supporting" || isDisplayKeyProduct(product)));
}

function familyCounts(products) {
  return {
    proximity: productsForFamily(products, "proximity").length,
    keyed: productsForFamily(products, "keyed").length,
    supporting: productsForFamily(products, "supporting").length,
  };
}

function ensureSelectedKeyFamily(products) {
  const counts = familyCounts(products);
  if (selectedKeyFamily && selectedKeyFamily !== "supporting" && counts[selectedKeyFamily]) return;
  if (counts.proximity) selectedKeyFamily = "proximity";
  else if (counts.keyed) selectedKeyFamily = "keyed";
  else if (!selectedKeyFamily) selectedKeyFamily = "keyed";
}

function renderWorkflowActions(actions) {
  const hasStartOver = actions.some((action) => /data-vin-home|data-vin-reset/.test(action));
  const withStartOver = hasStartOver
    ? actions
    : [...actions, `<button class="secondary-action" type="button" data-vin-home>Start over</button>`];
  return `
    <div class="workflow-action-shell">
      <div class="workflow-actions">${withStartOver.join("")}</div>
    </div>
  `;
}

function stepLabel(step) {
  return {
    vehicle: "Vehicle",
    "vehicle-details": "Details",
    package: "Key type",
    parts: "Pictures",
    lishi: "Lishi",
    programmers: "Programmers",
    summary: "Summary",
    suppliers: "Summary",
  }[step] || "VIN";
}

function renderMobileContextHeader(profile, step) {
  if (!profile?.vehicle || step === "vehicle") return "";
  const vehicle = profile.vehicle;
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const vin = profile.vin ? `${profile.vin.slice(0, 5)}...${profile.vin.slice(-4)}` : "Y/M/M";
  return `
    <div class="mobile-context-header">
      <div>
        <span>${escapeHtml(stepLabel(step))}</span>
        <strong>${escapeHtml(title || "Vehicle lookup")}</strong>
      </div>
      <small>${escapeHtml(vin)}</small>
    </div>
  `;
}

function renderShopEvidenceCard(evidence) {
  if (!evidence) return "";
  const hasEvidence = evidence.totalMatches > 0;
  return `
    <section class="shop-evidence-card ${hasEvidence ? "" : "empty"}">
      <div>
        <span>Shop history</span>
        <strong>${escapeHtml(hasEvidence ? evidence.summary : "No shop match yet")}</strong>
        <p>${escapeHtml(
          hasEvidence
            ? [
                evidence.programmers?.length ? `Programmers: ${evidence.programmers.join(", ")}` : "",
                evidence.tools?.length ? `Tools/refs: ${evidence.tools.join(", ")}` : "",
                evidence.keyCodes?.length ? `Key codes: ${evidence.keyCodes.join(", ")}` : "",
              ]
                .filter(Boolean)
                .join(" | ") || "Use as a confidence clue, then verify FCC/buttons/blade."
            : "This lookup will start a new evidence trail once the completed job is saved.",
        )}</p>
      </div>
      <small>${escapeHtml(evidence.confidence)} confidence</small>
    </section>
  `;
}

function renderVehicleMemoryCard(profile) {
  const evidence = profile.shopEvidence || {};
  const jobs = evidence.jobs || [];
  const workedJobs = jobs.filter((job) => !job.outcome || job.outcome === "worked");
  const failedJobs = jobs.filter((job) => job.outcome && job.outcome !== "worked");
  const prices = jobs.map((job) => Number(job.price)).filter((price) => Number.isFinite(price) && price > 0);
  const average = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null;
  const baseline = profile.verifiedProfile?.baselinePart || profile.verifiedProfile?.verifiedParts?.[0] || null;
  if (!jobs.length && !baseline) return "";
  const mostUsedProgrammer = evidence.programmers?.[0] || "Not recorded";
  return `
    <section class="vehicle-memory-card">
      <div>
        <span>Vehicle memory</span>
        <strong>${escapeHtml(baseline?.name || `${jobs.length} saved job${jobs.length === 1 ? "" : "s"}`)}</strong>
        <p>${escapeHtml(
          [
            `${workedJobs.length} worked`,
            failedJobs.length ? `${failedJobs.length} issue${failedJobs.length === 1 ? "" : "s"}` : "",
            average ? `Avg charge $${average.toFixed(0)}` : "",
            `Programmer: ${mostUsedProgrammer}`,
          ]
            .filter(Boolean)
            .join(" | "),
        )}</p>
      </div>
      <small>${escapeHtml(profile.verifiedProfile?.confidence || evidence.confidence || "learning")}</small>
    </section>
  `;
}

function renderVehicleReferenceCard(reference) {
  if (!reference) return "";
  const renderList = (items) => (items || []).filter(Boolean).slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const renderReferenceArticle = (label, items) =>
    items?.length
      ? `<article>
          <small>${escapeHtml(label)}</small>
          <ul>${renderList(items)}</ul>
        </article>`
      : "";
  return `
    <section class="vehicle-reference-card">
      <div class="reference-head">
        <div>
          <span>Vehicle reference</span>
          <strong>${escapeHtml(reference.keyway?.primary || "Verify keyway")}</strong>
          <p>${escapeHtml(reference.source || "Reference data must be verified on the vehicle.")}</p>
        </div>
        <small>${escapeHtml(reference.keyway?.confidence || "verify")}</small>
      </div>
      <div class="reference-grid">
        <article>
          <small>Keyway</small>
          <strong>${escapeHtml(reference.keyway?.primary || "Verify")}</strong>
          <p>${escapeHtml((reference.keyway?.alternates || []).join(" | ") || "Confirm from lock or emergency insert.")}</p>
        </article>
        <article>
          <small>Lishi / decode</small>
          <strong>${escapeHtml(reference.lishi?.primary || "Verify")}</strong>
          <p>${escapeHtml((reference.lishi?.alternates || []).join(" | ") || "Use keyway-confirmed tool only.")}</p>
        </article>
        <article>
          <small>Unlock kit</small>
          <ul>${renderList(reference.unlock)}</ul>
        </article>
        <article>
          <small>Originate key</small>
          <ul>${renderList(reference.origination)}</ul>
        </article>
        <article>
          <small>Programming</small>
          <ul>${renderList(reference.programming)}</ul>
        </article>
        ${renderReferenceArticle("Access / proof", reference.access)}
        ${renderReferenceArticle("Photos to capture", reference.fieldPhotos)}
        ${renderReferenceArticle("Field tools", reference.fieldTools)}
        ${renderReferenceArticle("Job flow", reference.jobFlow)}
        ${renderReferenceArticle("Decode plan", reference.decodePlan)}
        ${renderReferenceArticle("Cutting setup", reference.cutting)}
        ${renderReferenceArticle("Part verification", reference.partVerification)}
        ${renderReferenceArticle("Vault notes", reference.vaultNotes)}
        <article>
          <small>Watch outs</small>
          <ul>${renderList(reference.warnings)}</ul>
        </article>
        ${
          reference.referenceVault?.matched
            ? `<article>
                <small>Reference vault</small>
                <strong>${escapeHtml(`${reference.referenceVault.matched} original TimLock-App match${reference.referenceVault.matched === 1 ? "" : "es"}`)}</strong>
                <p>${escapeHtml(reference.referenceVault.sourcePolicy || "Original summaries with source audit trail.")}</p>
              </article>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderFieldReferencePreview(reference) {
  if (!reference) return "";
  const items = [
    ["Keyway", reference.keyway?.primary || "Verify by insert/lock"],
    ["Decode", (reference.decodePlan || [])[0] || "Confirm code/decode path"],
    ["Tools", (reference.fieldTools || [])[0] || reference.lishi?.primary || "Verify field tools"],
    [
      "Vault",
      reference.referenceVault?.matched
        ? `${reference.referenceVault.matched} original match${reference.referenceVault.matched === 1 ? "" : "es"}`
        : (reference.warnings || [])[0] || "VIN alone is not enough",
    ],
  ];
  return `
    <section class="field-reference-strip">
      ${items
        .map(
          ([label, value]) => `
            <article>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderJobKitSummary(jobKit) {
  if (!jobKit) return "";
  const firstKey = jobKit.keys?.[0];
  const firstTool = jobKit.tools?.[0];
  const programmerCount = jobKit.programmerCoverage?.length || jobKit.programmers?.length || 0;
  const cards = [
    ["Keys needed", firstKey?.name || "Verify key package", firstKey?.detail || "Confirm prox, flip, transponder, FCC, buttons, and blade."],
    ["Programmer coverage", programmerCount ? `${programmerCount} paths to compare` : "Verify coverage", "Choose the programmer on the confidence screen after picking the key picture."],
    ["Tools", firstTool?.name || "Bring field kit", firstTool?.detail || "Confirm keyway, decode/cut path, OBD, and battery support."],
  ];
  return `
    <section class="job-kit-summary">
      <div class="job-kit-head">
        <div>
          <span>Job kit</span>
          <strong>${escapeHtml(jobKit.headline || "Vehicle job kit")}</strong>
          <p>${escapeHtml(jobKit.summary || "Keys, programmers, tools, and warnings for this lookup.")}</p>
        </div>
        <small>${escapeHtml(jobKit.confidence || "verify")}</small>
      </div>
      <div class="job-kit-cards">
        ${cards
          .map(
            ([label, title, detail]) => `
              <article>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(detail)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderJobKitDetail(jobKit) {
  if (!jobKit) return "";
  const renderItems = (items) =>
    (items || [])
      .slice(0, 8)
      .map(
        (item) => `
          <article>
            <span>${escapeHtml(item.role || item.confidence || "Verify")}</span>
            <strong>${escapeHtml(item.name || "Verify")}</strong>
            <p>${escapeHtml(item.detail || "Confirm before dispatch.")}</p>
          </article>
        `,
      )
      .join("");
  const renderList = (items) => (items || []).slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <section class="job-kit-detail">
      <div class="job-kit-head">
        <div>
          <span>What this job needs</span>
          <strong>${escapeHtml(jobKit.headline || "Vehicle job kit")}</strong>
        </div>
        <small>${escapeHtml(jobKit.confidence || "verify")}</small>
      </div>
      <div class="job-kit-lanes">
        <section>
          <h4>Keys</h4>
          <div>${renderItems(jobKit.keys)}</div>
        </section>
        <section>
          <h4>Programmers</h4>
          <div>${renderItems(jobKit.programmers)}</div>
        </section>
        <section>
          <h4>Tools</h4>
          <div>${renderItems(jobKit.tools)}</div>
        </section>
      </div>
      <div class="job-kit-checks">
        <article>
          <span>Verify before dispatch</span>
          <ul>${renderList(jobKit.verify)}</ul>
        </article>
        <article>
          <span>Warnings</span>
          <ul>${renderList(jobKit.warnings)}</ul>
        </article>
      </div>
    </section>
  `;
}

function renderVehicleDossier(profile) {
  const vehicle = profile.vehicle || {};
  const groups = profile.vehicleDecodeGroups || [];
  const fallbackGroups = [
    {
      title: "Vehicle details",
      facts: [
        { label: "Year", value: vehicle.year },
        { label: "Make", value: vehicle.make },
        { label: "Model", value: vehicle.model },
        { label: "Trim", value: vehicle.trim },
        { label: "Body", value: vehicle.bodyClass },
        { label: "Engine", value: vehicle.engine },
        { label: "Drive", value: vehicle.driveType },
        { label: "Plant", value: [vehicle.plantCity, vehicle.plantCountry].filter(Boolean).join(", ") },
      ].filter((fact) => fact.value),
    },
  ].filter((group) => group.facts.length);
  const usableGroups = groups.length ? groups : fallbackGroups;
  return `
    <div class="vehicle-dossier">
      ${usableGroups
        .map(
          (group) => `
            <section class="dossier-group">
              <div class="dossier-group-head">
                <span>${escapeHtml(group.title)}</span>
                <small>${escapeHtml(`${group.facts.length} fields`)}</small>
              </div>
              <div class="dossier-facts">
                ${group.facts
                  .map(
                    (fact) => `
                      <div class="dossier-fact">
                        <small>${escapeHtml(fact.label)}</small>
                        <strong>${escapeHtml(fact.value)}</strong>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderVerifiedProfileCard(profile) {
  if (!profile) return "";
  const baseline = profile.baselinePart || profile.verifiedParts?.[0] || null;
  const title = [profile.year, profile.make, profile.model, profile.trim].filter(Boolean).join(" ");
  const sourceList = baseline?.supplierOutcomes ? Object.values(baseline.supplierOutcomes) : [];
  return `
    <section class="verified-profile-card">
      <div>
        <span>Verified baseline</span>
        <strong>${escapeHtml(baseline ? [baseline.oem, baseline.fcc, baseline.buttons].filter(Boolean).join(" | ") || baseline.name : title)}</strong>
        <p>${escapeHtml(
          baseline
            ? [
                baseline.name,
                baseline.frequency,
                baseline.chip,
                sourceList.length
                  ? `Worked parts sources: ${sourceList.map((item, index) => `${catalogSourceLabelFromName(item.supplier || `source-${index}`)} x${item.workedCount}`).join(", ")}`
                  : baseline.suppliers?.length ? `${baseline.suppliers.length} parts source${baseline.suppliers.length === 1 ? "" : "s"} saved` : "",
              ]
                .filter(Boolean)
                .join(" | ")
            : "No worked part has been saved yet for this vehicle profile.",
        )}</p>
      </div>
      <small>${escapeHtml(`${profile.confidence || "learning"} | ${profile.verifiedParts?.length || 0} part${profile.verifiedParts?.length === 1 ? "" : "s"}`)}</small>
    </section>
  `;
}

function renderShopVerifiedPicks(offers) {
  const verifiedOffers = offers.filter((offer) => offer.profileMatch);
  if (!verifiedOffers.length) return "";
  const groups = exactPartGroups(verifiedOffers);
  const totalWorked = verifiedOffers.reduce((count, offer) => count + (offer.profileWorkedCount || 0), 0);
  return `
    <div class="shop-verified-picks">
      <div class="shop-verified-heading">
        <div>
          <p class="eyebrow">Shop verified first</p>
          <strong>Previously worked on this vehicle profile</strong>
          <span>These matches are boosted above parts guesses because someone marked the part worked.</span>
        </div>
        <small>${escapeHtml(`${groups.length} parts / ${totalWorked || verifiedOffers.length} worked`)}</small>
      </div>
      ${groups.map((group) => renderExactPartGroup({ ...group, focusMode: "verified", focusNote: "Shop-confirmed part. Compare parts fitment, stock, and condition before ordering." }, offers)).join("")}
    </div>
  `;
}

function resetVinWorkflow() {
  supplierLookupRequestId += 1;
  vinWorkflowStep = "entry";
  latestVinProfile = null;
  selectedKeyFamily = "";
  selectedKeyPackage = "";
  selectedPartChoiceKey = "";
  selectedProgrammerKey = "";
  Object.values(liveProductFilters).forEach((selected) => selected.clear());
  vinForm.reset();
  ymmForm?.reset();
  vinForm.classList.remove("is-hidden");
  ymmForm?.classList.remove("is-hidden");
  vinResult.innerHTML = "";
  vinRecommendation.innerHTML = `
    <strong>Parts source ready</strong>
    <p>Enter a VIN for identity first, or search year/make/model when the VIN cannot prove key package details.</p>
  `;
}

const keyPackageOptions = [
  {
    id: "push-start",
    title: "Proximity key",
    family: "proximity",
    note: "Smart key, prox, PEPS, push-to-start, and emergency insert references.",
  },
  {
    id: "turn-key",
    title: "Keyed ignition",
    family: "keyed",
    note: "Flip key, remote-head key, transponder key, switchblade, and blade references.",
  },
];

function selectedPackageOption() {
  return keyPackageOptions.find((option) => option.id === selectedKeyPackage) || null;
}

function applyKeyPackage(option) {
  if (!option) return;
  selectedKeyPackage = option.id;
  if (option.family) selectedKeyFamily = option.family;
  selectedPartChoiceKey = "";
  selectedProgrammerKey = "";
  Object.values(liveProductFilters).forEach((selected) => selected.clear());
  if (option.buttonFilter) {
    liveProductFilters.buttons.clear();
    liveProductFilters.buttons.add(option.buttonFilter);
  }
}

function renderLiveFilterGroup(label, group, products) {
  const options = liveFilterOptions(products, group);
  if (!options.length) return "";
  return `
    <details class="live-filter-group" ${group === "condition" || group === "stock" ? "open" : ""}>
      <summary>${label}</summary>
      <div>
        ${options
          .map(
            (option) => `
              <label class="filter-check">
                <input type="checkbox" data-live-filter="${group}" value="${escapeHtml(option.value)}" ${
                  liveProductFilters[group].has(option.value) ? "checked" : ""
                } />
                <span>${escapeHtml(option.value)} <small>${option.count}</small></span>
              </label>
            `,
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderLiveFilters(products, visibleProducts) {
  return `
    <div class="live-filter-panel">
      <div class="filter-toolbar">
        <div>
          <p class="eyebrow">Filter parts</p>
          <strong>${visibleProducts.length} of ${products.length} shown</strong>
        </div>
        <button class="secondary-action small" type="button" data-live-filter-clear>Clear</button>
      </div>
      ${renderLiveFilterGroup("Condition", "condition", products)}
      ${renderLiveFilterGroup("Stock", "stock", products)}
      ${renderLiveFilterGroup("Part Style", "type", products)}
      ${renderLiveFilterGroup("Buttons", "buttons", products)}
      ${renderLiveFilterGroup("Parts Source", "supplier", products)}
    </div>
  `;
}

function productBadges(product, index) {
  const badges = [];
  if (index === 0) badges.push("Best match");
  if (product.keyInfo?.condition) badges.push(product.keyInfo.condition);
  if (product.keyInfo?.stock && product.keyInfo.stock !== "Verify") badges.push(product.keyInfo.stock);
  if (product.keyInfo?.fcc) badges.push("FCC");
  if (product.keyInfo?.crossReference) badges.push("Cross-ref");
  if (product.keyInfo?.buttons) badges.push(`${product.keyInfo.buttons} button`);
  return badges.slice(0, 5);
}

function normalizePrice(value) {
  const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function buttonCountFromText(value) {
  const text = String(value || "");
  const match =
    text.match(/\b([2-7])\s*(?:button|buttons|btn|btns)\b/i) ||
    text.match(/\b([2-7])[-\s]*(?:button|buttons|btn|btns)\b/i) ||
    text.match(/\b([2-7])\s*b\b/i) ||
    text.match(/\b(?:button|buttons|btn|btns)[:\s-]*([2-7])\b/i);
  return match ? match[1] : "";
}

function normalizedSupplierOffer(product) {
  const buttons = product.keyInfo?.buttons || buttonCountFromText(product.name);
  return {
    supplier: product.supplier || "Key Innovations",
    partName: product.name || "Parts reference",
    sku: product.keyInfo?.sku || "",
    oem: product.keyInfo?.oem || "",
    fcc: product.keyInfo?.fcc || "",
    condition: product.keyInfo?.condition || "Verify",
    stock: product.keyInfo?.stock || "Verify",
    price: product.price || "",
    priceFormatted: product.priceFormatted || "",
    priceValue: normalizePrice(product.price),
    listPrice: product.listPrice || "",
    listPriceFormatted: product.listPriceFormatted || "",
    listPriceValue: normalizePrice(product.listPrice),
    image: product.image || "",
    productUrl: product.url || "",
    productType: product.keyInfo?.productType || "Verify",
    buttons,
    chip: product.keyInfo?.chip || "",
    frequency: product.keyInfo?.frequency || "",
    fitment: product.keyInfo?.fitment || product.fitmentLines?.[0] || "",
    crossReference: product.keyInfo?.crossReference || "",
    crossReferenceOe: product.keyInfo?.crossReferenceOe || "",
    crossReferenceAliases: product.keyInfo?.crossReferenceAliases || "",
    shopMatch: product.keyInfo?.shopMatch || "",
    shopWarning: product.keyInfo?.shopWarning || "",
    profileMatch: product.keyInfo?.profileMatch || "",
    profileWorkedCount: Number(product.keyInfo?.profileWorkedCount || 0),
    profileSuppliers: Array.isArray(product.keyInfo?.profileSuppliers) ? product.keyInfo.profileSuppliers : [],
    profileWarning: product.keyInfo?.profileWarning || "",
    selectionRank: product.selection?.rank || product.keyInfo?.selectionRank || "",
    selectionScore: Number.isFinite(Number(product.selection?.score ?? product.keyInfo?.selectionScore))
      ? Number(product.selection?.score ?? product.keyInfo?.selectionScore)
      : null,
    selectionFamily: product.selection?.family || product.keyInfo?.selectionFamily || "",
    selectionExpected: product.selection?.expectedFamily || "",
    selectionExpectedSource: product.selection?.expectedSource || "",
    selectionReasons: Array.isArray(product.selection?.reasons) ? product.selection.reasons : [],
    selectionWarnings: Array.isArray(product.selection?.warnings) ? product.selection.warnings : [],
    selectionMissing: Array.isArray(product.selection?.missing) ? product.selection.missing : [],
    fitmentConfidence: product.source?.includes("exact") ? "Exact fitment" : "Verify fitment",
    rawProduct: product,
  };
}

function identityParts(offer) {
  const primary = offer.fcc || offer.oem || offer.sku || offer.partName;
  return String(primary || "Unknown part")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function partNumberTokens(value) {
  const text = String(value || "").toUpperCase();
  const tokens = [];
  for (const match of text.matchAll(/\b\d{3}-R\d{4}R?\b/g)) {
    tokens.push(match[0].replace(/[^A-Z0-9]/g, "").replace(/R$/, ""));
  }
  for (const match of text.matchAll(/\b[A-Z]{2,5}-?R?\d{3,5}\b/g)) {
    tokens.push(match[0].replace(/[^A-Z0-9]/g, "").replace(/R$/, ""));
  }
  return [...new Set(tokens.filter((token) => token.length >= 5))];
}

function fccToken(value) {
  const text = String(value || "").toUpperCase();
  const match = text.match(/\b[A-Z][A-Z0-9]{2,}-[A-Z0-9]{3,}\b/);
  return match ? match[0].replace(/[^A-Z0-9]/g, "") : "";
}

function exactPartKey(offer) {
  const fcc = fccToken([offer.fcc, offer.partName].filter(Boolean).join(" "));
  if (fcc) return `fcc:${fcc}:buttons:${String(offer.buttons || "unknown").toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
  const oemTokens = partNumberTokens([offer.oem, offer.partName].filter(Boolean).join(" "));
  if (oemTokens.length) return `oem:${oemTokens[0]}`;
  const skuTokens = partNumberTokens([offer.sku, offer.partName].filter(Boolean).join(" "));
  if (skuTokens.length) return `sku:${skuTokens[0]}`;
  return `single:${offerIdentityKey(offer)}`;
}

function exactPartLabel(group) {
  const best = group.bestOffer || group.offers[0];
  const parts = partNumberTokens([best.oem, best.sku, best.partName].filter(Boolean).join(" "));
  if (parts.length) return parts[0].replace(/^(\d{3})R/, "$1-R");
  return best.fcc || best.oem || best.sku || best.partName;
}

function compareScore(offer, index) {
  let score = 0;
  if (index === 0) score += 15;
  if (offer.fitmentConfidence === "Exact fitment") score += 30;
  if (/^In stock/i.test(offer.stock)) score += 25;
  if (offer.fcc) score += 15;
  if (offer.condition && !/verify/i.test(offer.condition)) score += 10;
  if (offer.priceValue) score += 5;
  if (offer.selectionScore !== null) score = Math.max(score, offer.selectionScore);
  return score;
}

function offerIsInStock(offer) {
  return /^In stock/i.test(offer.stock || "");
}

function selectionRankWeight(rank) {
  return { Recommended: 4, Possible: 3, "Verify carefully": 2, "Reference only": 1 }[rank] || 0;
}

function sortSupplierOffers(products) {
  return products
    .map((product, index) => {
      const offer = normalizedSupplierOffer(product);
      offer.score = compareScore(offer, index);
      return offer;
    })
    .sort((a, b) => {
      if (selectionRankWeight(b.selectionRank) !== selectionRankWeight(a.selectionRank)) {
        return selectionRankWeight(b.selectionRank) - selectionRankWeight(a.selectionRank);
      }
      if (Boolean(b.shopMatch) !== Boolean(a.shopMatch)) return b.shopMatch ? 1 : -1;
      if (offerIsInStock(b) !== offerIsInStock(a)) return offerIsInStock(b) ? 1 : -1;
      if ((b.selectionScore ?? -1) !== (a.selectionScore ?? -1)) return (b.selectionScore ?? -1) - (a.selectionScore ?? -1);
      return (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity) || a.supplier.localeCompare(b.supplier) || b.score - a.score;
    });
}

function groupSupplierOffers(products) {
  const groups = new Map();
  products.forEach((product, index) => {
    const offer = normalizedSupplierOffer(product);
    offer.score = compareScore(offer, index);
    const key = identityParts(offer);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: offer.fcc || offer.oem || offer.partName,
        image: offer.image,
        offers: [],
      });
    }
    const group = groups.get(key);
    if (!group.image && offer.image) group.image = offer.image;
    group.offers.push(offer);
  });

  return Array.from(groups.values())
    .map((group) => {
      group.offers.sort((a, b) => {
        if (offerIsInStock(b) !== offerIsInStock(a)) return offerIsInStock(b) ? 1 : -1;
        return (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity) || b.score - a.score;
      });
      group.bestOffer = group.offers[0];
      group.image = group.bestOffer?.image || group.image || group.offers.find((offer) => offer.image)?.image || "";
      group.lowestInStock = group.offers
        .filter((offer) => offerIsInStock(offer) && offer.priceValue)
        .sort((a, b) => a.priceValue - b.priceValue)[0];
      group.inStockCount = group.offers.filter(offerIsInStock).length;
      return group;
    })
    .sort((a, b) => {
      if ((b.inStockCount > 0) !== (a.inStockCount > 0)) return b.inStockCount > 0 ? 1 : -1;
      return b.bestOffer.score - a.bestOffer.score;
    });
}

function buildExactPartGroup(key, offers, options = {}) {
  const group = {
    key,
    offers: [...offers],
    focusMode: options.focusMode || "",
    focusNote: options.focusNote || "",
    originalOfferCount: options.originalOfferCount || offers.length,
  };
  group.offers.sort((a, b) => {
    if (isKeyInnovationsGradeA(b) !== isKeyInnovationsGradeA(a)) return isKeyInnovationsGradeA(b) ? 1 : -1;
    if (selectionRankWeight(b.selectionRank) !== selectionRankWeight(a.selectionRank)) {
      return selectionRankWeight(b.selectionRank) - selectionRankWeight(a.selectionRank);
    }
    if (offerIsInStock(b) !== offerIsInStock(a)) return offerIsInStock(b) ? 1 : -1;
    return (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity) || a.supplier.localeCompare(b.supplier);
  });
  group.bestOffer = group.offers[0];
  group.imageOffer = group.offers.find((offer) => offer.image) || group.bestOffer;
  group.image = group.imageOffer?.image || "";
  group.label = exactPartLabel(group);
  group.supplierCount = new Set(group.offers.map((offer) => offer.supplier)).size;
  group.conditions = [...new Set(group.offers.map((offer) => offer.condition && offer.condition !== "Verify" ? offer.condition : conditionBucket(offer.rawProduct)).filter(Boolean))];
  group.fccs = [...new Set(group.offers.map((offer) => offer.fcc).filter(Boolean))];
  group.frequencies = [...new Set(group.offers.map((offer) => offer.frequency).filter(Boolean))];
  group.buttons = [...new Set(group.offers.map((offer) => offer.buttons).filter(Boolean))];
  group.buttonLayouts = [...new Set(group.offers.map((offer) => buttonLayoutBucket(offer.rawProduct)).filter(Boolean))];
  group.lowestPrice = group.offers
    .filter((offer) => offer.priceValue)
    .sort((a, b) => a.priceValue - b.priceValue)[0];
  group.inStockCount = group.offers.filter(offerIsInStock).length;
  group.lane = partLane(group.bestOffer);
  group.agreementScore = Math.min(100, 35 + group.supplierCount * 15 + group.inStockCount * 5 + (group.fccs.length ? 10 : 0) + (group.buttons.length ? 5 : 0));
  return group;
}

function exactPartGroups(offers) {
  const groups = new Map();
  offers.forEach((offer) => {
    const key = exactPartKey(offer);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        offers: [],
      });
    }
    groups.get(key).offers.push(offer);
  });

  return Array.from(groups.values())
    .map((group) => buildExactPartGroup(group.key, group.offers))
    .sort((a, b) => {
      if (selectionRankWeight(b.bestOffer.selectionRank) !== selectionRankWeight(a.bestOffer.selectionRank)) {
        return selectionRankWeight(b.bestOffer.selectionRank) - selectionRankWeight(a.bestOffer.selectionRank);
      }
      if ((b.supplierCount > 1) !== (a.supplierCount > 1)) return b.supplierCount > 1 ? 1 : -1;
      if (b.inStockCount !== a.inStockCount) return b.inStockCount - a.inStockCount;
      return (a.lowestPrice?.priceValue ?? Infinity) - (b.lowestPrice?.priceValue ?? Infinity);
    });
}

function visualPartChoiceKey(group) {
  const best = group.bestOffer || group.offers[0];
  const family = productKeyFamily(best.rawProduct);
  const type = partTypeBucket(best.rawProduct);
  const layout = buttonLayoutBucket(best.rawProduct);
  const text = [best.partName, best.productType, best.buttons, best.chip].filter(Boolean).join(" ").toLowerCase();
  const style =
    /prox|proximity|smart|peps|push/.test(text) || type === "Proximity / smart"
      ? "proximity"
      : /flip|remote head|switchblade/.test(text) || type === "Flip / remote head"
        ? "flip-remote"
        : /transponder/.test(text) || type === "Transponder key"
          ? "transponder"
          : "key";
  const normalizedLayout = String(layout || "unknown")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const layoutUnknown = !normalizedLayout || normalizedLayout === "BUTTON-LAYOUT-UNKNOWN";
  const unknownIdentity = layoutUnknown
    ? String([best.fcc, best.oem, best.sku, best.partName, best.image].filter(Boolean).join(" "))
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90)
    : "";
  return `visual:${family}:${style}:${normalizedLayout || "UNKNOWN"}${unknownIdentity ? `:${unknownIdentity}` : ""}`;
}

function visualPartChoiceGroups(offers) {
  const merged = new Map();
  offers.filter((offer) => isDisplayKeyProduct(offer.rawProduct)).forEach((offer) => {
    const key = visualPartChoiceKey({ bestOffer: offer, offers: [offer], key: offerIdentityKey(offer) });
    if (!merged.has(key)) merged.set(key, []);
    merged.get(key).push(offer);
  });

  return Array.from(merged.entries())
    .map(([key, groupOffers]) => buildExactPartGroup(key, groupOffers))
    .sort((a, b) => {
      if (selectionRankWeight(b.bestOffer.selectionRank) !== selectionRankWeight(a.bestOffer.selectionRank)) {
        return selectionRankWeight(b.bestOffer.selectionRank) - selectionRankWeight(a.bestOffer.selectionRank);
      }
      if (b.inStockCount !== a.inStockCount) return b.inStockCount - a.inStockCount;
      return (a.lowestPrice?.priceValue ?? Infinity) - (b.lowestPrice?.priceValue ?? Infinity);
    });
}

function conditionTextForOffer(offer) {
  return [offer.condition, offer.partName, offer.rawProduct?.keyInfo?.condition, offer.rawProduct?.condition].filter(Boolean).join(" ").toLowerCase();
}

function isKeyInnovationsGradeA(offer) {
  const supplier = String(offer.supplier || "").toLowerCase();
  const text = conditionTextForOffer(offer);
  return supplier.includes("key innovations") && /refurbished[\s,/-]*grade\s*a|grade\s*a/.test(text);
}

function isGradeAEquivalentCondition(offer) {
  const text = conditionTextForOffer(offer);
  return /refurbished[\s,/-]*grade\s*a|grade\s*a|refurb|recondition|recase|used|renewed|remanufactured/.test(text);
}

function gradeABaselineGroups(offers) {
  return exactPartGroups(offers)
    .filter((group) => group.offers.some(isKeyInnovationsGradeA))
    .map((group) => {
      const equivalentCount = group.offers.filter((offer) => offer.supplier !== "Key Innovations" && isGradeAEquivalentCondition(offer)).length;
      const summary = buildExactPartGroup(group.key, group.offers, {
        focusMode: "grade-a",
        focusNote: equivalentCount
          ? "Showing every exact parts match for this Grade A option, with refurbished/equivalent offers included."
          : "Showing every exact parts match for this Grade A option. Verify condition when another parts source does not publish it.",
        originalOfferCount: group.offers.length,
      });
      summary.lane = "grade-a";
      return summary;
    });
}

function supplierCounts(products) {
  return products.reduce((counts, product) => {
    const supplier = product.supplier || "Key Innovations";
    counts[supplier] = (counts[supplier] || 0) + 1;
    return counts;
  }, {});
}

function renderOfferBadges(offer) {
  const condition = conditionBucket(offer.rawProduct);
  const stock = stockBucket(offer.rawProduct);
  const type = partTypeBucket(offer.rawProduct);
  return [
    offer.selectionRank,
    offer.fitmentConfidence,
    stock !== "Stock unknown" ? stock : "",
    condition !== "Unlisted" ? condition : "",
    type !== "Other key item" ? type : "",
    offer.fcc ? "FCC" : "",
    offer.buttons ? `${offer.buttons} button` : "",
  ]
    .filter(Boolean)
    .slice(0, 5)
    .map((badge) => `<span>${escapeHtml(badge)}</span>`)
    .join("");
}

function selectionClassName(rank) {
  return String(rank || "verify")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function confidenceLabel(rank) {
  return {
    Recommended: "Strong match",
    Possible: "Good candidate",
    "Verify carefully": "Verify before ordering",
    "Reference only": "Reference only",
  }[rank] || "Verify before ordering";
}

function renderSelectionEngine(offer) {
  const rank = offer.selectionRank || "Verify carefully";
  const reasons = offer.selectionReasons.length ? offer.selectionReasons : ["No strong part evidence yet"];
  const missing = offer.selectionMissing.length ? offer.selectionMissing : [];
  const warnings = offer.selectionWarnings.length ? offer.selectionWarnings : [];
  return `
    <div class="selection-engine ${escapeHtml(selectionClassName(rank))}">
      <div>
        <span>${escapeHtml(confidenceLabel(rank))}</span>
        <strong>${offer.selectionScore !== null ? `${offer.selectionScore}/100` : "Score pending"}</strong>
      </div>
      <p>${escapeHtml(reasons.filter(Boolean).slice(0, 3).join(" + "))}</p>
      ${
        missing.length || warnings.length
          ? `<small>${escapeHtml(
              [
                missing.length ? `Verify: ${missing.slice(0, 3).join(", ")}` : "",
                warnings.length ? warnings.slice(0, 2).join("; ") : "",
              ]
                .filter(Boolean)
                .join(" | "),
            )}</small>`
          : ""
      }
      ${offer.selectionExpected ? `<small>Expected ${escapeHtml(offer.selectionExpected)}${offer.selectionExpectedSource ? ` from ${escapeHtml(offer.selectionExpectedSource)}` : ""}</small>` : ""}
    </div>
  `;
}

function partLane(offer) {
  const type = partTypeBucket(offer.rawProduct);
  if (/Insert|Tools/.test(type)) return "supporting";
  if (/Proximity/.test(type) || offer.selectionFamily === "proximity") return "main";
  if (/Flip|Transponder/.test(type) || ["remote-head", "transponder"].includes(offer.selectionFamily)) return "main";
  return offer.selectionRank === "Reference only" ? "reference" : "main";
}

function laneLabel(lane) {
  return {
    main: "Main key candidates",
    supporting: "Blades, tools, and supporting items",
    reference: "Reference / verify only",
  }[lane];
}

function offerIdentityKey(offer) {
  return String([offer.supplier, offer.sku, offer.oem, offer.fcc, offer.partName].filter(Boolean).join("|"))
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function alternatesForOffer(offer, offers) {
  const directKeys = [offer.fcc, offer.oem, offer.sku].filter(Boolean).map((item) => String(item).toUpperCase());
  const keys = directKeys.length
    ? directKeys
    : [offer.selectionFamily && offer.selectionFamily !== "unknown" ? offer.selectionFamily : ""].filter(Boolean).map((item) => String(item).toUpperCase());
  return offers
    .filter((candidate) => candidate !== offer)
    .filter((candidate) => {
      const text = [candidate.fcc, candidate.oem, candidate.selectionFamily, candidate.partName].filter(Boolean).join(" ").toUpperCase();
      return keys.some((key) => key && text.includes(key));
    })
    .slice(0, 3);
}

function renderPartDetail(offer, alternates) {
  const rows = [
    ["Parts source", catalogSourceLabelFromName(offer.supplier)],
    ["SKU", offer.sku],
    ["OEM / item", offer.oem],
    ["FCC", offer.fcc],
    ["Frequency", offer.frequency],
    ["Chip", offer.chip],
    ["Buttons", offer.buttons],
    ["Fitment", offer.fitment],
    ["Condition", offer.condition],
    ["Stock", offer.stock],
  ].filter(([, value]) => value);
  return `
    <details class="part-detail">
      <summary>More info</summary>
      <div class="part-detail-grid">
        ${rows
          .map(
            ([label, value]) => `
              <span>
                <small>${escapeHtml(label)}</small>
                <strong>${escapeHtml(value)}</strong>
              </span>
            `,
          )
          .join("")}
      </div>
      <div class="detail-notes">
        <p><strong>Why:</strong> ${escapeHtml((offer.selectionReasons || []).join(" | ") || "No strong evidence yet")}</p>
        <p><strong>Verify:</strong> ${escapeHtml([...(offer.selectionMissing || []), ...(offer.selectionWarnings || [])].join(" | ") || "No extra warnings")}</p>
        ${
          alternates.length
            ? `<p><strong>Known alternates:</strong> ${escapeHtml(alternates.map((item) => `${catalogSourceLabelFromName(item.supplier)} ${item.priceFormatted || item.price || ""}`.trim()).join(" | "))}</p>`
            : ""
        }
        <div class="feedback-grid" data-feedback-group="${escapeHtml(offerIdentityKey(offer))}">
          <button class="secondary-action small good" type="button" data-part-feedback="worked" data-part-id="${escapeHtml(offerIdentityKey(offer))}">Worked</button>
          <button class="secondary-action small" type="button" data-part-feedback="failed-program" data-part-id="${escapeHtml(offerIdentityKey(offer))}">Did not program</button>
          <button class="secondary-action small" type="button" data-part-feedback="wrong-fcc" data-part-id="${escapeHtml(offerIdentityKey(offer))}">Wrong FCC</button>
          <button class="secondary-action small" type="button" data-part-feedback="wrong-buttons" data-part-id="${escapeHtml(offerIdentityKey(offer))}">Wrong buttons</button>
          <button class="secondary-action small" type="button" data-part-feedback="ordered-alternate" data-part-id="${escapeHtml(offerIdentityKey(offer))}">Ordered alternate</button>
          <button class="secondary-action small" type="button" data-part-feedback="different-key-style" data-part-id="${escapeHtml(offerIdentityKey(offer))}">Different style</button>
        </div>
      </div>
    </details>
  `;
}

function renderOfferRow(offer, offers) {
  const alternates = alternatesForOffer(offer, offers);
  return `
    <div class="offer-row direct-offer ${offer.stock === "Out of stock" ? "out-of-stock" : ""}">
      ${renderOfferThumb(offer)}
      <div>
        <strong>${escapeHtml(offer.partName)}</strong>
        <p>${escapeHtml(catalogSourceLabelFromName(offer.supplier))}</p>
        <p>${escapeHtml([offer.sku, offer.oem, offer.fcc, offer.productType].filter(Boolean).join(" - ") || "Verify identifiers")}</p>
        ${renderSelectionEngine(offer)}
        ${renderOfferReference(offer)}
        ${alternates.length ? `<p class="alternate-note">${escapeHtml(`${alternates.length} related alternate${alternates.length === 1 ? "" : "s"} found`)}</p>` : ""}
        <div class="badge-row">${renderOfferBadges(offer)}</div>
        ${renderPartDetail(offer, alternates)}
      </div>
      <div class="offer-actions">
        ${renderOfferPrice(offer)}
        ${offer.productUrl ? `<a href="${escapeHtml(offer.productUrl)}" target="_blank" rel="noreferrer">Open</a>` : ""}
      </div>
    </div>
  `;
}

function renderSupplierComparisonTab(offer, groupOffers) {
  const alternates = alternatesForOffer(offer, groupOffers);
  const condition = offer.condition && offer.condition !== "Verify" ? offer.condition : conditionBucket(offer.rawProduct);
  const stock = stockBucket(offer.rawProduct);
  return `
    <article class="supplier-part-tab ${offerIsInStock(offer) ? "in-stock" : "not-in-stock"}">
      <div class="supplier-tab-head">
        <strong>${escapeHtml(catalogSourceLabelFromName(offer.supplier))}</strong>
        <span>${escapeHtml(confidenceLabel(offer.selectionRank))}</span>
      </div>
      <div class="supplier-tab-body">
        ${renderOfferThumb(offer)}
        <div>
          ${renderOfferPrice(offer)}
          <p>${escapeHtml([condition, stock, offer.buttons].filter(Boolean).join(" | "))}</p>
          <p>${escapeHtml([offer.sku, offer.oem, offer.fcc].filter(Boolean).join(" - ") || "Verify identifiers")}</p>
        </div>
      </div>
      <div class="supplier-tab-meta">
        <span><small>Condition</small><strong>${escapeHtml(condition || "Verify")}</strong></span>
        <span><small>Stock</small><strong>${escapeHtml(offer.stock || stock || "Verify")}</strong></span>
        <span><small>Price</small><strong>${escapeHtml(offer.priceValue ? `$${offer.priceValue.toFixed(2)}` : offer.priceFormatted || "Check")}</strong></span>
        <span><small>Score</small><strong>${escapeHtml(offer.selectionScore !== null ? `${offer.selectionScore}/100` : "Pending")}</strong></span>
      </div>
      <div class="supplier-tab-actions" data-feedback-group="${escapeHtml(offerIdentityKey(offer))}">
        <button class="secondary-action small good" type="button" data-part-feedback="worked" data-part-id="${escapeHtml(offerIdentityKey(offer))}">
          ${offer.profileMatch ? "Worked again" : "Mark worked"}
        </button>
        <button class="secondary-action small" type="button" data-save-job-part="${escapeHtml(offerIdentityKey(offer))}">Save job</button>
        ${offer.productUrl ? `<a class="supplier-tab-link" href="${escapeHtml(offer.productUrl)}" target="_blank" rel="noreferrer">Open parts page</a>` : ""}
      </div>
      <details class="supplier-tab-detail">
        <summary>Details</summary>
        ${renderSelectionEngine(offer)}
        ${renderOfferReference(offer)}
        ${renderPartDetail(offer, alternates)}
      </details>
    </article>
  `;
}

function supplierLabel(offer) {
  if (!offer) return "None";
  return [catalogSourceLabelFromName(offer.supplier), offer.priceValue ? `$${offer.priceValue.toFixed(2)}` : offer.priceFormatted || "", offer.stock].filter(Boolean).join(" - ");
}

function offerRiskFlags(offer) {
  return [
    offer.stock === "Out of stock" ? "out of stock" : "",
    !offer.fcc ? "FCC missing" : "",
    !offer.buttons ? "buttons missing" : "",
    ...(offer.selectionWarnings || []),
    ...(offer.selectionMissing || []).map((item) => `verify ${item}`),
  ].filter(Boolean);
}

function groupDecision(group) {
  const gradeA = group.offers.find(isKeyInnovationsGradeA);
  const inStock = group.offers.filter(offerIsInStock);
  const priced = group.offers.filter((offer) => offer.priceValue);
  const acceptable = group.offers.filter((offer) => offer.selectionRank !== "Reference only" && !offer.profileWarning && !offer.shopWarning);
  const cheapestAcceptable = (acceptable.length ? acceptable : priced).filter((offer) => offer.priceValue).sort((a, b) => a.priceValue - b.priceValue)[0];
  const bestInStock = (inStock.length ? inStock : group.offers).sort((a, b) => {
    if (selectionRankWeight(b.selectionRank) !== selectionRankWeight(a.selectionRank)) return selectionRankWeight(b.selectionRank) - selectionRankWeight(a.selectionRank);
    return (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity);
  })[0];
  const bestFieldPick = group.focusMode === "grade-a" ? gradeA || group.bestOffer : gradeA || bestInStock || group.bestOffer;
  const valueOption = group.focusMode === "grade-a" ? gradeA || cheapestAcceptable || group.bestOffer : cheapestAcceptable || gradeA || group.bestOffer;
  const supplierCheck = group.offers.find((offer) => offer !== valueOption && offerIsInStock(offer)) || group.offers.find((offer) => offer !== valueOption) || bestInStock;
  const conditions = group.conditions.length ? group.conditions.join(" / ") : "condition verify";
  const why = [
    group.focusMode === "grade-a" ? "Refurbished Grade A baseline" : "",
    group.supplierCount > 1 ? `${group.supplierCount} parts sources match` : "single parts source match",
    group.fccs.length ? `FCC ${group.fccs[0]}` : "",
    group.buttons.length ? `${group.buttons[0]} button` : "",
    gradeA && group.focusMode !== "grade-a" ? "Grade A available" : "",
  ].filter(Boolean);
  const verify = [
    group.fccs.length ? "" : "FCC",
    group.buttons.length ? "" : "button layout",
    group.frequencies.length ? "" : "frequency",
    conditions.toLowerCase().includes("verify") ? "condition" : "",
    group.inStockCount ? "" : "availability",
  ].filter(Boolean);
  const risks = [...new Set(group.offers.flatMap(offerRiskFlags))].slice(0, 4);
  return {
    bestFieldPick,
    valueOption,
    supplierCheck,
    bestInStock,
    conditions,
    why,
    verify,
    risks,
  };
}

function renderDecisionCard(group) {
  const decision = groupDecision(group);
  const gradeAFocus = group.focusMode === "grade-a";
  return `
    <div class="part-decision-card">
      <div class="decision-main">
        <span>${gradeAFocus ? "Start here" : "Best field pick"}</span>
        <strong>${escapeHtml(decision.bestFieldPick?.partName || group.bestOffer.partName)}</strong>
        <p>${escapeHtml(decision.why.join(" + ") || "Best available parts/ranking match.")}</p>
      </div>
      <div class="decision-grid">
        <span><small>${gradeAFocus ? "Grade A option" : "Value option"}</small><strong>${escapeHtml(supplierLabel(decision.valueOption))}</strong></span>
        <span><small>${gradeAFocus ? "Other parts check" : "Best in stock"}</small><strong>${escapeHtml(supplierLabel(gradeAFocus ? decision.supplierCheck : decision.bestInStock))}</strong></span>
        <span><small>Condition spread</small><strong>${escapeHtml(decision.conditions)}</strong></span>
        <span><small>Verify</small><strong>${escapeHtml(decision.verify.length ? decision.verify.join(", ") : "photo + blade before ordering")}</strong></span>
      </div>
      ${decision.risks.length ? `<p class="decision-risks">${escapeHtml(`Risk flags: ${decision.risks.join(" | ")}`)}</p>` : ""}
    </div>
  `;
}

function renderExactPartGroup(group, allOffers) {
  const best = group.bestOffer;
  const sourceCountLabel = `${group.supplierCount} parts source${group.supplierCount === 1 ? "" : "s"}`;
  const headerDetails = [
    group.label,
    group.fccs[0],
    group.buttons[0],
    group.frequencies[0],
    best.productType,
  ].filter(Boolean);
  const identifiers = headerDetails.join(" | ");
  const agreementLabel =
    group.focusMode === "grade-a"
        ? "Grade A baseline"
        : group.supplierCount >= 3
        ? "Strong parts agreement"
        : group.supplierCount === 2
          ? "Parts agreement"
          : "Single-source match";
  const className = ["exact-part-group", group.supplierCount > 1 ? "multi-supplier" : "", group.focusMode === "grade-a" ? "grade-a-focus" : "", group.focusMode === "verified" ? "verified-focus" : ""]
    .filter(Boolean)
    .join(" ");
  return `
    <section class="${escapeHtml(className)}">
      <div class="exact-group-head">
        <div>
          <span>${escapeHtml(agreementLabel)}</span>
          <strong>${escapeHtml(identifiers || best.partName)}</strong>
          <p>${escapeHtml(group.focusNote || (group.conditions.length ? `Conditions: ${group.conditions.join(" / ")}` : best.partName))}</p>
        </div>
        <div class="exact-group-summary">
          <strong>${escapeHtml(group.lowestPrice?.priceValue ? `$${group.lowestPrice.priceValue.toFixed(2)}` : "Check")}</strong>
          <span>${escapeHtml(`${sourceCountLabel} | ${group.agreementScore}%`)}</span>
        </div>
      </div>
      <div class="agreement-strip">
        <span>${escapeHtml(`${sourceCountLabel} agree`)}</span>
        <span>${escapeHtml(`${group.inStockCount} in stock`)}</span>
        <span>${escapeHtml(group.conditions.length ? group.conditions.join(" / ") : "Condition verify")}</span>
        ${group.focusMode === "verified" ? `<span>${escapeHtml(`${group.offers.reduce((count, offer) => count + (offer.profileWorkedCount || 0), 0) || group.offers.length} worked`)}</span>` : ""}
        ${group.focusMode === "grade-a" ? `<span>${escapeHtml(`${group.offers.length} Grade A/equivalent offers`)}</span>` : ""}
      </div>
      ${renderDecisionCard(group)}
      <div class="exact-supplier-tabs" aria-label="${escapeHtml(`${group.label} parts comparison`)}">
        ${group.offers.map((offer) => renderSupplierComparisonTab(offer, allOffers)).join("")}
      </div>
    </section>
  `;
}

function renderLaneGroups(groups, offers) {
  const lanes = ["main", "supporting", "reference"];
  return lanes
    .map((lane) => {
      const laneGroups = groups.filter((group) => group.lane === lane);
      if (!laneGroups.length) return "";
      const itemCount = laneGroups.reduce((count, group) => count + group.offers.length, 0);
      return `
        <div class="offer-lane">
          <div class="offer-lane-heading">
            <strong>${escapeHtml(laneLabel(lane))}</strong>
            <span>${laneGroups.length} parts / ${itemCount} offers</span>
          </div>
          ${laneGroups.map((group) => renderExactPartGroup(group, offers)).join("")}
        </div>
      `;
    })
    .join("");
}

function renderGradeABaseline(offers) {
  const gradeAGroups = gradeABaselineGroups(offers);
  if (!gradeAGroups.length) return "";
  const totalOffers = gradeAGroups.reduce((count, group) => count + group.offers.length, 0);
  return `
    <div class="grade-a-baseline">
      <div class="grade-a-heading">
        <div>
          <p class="eyebrow">Initial locksmith pick</p>
          <strong>Refurbished Grade A baseline</strong>
          <span>All Grade A options are shown first, including out-of-stock parts, with equivalent-condition matches from other parts sources.</span>
        </div>
        <small>${escapeHtml(`${gradeAGroups.length} parts / ${totalOffers} offers`)}</small>
      </div>
      ${gradeAGroups.map((group) => renderExactPartGroup(group, offers)).join("")}
    </div>
  `;
}

function renderOfferLanes(offers, baselineOffers = offers) {
  const gradeAGroups = gradeABaselineGroups(baselineOffers);
  const gradeAKeys = new Set(gradeAGroups.map((group) => group.key));
  const verifiedGroups = exactPartGroups(offers.filter((offer) => offer.profileMatch));
  const verifiedKeys = new Set(verifiedGroups.map((group) => group.key));
  const secondaryGroups = exactPartGroups(offers).filter((group) => !gradeAKeys.has(group.key) && !verifiedKeys.has(group.key));
  const secondaryMarkup = renderLaneGroups(secondaryGroups, offers);
  const verifiedMarkup = renderShopVerifiedPicks(offers);
  const baselineMarkup = renderGradeABaseline(baselineOffers);
  if (!baselineMarkup && !verifiedMarkup) return secondaryMarkup;
  return `
    ${baselineMarkup}
    ${verifiedMarkup}
    ${
      secondaryMarkup
        ? `<details class="secondary-results">
            <summary>Other filtered matches</summary>
            ${secondaryMarkup}
          </details>`
        : ""
    }
  `;
}

function renderPartChoiceCard(group) {
  const offer = group.bestOffer;
  const imageOffer = group.imageOffer || group.offers.find((item) => item.image) || offer;
  const chosen = selectedPartChoiceKey === group.key;
  const buttonLabel = group.buttonLayouts?.[0] || (group.buttons[0] ? `${group.buttons[0]} button` : buttonLayoutBucket(offer.rawProduct));
  const typeLabel = partTypeBucket(offer.rawProduct);
  return `
    <button class="part-choice-card ${chosen ? "active" : ""}" type="button" data-select-part-choice="${escapeHtml(group.key)}">
      <div class="part-choice-image">
        ${
          imageOffer.image
            ? renderOfferThumb(imageOffer, group.label)
            : renderKeyImageFallback(buttonLabel, typeLabel)
        }
      </div>
      <div class="part-choice-copy">
        <span>${escapeHtml(typeLabel)}</span>
        <strong>${escapeHtml(buttonLabel || "Button layout verify")}</strong>
      </div>
      <div class="part-choice-footer">
        <span>${escapeHtml(typeLabel)}</span>
      </div>
    </button>
  `;
}

function renderPartChoiceBoard(lookup, products) {
  if (!lookup) return "";
  if (!products.length) return renderLiveSupplierProducts(lookup, products);
  const offers = sortSupplierOffers(products.filter(productPassesLiveFilters));
  const groups = visualPartChoiceGroups(offers);

  return `
    <section class="part-choice-flow">
      <div class="part-choice-toolbar">
        <div>
          <p class="eyebrow">Part choices</p>
          <h3>${escapeHtml(`${groups.length} visual choices`)}</h3>
          <p>${escapeHtml("Pick the visible key/button layout. Hardware, Lishi tools, chips, springs, shells, and duplicate button layouts are filtered out here.")}</p>
        </div>
      </div>
      <div class="part-choice-grid">
        ${
          groups.length
            ? groups.map(renderPartChoiceCard).join("")
            : `<article class="assistant-card"><strong>No part choices match those filters</strong><p>Clear a filter or go back to choose a broader key family.</p></article>`
        }
      </div>
    </section>
  `;
}

function selectedVisualPartGroup(profile) {
  const products = profile.liveSupplierLookup?.products || [];
  let selectedProducts = productsForFamily(products, selectedKeyFamily);
  if (!selectedProducts.length && products.length) {
    selectedProducts = products.filter((product) => productKeyFamily(product) !== "supporting" && isDisplayKeyProduct(product));
  }
  const offers = sortSupplierOffers(selectedProducts.filter(productPassesLiveFilters));
  const baselineOffers = sortSupplierOffers(selectedProducts);
  const selectedGroup = visualPartChoiceGroups(offers).find((group) => group.key === selectedPartChoiceKey);
  const selectedBaselineGroup = visualPartChoiceGroups(baselineOffers).find((group) => group.key === selectedPartChoiceKey);
  return selectedGroup || selectedBaselineGroup || null;
}

function selectedPartSnapshot(profile) {
  const group = selectedVisualPartGroup(profile);
  if (!group) return null;
  const best = group.bestOffer;
  const imageOffer = group.imageOffer || group.offers.find((offer) => offer.image) || best;
  const buttonLabel = group.buttonLayouts?.[0] || (group.buttons[0] ? `${group.buttons[0]} button` : buttonLayoutBucket(best.rawProduct));
  const typeLabel = partTypeBucket(best.rawProduct);
  return {
    group,
    best,
    imageOffer,
    buttonLabel,
    typeLabel,
    title: buttonLabel || typeLabel || "Selected key",
    identifier: group.label || best.fcc || best.oem || best.sku || "Visual match selected",
  };
}

function extractKeywayTokens(value) {
  const text = String(value || "").toUpperCase();
  const tokens = [];
  const patterns = [
    /\b(?:HU|TOY|TR|DAT|NSN|NIS|MIT|MZ|MAZ|BMW|BW|VA|HON|HD|HY|KIA|SUB|CY|FO|H|Y|B)\s*[- ]?\s*\d{2,4}[A-Z]?\b/g,
    /\b(?:FO38|FO21|B106|H72|H75|H92|H94|H101|Y160|Y164|Y165|Y170|Y171|Y172|Y157|TOY43|TOY48|TOY49|TR47|DAT17|NSN11|NSN14)\b/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const token = match[0].replace(/[\s-]+/g, "");
      if (token.length >= 3 && !tokens.includes(token)) tokens.push(token);
    }
  });
  return tokens;
}

function vehicleSpecificKeyways(profile) {
  const vehicle = profile?.vehicle || {};
  const make = String(vehicle.make || "").toUpperCase();
  const model = String(vehicle.model || "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const year = Number(vehicle.year);
  if (make === "FORD" && model.includes("ESCAPE") && year >= 2013 && year <= 2019) {
    return [{ keyway: "HU101", source: "Ford Escape key fitment" }];
  }
  if (["CHEVROLET", "GMC", "CADILLAC"].includes(make) && /SILVERADO|SIERRA|TAHOE|SUBURBAN|YUKON|ESCALADE/.test(model) && year >= 2014 && year <= 2022) {
    return [{ keyway: "HU100", source: "GM truck/SUV keyway fitment" }];
  }
  return [];
}

function lishiReferenceForProfile(profile, snapshot = selectedPartSnapshot(profile)) {
  const reference = profile.vehicleReference || {};
  const products = profile.liveSupplierLookup?.products || [];
  const selectedProducts = snapshot?.group?.offers?.map((offer) => offer.rawProduct).filter(Boolean).filter(isDisplayKeyProduct) || [];
  const visibleKeyProducts = productsForFamily(products, selectedKeyFamily).filter(isDisplayKeyProduct);
  const sourceProducts = [
    ...selectedProducts,
    ...visibleKeyProducts.filter((product) => !selectedProducts.includes(product)),
  ];
  const references = [
    reference.keyway?.primary,
    ...(reference.keyway?.alternates || []),
    reference.lishi?.primary,
    ...(reference.lishi?.alternates || []),
    ...(reference.cutting || []),
    ...(reference.decodePlan || []),
  ];
  const candidates = new Map();
  const addCandidate = (token, source, productName = "") => {
    if (!token) return;
    if (!candidates.has(token)) {
      candidates.set(token, {
        keyway: token,
        tool: `${token} Lishi / decoder`,
        sources: new Set(),
        products: new Set(),
      });
    }
    const candidate = candidates.get(token);
    if (source) candidate.sources.add(source);
    if (productName) candidate.products.add(productName);
  };

  sourceProducts.forEach((product) => {
    const text = productSearchText(product);
    const source = selectedProducts.includes(product) ? "selected key listing" : "shown key listing";
    extractKeywayTokens(text).forEach((token) => addCandidate(token, source, product.name || product.keyInfo?.sku || ""));
  });
  const fitmentKeyways = vehicleSpecificKeyways(profile);
  if (fitmentKeyways.length) {
    candidates.clear();
    fitmentKeyways.forEach((item) => addCandidate(item.keyway, item.source));
  }
  if (!candidates.size) {
    references.forEach((value) => {
      extractKeywayTokens(value).forEach((token) => addCandidate(token, "vehicle reference fallback"));
    });
  }

  const list = Array.from(candidates.values()).map((candidate) => ({
    ...candidate,
    sources: Array.from(candidate.sources),
    products: Array.from(candidate.products).slice(0, 3),
  }));
  const fallbackPrimary = reference.lishi?.primary || reference.keyway?.primary || "Confirm from lock or emergency insert";
  return {
    primary: list.length ? list.map((candidate) => candidate.tool).join(" / ") : fallbackPrimary,
    keyways: list.map((candidate) => candidate.keyway),
    candidates: list,
    fallbackPrimary,
  };
}

function programmerPercent(item, fallback = 50) {
  const direct = Number(item?.confidencePercent);
  if (Number.isFinite(direct)) return Math.max(0, Math.min(100, Math.round(direct)));
  const text = String(item?.confidence || "").toLowerCase();
  const numeric = Number(text.match(/\d{2,3}/)?.[0]);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(100, numeric));
  if (/oem|certain/.test(text)) return 100;
  if (/verified|high/.test(text)) return 88;
  if (/medium/.test(text)) return 68;
  if (/public/.test(text)) return 58;
  if (/low/.test(text)) return 42;
  return fallback;
}

function canonicalProgrammerName(value) {
  const text = cleanInput(value);
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  if (!normalized) return "";
  if (/\bSMART\s*PRO\b/.test(normalized) || /ADVANCED DIAGNOSTICS/.test(normalized) || /\bMYKEYS\b/.test(normalized)) return "Advanced Diagnostics Smart Pro";
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

function programmerOptionKey(item) {
  return String(canonicalProgrammerName([item.platform, item.name].filter(Boolean).join(" ")) || item.name || item.platform || "Programmer path")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function programmerCoverageOptions(profile) {
  const items = profile.jobKit?.programmerCoverage?.length ? profile.jobKit.programmerCoverage : profile.jobKit?.programmers || [];
  const merged = new Map();
  items
    .map((item) => ({
      ...item,
      name: canonicalProgrammerName([item.platform, item.name].filter(Boolean).join(" ")) || item.name,
      key: programmerOptionKey(item),
      confidencePercent: programmerPercent(item),
    }))
    .forEach((item) => {
      const existing = merged.get(item.key);
      if (!existing || item.confidencePercent > existing.confidencePercent) {
        merged.set(item.key, {
          ...(existing || {}),
          ...item,
          evidence: [...new Set([...(existing?.evidence || []), ...(item.evidence || [])].filter(Boolean))],
          models: [...new Set([...(existing?.models || []), ...(item.models || [])].filter(Boolean))],
        });
      } else {
        existing.evidence = [...new Set([...(existing.evidence || []), ...(item.evidence || [])].filter(Boolean))];
        existing.models = [...new Set([...(existing.models || []), ...(item.models || [])].filter(Boolean))];
      }
    });
  return Array.from(merged.values()).sort(
    (a, b) => b.confidencePercent - a.confidencePercent || String(a.name || "").localeCompare(String(b.name || "")),
  );
}

function selectedProgrammerOption(profile) {
  const options = programmerCoverageOptions(profile);
  return options.find((item) => item.key === selectedProgrammerKey) || options[0] || null;
}

function compactToolToken(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function importedLishiToolsForProfile(profile, lishi = lishiReferenceForProfile(profile)) {
  const tools = profile?.lishiLookup?.tools || [];
  const preferred = [...new Set([...(lishi.keyways || []), lishi.fallbackPrimary, lishi.primary].flatMap((value) => extractKeywayTokens(value)))].map(compactToolToken);
  if (!preferred.length) return tools;
  const exact = tools.filter((tool) => {
    const id = compactToolToken(tool.canonical || tool.tool);
    return preferred.some((token) => id === token || id.startsWith(token));
  });
  return exact.length ? exact : tools;
}

function buildDispatchPack(profile) {
  const vehicle = profile?.vehicle || {};
  const snapshot = selectedPartSnapshot(profile);
  const programmer = selectedProgrammerOption(profile);
  const lishi = lishiReferenceForProfile(profile, snapshot);
  const reference = profile?.vehicleReference || {};
  const importedLishiTools = importedLishiToolsForProfile(profile, lishi).map((tool) => tool.canonical || tool.tool).filter(Boolean);
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "Vehicle lookup";
  const supplier = profile?.liveSupplierLookup || {};
  const supplierCount = supplier.products?.length || 0;
  const matchedJobCount = profile?.matchedJobs?.length || profile?.shopEvidence?.jobs?.length || 0;
  const sourceStatus = profile?.fieldMode?.cached
    ? "Cached field pack"
    : supplier.loginStatus === "error"
      ? "Server live / parts slow"
      : supplierCount
        ? "Live parts ready"
        : "Reference ready";
  const facts = [
    ["Vehicle", title],
    ["VIN", profile?.vin || "Y/M/M lookup"],
    ["Current step", stepLabel(vinWorkflowStep)],
    ["Key choice", snapshot ? [snapshot.typeLabel, snapshot.title].filter(Boolean).join(" | ") : selectedPackageOption()?.title || "Choose key type"],
    ["Part clue", snapshot?.identifier || profile?.supplierCandidates?.[0]?.hlPartNumber || "Pick key picture"],
    ["Keyway", lishi.keyways.length ? lishi.keyways.join(" / ") : reference.keyway?.primary || "Verify from lock"],
    ["Lishi match", importedLishiTools.length ? importedLishiTools.slice(0, 4).join(" / ") : lishi.primary || "Verify by keyway"],
    ["Programmer", programmer ? `${programmer.name} (${programmerPercent(programmer)}%)` : "Choose programmer path"],
    ["Proof history", matchedJobCount ? `${matchedJobCount} related saved job${matchedJobCount === 1 ? "" : "s"}` : "No saved job proof yet"],
  ].filter(([, value]) => value);
  const checklist = [
    "Verify ownership/authorization and attach proof before code/PIN work",
    snapshot ? "Compare FCC, buttons, chip, frequency, blade, and emergency insert before cutting" : "Choose the visible key/button layout before quoting parts",
    importedLishiTools.length ? `Verify ${importedLishiTools.slice(0, 3).join(" / ")} against the lock before use` : lishi.primary ? `Confirm ${lishi.primary} from the lock or insert before decode` : "Confirm keyway from the lock or insert",
    programmer ? `Use ${programmer.name}; verify add-key/all-keys-lost coverage before starting` : "Choose programmer path before final rundown",
    ...(reference.partVerification || []).slice(0, 3),
    "Save worked-job proof after the job to improve coverage percentages",
  ];
  return {
    id: `${lookupCacheKeyFromProfile(profile)}:${Date.now()}`,
    createdAt: new Date().toISOString(),
    title,
    sourceStatus,
    stage: stepLabel(vinWorkflowStep),
    cached: Boolean(profile?.fieldMode?.cached),
    facts,
    checklist: [...new Set(checklist.filter(Boolean))].slice(0, 8),
    notes: [
      profile?.fieldMode?.reason,
      supplier.statusMessage,
      profile?.confidence,
    ].filter(Boolean),
  };
}

function dispatchPackText(pack) {
  return [
    `TimLock Dispatch Pack - ${pack.title}`,
    `Status: ${pack.sourceStatus}`,
    "",
    ...pack.facts.map(([label, value]) => `${label}: ${value}`),
    "",
    "Checklist:",
    ...pack.checklist.map((item, index) => `${index + 1}. ${item}`),
    pack.notes.length ? "" : null,
    ...pack.notes.map((note) => `Note: ${note}`),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function savedDispatchPacks() {
  const archive = readLocalObject(dispatchPackArchiveKey, { packs: [] });
  return Array.isArray(archive.packs) ? archive.packs : [];
}

function saveDispatchPack(profile) {
  const pack = buildDispatchPack(profile);
  writeLocalObject(dispatchPackArchiveKey, { version: 1, packs: [pack, ...savedDispatchPacks()].slice(0, 50) });
  return pack;
}

async function copyDispatchPack(profile) {
  const pack = buildDispatchPack(profile);
  const text = dispatchPackText(pack);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  return pack;
}

function renderDispatchPack(profile) {
  const pack = buildDispatchPack(profile);
  return `
    <div class="dispatch-pack">
      <div class="dispatch-pack-head">
        <div>
          <p class="eyebrow">Dispatch Pack</p>
          <strong>${escapeHtml(pack.title)}</strong>
          <span>${escapeHtml(pack.sourceStatus)}${pack.cached ? " - offline-safe" : ""}</span>
        </div>
        <div class="dispatch-pack-actions">
          <button class="secondary-action small" type="button" data-open-workbench-current>Workbench</button>
          <button class="secondary-action small" type="button" data-copy-dispatch-pack>Copy</button>
          <button class="secondary-action small" type="button" data-save-dispatch-pack>Save</button>
        </div>
      </div>
      <section class="dispatch-pack-facts">
        ${pack.facts
          .slice(0, 8)
          .map(
            ([label, value]) => `
              <article>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="dispatch-pack-checklist">
        <span>Field checklist</span>
        <ul>${pack.checklist.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      ${pack.notes.length ? `<p class="dispatch-pack-note">${escapeHtml(pack.notes[0])}</p>` : ""}
    </div>
  `;
}

function normalizedProgrammerName(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function selectWorkedProgrammerOption(profile, programmerName) {
  const target = normalizedProgrammerName(programmerName);
  if (!target) return false;
  const options = programmerCoverageOptions(profile);
  const sameName = (item) => normalizedProgrammerName(item.name) === target;
  const workedMatch =
    options.find((item) => sameName(item) && /worked|shop-success|shop evidence/i.test([item.role, item.source].filter(Boolean).join(" "))) ||
    options.find(sameName);
  if (!workedMatch) return false;
  selectedProgrammerKey = workedMatch.key;
  return true;
}

function programmerSummaryText(item) {
  if (!item) return "";
  if (/OEM/i.test(item.role || "")) {
    return item.passThru ? `OEM fallback. Interface: ${item.passThru}` : "OEM fallback path when aftermarket coverage is not proven.";
  }
  if (item.models?.length) return item.models.join(" / ");
  return item.detail || "Verify exact year, model, key system, and add-key/all-keys-lost coverage.";
}

function programmerEvidenceText(item) {
  const evidence = Array.isArray(item?.evidence) ? item.evidence.filter(Boolean) : [];
  if (evidence.length) return evidence.slice(0, 2).join(" | ");
  if (item?.sourceUrl) return "Public source listed; verify exact function coverage before dispatch.";
  return "";
}

function programmerBadge(item) {
  const text = [item.role, item.source, item.confidence].filter(Boolean).join(" ");
  if (/worked|shop-success|shop evidence|shop-confirmed/i.test(text)) return "Shop proof";
  if (/OEM/i.test(text)) return "OEM fallback";
  if (/community/i.test(text)) return "Community clue";
  if (/public|coverage clue|aftermarket/i.test(text) || item.sourceUrl || item.platform) return "Coverage clue";
  return "Programmer path";
}

function renderProgrammerCompactOption(item) {
  const percent = programmerPercent(item);
  const selected = selectedProgrammerKey === item.key;
  return `
    <button class="programmer-compact-option ${selected ? "active" : ""}" type="button" data-select-programmer="${escapeHtml(item.key)}">
      <div>
        <span>${escapeHtml(programmerBadge(item))}</span>
        <strong>${escapeHtml(item.name || "Programmer coverage")}</strong>
        <p>${escapeHtml(programmerSummaryText(item))}</p>
        ${programmerEvidenceText(item) ? `<small>${escapeHtml(programmerEvidenceText(item))}</small>` : ""}
      </div>
      <em>${percent}%</em>
    </button>
  `;
}

function renderSelectedKeyMini(snapshot) {
  if (!snapshot) return "";
  const { best, imageOffer, title, typeLabel, identifier } = snapshot;
  const thumbOffer = imageOffer || best;
  return `
    <section class="selected-key-mini">
      <div class="selected-key-mini-photo">${
        thumbOffer.image ? renderOfferThumb(thumbOffer, title) : renderKeyImageFallback(title, typeLabel)
      }</div>
      <div>
        <span>${escapeHtml(typeLabel)}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(identifier)}</p>
      </div>
    </section>
  `;
}

function renderProgrammerCoverageScreen(profile) {
  const snapshot = selectedPartSnapshot(profile);
  if (!snapshot) {
    return `
      <section class="program-screen programmer-step">
        <div class="workflow-heading">
          <p class="eyebrow">Screen 5</p>
          <h3>Select a key picture first</h3>
          <p>Go back one screen and choose the picture/button layout before confirming programmer coverage.</p>
        </div>
        ${renderWorkflowActions([`<button class="secondary-action" type="button" data-vin-back="parts">Back</button>`])}
      </section>
    `;
  }
  const options = programmerCoverageOptions(profile);
  const primaryOptions = options.slice(0, 6);
  const extraOptions = options.slice(6);
  return `
    <section class="program-screen programmer-step">
      <div class="programmer-command-head">
        <div>
          <p class="eyebrow">Screen 6</p>
          <h3>Choose programmer path</h3>
          <p>Tap the programmer you would actually use. That moves you to the final job overview where you can save the worked-job proof.</p>
        </div>
      </div>
      ${renderSelectedKeyMini(snapshot)}
      <div class="job-entry-callout">
        <strong>Next step</strong>
        <p>Choose a programmer card below to continue. Save worked-job proof only after reviewing the final summary.</p>
      </div>
      ${
        options.length
          ? `
            <div class="programmer-lanes">
              <section>
                <div class="programmer-lane-head">
                  <span>Recommended path</span>
                  <strong>Ranked programmer options</strong>
                </div>
                ${primaryOptions.map(renderProgrammerCompactOption).join("")}
              </section>
              ${
                extraOptions.length
                  ? `<details class="programmer-more"><summary>More platforms (${extraOptions.length})</summary>${extraOptions.map(renderProgrammerCompactOption).join("")}</details>`
                  : ""
              }
            </div>
          `
          : `<article class="assistant-card"><strong>No programmer coverage yet</strong><p>Add a worked job record or use OEM as the fallback path before quoting.</p></article>`
      }
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="lishi">Back to decode</button>`,
      ])}
    </section>
  `;
}

function renderLishiDecodeScreen(profile) {
  const snapshot = selectedPartSnapshot(profile);
  if (!snapshot) {
    return `
      <section class="program-screen lishi-step">
        <div class="workflow-heading">
          <p class="eyebrow">Screen 5</p>
          <h3>Select a key picture first</h3>
          <p>Go back one screen and choose the picture/button layout before checking decode tools.</p>
        </div>
        ${renderWorkflowActions([`<button class="secondary-action" type="button" data-vin-back="parts">Back</button>`])}
      </section>
    `;
  }
  const reference = profile.vehicleReference || {};
  const lishi = lishiReferenceForProfile(profile, snapshot);
  const codeSources = [
    "NASTF SDRM / Vehicle Security Professional account for OEM security access where supported",
    "OEM service-information portals tied to the vehicle make and authorized locksmith credentials",
    "Authorized key-code or PIN-code provider after customer ownership and locksmith authorization are documented",
    "Dealer/OEM parts or service channel when the manufacturer requires direct authorization",
  ];
  const rows = [
    ["Lishi / keyway", lishi.keyways.length ? lishi.keyways.join(" / ") : reference.keyway?.primary || "Confirm from lock or emergency insert"],
    ["Tool to grab", lishi.primary],
    ["Alternates", [...new Set([...(reference.lishi?.alternates || []), ...(reference.keyway?.alternates || [])])].join(" | ")],
    ["Decode plan", (reference.decodePlan || []).slice(0, 3).join(" | ")],
    ["Cut path", (reference.cutting || []).slice(0, 3).join(" | ")],
  ].filter(([, value]) => value);
  const checklist = [
    "Confirm ownership/authorization before requesting any key code or PIN",
    "Confirm keyway from the lock, door cylinder, or emergency insert before choosing a Lishi",
    "VIN may identify the vehicle but does not prove the mechanical keyway on its own",
    ...(reference.access || []).slice(0, 2),
  ];
  return `
    <section class="program-screen lishi-step">
      <div class="workflow-heading">
        <p class="eyebrow">Screen 5</p>
        <h3>Decode lock and code source</h3>
        <p>Confirm the mechanical path before programming. Use authorized code/PIN sources only with valid credentials and documented customer authorization.</p>
      </div>
      ${renderSelectedKeyMini(snapshot)}
      <section class="lishi-reference-grid">
        ${rows
          .map(
            ([label, value]) => `
              <article>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="lishi-candidate-list">
        <div>
          <span>Lishi shortlist</span>
          <strong>${escapeHtml(lishi.candidates.length ? `${lishi.candidates.length} candidate${lishi.candidates.length === 1 ? "" : "s"}` : "Verify by keyway")}</strong>
        </div>
        ${
          lishi.candidates.length
            ? lishi.candidates
                .map(
                  (candidate) => `
                    <article>
                      <strong>${escapeHtml(candidate.tool)}</strong>
                      <p>${escapeHtml([candidate.sources.join(" + "), candidate.products.length ? `Seen on: ${candidate.products.join(" / ")}` : ""].filter(Boolean).join(" | "))}</p>
                    </article>
                  `,
                )
                .join("")
            : `<article><strong>${escapeHtml(lishi.fallbackPrimary)}</strong><p>Parts listings did not expose a specific Lishi/keyway. Confirm from the lock, emergency insert, or authorized code source.</p></article>`
        }
      </section>
      ${renderProfileLishiLookup(profile.lishiLookup)}
      <section class="code-source-panel">
        <div>
          <span>Code / PIN sources</span>
          <strong>Use NASTF/OEM-authorized paths</strong>
        </div>
        <ul>${codeSources.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section class="reference-checklist">
        <span>Before decode/code request</span>
        <ul>${[...new Set(checklist)].slice(0, 7).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="parts">Back to key pictures</button>`,
        `<button class="primary-action" type="button" data-continue-programmers>Next: Programmer coverage</button>`,
      ])}
    </section>
  `;
}

function renderFinalJobSummaryScreen(profile) {
  const snapshot = selectedPartSnapshot(profile);
  const programmer = selectedProgrammerOption(profile);
  if (!snapshot) {
    return `
      <section class="program-screen final-rundown-step">
        <div class="workflow-heading">
          <p class="eyebrow">Final rundown</p>
          <h3>Select a key picture first</h3>
          <p>The job rundown needs a selected key/button layout before it can summarize the parts and tools.</p>
        </div>
        ${renderWorkflowActions([`<button class="secondary-action" type="button" data-vin-back="parts">Back</button>`])}
      </section>
    `;
  }
  const vehicle = profile.vehicle || {};
  const reference = profile.vehicleReference || {};
  const best = snapshot.best;
  const lishi = lishiReferenceForProfile(profile, snapshot);
  const importedLishiTools = importedLishiToolsForProfile(profile, lishi).map((tool) => tool.canonical || tool.tool).filter(Boolean);
  const percent = programmer ? programmerPercent(programmer) : 0;
  const rows = [
    ["Vehicle", [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")],
    ["Key choice", [snapshot.typeLabel, snapshot.title].filter(Boolean).join(" | ")],
    ["Part clue", snapshot.identifier],
    ["FCC / buttons", [snapshot.group.fccs.join(" / "), snapshot.group.buttonLayouts?.join(" / ") || (snapshot.group.buttons.length ? `${snapshot.group.buttons.join(" / ")} button` : "")].filter(Boolean).join(" | ")],
    ["Chip / frequency", [best.chip, snapshot.group.frequencies.join(" / ")].filter(Boolean).join(" | ")],
    ["Programmer", programmer ? `${programmer.name} (${percent}% confidence)` : "Verify coverage"],
    ["Programmer models", programmer?.models?.length ? programmer.models.join(" / ") : ""],
    ["Pass-through / VCI", programmer?.passThru || ""],
    ["OEM key note", programmer && Number(programmer.oemKeyLikelihood) >= 90 ? `Plan OEM key about ${programmer.oemKeyLikelihood}% of the time when this path is required.` : ""],
    ["Keyway", lishi.keyways.length ? lishi.keyways.join(" / ") : reference.keyway?.primary || "Verify by lock/emergency insert"],
    ["Lishi / decode", lishi.primary || "Verify keyway before choosing tool"],
    ["Imported Lishi match", importedLishiTools.slice(0, 5).join(" / ")],
    ["Cut / originate", (reference.cutting || reference.decodePlan || []).slice(0, 2).join(" | ")],
  ].filter(([, value]) => value);
  const verify = [
    ...(profile.jobKit?.verify || []),
    ...(reference.partVerification || []),
    "Confirm ownership/authorization",
    "Confirm FCC, buttons, chip, and emergency insert before cutting/programming",
  ];
  const tools = [
    ...(profile.jobKit?.tools || []).map((item) => item.name || item.detail),
    ...importedLishiTools.map((tool) => `${tool} Lishi`),
    ...(reference.fieldTools || []),
  ].filter(Boolean);
  return `
    <section class="program-screen final-rundown-step">
      <div class="workflow-heading">
        <p class="eyebrow">Final rundown</p>
        <h3>What to bring and verify</h3>
          <p>Basic field summary for this job. No parts pricing, no shop-history giveaway, just the working reference.</p>
      </div>
      ${renderSelectedKeyMini(snapshot)}
      <section class="job-rundown-grid">
        ${rows
          .map(
            ([label, value]) => `
              <article>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="job-rundown-lists">
        <article>
          <span>Tools</span>
          <ul>${[...new Set(tools)].slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>
        <article>
          <span>Verify</span>
          <ul>${[...new Set(verify)].slice(0, 7).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>
      </section>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="programmers">Back to programmer</button>`,
        `<button class="primary-action" type="button" data-save-selected-job>Save worked-job proof</button>`,
        `<button class="secondary-action" type="button" data-vin-reset>Start over</button>`,
      ])}
    </section>
  `;
}

function renderSelectedSupplierScreen(profile) {
  const products = profile.liveSupplierLookup?.products || [];
  let selectedProducts = productsForFamily(products, selectedKeyFamily);
  if (!selectedProducts.length && products.length) {
    selectedProducts = products.filter((product) => productKeyFamily(product) !== "supporting" && isDisplayKeyProduct(product));
  }
  const offers = sortSupplierOffers(selectedProducts.filter(productPassesLiveFilters));
  const baselineOffers = sortSupplierOffers(selectedProducts);
  const groups = visualPartChoiceGroups(offers);
  const baselineGroups = visualPartChoiceGroups(baselineOffers);
  const selectedGroup = groups.find((group) => group.key === selectedPartChoiceKey);
  const selectedBaselineGroup = baselineGroups.find((group) => group.key === selectedPartChoiceKey);
  const group = selectedGroup || selectedBaselineGroup;

  if (!group) {
    return `
      <section class="program-screen selected-parts-step">
        <div class="workflow-heading">
          <p class="eyebrow">Screen 5</p>
          <h3>Select a part first</h3>
          <p>Go back one screen and choose the picture that matches the vehicle/customer key.</p>
        </div>
        ${renderWorkflowActions([
          `<button class="secondary-action" type="button" data-vin-back="parts">Back</button>`,
        ])}
      </section>
    `;
  }
  const best = group.bestOffer;
  const buttonLabel = group.buttonLayouts?.[0] || (group.buttons[0] ? `${group.buttons[0]} button` : buttonLayoutBucket(best.rawProduct));
  const typeLabel = partTypeBucket(best.rawProduct);
  const reference = profile.vehicleReference || {};
  const lishi = lishiReferenceForProfile(profile, { group, best });
  const referenceRows = [
    ["Style", typeLabel],
    ["Buttons", buttonLabel],
    ["FCC", group.fccs.join(" / ")],
    ["Frequency", group.frequencies.join(" / ")],
    ["Chip", best.chip],
    ["Fitment", best.fitment],
  ].filter(([, value]) => value && value !== "Button layout unknown");
  const checklist = [
    ...(reference.partVerification || []),
    ...(reference.decodePlan || []).slice(0, 2),
    "Match the on-screen button layout to the customer's key/vehicle equipment",
    "Confirm FCC/frequency before cutting or programming",
  ];
  const jobSections = [
    {
      title: "Field flow",
      rows: [
        ["Start", (reference.jobFlow || []).slice(0, 2).join(" | ")],
        ["Photos", (reference.fieldPhotos || []).slice(0, 3).join(" | ")],
      ],
    },
    {
      title: "Mechanical",
      rows: [
        ["Keyway", lishi.keyways.length ? lishi.keyways.join(" / ") : reference.keyway?.primary],
        ["Lishi / decode", lishi.primary || reference.lishi?.primary],
        ["Cut path", (reference.cutting || []).slice(0, 3).join(" | ")],
      ],
    },
    {
      title: "Programming",
      rows: [
        ["Method", (reference.programming || []).slice(0, 3).join(" | ")],
        ["Warnings", (reference.warnings || []).slice(0, 3).join(" | ")],
      ],
    },
    {
      title: "Tools",
      rows: [
        ["Field kit", (reference.fieldTools || []).slice(0, 3).join(" | ")],
        ["Access", (reference.access || []).slice(0, 2).join(" | ")],
      ],
    },
  ];

  return `
    <section class="program-screen selected-parts-step">
      <div class="workflow-heading">
        <p class="eyebrow">Screen 5</p>
        <h3>${escapeHtml(buttonLabel || typeLabel || "Selected key")}</h3>
        <p>${escapeHtml("Reference the selected button configuration, identifiers, mechanical path, and programming notes before cutting or programming.")}</p>
      </div>
      <section class="selected-key-reference">
        <div class="selected-key-photo">${
          best.image
            ? renderOfferThumb(best, buttonLabel || typeLabel)
            : `<div class="offer-thumb empty" aria-hidden="true">No photo</div>`
        }</div>
        <div class="selected-key-info">
          <span>${escapeHtml(typeLabel)}</span>
          <strong>${escapeHtml(buttonLabel || "Button layout verify")}</strong>
          <p>${escapeHtml("Confirm the physical buttons and emergency insert/keyway against the vehicle before cutting or programming.")}</p>
          <div class="selected-reference-grid">
            ${referenceRows
              .map(
                ([label, value]) => `
                  <span>
                    <small>${escapeHtml(label)}</small>
                    <strong>${escapeHtml(value)}</strong>
                  </span>
                `,
              )
              .join("")}
          </div>
        </div>
      </section>
      <section class="reference-job-grid">
        ${jobSections
          .map(
            (section) => `
              <article class="reference-job-card">
                <span>${escapeHtml(section.title)}</span>
                ${section.rows
                  .filter(([, value]) => value)
                  .map(
                    ([label, value]) => `
                      <p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>
                    `,
                  )
                  .join("")}
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="reference-checklist">
        <span>Confirm before job</span>
        <ul>
          ${[...new Set(checklist.filter(Boolean))].slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="parts">Back to key pictures</button>`,
        `<button class="secondary-action" type="button" data-vin-reset>Start over</button>`,
      ])}
    </section>
  `;
}

function findOfferByIdentity(identity) {
  const products = latestVinProfile?.liveSupplierLookup?.products || [];
  return products.map(normalizedSupplierOffer).find((offer) => offerIdentityKey(offer) === identity) || null;
}

function partPayloadFromOffer(offer) {
  return {
    name: offer.partName,
    supplier: offer.supplier,
    sku: offer.sku,
    oem: offer.oem,
    fcc: offer.fcc,
    frequency: offer.frequency,
    chip: offer.chip,
    buttons: offer.buttons,
    price: offer.priceFormatted || offer.price,
    stock: offer.stock,
    family: offer.selectionFamily,
  };
}

function savePartOutcome(outcome, offer, extra = {}) {
  const part = extra.part || partPayloadFromOffer(offer);
  return api("/api/part-outcomes", {
    method: "POST",
    body: JSON.stringify({
      outcome,
      vin: latestVinProfile.vin,
      vehicle: latestVinProfile.vehicle,
      part,
      ...extra,
    }),
  });
}

function cleanInput(value) {
  return String(value ?? "").trim();
}

function jobSortTime(job = {}) {
  return Date.parse(job.createdAt || job.importedAt || job.schedule || "") || 0;
}

function mergeJobLists(...lists) {
  const map = new Map();
  lists.flat().forEach((job) => {
    if (!job || typeof job !== "object") return;
    const id = cleanInput(job.id) || `${cleanInput(job.title)}-${cleanInput(job.vehicle)}-${cleanInput(job.createdAt || job.schedule)}`;
    if (!id) return;
    map.set(id, { ...(map.get(id) || {}), ...job, id });
  });
  return Array.from(map.values()).sort((a, b) => jobSortTime(b) - jobSortTime(a));
}

function localArchivedJobs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(localJobArchiveKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((job) => job && typeof job === "object") : [];
  } catch {
    return [];
  }
}

function rememberJobs(items = []) {
  const merged = mergeJobLists(localArchivedJobs(), items).slice(0, 1000);
  localStorage.setItem(localJobArchiveKey, JSON.stringify(merged));
  return merged;
}

function readLocalObject(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalObject(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to write ${key}`, error);
  }
}

function lookupCacheKeyFromVehicle(vehicle = {}) {
  return `ymm:${cleanInput(vehicle.year)}|${cleanInput(vehicle.make).toUpperCase()}|${cleanInput(vehicle.model).toUpperCase()}`;
}

function lookupCacheKeyFromVin(vin) {
  return `vin:${normalizeVinInput(vin)}`;
}

function lookupCacheKeyFromProfile(profile = {}) {
  if (profile.vin) return lookupCacheKeyFromVin(profile.vin);
  return lookupCacheKeyFromVehicle(profile.vehicle || {});
}

function cacheLookupProfile(key, profile) {
  if (!key || !profile?.vehicle) return;
  const cache = readLocalObject(fieldLookupCacheKey, { entries: [] });
  const entries = Array.isArray(cache.entries) ? cache.entries.filter((entry) => entry?.key !== key) : [];
  entries.unshift({
    key,
    updatedAt: new Date().toISOString(),
    vehicle: profile.vehicle,
    profile,
  });
  writeLocalObject(fieldLookupCacheKey, { version: 1, entries: entries.slice(0, 75) });
}

function cachedLookupProfile(key, reason) {
  const cache = readLocalObject(fieldLookupCacheKey, { entries: [] });
  const entry = (Array.isArray(cache.entries) ? cache.entries : []).find((item) => item?.key === key);
  if (!entry?.profile) return null;
  const profile = JSON.parse(JSON.stringify(entry.profile));
  profile.fieldMode = {
    cached: true,
    reason,
    cachedAt: entry.updatedAt,
  };
  profile.sourceReadiness = [
    ...(profile.sourceReadiness || []),
    {
      sourceId: "field-cache",
      label: "Field cache",
      status: "cached",
      result: `Loaded saved profile from ${entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "this device"}`,
    },
  ];
  return profile;
}

async function syncLocalJobsToServer() {
  const archived = localArchivedJobs();
  if (!archived.length) return;
  try {
    const result = await api("/api/jobs/sync", {
      method: "POST",
      body: JSON.stringify({ jobs: archived }),
    });
    jobs = mergeJobLists(result.jobs || [], archived);
    rememberJobs(jobs);
    renderJobs();
  } catch {
    // Local proof still feeds part-history searches even when the server sync is unavailable.
  }
}

function workedJobPayloadFromForm(data) {
  const vin = normalizeVinInput(data.get("vin"));
  const year = cleanInput(data.get("year"));
  const make = cleanInput(data.get("make")).toUpperCase();
  const model = cleanInput(data.get("model"));
  const trim = cleanInput(data.get("trim"));
  const exactPart = cleanInput(data.get("exactPart"));
  const partNumber = cleanInput(data.get("partNumber"));
  const lishi = cleanInput(data.get("lishi"));
  const programmer = cleanInput(data.get("programmer"));
  const buttons = cleanInput(data.get("buttons"));
  const notes = cleanInput(data.get("notes"));
  const keyType = cleanInput(data.get("keyType"));

  return {
    outcome: cleanInput(data.get("outcome")) || "worked",
    vin,
    vehicle: { year, make, model, trim },
    part: {
      name: exactPart,
      supplier: "Manual reference",
      sku: partNumber,
      oem: "",
      fcc: "",
      frequency: "",
      chip: "",
      buttons,
      keyway: lishi,
      lishi,
      programmer,
      family: keyType === "proximity" ? "proximity" : "keyed",
    },
    job: {
      exactPart,
      partNumber,
      lishi,
      programmer,
      keyType,
      notes,
    },
  };
}

function validateWorkedJobPayload(payload) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(payload.vin)) return "Enter a valid 17-character VIN.";
  if (!payload.vehicle.year || !payload.vehicle.make || !payload.vehicle.model) return "Enter year, make, and model.";
  if (!payload.part.name) return "Enter the exact key or part used.";
  if (!payload.part.lishi) return "Enter the Lishi/keyway used.";
  if (!payload.part.programmer) return "Enter the programmer used.";
  return "";
}

async function saveWorkedJobPayload(payload) {
  return api("/api/part-outcomes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function partHistoryRecentSearches() {
  try {
    const parsed = JSON.parse(localStorage.getItem(partHistoryRecentsKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(cleanInput).filter(Boolean).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function savePartHistoryRecent(query) {
  const clean = cleanInput(query).toUpperCase();
  if (!clean) return;
  const recent = [clean, ...partHistoryRecentSearches().filter((item) => item.toUpperCase() !== clean)].slice(0, 10);
  localStorage.setItem(partHistoryRecentsKey, JSON.stringify(recent));
}

function renderPartHistoryRecents() {
  if (!partHistoryRecents) return;
  const recent = partHistoryRecentSearches();
  if (!recent.length) {
    partHistoryRecents.innerHTML = "";
    return;
  }
  partHistoryRecents.innerHTML = `
    <span>Recent</span>
    ${recent.map((item) => `<button class="part-chip" type="button" data-part-history-search="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
  `;
}

function renderPartChips(values = [], empty = "None") {
  const clean = [...new Set(values.map((value) => cleanInput(value)).filter(Boolean))];
  if (!clean.length) return `<span class="part-chip muted">${escapeHtml(empty)}</span>`;
  return clean
    .slice(0, 10)
    .map((value) => `<span class="part-chip">${escapeHtml(value)}</span>`)
    .join("");
}

function partHistoryEvidenceBadges(payload = {}) {
  const identifiers = payload.identifiers || {};
  const jobs = payload.jobs || [];
  const evidence = payload.programmerEvidence || {};
  const hasProgrammerProof = (evidence.programmers || []).some((programmer) => Number(programmer.successes) > 0);
  return [
    jobs.length ? "Shop proven" : "No job proof",
    payload.referenceStats?.matchedReferenceRows ? "Cross-ref linked" : "Direct text only",
    hasProgrammerProof ? "Programmer proof" : "No programmer proof",
    identifiers.oe?.length ? "OE linked" : "",
  ].filter(Boolean);
}

function partHistoryProofSummary(payload = {}) {
  const identifiers = payload.identifiers || {};
  const jobs = payload.jobs || [];
  const oe = identifiers.oe?.slice(0, 4).join(", ");
  const topProgrammer = payload.programmerEvidence?.programmers?.[0];
  const partLabel = payload.primaryIdentifier || payload.query || "Part";
  const pieces = [`${partLabel}${oe ? ` matched OE ${oe}` : ""}.`];
  if (jobs.length) {
    pieces.push(`${jobs.length} saved job${jobs.length === 1 ? "" : "s"} matched this part family.`);
    if (topProgrammer) {
      const percent = Number.isFinite(Number(topProgrammer.observedCoveragePercent)) ? `${topProgrammer.observedCoveragePercent}% observed success` : "observed coverage not fully scored";
      pieces.push(`Top programmer proof: ${topProgrammer.name}, ${topProgrammer.jobs} job${topProgrammer.jobs === 1 ? "" : "s"}, ${percent}.`);
    }
  } else {
    pieces.push("No saved job proof yet. Coverage proof is not established.");
  }
  return pieces.join(" ");
}

async function copyPartHistoryProof() {
  if (!latestPartHistory) return;
  const text = partHistoryProofSummary(latestPartHistory);
  try {
    await navigator.clipboard.writeText(text);
    if (partHistoryStatus) partHistoryStatus.textContent = "Proof summary copied.";
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    if (partHistoryStatus) partHistoryStatus.textContent = "Proof summary copied.";
  }
}

function renderPartHistoryActions(payload) {
  return `
    <section class="history-action-bar">
      <div class="badge-row">${partHistoryEvidenceBadges(payload).map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>
      <button class="secondary-action small" type="button" data-copy-part-proof>Copy Proof Summary</button>
    </section>
  `;
}

function renderPartHistoryCoverage(programmerEvidence = {}) {
  const programmers = programmerEvidence.programmers || [];
  if (!programmers.length) {
    return `
      <article class="assistant-card">
        <strong>No programmer proof yet</strong>
        <p>No saved job matched this part family with a recorded programmer.</p>
      </article>
    `;
  }

  return `
    <section class="coverage-grid">
      ${programmers
        .map((programmer) => {
          const percent = Number.isFinite(Number(programmer.observedCoveragePercent)) ? Number(programmer.observedCoveragePercent) : null;
          return `
            <article class="coverage-card">
              <div>
                <span>${escapeHtml(percent === null ? "N/A" : `${percent}%`)}</span>
                <strong>${escapeHtml(programmer.name)}</strong>
              </div>
              <div class="evidence-meter"><i style="width: ${escapeHtml(percent === null ? 0 : percent)}%"></i></div>
              <p>${escapeHtml(`${programmer.successes} success / ${programmer.warningsOrFailures} warning / ${programmer.unknown} unknown across ${programmer.jobs} job${programmer.jobs === 1 ? "" : "s"}.`)}</p>
              <div class="part-chip-row">${renderPartChips(programmer.vehicles, "No vehicles")}</div>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderPartHistoryJob(job) {
  const refs = (job.matchedReferences || []).map((reference) => reference.primaryLabel || reference.primary).filter(Boolean);
  return `
    <article class="history-job-card">
      <div class="history-job-head">
        <div>
          <span>${escapeHtml(job.outcome?.label || job.status || "Saved job")}</span>
          <strong>${escapeHtml(job.title || job.vehicle || "Saved job")}</strong>
        </div>
        <span class="status ${job.outcome?.key === "warning" ? "warn" : ""}">${escapeHtml(job.status || "History")}</span>
      </div>
      <div class="history-job-grid">
        <div><small>Vehicle</small><strong>${escapeHtml(job.vehicle || "Not recorded")}</strong></div>
        <div><small>VIN</small><strong>${escapeHtml(job.vin || "Not recorded")}</strong></div>
        <div><small>Programmer</small><strong>${escapeHtml(job.programmer || "Not recorded")}</strong></div>
        <div><small>Total</small><strong>${escapeHtml(formatMoney(job.price, job.payment))}</strong></div>
      </div>
      <div class="history-job-section">
        <small>Part numbers</small>
        <div class="part-chip-row">${renderPartChips(job.partNumbers, "No part numbers logged")}</div>
      </div>
      <div class="history-job-section">
        <small>Cross-reference match</small>
        <div class="part-chip-row">${renderPartChips(refs, "Direct job text match")}</div>
      </div>
      <div class="history-job-section">
        <small>OE sources</small>
        <div class="part-chip-row">${renderPartChips(job.oemSources, "No OE source linked")}</div>
      </div>
      <details>
        <summary>Notes and matched tokens</summary>
        <p>${escapeHtml((job.notes || []).slice(0, 5).join(" | ") || "No notes saved.")}</p>
        <div class="part-chip-row">${renderPartChips(job.matchedTokens || [], "No tokens")}</div>
      </details>
    </article>
  `;
}

function renderPartHistory(payload) {
  if (!partHistoryResult) return;
  latestPartHistory = payload;
  const identifiers = payload.identifiers || {};
  const jobs = payload.jobs || [];
  const crossReferences = payload.crossReferences || [];
  const summaryCards = [
    ["Primary", payload.primaryIdentifier],
    ["LR#", identifiers.lr?.[0]],
    ["MW#", identifiers.mw?.[0]],
    ["OE#", identifiers.oe?.[0]],
  ];

  partHistoryResult.innerHTML = `
    <section class="history-summary-grid">
      ${summaryCards
        .map(
          ([label, value]) => `
            <article class="metric">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value || "None")}</strong>
              <p>${escapeHtml(label === "Primary" ? `${jobs.length} matched job${jobs.length === 1 ? "" : "s"}` : payload.query)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
    ${renderPartHistoryActions(payload)}
    <section class="history-reference-panel">
      <div>
        <p class="eyebrow">Cross-reference family</p>
        <div class="part-chip-row">${renderPartChips(identifiers.all || [], "No cross-reference row found")}</div>
      </div>
      <div>
        <p class="eyebrow">Matched OE numbers</p>
        <div class="part-chip-row">${renderPartChips(identifiers.oe || [], "No OE numbers")}</div>
      </div>
      ${
        crossReferences.length
          ? `<div class="part-history-table">${crossReferences
              .slice(0, 6)
              .map(
                (reference) => `
                  <article>
                    <strong>${escapeHtml(reference.primaryLabel || reference.primary)}</strong>
                    <span>${escapeHtml([reference.sourceTable, ...(reference.oemPartNumbers || []).slice(0, 3)].filter(Boolean).join(" | "))}</span>
                  </article>
                `,
              )
              .join("")}</div>`
          : ""
      }
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Programmer proof</p>
          <h3>${escapeHtml(`${payload.programmerEvidence?.totalJobs || 0} matched jobs`)}</h3>
        </div>
      </div>
      ${renderPartHistoryCoverage(payload.programmerEvidence)}
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Job history</p>
          <h3>${escapeHtml(payload.primaryIdentifier || payload.query)}</h3>
        </div>
      </div>
      <div class="history-job-list">
        ${
          jobs.length
            ? jobs.map(renderPartHistoryJob).join("")
            : `<article class="assistant-card"><strong>No matched jobs yet</strong><p>Save or import worked jobs with this part number, OE number, FCC, LR#, or MW# to build coverage proof.</p></article>`
        }
      </div>
    </section>
  `;
  updateAiContextUi();
}

function coveragePercentLabel(value) {
  return Number.isFinite(Number(value)) ? `${Number(value)}%` : "N/A";
}

function coverageProofSummary(payload = {}) {
  const summary = payload.summary || {};
  const topProgrammer = payload.programmers?.find((item) => item.key !== "Programmer not recorded");
  const topMake = payload.makes?.[0];
  const pieces = [
    `${summary.automotiveJobs || 0} automotive jobs are in the TimLock-App proof base.`,
    `${summary.provenJobs || 0} are proven successful with ${coveragePercentLabel(summary.observedCoveragePercent)} observed success across scored jobs.`,
    `${summary.jobsWithProgrammer || 0} jobs have programmer proof and ${summary.jobsWithPartNumbers || 0} have part-number proof.`,
  ];
  if (topProgrammer) {
    pieces.push(`Top programmer: ${topProgrammer.key} with ${topProgrammer.jobs} job${topProgrammer.jobs === 1 ? "" : "s"} and ${coveragePercentLabel(topProgrammer.observedCoveragePercent)} observed success.`);
  }
  if (topMake) {
    pieces.push(`Top make: ${topMake.key} with ${topMake.jobs} job${topMake.jobs === 1 ? "" : "s"}.`);
  }
  return pieces.join(" ");
}

async function copyCoverageProof() {
  if (!latestCoverageDashboard) return;
  const text = coverageProofSummary(latestCoverageDashboard);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  if (coverageDashboardStatus) coverageDashboardStatus.textContent = "Coverage proof summary copied.";
}

function renderCoverageCard(item, type = "programmer") {
  const percent = Number.isFinite(Number(item.observedCoveragePercent)) ? Number(item.observedCoveragePercent) : null;
  const label = type === "make" ? "Make" : type === "part" ? "Part family" : "Programmer";
  return `
    <article class="coverage-card">
      <div>
        <span>${escapeHtml(percent === null ? "N/A" : `${percent}%`)}</span>
        <strong>${escapeHtml(item.key || label)}</strong>
      </div>
      <div class="evidence-meter"><i style="width: ${escapeHtml(percent === null ? 0 : percent)}%"></i></div>
      <p>${escapeHtml(`${item.successes || 0} success / ${item.warnings || 0} warning / ${item.unknown || 0} unknown across ${item.jobs || 0} job${item.jobs === 1 ? "" : "s"}.`)}</p>
      <div class="history-job-section">
        <small>${escapeHtml(type === "part" ? "Vehicles" : "Part proof")}</small>
        <div class="part-chip-row">${renderPartChips(type === "part" ? item.vehicles : item.partNumbers, type === "part" ? "No vehicles" : "No part numbers")}</div>
      </div>
      ${
        type !== "programmer"
          ? `<div class="history-job-section"><small>Programmers</small><div class="part-chip-row">${renderPartChips(item.programmers, "No programmer")}</div></div>`
          : `<div class="history-job-section"><small>Vehicles</small><div class="part-chip-row">${renderPartChips(item.vehicles, "No vehicles")}</div></div>`
      }
    </article>
  `;
}

function renderCoverageGap(title, items = [], empty) {
  return `
    <article class="coverage-gap-card">
      <strong>${escapeHtml(title)}</strong>
      ${
        items.length
          ? `<div class="coverage-gap-list">${items
              .map(
                (item) => `
                  <div>
                    <span>${escapeHtml(item.vehicle || "Unknown vehicle")}</span>
                    <small>${escapeHtml(item.title || item.id || "Saved job")}</small>
                  </div>
                `,
              )
              .join("")}</div>`
          : `<p>${escapeHtml(empty)}</p>`
      }
    </article>
  `;
}

function renderCoverageDashboard(payload = {}) {
  if (!coverageDashboard) return;
  latestCoverageDashboard = payload;
  const summary = payload.summary || {};
  const summaryCards = [
    ["Jobs", summary.automotiveJobs || 0, `${summary.totalJobs || 0} total saved records`],
    ["Observed", coveragePercentLabel(summary.observedCoveragePercent), `${summary.provenJobs || 0} proven / ${summary.warningJobs || 0} warnings`],
    ["Programmers", coveragePercentLabel(summary.programmerProofPercent), `${summary.jobsWithProgrammer || 0} jobs with programmer proof`],
    ["Parts", coveragePercentLabel(summary.partProofPercent), `${summary.jobsWithPartNumbers || 0} jobs with part numbers`],
    ["Cross-ref", coveragePercentLabel(summary.crossReferencePercent), `${summary.crossReferenceLinkedJobs || 0} jobs linked to ${summary.referenceRows || 0} rows`],
  ];

  coverageDashboard.innerHTML = `
    <section class="history-summary-grid coverage-summary-grid">
      ${summaryCards
        .map(
          ([label, value, caption]) => `
            <article class="metric">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <p>${escapeHtml(caption)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
    <section class="history-action-bar">
      <div class="badge-row">
        <span>Observed shop proof</span>
        <span>${escapeHtml(`${summary.referenceTokens || 0} reference tokens`)}</span>
        <span>${escapeHtml(`${summary.unknownJobs || 0} jobs need outcome cleanup`)}</span>
      </div>
      <button class="secondary-action small" type="button" data-copy-coverage-proof>Copy Coverage Proof</button>
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Programmer proof</p>
          <h3>What has worked here</h3>
        </div>
      </div>
      <div class="coverage-grid">
        ${
          payload.programmers?.length
            ? payload.programmers.slice(0, 6).map((item) => renderCoverageCard(item, "programmer")).join("")
            : `<article class="assistant-card"><strong>No programmer proof yet</strong><p>Save worked jobs with a programmer to build this chart.</p></article>`
        }
      </div>
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Make coverage</p>
          <h3>Coverage by vehicle family</h3>
        </div>
      </div>
      <div class="coverage-grid">
        ${
          payload.makes?.length
            ? payload.makes.slice(0, 8).map((item) => renderCoverageCard(item, "make")).join("")
            : `<article class="assistant-card"><strong>No make coverage yet</strong><p>Import or save vehicle jobs to build make-level proof.</p></article>`
        }
      </div>
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Part proof</p>
          <h3>Top part families</h3>
        </div>
      </div>
      <div class="coverage-grid">
        ${
          payload.parts?.length
            ? payload.parts.slice(0, 6).map((item) => renderCoverageCard(item, "part")).join("")
            : `<article class="assistant-card"><strong>No part proof yet</strong><p>Record LR#, MW#, TI#, OE#, FCC, or SKU values on jobs to build part proof.</p></article>`
        }
      </div>
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Cleanup queue</p>
          <h3>Proof gaps to fix next</h3>
        </div>
      </div>
      <div class="coverage-gap-grid">
        ${renderCoverageGap("Missing programmer", payload.gaps?.missingProgrammer || [], "Every shown automotive job has programmer proof.")}
        ${renderCoverageGap("Missing part number", payload.gaps?.missingPart || [], "Every shown automotive job has part proof.")}
        ${renderCoverageGap("Needs outcome", payload.gaps?.needsOutcome || [], "Every shown automotive job has a scored outcome.")}
      </div>
    </section>
    <article class="assistant-card">
      <strong>Proof note</strong>
      <p>${escapeHtml(payload.proofNote || "Coverage is observed from saved jobs.")}</p>
    </article>
  `;
  updateAiContextUi();
}

function proofVaultLocalAttachments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(proofVaultAttachmentsKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveProofVaultAttachments(attachments) {
  localStorage.setItem(proofVaultAttachmentsKey, JSON.stringify(attachments || {}));
}

function normalizeProofAttachment(attachment, storage = "browser") {
  return {
    ...attachment,
    storage: attachment.storage || storage,
  };
}

function mergeProofAttachmentMaps(...maps) {
  const merged = {};
  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([jobId, items]) => {
      if (!Array.isArray(items)) return;
      const existing = new Map((merged[jobId] || []).map((attachment) => [attachment.id, attachment]));
      items.forEach((attachment) => {
        if (!attachment?.id) return;
        existing.set(attachment.id, normalizeProofAttachment(attachment, attachment.storage || "browser"));
      });
      merged[jobId] = Array.from(existing.values()).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
    });
  });
  return merged;
}

function proofVaultAttachments() {
  return mergeProofAttachmentMaps(proofVaultServerAttachments, proofVaultLocalAttachments());
}

function proofVaultAttachmentCount(attachments = proofVaultAttachments()) {
  return Object.values(attachments).reduce((count, items) => count + (Array.isArray(items) ? items.length : 0), 0);
}

function browserProofAttachmentEntries() {
  return Object.entries(proofVaultLocalAttachments()).flatMap(([jobId, items]) =>
    (Array.isArray(items) ? items : [])
      .filter((attachment) => attachment?.id && attachment.dataUrl)
      .map((attachment) => ({ ...attachment, jobId })),
  );
}

function browserProofAttachmentCount() {
  return browserProofAttachmentEntries().length;
}

function removeBrowserProofAttachments(sourceIds = []) {
  const ids = new Set(sourceIds.filter(Boolean));
  if (!ids.size) return;
  const attachments = proofVaultLocalAttachments();
  Object.keys(attachments).forEach((jobId) => {
    attachments[jobId] = attachmentsForJob(jobId, attachments).filter((attachment) => !ids.has(attachment.id));
    if (!attachments[jobId].length) delete attachments[jobId];
  });
  saveProofVaultAttachments(attachments);
}

function attachmentsForJob(jobId, attachments = proofVaultAttachments()) {
  return Array.isArray(attachments[jobId]) ? attachments[jobId] : [];
}

function proofVaultStorageCaption() {
  if (proofVaultStorageMode === "cloudflare-r2") return "Cloud evidence files";
  if (proofVaultStorageMode === "local-file") return "Server local files";
  return "Browser fallback files";
}

function proofVaultStorageLabel(attachment = {}) {
  if (attachment.storage === "r2") return "Cloud";
  if (attachment.storage === "local") return "Server";
  return "Browser";
}

function renderProofAttachment(jobId, attachment) {
  const isImage = /^image\//.test(attachment.type || "");
  const url = attachment.previewUrl || attachment.url || attachment.dataUrl || "";
  const fileType = (attachment.type || "file").split("/").pop().toUpperCase();
  const media = isImage && url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="${escapeHtml(attachment.name || "Proof image")}" loading="lazy" /></a>`
    : url
      ? `<a class="proof-file-tile" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(fileType)}</a>`
      : `<span>${escapeHtml(fileType)}</span>`;
  return `
    <article class="proof-attachment">
      ${media}
      <div>
        <strong>${escapeHtml(attachment.name || "Attachment")}</strong>
        <small>${escapeHtml([proofVaultStorageLabel(attachment), Math.round((attachment.size || 0) / 1024) ? `${Math.round((attachment.size || 0) / 1024)} KB` : "", attachment.createdAt ? new Date(attachment.createdAt).toLocaleString() : ""].filter(Boolean).join(" | "))}</small>
      </div>
      <button class="icon-action" type="button" data-remove-proof-attachment="${escapeHtml(attachment.id)}" data-proof-job-id="${escapeHtml(jobId)}" title="Remove attachment">x</button>
    </article>
  `;
}

function renderProofVaultRecord(record, attachments) {
  const refs = (record.matchedReferences || []).map((reference) => reference.primaryLabel || reference.primary).filter(Boolean);
  const files = attachmentsForJob(record.id, attachments);
  return `
    <article class="proof-record-card">
      <div class="history-job-head">
        <div>
          <span>${escapeHtml(record.outcome?.label || record.status || "Saved proof")}</span>
          <strong>${escapeHtml(record.title || record.vehicle || "Saved job")}</strong>
        </div>
        <span class="status ${record.outcome?.key === "warning" ? "warn" : ""}">${escapeHtml(files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "No files")}</span>
      </div>
      <div class="history-job-grid">
        <div><small>Vehicle</small><strong>${escapeHtml(record.vehicle || "Not recorded")}</strong></div>
        <div><small>VIN</small><strong>${escapeHtml(record.vin || "Not recorded")}</strong></div>
        <div><small>Programmer</small><strong>${escapeHtml(record.programmer || "Not recorded")}</strong></div>
        <div><small>Total</small><strong>${escapeHtml(formatMoney(record.price, record.payment))}</strong></div>
      </div>
      <div class="history-job-section">
        <small>Part proof</small>
        <div class="part-chip-row">${renderPartChips(record.partNumbers, "No part numbers logged")}</div>
      </div>
      <div class="history-job-section">
        <small>OE / cross-reference</small>
        <div class="part-chip-row">${renderPartChips([record.oemSources || [], refs].flat(), "No linked OE")}</div>
      </div>
      <div class="proof-attachment-list">
        ${files.length ? files.map((attachment) => renderProofAttachment(record.id, attachment)).join("") : `<p>No attachments saved for this job.</p>`}
      </div>
      <div class="proof-card-actions">
        <label class="secondary-action small">
          Attach Proof
          <input type="file" accept="image/*,.pdf" data-proof-attach="${escapeHtml(record.id)}" hidden />
        </label>
        <button class="secondary-action small" type="button" data-proof-search-part="${escapeHtml((record.partNumbers || [])[0] || record.vin || record.vehicle || "")}">Search This Proof</button>
      </div>
      <details>
        <summary>Notes and tokens</summary>
        <p>${escapeHtml((record.notes || []).slice(0, 6).join(" | ") || "No notes saved.")}</p>
        <div class="part-chip-row">${renderPartChips(record.matchedTokens || [], "No matched tokens")}</div>
      </details>
    </article>
  `;
}

function renderProofMigrationPanel() {
  const localCount = browserProofAttachmentCount();
  if (!localCount) return "";
  return `
    <section class="proof-migration-panel">
      <div>
        <p class="eyebrow">Browser-local proof</p>
        <strong>${escapeHtml(`${localCount} attachment${localCount === 1 ? "" : "s"} on this device`)}</strong>
        <p>Move these files into server/R2 storage so they can follow the job across PC and phone.</p>
      </div>
      <button class="secondary-action small" type="button" data-migrate-local-proof>Migrate Now</button>
    </section>
  `;
}

function renderProofVault(payload = {}) {
  if (!proofVault) return;
  latestProofVault = payload;
  const summary = payload.summary || {};
  const attachments = proofVaultAttachments();
  const summaryCards = [
    ["Saved Jobs", summary.totalJobs || 0, `${summary.shownJobs || payload.records?.length || 0} shown`],
    ["Proven", summary.provenJobs || 0, `${summary.warningJobs || 0} warnings`],
    ["Files", proofVaultAttachmentCount(attachments), proofVaultStorageCaption()],
    ["Cross-Refs", summary.matchedReferenceRows || 0, `${summary.referenceRows || 0} reference rows`],
  ];

  proofVault.innerHTML = `
    <section class="history-summary-grid">
      ${summaryCards
        .map(
          ([label, value, caption]) => `
            <article class="metric">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <p>${escapeHtml(caption)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
    <section class="history-action-bar">
      <div class="badge-row">
        <span>${escapeHtml(payload.query ? `Search: ${payload.query}` : "Recent proof only")}</span>
        <span>${escapeHtml(`${summary.unknownJobs || 0} unknown outcomes`)}</span>
        <span>${escapeHtml(`${localArchivedJobs().length} local archived jobs`)}</span>
        <span>${escapeHtml(proofVaultStorageCaption())}</span>
      </div>
      <button class="secondary-action small" type="button" data-copy-proof-vault-summary>Copy Packet Summary</button>
    </section>
    ${renderProofMigrationPanel()}
    ${
      payload.partHistory?.programmerEvidence?.programmers?.length
        ? `<section class="history-section"><div class="panel-header tight"><div><p class="eyebrow">Programmer evidence</p><h3>${escapeHtml(payload.partHistory.primaryIdentifier || payload.query)}</h3></div></div>${renderPartHistoryCoverage(payload.partHistory.programmerEvidence)}</section>`
        : ""
    }
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Proof records</p>
          <h3>${escapeHtml(`${payload.records?.length || 0} record${payload.records?.length === 1 ? "" : "s"}`)}</h3>
        </div>
      </div>
      <div class="proof-record-list">
        ${
          payload.records?.length
            ? payload.records.map((record) => renderProofVaultRecord(record, attachments)).join("")
            : `<article class="assistant-card"><strong>No proof matched</strong><p>Try an LR#, MW#, OE#, FCC, VIN, programmer, or vehicle search.</p></article>`
        }
      </div>
    </section>
    <article class="assistant-card">
      <strong>Vault note</strong>
      <p>${escapeHtml(payload.proofNote || "Proof Vault uses saved jobs, cross references, programmer evidence, and attachment proof.")}</p>
    </article>
  `;
  updateAiContextUi();
}

async function loadProofVaultAttachments(jobId = "") {
  try {
    const suffix = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";
    const payload = await api(`/api/proof-vault/attachments${suffix}`);
    proofVaultServerAttachments = payload.byJob || {};
    proofVaultStorageMode = payload.storage || "local-file";
    proofVaultAttachmentMaxBytes = Number(payload.maxBytes) || proofVaultAttachmentMaxBytes;
    return payload;
  } catch {
    proofVaultServerAttachments = {};
    proofVaultStorageMode = "browser-local";
    return null;
  }
}

async function loadProofVault(query = proofVaultForm?.elements.proofQuery?.value || "") {
  if (!proofVault) return;
  try {
    const cleanQuery = cleanInput(query);
    if (proofVaultStatus) proofVaultStatus.textContent = cleanQuery ? "Searching proof vault..." : "Loading recent proof...";
    const attachmentLoad = loadProofVaultAttachments();
    const payload = await api("/api/proof-vault", {
      method: "POST",
      body: JSON.stringify({ q: cleanQuery, jobs: localArchivedJobs() }),
      timeoutMs: 20000,
    });
    await attachmentLoad;
    renderProofVault(payload);
    if (proofVaultStatus) {
      proofVaultStatus.textContent =
        payload.mode === "recent"
          ? `Vault ready. Showing ${payload.summary?.shownJobs || payload.records?.length || 0} recent records; search to narrow proof.`
          : `Vault searched ${payload.summary?.totalJobs || 0} jobs and found ${payload.summary?.matchingJobs || 0} records.`;
    }
  } catch (error) {
    if (proofVaultStatus) proofVaultStatus.textContent = error.message;
    proofVault.innerHTML = `<article class="assistant-card"><strong>Proof Vault unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

async function addProofAttachment(jobId, file) {
  if (!jobId || !file) return;
  if (file.size > proofVaultAttachmentMaxBytes) {
    if (proofVaultStatus) proofVaultStatus.textContent = `Attachment is over ${Math.round(proofVaultAttachmentMaxBytes / 1_000_000)} MB. Export the photo smaller, then attach it.`;
    return;
  }
  const dataUrl = await fileAsDataUrl(file);
  try {
    const payload = await api("/api/proof-vault/attachments", {
      method: "POST",
      body: JSON.stringify({
        jobId,
        name: file.name,
        type: file.type || "application/octet-stream",
        dataUrl,
      }),
    });
    proofVaultStorageMode = payload.storage || proofVaultStorageMode;
    const current = attachmentsForJob(jobId, proofVaultServerAttachments).filter((attachment) => attachment.id !== payload.attachment?.id);
    proofVaultServerAttachments[jobId] = [payload.attachment, ...current].filter(Boolean).slice(0, 20);
    renderProofVault(latestProofVault);
    if (proofVaultStatus) proofVaultStatus.textContent = `Attached server-backed proof to ${jobId}.`;
    return;
  } catch (serverError) {
    if (file.size > 1_500_000) {
      if (proofVaultStatus) proofVaultStatus.textContent = `Server upload failed: ${serverError.message}. Browser fallback is limited to 1.5 MB.`;
      return;
    }
  }

  const attachments = proofVaultLocalAttachments();
  const files = attachmentsForJob(jobId, attachments).slice(0, 7);
  files.unshift({
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
    dataUrl,
    storage: "browser",
  });
  attachments[jobId] = files;
  saveProofVaultAttachments(attachments);
  renderProofVault(latestProofVault);
  if (proofVaultStatus) proofVaultStatus.textContent = `Attached browser-local proof to ${jobId}.`;
}

async function migrateBrowserProofAttachments() {
  const entries = browserProofAttachmentEntries();
  if (!entries.length) {
    if (proofVaultStatus) proofVaultStatus.textContent = "No browser-local proof needs migration.";
    if (storageSettingsStatus) storageSettingsStatus.textContent = "No browser-local proof needs migration.";
    return;
  }

  await syncLocalJobsToServer();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const migratedIds = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const progress = `Migrating proof ${index + 1} of ${entries.length}...`;
    if (proofVaultStatus) proofVaultStatus.textContent = progress;
    if (storageSettingsStatus) storageSettingsStatus.textContent = progress;
    try {
      const payload = await api("/api/proof-vault/attachments/migrate", {
        method: "POST",
        body: JSON.stringify({
          attachments: [
            {
              ...entry,
              sourceId: entry.id,
              id: entry.id,
              jobId: entry.jobId,
            },
          ],
        }),
        timeoutMs: 30000,
      });
      proofVaultStorageMode = payload.storage || proofVaultStorageMode;
      proofVaultServerAttachments = payload.byJob || proofVaultServerAttachments;
      const moved = [...(payload.uploaded || []), ...(payload.skipped || [])].map((item) => item.sourceId).filter(Boolean);
      migratedIds.push(...moved);
      uploaded += payload.summary?.uploaded || 0;
      skipped += payload.summary?.skipped || 0;
      failed += payload.summary?.failed || 0;
    } catch {
      failed += 1;
    }
  }

  removeBrowserProofAttachments(migratedIds);
  await loadProofVaultAttachments();
  if (latestProofVault) renderProofVault(latestProofVault);
  await loadStorageStatus({ quiet: true });
  const summary = `Migration complete: ${uploaded} uploaded, ${skipped} already present, ${failed} failed.`;
  if (proofVaultStatus) proofVaultStatus.textContent = summary;
  if (storageSettingsStatus) storageSettingsStatus.textContent = summary;
}

async function removeProofAttachment(jobId, attachmentId) {
  const serverFiles = attachmentsForJob(jobId, proofVaultServerAttachments);
  if (serverFiles.some((attachment) => attachment.id === attachmentId)) {
    try {
      await api(`/api/proof-vault/attachments/${encodeURIComponent(attachmentId)}`, { method: "DELETE" });
      proofVaultServerAttachments[jobId] = serverFiles.filter((attachment) => attachment.id !== attachmentId);
      if (!proofVaultServerAttachments[jobId].length) delete proofVaultServerAttachments[jobId];
      renderProofVault(latestProofVault);
      if (proofVaultStatus) proofVaultStatus.textContent = "Server attachment removed.";
    } catch (error) {
      if (proofVaultStatus) proofVaultStatus.textContent = `Could not remove attachment: ${error.message}`;
    }
    return;
  }

  const attachments = proofVaultLocalAttachments();
  attachments[jobId] = attachmentsForJob(jobId, attachments).filter((attachment) => attachment.id !== attachmentId);
  if (!attachments[jobId].length) delete attachments[jobId];
  saveProofVaultAttachments(attachments);
  renderProofVault(latestProofVault);
  if (proofVaultStatus) proofVaultStatus.textContent = "Attachment removed.";
}

function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatStorageBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${Math.round(bytes)} B`;
}

function storageModeLabel(value) {
  if (value === "cloudflare-r2") return "Cloudflare R2";
  if (value === "local-file") return "Server files";
  if (value === "external-data-dir") return "Persistent data dir";
  if (value === "repo-local") return "Local dev folder";
  return cleanInput(value) || "Unknown";
}

function renderStorageStatus(payload = latestStorageStatus) {
  if (!storageStatusPanel) return;
  if (!payload) {
    storageStatusPanel.innerHTML = `
      <article class="assistant-card">
        <strong>Storage status unavailable</strong>
        <p>Refresh storage status after the server is awake.</p>
      </article>
    `;
    return;
  }

  const storage = payload.storage || {};
  const counts = payload.counts || {};
  const r2 = storage.r2 || {};
  const cards = [
    ["Jobs", counts.jobs || 0, "Server job memory"],
    ["Proof files", counts.proofAttachments || 0, storageModeLabel(storage.attachmentMode)],
    ["Browser proof", browserProofAttachmentCount(), "This device only"],
    ["AI memory", (counts.aiFeedback || 0) + (counts.shopRules || 0), `${counts.shopRules || 0} shop rules`],
    ["Profiles", counts.vehicleProfiles || 0, `${counts.referenceVault || 0} owner notes`],
  ];
  const warnings = payload.warnings || [];
  const healthFiles = (payload.healthFiles || []).slice(0, 8);

  storageStatusPanel.innerHTML = `
    <section class="history-summary-grid storage-status-grid">
      ${cards
        .map(
          ([label, value, caption]) => `
            <article class="metric">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <p>${escapeHtml(caption)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
    <section class="storage-status-details">
      <article>
        <span>Job store</span>
        <strong>${escapeHtml(storageModeLabel(storage.dataDirMode))}</strong>
        <p>${escapeHtml(storage.mutableDataDir || "Path unavailable")}</p>
      </article>
      <article>
        <span>Proof attachments</span>
        <strong>${escapeHtml(storageModeLabel(storage.attachmentMode))}</strong>
        <p>${escapeHtml(`Upload limit ${formatStorageBytes(storage.maxAttachmentBytes)}. R2 ${r2.configured ? "configured" : "not configured"}. Cloud ${counts.proofAttachmentsR2 || 0} / server ${counts.proofAttachmentsLocal || 0}.`)}</p>
      </article>
      <article>
        <span>Backup coverage</span>
        <strong>${escapeHtml(payload.backup?.serverBackupAvailable ? "Server backup ready" : "Backup unavailable")}</strong>
        <p>${escapeHtml(payload.backup?.includesProofAttachmentFiles ? "Includes proof files" : `Includes proof metadata. File previews use ${storage.privateProofFiles ? "private server proxy" : storage.publicR2Preview ? "public R2 preview URL" : "server proxy"}.`)}</p>
      </article>
    </section>
    ${
      warnings.length
        ? `<section class="storage-warning-list">${warnings.map((warning) => `<article>${escapeHtml(warning)}</article>`).join("")}</section>`
        : `<article class="assistant-card storage-ok-card"><strong>Durable setup looks ready</strong><p>Job memory, AI memory, and Proof Vault metadata are readable.</p></article>`
    }
    <section class="storage-file-list">
      ${healthFiles
        .map(
          (file) => `
            <article class="${file.ok ? "" : "warn"}">
              <span>${escapeHtml(file.label)}</span>
              <strong>${escapeHtml(file.ok ? `${file.count ?? "OK"}` : "Needs attention")}</strong>
            </article>
          `,
        )
        .join("")}
    </section>
    ${renderStorageDiagnostics()}
  `;
}

function renderStorageDiagnostics(payload = latestStorageDiagnostics) {
  if (!payload) return "";
  const tests = payload.tests || [];
  return `
    <section class="storage-diagnostics-panel">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Storage diagnostics</p>
          <h3>${escapeHtml(payload.status === "passed" ? "Round-trip passed" : payload.status === "warning" ? "Round-trip passed with warnings" : "Storage test failed")}</h3>
        </div>
      </div>
      <div class="storage-file-list">
        ${tests
          .map(
            (test) => `
              <article class="${test.ok ? "" : "warn"}">
                <span>${escapeHtml(test.label)}</span>
                <strong>${escapeHtml(test.ok ? "Passed" : "Failed")}</strong>
                <p>${escapeHtml(test.ok ? `${test.ms} ms` : test.error || "Check storage setup")}</p>
              </article>
            `,
          )
          .join("")}
      </div>
      <article class="assistant-card">
        <strong>${escapeHtml(`Sampled ${payload.sample?.checked || 0} proof file${payload.sample?.checked === 1 ? "" : "s"}`)}</strong>
        <p>${escapeHtml(`${payload.sample?.readable || 0} readable, ${payload.sample?.missing || 0} missing. ${(payload.warnings || []).join(" ")}`.trim())}</p>
      </article>
    </section>
  `;
}

async function loadStorageStatus({ quiet = false } = {}) {
  if (!storageStatusPanel) return null;
  try {
    if (storageSettingsStatus && !quiet) storageSettingsStatus.textContent = "Checking server storage...";
    const payload = await api("/api/storage/status", { timeoutMs: 10000, noStatus: true });
    latestStorageStatus = payload;
    renderStorageStatus(payload);
    if (storageSettingsStatus && !quiet) {
      storageSettingsStatus.textContent = payload.warnings?.length
        ? `Storage checked with ${payload.warnings.length} warning${payload.warnings.length === 1 ? "" : "s"}.`
        : "Storage checked. Server data is readable.";
    }
    return payload;
  } catch (error) {
    if (storageSettingsStatus) storageSettingsStatus.textContent = `Storage check failed: ${error.message}`;
    renderStorageStatus(null);
    return null;
  }
}

async function runStorageDiagnostics() {
  if (storageSettingsStatus) storageSettingsStatus.textContent = "Running storage round-trip test...";
  try {
    const payload = await api("/api/storage/diagnostics", {
      method: "POST",
      body: JSON.stringify({}),
      timeoutMs: 45000,
      noStatus: true,
    });
    latestStorageDiagnostics = payload;
    if (!latestStorageStatus) await loadStorageStatus({ quiet: true });
    renderStorageStatus(latestStorageStatus);
    if (storageSettingsStatus) {
      storageSettingsStatus.textContent =
        payload.status === "passed"
          ? "Storage diagnostics passed."
          : payload.status === "warning"
            ? `Storage diagnostics passed with ${payload.warnings?.length || 0} warning${payload.warnings?.length === 1 ? "" : "s"}.`
            : "Storage diagnostics failed. Check the warning cards below.";
    }
  } catch (error) {
    latestStorageDiagnostics = {
      status: "failed",
      tests: [{ label: "Storage diagnostics", ok: false, error: error.message }],
      sample: { checked: 0, readable: 0, missing: 0 },
      warnings: [error.message],
    };
    if (!latestStorageStatus) await loadStorageStatus({ quiet: true });
    renderStorageStatus(latestStorageStatus);
    if (storageSettingsStatus) storageSettingsStatus.textContent = `Storage diagnostics failed: ${error.message}`;
  }
}

async function exportServerBackup() {
  if (storageSettingsStatus) storageSettingsStatus.textContent = "Building server backup...";
  try {
    const payload = await api("/api/storage/export", { timeoutMs: 30000, noStatus: true });
    downloadJson(`timlock-server-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
    latestStorageStatus = payload.status || latestStorageStatus;
    renderStorageStatus(latestStorageStatus);
    if (storageSettingsStatus) storageSettingsStatus.textContent = "Server backup exported.";
  } catch (error) {
    if (storageSettingsStatus) storageSettingsStatus.textContent = `Export failed: ${error.message}`;
  }
}

async function importServerBackup(file) {
  if (!file) return;
  if (storageSettingsStatus) storageSettingsStatus.textContent = "Importing server backup...";
  try {
    const bundle = JSON.parse(await file.text());
    const payload = await api("/api/storage/import", {
      method: "POST",
      body: JSON.stringify({ bundle }),
      timeoutMs: 40000,
      noStatus: true,
    });
    latestStorageStatus = payload.status || latestStorageStatus;
    renderStorageStatus(latestStorageStatus);
    await Promise.allSettled([
      loadJobs(),
      loadCoverageDashboard(),
      loadAiMemory(),
      loadAiAdvisor(),
      loadReferenceVault(),
      loadPublicReferenceSources(),
      loadProofVaultAttachments().then(() => {
        if (latestProofVault) renderProofVault(latestProofVault);
      }),
    ]);
    if (storageSettingsStatus) {
      const imported = payload.result || {};
      storageSettingsStatus.textContent = `Backup imported. Jobs: ${imported.store?.jobs ?? latestStorageStatus?.counts?.jobs ?? 0}, proof files: ${imported.proofAttachments ?? latestStorageStatus?.counts?.proofAttachments ?? 0}.`;
    }
  } catch (error) {
    if (storageSettingsStatus) storageSettingsStatus.textContent = `Import failed: ${error.message}`;
  }
}

function exportProofVaultBackup() {
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    jobs: mergeJobLists(jobs, localArchivedJobs()),
    attachments: proofVaultLocalAttachments(),
    serverAttachments: proofVaultServerAttachments,
    attachmentStorage: proofVaultStorageMode,
    proofVault: latestProofVault,
    coverage: latestCoverageDashboard,
  };
  downloadJson(`timlock-proof-vault-${new Date().toISOString().slice(0, 10)}.json`, payload);
  if (proofVaultStatus) proofVaultStatus.textContent = "Proof Vault backup exported.";
}

async function importProofVaultBackup(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const importedJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    if (importedJobs.length) rememberJobs(importedJobs);
    const currentAttachments = proofVaultAttachments();
    const importedAttachments = payload.attachments && typeof payload.attachments === "object" ? payload.attachments : {};
    for (const [jobId, items] of Object.entries(importedAttachments)) {
      const existing = new Map(attachmentsForJob(jobId, currentAttachments).map((attachment) => [attachment.id, attachment]));
      (Array.isArray(items) ? items : []).forEach((attachment) => {
        if (attachment?.id && attachment.dataUrl) existing.set(attachment.id, normalizeProofAttachment(attachment, "browser"));
      });
      currentAttachments[jobId] = Array.from(existing.values()).slice(0, 8);
    }
    saveProofVaultAttachments(currentAttachments);
    await syncLocalJobsToServer();
    await loadJobs();
    await loadCoverageDashboard();
    await loadProofVault();
    if (proofVaultStatus) proofVaultStatus.textContent = `Imported ${importedJobs.length} jobs and ${proofVaultAttachmentCount(importedAttachments)} attachments.`;
  } catch (error) {
    if (proofVaultStatus) proofVaultStatus.textContent = `Import failed: ${error.message}`;
  }
}

function proofVaultPacketSummary() {
  const payload = latestProofVault || {};
  const summary = payload.summary || {};
  const query = payload.query ? ` for ${payload.query}` : "";
  const topProgrammer = payload.partHistory?.programmerEvidence?.programmers?.[0];
  return [
    `Proof Vault${query}: ${summary.matchingJobs || 0} matching job records from ${summary.totalJobs || 0} saved jobs.`,
    `${summary.provenJobs || 0} proven, ${summary.warningJobs || 0} warnings, ${summary.unknownJobs || 0} unknown.`,
    `${proofVaultAttachmentCount()} evidence attachment${proofVaultAttachmentCount() === 1 ? "" : "s"} available through ${proofVaultStorageCaption().toLowerCase()}.`,
    topProgrammer ? `Top programmer evidence: ${topProgrammer.name}, ${topProgrammer.jobs} jobs, ${coveragePercentLabel(topProgrammer.observedCoveragePercent)} observed success.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function copyProofVaultSummary() {
  const text = proofVaultPacketSummary();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  if (proofVaultStatus) proofVaultStatus.textContent = "Proof packet summary copied.";
}

const codeDeskSystems = [
  {
    id: "kw1",
    name: "KW1 / Kwikset Classic",
    category: "Residential",
    family: "Residential edge cut",
    source: "Public depth-space reference",
    blanks: ["KW1", "KW10", "1176"],
    cuts: 5,
    stop: "Shoulder",
    spaces: [0.247, 0.397, 0.547, 0.697, 0.847],
    depths: {
      1: 0.329,
      2: 0.306,
      3: 0.283,
      4: 0.260,
      5: 0.237,
      6: 0.214,
      7: 0.191,
    },
    macs: 4,
    notes: ["Verify cutter card and shoulder stop before cutting customer keys.", "Use authorized job proof for code-originated work."],
  },
  {
    id: "sc1",
    name: "SC1 / Schlage Classic",
    category: "Residential",
    family: "Residential edge cut",
    source: "Public depth-space reference",
    blanks: ["SC1", "SC4", "1145"],
    cuts: 5,
    stop: "Shoulder",
    spaces: [0.231, 0.387, 0.543, 0.699, 0.855],
    depths: {
      0: 0.335,
      1: 0.320,
      2: 0.305,
      3: 0.290,
      4: 0.275,
      5: 0.260,
      6: 0.245,
      7: 0.230,
      8: 0.215,
      9: 0.200,
    },
    macs: 7,
    notes: ["Confirm system variant, keyway, and cutter setup before originating.", "Imported records can add authorized code-to-bitting lookup."],
  },
  {
    id: "auto-y164",
    name: "Y164 / Chrysler 8-cut",
    category: "Automotive",
    family: "Automotive edge cut",
    source: "Automotive template - import exact depth-space card",
    blanks: ["Y164", "Y164-PT", "CHRY", "MOPAR"],
    cuts: 8,
    stop: "Shoulder",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Template only until an exact Y164 depth-space card is imported.", "Require job authorization/proof before code-originated work."],
  },
  {
    id: "auto-h92",
    name: "H92/H94 / Ford 8-cut",
    category: "Automotive",
    family: "Automotive edge cut",
    source: "Automotive template - import exact depth-space card",
    blanks: ["H92", "H92-PT", "H94", "H94-PT", "H128", "FORD"],
    cuts: 8,
    stop: "Shoulder",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Template only until the exact Ford card/version is imported.", "Confirm blank, chip, and application before cutting."],
  },
  {
    id: "auto-hu100",
    name: "HU100 / GM side-mill",
    category: "Automotive",
    family: "Automotive high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["HU100", "B111", "B111-PT", "GM"],
    cuts: 10,
    stop: "Tip / card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["High-security templates need exact spacing, depth, and side/axis rules from your verified card.", "Do not rely on VIN alone for mechanical keyway."],
  },
  {
    id: "auto-toy44",
    name: "TOY44/TOY48 / Toyota-Lexus",
    category: "Automotive",
    family: "Automotive edge/high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["TOY44", "TOY44D", "TOY44G", "TOY48", "TR47", "TOYOTA", "LEXUS"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Toyota/Lexus systems split by keyway and generation. Import the exact card before measurement snapping.", "Use part proof and vehicle application notes from saved jobs."],
  },
  {
    id: "auto-honda",
    name: "HO01/HO03 / Honda-Acura",
    category: "Automotive",
    family: "Automotive edge/high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["HO01", "HO03", "HO05", "HD103", "HONDA", "ACURA"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Honda/Acura keyways vary by generation and shell/prox package.", "Import your verified card before translating measurements."],
  },
  {
    id: "auto-nissan",
    name: "NI04/NI07/DA34 / Nissan-Infiniti",
    category: "Automotive",
    family: "Automotive edge/high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["NI04", "NI07", "DA34", "X237", "NISSAN", "INFINITI"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Nissan/Infiniti systems split by keyway, prox generation, and insert style.", "Use authorized code data only after customer proof is logged."],
  },
  {
    id: "auto-hyundai-kia",
    name: "HY/KIA / Hyundai-Kia",
    category: "Automotive",
    family: "Automotive edge/high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["HY15", "HY18", "HY18R", "HY20", "KK12", "HYUNDAI", "KIA"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Hyundai/Kia systems split heavily by model year, smart key platform, and emergency insert.", "Import the exact card before measurement snapping."],
  },
  {
    id: "auto-mazda",
    name: "MAZ24/MZ31 / Mazda",
    category: "Automotive",
    family: "Automotive edge/high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["MAZ24", "MAZ24R", "MZ31", "X249", "MAZDA"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Mazda key systems vary by prox generation and keyway.", "Use imported cards and saved-job proof before cutting production keys."],
  },
  {
    id: "auto-subaru",
    name: "SUB/DAT / Subaru",
    category: "Automotive",
    family: "Automotive edge/high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["SUB4", "DAT17", "B110", "SUBARU"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["Subaru applications split by blade profile and prox generation.", "Confirm blank and immobilizer path against the saved job or imported data."],
  },
  {
    id: "auto-vw-audi",
    name: "HU66/HU162 / VW-Audi",
    category: "Automotive",
    family: "Automotive high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["HU66", "HU66T6", "HU162T", "VOLKSWAGEN", "AUDI"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["VW/Audi laser systems require exact card, side, and stop setup.", "Treat programming/security data as verify-first unless proven by job history."],
  },
  {
    id: "auto-euro-high-security",
    name: "European high-security",
    category: "Automotive",
    family: "Automotive high security",
    source: "Automotive template - import exact depth-space card",
    blanks: ["HU64", "HU92", "HU100R", "Emergency insert"],
    cuts: "",
    stop: "Card-specific",
    spaces: [],
    depths: {},
    macs: "Card",
    cardRequired: true,
    notes: ["BMW/Mercedes style systems need exact card and strict authorization workflow.", "Use this only as a parking place until the verified system is imported."],
  },
  {
    id: "auto-generic",
    name: "Verify keyway/card",
    category: "Automotive",
    family: "Automotive verify-first",
    source: "Automotive template placeholder",
    blanks: [],
    cuts: "",
    stop: "Verify",
    spaces: [],
    depths: {},
    macs: "Verify",
    cardRequired: true,
    notes: ["Use this when the app knows the vehicle but not enough to suggest a family.", "Import a verified depth-space card and authorized code data before production work."],
  },
];

function loadCodeDeskImports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(codeDeskImportKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeCodeDeskRecord).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveCodeDeskImports(records) {
  codeDeskImportedRecords = (records || []).map(normalizeCodeDeskRecord).filter(Boolean).slice(0, 5000);
  localStorage.setItem(codeDeskImportKey, JSON.stringify(codeDeskImportedRecords));
}

function loadCodeDeskSystems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(codeDeskSystemKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeCodeDeskSystem).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveCodeDeskSystems(systems) {
  codeDeskCustomSystems = (systems || []).map(normalizeCodeDeskSystem).filter(Boolean).slice(0, 500);
  localStorage.setItem(codeDeskSystemKey, JSON.stringify(codeDeskCustomSystems));
}

function codeDeskAvailableSystems() {
  const map = new Map();
  [...codeDeskSystems, ...codeDeskCustomSystems].forEach((system) => {
    if (!system?.id) return;
    map.set(system.id, system);
  });
  return Array.from(map.values());
}

function splitCodeDeskList(value) {
  if (Array.isArray(value)) return value.map(cleanInput).filter(Boolean);
  return cleanInput(value)
    .split(/[|;,/]+/)
    .map(cleanInput)
    .filter(Boolean);
}

function parseCodeDeskNumbers(value) {
  if (Array.isArray(value)) return value.map(Number).filter((item) => Number.isFinite(item));
  return (cleanInput(value).match(/\d+(?:\.\d+)?/g) || [])
    .map(Number)
    .map((item) => (item > 1 ? item / 1000 : item))
    .filter((item) => Number.isFinite(item));
}

function parseCodeDeskDepths(value, row = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([cut, depth]) => [cleanInput(cut), Number(depth)]).filter(([, depth]) => Number.isFinite(depth)));
  }
  const text = cleanInput(value);
  const depths = {};
  if (text.startsWith("{")) {
    try {
      return parseCodeDeskDepths(JSON.parse(text));
    } catch {
      // Fall through to pair parsing.
    }
  }
  text.split(/[|;,]+/).forEach((pair) => {
    const match = pair.match(/([0-9A-Z?]+)\s*[:=]\s*(\d+(?:\.\d+)?)/i);
    if (!match) return;
    const depth = Number(match[2]);
    if (Number.isFinite(depth)) depths[match[1]] = depth > 1 ? depth / 1000 : depth;
  });
  Object.entries(row || {}).forEach(([key, raw]) => {
    const match = key.match(/^depth([0-9a-z?]+)$/i);
    const depth = Number(raw);
    if (match && Number.isFinite(depth)) depths[match[1].toUpperCase()] = depth > 1 ? depth / 1000 : depth;
  });
  return depths;
}

function normalizeCodeDeskSystem(system = {}) {
  if (!system || typeof system !== "object") return null;
  const row = Object.fromEntries(Object.entries(system).map(([key, value]) => [normalizeImportHeader(key), value]));
  const name = pickCodeDeskField(row, ["name", "system", "card", "keyway", "description"]);
  const id = cleanInput(system.id || row.id) || compactCodeDeskKey(name).toLowerCase();
  if (!name || !id) return null;
  const depths = parseCodeDeskDepths(system.depths || row.depths, row);
  const spaces = parseCodeDeskNumbers(system.spaces || row.spaces || row.space);
  return {
    id,
    name,
    category: pickCodeDeskField(row, ["category", "type"]) || "Imported",
    family: pickCodeDeskField(row, ["family", "format", "style"]) || (compactCodeDeskKey(name).includes("HU") || compactCodeDeskKey(name).includes("HIGH") ? "Automotive high security" : "Automotive edge cut"),
    source: pickCodeDeskField(row, ["source", "origin", "vendor"]) || "Imported depth-space card",
    blanks: splitCodeDeskList(system.blanks || row.blanks || row.blank || row.keyblank || row.keyway),
    spaces,
    depths,
    macs: pickCodeDeskField(row, ["macs", "mac"]) || "Verify",
    cuts: cleanInput(system.cuts || row.cuts || row.positions) || spaces.length || "",
    stop: pickCodeDeskField(row, ["stop", "stoptype", "shoulder", "tip"]) || "Card-specific",
    cardRequired: !Object.keys(depths).length,
    custom: true,
    notes: splitCodeDeskList(system.notes || row.notes || row.note).length
      ? splitCodeDeskList(system.notes || row.notes || row.note)
      : ["Imported automotive card. Verify machine setup before cutting."],
  };
}

function normalizeCodeDeskKey(value) {
  return cleanInput(value).toUpperCase();
}

function compactCodeDeskKey(value) {
  return normalizeCodeDeskKey(value).replace(/[^A-Z0-9?]/g, "");
}

function normalizeBittingInput(value) {
  const text = cleanInput(value);
  if (!text) return [];
  const compact = text.replace(/[^0-9?]/g, "");
  if (compact && !/[\s,;/-]/.test(text)) return compact.split("");
  return text
    .split(/[\s,;/-]+/)
    .map((part) => part.replace(/[^0-9?]/g, ""))
    .filter(Boolean);
}

function normalizeImportHeader(value) {
  return cleanInput(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickCodeDeskField(row, names) {
  for (const name of names) {
    const value = row[normalizeImportHeader(name)];
    if (cleanInput(value)) return cleanInput(value);
  }
  return "";
}

function normalizeCodeDeskRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  const row = Object.fromEntries(Object.entries(record).map(([key, value]) => [normalizeImportHeader(key), value]));
  const system = pickCodeDeskField(row, ["system", "keyway", "blank", "key blank", "card"]);
  const code = pickCodeDeskField(row, ["code", "key code", "lock code", "factory code"]);
  const bitting = normalizeBittingInput(pickCodeDeskField(row, ["bitting", "cuts", "cut", "depths"])).join("");
  const keyway = pickCodeDeskField(row, ["keyway", "blank", "key blank"]);
  const vehicle = pickCodeDeskField(row, ["vehicle", "application", "make model", "year make model"]);
  const partNumber = pickCodeDeskField(row, ["part", "part number", "partnumber", "pn", "sku"]);
  const source = pickCodeDeskField(row, ["source", "origin", "vendor"]);
  const notes = pickCodeDeskField(row, ["notes", "note", "memo"]);
  if (!code && !bitting) return null;
  return {
    id: cleanInput(record.id) || `${compactCodeDeskKey(system)}-${compactCodeDeskKey(code)}-${bitting || Date.now()}`,
    system,
    keyway,
    code,
    bitting,
    vehicle,
    partNumber,
    source,
    notes,
    importedAt: cleanInput(record.importedAt) || new Date().toISOString(),
  };
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function rowLooksLikeCodeDeskSystem(row) {
  const normalized = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [normalizeImportHeader(key), value]));
  const type = compactCodeDeskKey(normalized.type || normalized.recordtype || normalized.kind);
  if (["SYSTEM", "CARD", "DEPTHSPACECARD", "DSD"].includes(type)) return true;
  return Boolean((normalized.spaces || normalized.depths || normalized.depth0 || normalized.depth1 || normalized.depth2) && !(normalized.code || normalized.keycode || normalized.lockcode || normalized.factorycode));
}

function parseCodeDeskImport(text) {
  const trimmed = cleanInput(text);
  if (!trimmed) return { records: [], systems: [] };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : parsed.records || parsed.codes || [];
    const systemRows = Array.isArray(parsed) ? parsed.filter(rowLooksLikeCodeDeskSystem) : parsed.systems || parsed.cards || [];
    return {
      records: rows.filter((row) => !rowLooksLikeCodeDeskSystem(row)).map(normalizeCodeDeskRecord).filter(Boolean),
      systems: systemRows.map(normalizeCodeDeskSystem).filter(Boolean),
    };
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!lines.length) return { records: [], systems: [] };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines.shift(), delimiter).map(normalizeImportHeader);
  const rows = lines.map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header || `column${index}`] = cells[index] || "";
    });
    return row;
  });
  return {
    records: rows.filter((row) => !rowLooksLikeCodeDeskSystem(row)).map(normalizeCodeDeskRecord).filter(Boolean),
    systems: rows.filter(rowLooksLikeCodeDeskSystem).map(normalizeCodeDeskSystem).filter(Boolean),
  };
}

function selectedCodeDeskSystem() {
  const systems = codeDeskAvailableSystems();
  const selected = codeDeskForm?.elements.system?.value || systems[0]?.id || codeDeskSystems[0].id;
  return systems.find((system) => system.id === selected) || systems[0] || codeDeskSystems[0];
}

function codeDeskSystemMatchesRecord(system, record) {
  const systemTokens = [system.id, system.name, system.category, system.family, ...(system.blanks || [])].map(compactCodeDeskKey).filter(Boolean);
  const recordTokens = [record.system, record.keyway].map(compactCodeDeskKey).filter(Boolean);
  if (!recordTokens.length) return true;
  return recordTokens.some((token) => systemTokens.some((systemToken) => token.includes(systemToken) || systemToken.includes(token)));
}

function codeDeskDepthRows(system) {
  return Object.entries(system.depths || {})
    .map(([cut, depth]) => ({ cut, depth }))
    .sort((a, b) => Number(a.cut) - Number(b.cut));
}

function codeDeskFormatMeasurement(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(3) : "";
}

function codeDeskCutRows(system, bitting = []) {
  const hasDepthCard = Boolean(Object.keys(system.depths || {}).length);
  return bitting.map((cut, index) => ({
    position: index + 1,
    cut,
    space: system.spaces[index],
    depth: system.depths?.[cut],
    valid: !hasDepthCard || cut === "?" || Number.isFinite(Number(system.depths?.[cut])),
  }));
}

function nearestCodeDeskDepth(system, measurement) {
  const rows = codeDeskDepthRows(system);
  return rows
    .map((row) => ({ ...row, difference: Math.abs(row.depth - measurement) }))
    .sort((a, b) => a.difference - b.difference)[0];
}

function codeDeskMeasurementsToCuts(system, query) {
  if (!codeDeskDepthRows(system).length) return [];
  const measurements = (cleanInput(query).match(/\d+(?:\.\d+)?/g) || [])
    .map(Number)
    .map((value) => (value > 1 ? value / 1000 : value))
    .filter((value) => Number.isFinite(value));
  return measurements.map((measurement, index) => {
    const nearest = nearestCodeDeskDepth(system, measurement);
    return {
      position: index + 1,
      measurement,
      cut: nearest?.cut || "?",
      depth: nearest?.depth,
      difference: nearest?.difference,
    };
  });
}

function findCodeDeskRecords(system, query, mode) {
  const compactQuery = compactCodeDeskKey(query);
  const bittingQuery = normalizeBittingInput(query).join("");
  return codeDeskImportedRecords
    .filter((record) => codeDeskSystemMatchesRecord(system, record))
    .filter((record) => {
      const code = compactCodeDeskKey(record.code);
      const bitting = compactCodeDeskKey(record.bitting);
      if (mode === "code") return compactQuery && code.includes(compactQuery);
      if (mode === "reverse") return bittingQuery && bitting === bittingQuery;
      if (mode === "bitting") return bittingQuery && bitting === bittingQuery;
      return [code, bitting, compactCodeDeskKey(record.vehicle), compactCodeDeskKey(record.partNumber)].some((value) => compactQuery && value.includes(compactQuery));
    })
    .slice(0, 40);
}

function codeDeskBittingDistance(left, right) {
  const a = normalizeBittingInput(left).join("");
  const b = normalizeBittingInput(right).join("");
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] === "?" || b[index] === "?") continue;
    if (a[index] !== b[index]) distance += 1;
  }
  return distance;
}

function codeDeskVerifiedCandidates(system, bitting = [], query = "", mode = "bitting") {
  const targetBitting = Array.isArray(bitting) ? bitting.join("") : normalizeBittingInput(bitting).join("");
  const compactQuery = compactCodeDeskKey(query);
  return codeDeskImportedRecords
    .filter((record) => codeDeskSystemMatchesRecord(system, record))
    .map((record) => {
      const recordBitting = normalizeBittingInput(record.bitting).join("");
      const code = compactCodeDeskKey(record.code);
      const vehicleText = compactCodeDeskKey(record.vehicle);
      const partText = compactCodeDeskKey(record.partNumber);
      const sourceText = compactCodeDeskKey(record.source);
      let score = 0;
      let relation = "";
      let distance = Number.POSITIVE_INFINITY;
      const reasons = [];

      if (targetBitting && recordBitting) {
        distance = codeDeskBittingDistance(recordBitting, targetBitting);
        const maxNearDistance = targetBitting.length >= 8 ? 2 : 1;
        if (distance === 0) {
          score += 92;
          relation = "Exact bitting match";
          reasons.push("exact cuts");
        } else if (distance <= maxNearDistance) {
          score += Math.max(48, 74 - distance * 12);
          relation = `${distance} cut${distance === 1 ? "" : "s"} off`;
          reasons.push("near bitting");
        }
      }

      if (mode === "code" && compactQuery && code.includes(compactQuery)) {
        score += 78;
        relation ||= "Code record match";
        reasons.push("code match");
      }

      if (compactQuery && [vehicleText, partText, sourceText].some((value) => value && value.includes(compactQuery))) {
        score += 18;
        relation ||= "Context match";
        reasons.push("vehicle/source clue");
      }

      if (record.source) score += 4;
      if (record.vehicle) score += 3;
      if (record.partNumber) score += 3;
      if (!score) return null;

      const cappedScore = Math.min(99, Math.round(score));
      return {
        ...record,
        distance: Number.isFinite(distance) ? distance : null,
        matchScore: cappedScore,
        relation: relation || "Imported code clue",
        confidence: cappedScore >= 90 ? "Verified" : cappedScore >= 75 ? "Strong" : cappedScore >= 55 ? "Candidate" : "Clue",
        reasons: reasons.slice(0, 4),
        targetBitting,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore || (a.distance ?? 99) - (b.distance ?? 99) || String(a.code).localeCompare(String(b.code)))
    .slice(0, 12);
}

function renderCodeDeskCandidate(candidate) {
  const exact = candidate.distance === 0 || candidate.confidence === "Verified";
  return `
    <article class="code-desk-record verified-code-card ${exact ? "exact" : ""}">
      <div class="verified-code-head">
        <div>
          <span>${escapeHtml(candidate.relation)}</span>
          <strong>${escapeHtml(candidate.code || "No code recorded")}</strong>
        </div>
        <div class="verified-code-score">
          <strong>${escapeHtml(`${candidate.matchScore || 0}%`)}</strong>
          <small>${escapeHtml(candidate.confidence || "Candidate")}</small>
        </div>
      </div>
      <div class="verified-code-grid">
        <div><small>Record bitting</small><strong>${escapeHtml(candidate.bitting || "Not recorded")}</strong></div>
        <div><small>Target bitting</small><strong>${escapeHtml(candidate.targetBitting || "Not entered")}</strong></div>
        <div><small>Vehicle / system</small><strong>${escapeHtml([candidate.vehicle, candidate.system || candidate.keyway].filter(Boolean).join(" | ") || "Any imported system")}</strong></div>
        <div><small>Part / source</small><strong>${escapeHtml([candidate.partNumber, candidate.source].filter(Boolean).join(" | ") || "Authorized import")}</strong></div>
      </div>
      <div class="part-chip-row">${renderPartChips(candidate.reasons || [], exact ? "Exact imported match" : "Verify against vehicle, keyway, and code series")}</div>
      ${candidate.notes ? `<small>${escapeHtml(candidate.notes)}</small>` : ""}
    </article>
  `;
}

function renderCodeDeskRecord(record) {
  return `
    <article class="code-desk-record">
      <div>
        <span>${escapeHtml(record.code || "Imported record")}</span>
        <strong>${escapeHtml(record.bitting || "No bitting")}</strong>
      </div>
      <p>${escapeHtml([record.system || record.keyway, record.vehicle, record.partNumber, record.source].filter(Boolean).join(" | ") || "Imported authorized code data")}</p>
      ${record.notes ? `<small>${escapeHtml(record.notes)}</small>` : ""}
    </article>
  `;
}

function renderCodeDeskResult(result) {
  if (!codeDeskResult) return;
  latestCodeDeskResult = result;
  const depthRows = codeDeskDepthRows(result.system);
  const cutRows = result.cutRows || [];
  const measurementRows = result.measurementRows || [];
  const verifiedCandidates = result.verifiedCandidates || [];
  const topVerified = verifiedCandidates[0];
  codeDeskResult.dataset.ready = "result";
  codeDeskResult.innerHTML = `
    <section class="code-desk-summary-grid">
      <article class="metric">
        <span>System</span>
        <strong>${escapeHtml(result.system.name)}</strong>
        <p>${escapeHtml(result.system.family)}</p>
      </article>
      <article class="metric">
        <span>Blanks</span>
        <strong>${escapeHtml((result.system.blanks || []).join(" / "))}</strong>
        <p>${escapeHtml(result.system.source)}</p>
      </article>
      <article class="metric">
        <span>MACS</span>
        <strong>${escapeHtml(result.system.macs ?? "Verify")}</strong>
        <p>${escapeHtml([result.system.cuts ? `${result.system.cuts} cuts` : "", result.system.stop || ""].filter(Boolean).join(" | ") || "Machine setup controls final cut quality.")}</p>
      </article>
      <article class="metric">
        <span>Verified Code</span>
        <strong>${escapeHtml(topVerified?.code || "None")}</strong>
        <p>${escapeHtml(topVerified ? `${topVerified.confidence} | ${topVerified.relation}` : `${codeDeskImportedRecords.length} imported records`)}</p>
      </article>
    </section>
    <section class="code-desk-grid">
      <article class="code-desk-card">
        <div class="panel-header tight">
          <div>
            <p class="eyebrow">Cut plan</p>
            <h3>${escapeHtml(result.bitting?.length ? result.bitting.join("") : "No cuts yet")}</h3>
          </div>
        </div>
        ${
          cutRows.length
            ? `<div class="code-cut-table">${cutRows
                .map(
                  (row) => `
                    <div class="${row.valid ? "" : "warn"}">
                      <span>${escapeHtml(row.position)}</span>
                      <strong>${escapeHtml(row.cut)}</strong>
                      <small>${escapeHtml(row.depth ? `${codeDeskFormatMeasurement(row.depth)} depth` : "Verify cut")} ${escapeHtml(row.space ? `| ${codeDeskFormatMeasurement(row.space)} space` : "")}</small>
                    </div>
                  `,
                )
                .join("")}</div>`
            : `<p class="muted-copy">Enter bitting, measurements, or import a code record to build cuts.</p>`
        }
        ${
          measurementRows.length
            ? `<div class="code-measure-table">${measurementRows
                .map((row) => `<span>${escapeHtml(codeDeskFormatMeasurement(row.measurement))} -> ${escapeHtml(row.cut)} (${escapeHtml(codeDeskFormatMeasurement(row.difference))} off)</span>`)
                .join("")}</div>`
            : ""
        }
      </article>
      <article class="code-desk-card">
        <div class="panel-header tight">
          <div>
            <p class="eyebrow">Depth card</p>
            <h3>${escapeHtml(result.system.name)}</h3>
          </div>
        </div>
        <div class="code-depth-table">
          ${depthRows.length ? depthRows.map((row) => `<span><strong>${escapeHtml(row.cut)}</strong>${escapeHtml(codeDeskFormatMeasurement(row.depth))}</span>`).join("") : `<p class="muted-copy">Automotive template loaded. Import the exact depth-space card to enable measurement snapping.</p>`}
        </div>
        <div class="part-chip-row">
          ${(result.system.notes || []).map((note) => `<span class="part-chip">${escapeHtml(note)}</span>`).join("")}
        </div>
      </article>
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Verified code candidates</p>
          <h3>${escapeHtml(`${verifiedCandidates.length} candidate${verifiedCandidates.length === 1 ? "" : "s"}`)}</h3>
        </div>
      </div>
      <div class="code-desk-record-list verified-code-list">
        ${
          verifiedCandidates.length
            ? verifiedCandidates.map(renderCodeDeskCandidate).join("")
            : `<article class="assistant-card"><strong>No verified code candidate</strong><p>Enter bitting/cuts or measurements, then import authorized code records with code and bitting columns to verify code direction.</p></article>`
        }
      </div>
    </section>
    <section class="history-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Raw imported records</p>
          <h3>${escapeHtml(`${result.matches.length} match${result.matches.length === 1 ? "" : "es"}`)}</h3>
        </div>
      </div>
      <div class="code-desk-record-list">
        ${result.matches.length ? result.matches.map(renderCodeDeskRecord).join("") : `<article class="assistant-card"><strong>No imported code match</strong><p>Use bitting/measurements now, or import authorized CSV code data for code lookup.</p></article>`}
      </div>
    </section>
  `;
  updateAiContextUi();
}

function runCodeDesk() {
  if (!codeDeskForm) return;
  const data = new FormData(codeDeskForm);
  const system = selectedCodeDeskSystem();
  const mode = data.get("mode") || "bitting";
  const query = cleanInput(data.get("query"));
  let bitting = [];
  let measurementRows = [];
  let matches = [];
  let verifiedCandidates = [];

  if (mode === "measurements") {
    measurementRows = codeDeskMeasurementsToCuts(system, query);
    bitting = measurementRows.map((row) => row.cut);
    matches = findCodeDeskRecords(system, bitting.join(""), "reverse");
    verifiedCandidates = codeDeskVerifiedCandidates(system, bitting, query, mode);
  } else if (mode === "code") {
    matches = findCodeDeskRecords(system, query, "code");
    bitting = normalizeBittingInput(matches[0]?.bitting || "");
    verifiedCandidates = codeDeskVerifiedCandidates(system, bitting, query, mode);
  } else {
    bitting = normalizeBittingInput(query);
    matches = findCodeDeskRecords(system, query, mode);
    verifiedCandidates = codeDeskVerifiedCandidates(system, bitting, query, mode);
  }

  renderCodeDeskResult({
    system,
    mode,
    query,
    bitting,
    cutRows: codeDeskCutRows(system, bitting),
    measurementRows,
    matches,
    verifiedCandidates,
  });
  if (codeDeskStatus) {
    const topVerified = verifiedCandidates[0];
    codeDeskStatus.textContent = topVerified
      ? `${system.name}: ${topVerified.confidence.toLowerCase()} code candidate ${topVerified.code || "record"} from ${topVerified.relation.toLowerCase()}.`
      : `${system.name}: ${bitting.length ? `cut plan ${bitting.join("")}` : `${matches.length} imported records matched`}.`;
  }
}

function renderCodeDesk() {
  if (!codeDeskForm || !codeDeskResult) return;
  codeDeskImportedRecords = loadCodeDeskImports();
  codeDeskCustomSystems = loadCodeDeskSystems();
  const select = codeDeskForm.elements.system;
  if (select) {
    const current = select.value;
    const groups = codeDeskAvailableSystems().reduce((map, system) => {
      const group = system.category || "Other";
      map[group] ||= [];
      map[group].push(system);
      return map;
    }, {});
    select.innerHTML = Object.entries(groups)
      .map(
        ([group, systems]) => `
          <optgroup label="${escapeHtml(group)}">
            ${systems.map((system) => `<option value="${escapeHtml(system.id)}">${escapeHtml(system.name)}</option>`).join("")}
          </optgroup>
        `,
      )
      .join("");
    if (current && codeDeskAvailableSystems().some((system) => system.id === current)) select.value = current;
  }
  if (!codeDeskResult.dataset.ready) {
    const starter = selectedCodeDeskSystem();
    renderCodeDeskResult({
      system: starter,
      mode: "bitting",
      query: "",
      bitting: [],
      cutRows: [],
      measurementRows: [],
      matches: [],
      verifiedCandidates: [],
    });
    codeDeskResult.dataset.ready = "starter";
    if (codeDeskStatus) codeDeskStatus.textContent = "Code Desk ready. Automotive templates need your exact depth-space card import before production cutting.";
  }
}

async function importCodeDeskFile(file) {
  if (!file) return;
  try {
    const imported = parseCodeDeskImport(await file.text());
    const existing = new Map(codeDeskImportedRecords.map((record) => [record.id, record]));
    imported.records.forEach((record) => existing.set(record.id, record));
    saveCodeDeskImports(Array.from(existing.values()));
    if (imported.systems.length) {
      const existingSystems = new Map(codeDeskCustomSystems.map((system) => [system.id, system]));
      imported.systems.forEach((system) => existingSystems.set(system.id, system));
      saveCodeDeskSystems(Array.from(existingSystems.values()));
      if (codeDeskResult) codeDeskResult.dataset.ready = "";
      renderCodeDesk();
    }
    renderCodeDeskResult({
      system: selectedCodeDeskSystem(),
      mode: "code",
      query: "",
      bitting: [],
      cutRows: [],
      measurementRows: [],
      matches: imported.records.slice(0, 40),
      verifiedCandidates: [],
    });
    if (codeDeskStatus) codeDeskStatus.textContent = `Imported ${imported.records.length} code records and ${imported.systems.length} depth-space cards.`;
  } catch (error) {
    if (codeDeskStatus) codeDeskStatus.textContent = `Import failed: ${error.message}`;
  }
}

function exportCodeDeskRecords() {
  downloadJson(`timlock-code-desk-${new Date().toISOString().slice(0, 10)}.json`, {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    records: codeDeskImportedRecords,
    systems: codeDeskAvailableSystems().map(({ id, name, category, family, blanks, spaces, depths, macs, cuts, stop, source, notes, custom }) => ({ id, name, category, family, blanks, spaces, depths, macs, cuts, stop, source, notes, custom })),
  });
  if (codeDeskStatus) codeDeskStatus.textContent = "Code Desk records exported.";
}

function renderAutoDatabaseSupport(items = []) {
  return items
    .slice(0, 5)
    .map(
      (item) => `
        <div>
          <span>${escapeHtml(item.status || "ready")}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.gives || "")}</small>
        </div>
      `,
    )
    .join("");
}

function renderCodeDeskAutoRow(row) {
  const security = row.security?.length ? row.security.join(" + ") : "No PIN/online flag";
  const readiness = row.sourceReadiness || {};
  return `
    <article class="auto-baseline-card">
      <div class="history-job-head">
        <div>
          <span>${escapeHtml([row.ignitionType || "Vehicle", row.programMethod].filter(Boolean).join(" | ") || "Verify")}</span>
          <strong>${escapeHtml([row.year, row.make, row.model].filter(Boolean).join(" "))}</strong>
        </div>
        <span class="status">${escapeHtml(row.template?.confidence || "verify")}</span>
      </div>
      <div class="auto-baseline-grid">
        <div><small>Key system</small><strong>${escapeHtml(row.template?.name || "Verify keyway")}</strong></div>
        <div><small>Blanks / keyway</small><strong>${escapeHtml((row.template?.blanks || []).join(" / ") || "Import/verify")}</strong></div>
        <div><small>Security</small><strong>${escapeHtml(security)}</strong></div>
        <div><small>Program</small><strong>${escapeHtml(row.allKeysLostSupported ? "AKL supported" : "Verify AKL")}</strong></div>
      </div>
      <div class="part-chip-row">
        <span class="part-chip">${escapeHtml(`Identity: ${readiness.vehicleIdentity || "verify"}`)}</span>
        <span class="part-chip">${escapeHtml(`Programming: ${readiness.programming || "verify"}`)}</span>
        <span class="part-chip">${escapeHtml(`Code lookup: ${readiness.codeLookup || "import ready"}`)}</span>
        <span class="part-chip">${escapeHtml(`Depth-space: ${readiness.depthSpace || "import ready"}`)}</span>
        <button class="secondary-action small" type="button" data-code-system="${escapeHtml(row.template?.id || "auto-generic")}">Open Template</button>
      </div>
      <div class="auto-source-list">
        ${renderAutoDatabaseSupport(row.databaseSupport)}
      </div>
      ${row.notes ? `<p class="muted-copy">${escapeHtml(row.notes)}</p>` : ""}
    </article>
  `;
}

function renderCodeDeskAutoBaseline(payload = {}) {
  if (!codeDeskAutoBaseline) return;
  latestCodeDeskAutoBaseline = payload;
  const rows = payload.rows || [];
  codeDeskAutoBaseline.innerHTML = `
    <section class="code-desk-summary-grid">
      <article class="metric">
        <span>Rows</span>
        <strong>${escapeHtml(payload.totalRows || 0)}</strong>
        <p>${escapeHtml(`${payload.returnedRows || rows.length} shown`)}</p>
      </article>
      <article class="metric">
        <span>Makes</span>
        <strong>${escapeHtml(payload.makes?.length || 0)}</strong>
        <p>${escapeHtml((payload.makes || []).slice(0, 4).join(" / ") || "No makes")}</p>
      </article>
      <article class="metric">
        <span>Years</span>
        <strong>${escapeHtml(payload.years?.length || 0)}</strong>
        <p>${escapeHtml(payload.years?.length ? `${payload.years[payload.years.length - 1]}-${payload.years[0]}` : "No years")}</p>
      </article>
      <article class="metric">
        <span>Code Data</span>
        <strong>Import-ready</strong>
        <p>Authorized code records and depth-space cards</p>
      </article>
    </section>
    <div class="auto-baseline-list">
      ${
        rows.length
          ? rows.slice(0, 120).map(renderCodeDeskAutoRow).join("")
          : `<article class="assistant-card"><strong>No auto baseline rows matched</strong><p>Try a make, model, year, keyway, or programming method.</p></article>`
      }
    </div>
  `;
  updateAiContextUi();
}

async function loadCodeDeskAutoBaseline(query = codeDeskAutoForm?.elements.autoQuery?.value || "") {
  if (!codeDeskAutoBaseline) return;
  try {
    if (codeDeskAutoStatus) codeDeskAutoStatus.textContent = "Loading automotive baseline...";
    const year = cleanInput(codeDeskAutoForm?.elements.autoYear?.value || "");
    const make = cleanInput(codeDeskAutoForm?.elements.autoMake?.value || "");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (year) params.set("year", year);
    if (make) params.set("make", make);
    params.set("limit", "500");
    const payload = await api(`/api/code-desk/auto-baseline?${params.toString()}`);
    renderCodeDeskAutoBaseline(payload);
    if (codeDeskAutoStatus) codeDeskAutoStatus.textContent = `Loaded ${payload.returnedRows || 0} of ${payload.totalRows || 0} auto baseline rows.`;
  } catch (error) {
    if (codeDeskAutoStatus) codeDeskAutoStatus.textContent = error.message;
    codeDeskAutoBaseline.innerHTML = `<article class="assistant-card"><strong>Auto baseline unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

async function exportCodeDeskAutoBaseline() {
  try {
    const payload = await api("/api/code-desk/auto-baseline?limit=20000");
    downloadJson(`timlock-auto-code-baseline-${new Date().toISOString().slice(0, 10)}.json`, payload);
    if (codeDeskAutoStatus) codeDeskAutoStatus.textContent = `Exported ${payload.returnedRows || 0} auto baseline rows.`;
  } catch (error) {
    if (codeDeskAutoStatus) codeDeskAutoStatus.textContent = `Export failed: ${error.message}`;
  }
}

function lishiLookupParamsFromForm() {
  const params = new URLSearchParams();
  const elements = lishiLookupForm?.elements || {};
  const values = {
    q: cleanInput(elements.lishiQuery?.value || ""),
    year: cleanInput(elements.lishiYear?.value || ""),
    make: cleanInput(elements.lishiMake?.value || ""),
    model: cleanInput(elements.lishiModel?.value || ""),
    category: cleanInput(elements.lishiCategory?.value || ""),
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("limit", "80");
  return params;
}

function lishiLookupParamsFromProfile(profile) {
  const vehicle = profile?.vehicle || {};
  const snapshot = selectedPartSnapshot(profile);
  const lishi = lishiReferenceForProfile(profile, snapshot);
  const reference = profile?.vehicleReference || {};
  const q = [
    ...(lishi.keyways || []),
    lishi.primary,
    reference.keyway?.primary,
    reference.lishi?.primary,
  ]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (vehicle.year) params.set("year", vehicle.year);
  if (vehicle.make) params.set("make", vehicle.make);
  if (vehicle.model) params.set("model", vehicle.model);
  params.set("category", "Automotive");
  params.set("limit", "12");
  return params;
}

function renderLishiToolCard(tool) {
  const applications = tool.applications || [];
  return `
    <article class="lishi-tool-card">
      <div class="history-job-head">
        <div>
          <span>${escapeHtml((tool.categories || []).slice(0, 2).join(" | ") || "Lishi tool")}</span>
          <strong>${escapeHtml(tool.canonical || tool.tool)}</strong>
        </div>
        <span class="status">${escapeHtml(`${tool.applicationCount || 0} apps`)}</span>
      </div>
      <p>${escapeHtml(tool.primaryFunction || "Verify function before use.")}</p>
      <div class="part-chip-row">
        ${(tool.aliases || []).slice(0, 6).map((alias) => `<span class="part-chip">${escapeHtml(alias)}</span>`).join("")}
      </div>
      <div class="lishi-application-list">
        ${
          applications.length
            ? applications
                .slice(0, 5)
                .map(
                  (application) => `
                    <span>${escapeHtml([application.manufacturer, application.model, application.yearsText].filter(Boolean).join(" | "))}</span>
                  `,
                )
                .join("")
            : `<span>No PDF vehicle rows matched this tool in the imported reference.</span>`
        }
      </div>
      <small>${escapeHtml(tool.sourceNote || "Verify against current supplier/manufacturer source.")}</small>
    </article>
  `;
}

function renderLishiApplicationRow(application) {
  return `
    <article class="lishi-application-row">
      <strong>${escapeHtml(application.canonical || application.toolFromPdf)}</strong>
      <span>${escapeHtml([application.manufacturer, application.model].filter(Boolean).join(" "))}</span>
      <small>${escapeHtml(application.yearsText || [application.yearStart, application.yearEnd || (application.yearOpenEnded ? "current" : "")].filter(Boolean).join("-") || "Years not specified")}</small>
    </article>
  `;
}

function populateLishiCategories(payload = latestLishiLookup) {
  const select = lishiLookupForm?.elements.lishiCategory;
  if (!select || select.dataset.ready || !payload?.categories?.length) return;
  const current = select.value;
  select.innerHTML = `<option value="">All</option>${payload.categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  select.value = current;
  select.dataset.ready = "true";
}

function renderLishiLookup(payload = {}) {
  if (!lishiLookupResult) return;
  latestLishiLookup = payload;
  populateLishiCategories(payload);
  const tools = payload.tools || [];
  const applications = payload.applications || [];
  lishiLookupResult.innerHTML = `
    <section class="code-desk-summary-grid">
      <article class="metric">
        <span>Master tools</span>
        <strong>${escapeHtml(payload.stats?.tools || 0)}</strong>
        <p>${escapeHtml(`${payload.matchedTools || 0} matched`)}</p>
      </article>
      <article class="metric">
        <span>Applications</span>
        <strong>${escapeHtml(payload.stats?.applications || 0)}</strong>
        <p>${escapeHtml(`${payload.matchedApplications || 0} matched`)}</p>
      </article>
      <article class="metric">
        <span>Categories</span>
        <strong>${escapeHtml(payload.categories?.length || 0)}</strong>
        <p>${escapeHtml((payload.categories || []).slice(0, 3).join(" / ") || "No categories")}</p>
      </article>
      <article class="metric">
        <span>Source</span>
        <strong>${escapeHtml(payload.sourceWorkbook || "Lishi reference")}</strong>
        <p>Verify before quoting</p>
      </article>
    </section>
    <section class="lishi-result-grid">
      <div>
        <div class="panel-header tight">
          <div>
            <p class="eyebrow">Best matches</p>
            <h3>Tools</h3>
          </div>
        </div>
        <div class="lishi-tool-list">
          ${tools.length ? tools.slice(0, 40).map(renderLishiToolCard).join("") : `<article class="assistant-card"><strong>No Lishi tools matched</strong><p>Try a keyway, tool number, manufacturer, or broader category.</p></article>`}
        </div>
      </div>
      <div>
        <div class="panel-header tight">
          <div>
            <p class="eyebrow">Coverage rows</p>
            <h3>Applications</h3>
          </div>
        </div>
        <div class="lishi-application-results">
          ${applications.length ? applications.slice(0, 60).map(renderLishiApplicationRow).join("") : `<article class="assistant-card"><strong>No application rows matched</strong><p>Tool matches may still exist without vehicle coverage rows.</p></article>`}
        </div>
      </div>
    </section>
    <details class="deep-detail">
      <summary>Reference notes and sources</summary>
      <div class="source-list">
        ${(payload.sources || []).map((source) => `<article><strong>${escapeHtml(source.source)}</strong><p>${escapeHtml(source.contribution)}</p><small>${escapeHtml(source.reliability)}</small></article>`).join("")}
      </div>
    </details>
  `;
  updateAiContextUi();
}

async function loadLishiLookup(params = lishiLookupParamsFromForm()) {
  if (!lishiLookupResult) return;
  const requestId = ++lishiLookupRequestId;
  try {
    if (lishiLookupStatus) lishiLookupStatus.textContent = "Searching Lishi master reference...";
    const payload = await api(`/api/lishi-reference?${params.toString()}`, { timeoutMs: 12000 });
    if (requestId !== lishiLookupRequestId) return;
    renderLishiLookup(payload);
    if (lishiLookupStatus) {
      lishiLookupStatus.textContent = `Loaded ${payload.returnedTools || payload.tools?.length || 0} tool match${(payload.returnedTools || payload.tools?.length || 0) === 1 ? "" : "es"} and ${payload.matchedApplications || 0} coverage rows.`;
    }
  } catch (error) {
    if (requestId !== lishiLookupRequestId) return;
    if (lishiLookupStatus) lishiLookupStatus.textContent = error.message;
    lishiLookupResult.innerHTML = `<article class="assistant-card"><strong>Lishi lookup unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function currentWorkbenchProfile() {
  const profile = latestVinProfile || readLocalObject(currentJobContextKey, null);
  if (!profile?.vehicle) return null;
  const snapshot = latestVinProfile ? selectedPartSnapshot(latestVinProfile) : null;
  const best = snapshot?.best || {};
  return {
    vin: profile.vin || "",
    lookupMode: profile.lookupMode || "",
    vehicle: profile.vehicle || {},
    confidence: profile.confidence || "",
    keys: profile.keys || [],
    programmers: profile.programmers || [],
    tools: profile.tools || [],
    recommendation: profile.recommendation || null,
    matchedJobs: profile.matchedJobs || [],
    programmingReference: profile.programmingReference || null,
    supplierCandidates: profile.supplierCandidates || [],
    verifiedProfile: profile.verifiedProfile || null,
    shopEvidence: profile.shopEvidence || null,
    referenceVault: profile.referenceVault || [],
    vehicleReference: profile.vehicleReference || null,
    keyRequirements: profile.keyRequirements || null,
    catalogApplication: profile.catalogApplication || null,
    jobKit: profile.jobKit || null,
    lishiLookup: profile.lishiLookup || null,
    selectedPart: snapshot
      ? {
          title: snapshot.title,
          identifier: snapshot.identifier,
          typeLabel: snapshot.typeLabel,
          sku: best.sku || "",
          oem: best.oem || "",
          fcc: best.fcc || "",
          partName: best.partName || "",
          keyway: best.keyway || "",
        }
      : null,
  };
}

function saveCurrentJobContext(profile) {
  if (!profile?.vehicle) return;
  writeLocalObject(currentJobContextKey, currentWorkbenchProfile() || profile);
}

function workbenchQueryFromForm() {
  return cleanInput(workbenchForm?.elements.workbenchQuery?.value || "");
}

function workbenchPayload(query = workbenchQueryFromForm()) {
  return {
    q: query,
    profile: currentWorkbenchProfile(),
    jobs: localArchivedJobs(),
  };
}

function renderWorkbenchActions(payload = {}) {
  return `
    <section class="history-action-bar workbench-actions">
      <div class="badge-row">
        ${(payload.warnings || []).length ? payload.warnings.slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("") : `<span>No current warnings beyond normal verification.</span>`}
      </div>
      <div class="workbench-action-buttons">
        ${(payload.nextActions || [])
          .map((action) => `<button class="secondary-action small ${escapeHtml(action.tone || "")}" type="button" data-workbench-open="${escapeHtml(action.target)}">${escapeHtml(action.label)}</button>`)
          .join("")}
      </div>
    </section>
  `;
}

function renderWorkbenchPartHistory(payload = {}) {
  const history = payload.partHistory;
  if (!history) {
    return `<article class="assistant-card"><strong>No part query yet</strong><p>Search an LR#, MW#, TI#, OE#, FCC, or select a key from VIN lookup to pull part history.</p></article>`;
  }
  const jobs = history.jobs || [];
  return `
    <section class="workbench-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Part proof</p>
          <h3>${escapeHtml(history.primaryIdentifier || history.query || "Part history")}</h3>
        </div>
        <button class="secondary-action small" type="button" data-workbench-open="part-history">Open Part History</button>
      </div>
      <div class="history-reference-panel">
        <div>
          <p class="eyebrow">Cross-reference family</p>
          <div class="part-chip-row">${renderPartChips(history.identifiers?.all || [], "No cross-reference row found")}</div>
        </div>
        <div>
          <p class="eyebrow">OE sources</p>
          <div class="part-chip-row">${renderPartChips(history.identifiers?.oe || [], "No OE sources linked")}</div>
        </div>
      </div>
      <div class="workbench-card-list">
        ${jobs.length ? jobs.slice(0, 4).map(renderPartHistoryJob).join("") : `<article class="assistant-card"><strong>No saved job proof matched</strong><p>Save this job when complete and it will feed coverage percentages automatically.</p></article>`}
      </div>
    </section>
  `;
}

function renderWorkbenchLishi(payload = {}) {
  const lookup = payload.lishi || {};
  const tools = lookup.tools || [];
  return `
    <section class="workbench-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Lishi / decode</p>
          <h3>${escapeHtml(tools.length ? "Matched tools" : "Confirm keyway")}</h3>
        </div>
        <button class="secondary-action small" type="button" data-workbench-open="lishi">Open Lishi Lookup</button>
      </div>
      <div class="lishi-tool-list compact">
        ${tools.length ? tools.slice(0, 5).map(renderLishiToolCard).join("") : `<article class="assistant-card"><strong>No Lishi match yet</strong><p>Use the keyway from the lock/insert or a broader make/model search.</p></article>`}
      </div>
    </section>
  `;
}

function renderWorkbenchAuto(payload = {}) {
  const rows = payload.autoBaseline?.rows || [];
  return `
    <section class="workbench-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Code Desk / auto</p>
          <h3>${escapeHtml(rows.length ? "Baseline matches" : "Automotive baseline")}</h3>
        </div>
        <button class="secondary-action small" type="button" data-workbench-open="code-desk">Open Code Desk</button>
      </div>
      <div class="auto-baseline-list compact">
        ${rows.length ? rows.slice(0, 4).map(renderCodeDeskAutoRow).join("") : `<article class="assistant-card"><strong>No baseline row matched</strong><p>Try a year/make/model or keyway search, then import authorized code data for production lookup.</p></article>`}
      </div>
    </section>
  `;
}

function renderWorkbenchProof(payload = {}) {
  const records = payload.proofVault?.records || [];
  return `
    <section class="workbench-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Proof Vault</p>
          <h3>${escapeHtml(`${records.length} shown`)}</h3>
        </div>
        <button class="secondary-action small" type="button" data-workbench-open="proof-vault">Open Proof Vault</button>
      </div>
      <div class="proof-record-list compact">
        ${records.length ? records.slice(0, 4).map((record) => renderProofVaultRecord(record, proofVaultAttachments())).join("") : `<article class="assistant-card"><strong>No proof records matched</strong><p>Attach photos/docs and save the worked job to build proof across devices.</p></article>`}
      </div>
    </section>
  `;
}

function renderWorkbenchSources(payload = {}) {
  const sources = payload.sourceMap || {};
  return `
    <section class="workbench-section">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Data sources</p>
          <h3>Connected pieces</h3>
        </div>
        <button class="secondary-action small" type="button" data-workbench-open="reference-lists">View Lists</button>
      </div>
      <div class="source-list compact">
        ${Object.entries(sources)
          .map(
            ([key, value]) => `
              <article>
                <strong>${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</strong>
                <p>${escapeHtml(value.status || "connected")}</p>
                <small>${escapeHtml(Object.entries(value).filter(([name]) => name !== "status").map(([name, item]) => `${name}: ${item}`).join(" | "))}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderWorkbenchAiBrief(payload = {}) {
  const brief = payload.aiBrief || {};
  if (!brief.decision) return "";
  const evidence = brief.evidence || [];
  const gaps = brief.gaps || [];
  const nextSteps = brief.nextSteps || [];
  return `
    <section class="ai-brief-panel">
      <div class="ai-brief-main">
        <p class="eyebrow">${escapeHtml(brief.headline || "AI field brief")}</p>
        <h3>${escapeHtml(brief.decision)}</h3>
        <p>${escapeHtml(brief.technicianNote || "Use the verified data in this packet before dispatch.")}</p>
        <button class="secondary-action small" type="button" data-workbench-open="ai">Ask AI Bench</button>
      </div>
      <div class="ai-brief-score">
        <span>${escapeHtml(brief.confidenceLabel || "Developing")}</span>
        <strong>${escapeHtml(brief.confidencePercent || 0)}%</strong>
        <small>Packet confidence</small>
      </div>
      <div class="ai-brief-columns">
        <article>
          <strong>Evidence</strong>
          <ul>
            ${
              evidence.length
                ? evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
                : `<li>No matching proof yet.</li>`
            }
          </ul>
        </article>
        <article>
          <strong>Gaps</strong>
          <ul>
            ${gaps.length ? gaps.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li>No major gaps beyond normal verification.</li>`}
          </ul>
        </article>
        <article>
          <strong>Next</strong>
          <ul>
            ${nextSteps.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderJobWorkbench(payload = {}) {
  if (!workbenchResult) return;
  latestWorkbench = payload;
  const overview = payload.overview || {};
  const activeQueries = payload.activeQueries || {};
  const metrics = [
    ["Current", payload.title || "Job context", payload.vin || payload.query || "Search ready"],
    ["Proof", overview.matchedJobs || 0, `${overview.savedJobs || 0} saved jobs`],
    ["Parts", overview.partReferenceRows || 0, activeQueries.part || "Search-ready"],
    ["Coverage", overview.observedCoveragePercent ?? "N/A", "Observed shop proof"],
  ];
  workbenchResult.innerHTML = `
    ${renderWorkbenchAiBrief(payload)}
    <section class="history-summary-grid">
      ${metrics
        .map(
          ([label, value, caption]) => `
            <article class="metric">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <p>${escapeHtml(caption)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
    ${renderWorkbenchActions(payload)}
    <section class="workbench-query-strip">
      <span>Part: ${escapeHtml(activeQueries.part || "none")}</span>
      <span>Lishi: ${escapeHtml(activeQueries.lishi || "none")}</span>
      <span>Auto: ${escapeHtml(activeQueries.auto || "none")}</span>
      <span>Proof: ${escapeHtml(activeQueries.proof || "all")}</span>
    </section>
    <section class="workbench-grid">
      ${renderWorkbenchPartHistory(payload)}
      ${renderWorkbenchLishi(payload)}
      ${renderWorkbenchAuto(payload)}
      ${renderWorkbenchProof(payload)}
    </section>
    ${renderWorkbenchSources(payload)}
  `;
  updateAiContextUi();
}

async function loadJobWorkbench(query = workbenchQueryFromForm()) {
  if (!workbenchResult) return;
  try {
    if (workbenchStatus) workbenchStatus.textContent = "Building unified job workbench...";
    const payload = await api("/api/job-workbench", {
      method: "POST",
      body: JSON.stringify(workbenchPayload(query)),
      timeoutMs: 18000,
    });
    renderJobWorkbench(payload);
    if (workbenchStatus) workbenchStatus.textContent = `Workbench ready: ${payload.overview?.matchedJobs || 0} matched proof job${payload.overview?.matchedJobs === 1 ? "" : "s"}.`;
  } catch (error) {
    if (workbenchStatus) workbenchStatus.textContent = error.message;
    workbenchResult.innerHTML = `<article class="assistant-card"><strong>Workbench unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function referenceValueText(value) {
  if (Array.isArray(value)) return value.map(referenceValueText).filter(Boolean).join(" | ");
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${referenceValueText(item)}`).join(" | ");
  return cleanInput(value);
}

function renderReferenceListRow(row = {}, index = 0) {
  const entries = Object.entries(row).slice(0, 12);
  const title = row.title || row.name || row.canonical || row.tool || row.mlPartNumber || row.mwId || row.mwPartNumber || row.id || `Row ${index + 1}`;
  return `
    <article class="reference-row-card">
      <div class="history-job-head">
        <div>
          <span>${escapeHtml(row.type || row.sourceTable || row.category || "Reference row")}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
        <span class="status">${escapeHtml(row.id || index + 1)}</span>
      </div>
      <div class="reference-row-grid">
        ${entries
          .map(
            ([key, value]) => `
              <div>
                <small>${escapeHtml(key)}</small>
                <strong>${escapeHtml(referenceValueText(value) || "None")}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderReferenceList(payload = {}) {
  if (!referenceListResult) return;
  latestReferenceList = payload;
  const selected = (payload.sources || []).find((source) => source.id === payload.selectedSource);
  referenceListResult.innerHTML = `
    <section class="history-summary-grid">
      <article class="metric">
        <span>List</span>
        <strong>${escapeHtml(selected?.label || payload.selectedSource || "Reference")}</strong>
        <p>${escapeHtml(selected?.note || payload.sourceNote || "")}</p>
      </article>
      <article class="metric">
        <span>Total</span>
        <strong>${escapeHtml(payload.totalRows || 0)}</strong>
        <p>Rows in this piece</p>
      </article>
      <article class="metric">
        <span>Matched</span>
        <strong>${escapeHtml(payload.matchedRows || 0)}</strong>
        <p>${escapeHtml(payload.query || "No search filter")}</p>
      </article>
      <article class="metric">
        <span>Shown</span>
        <strong>${escapeHtml(payload.returnedRows || 0)}</strong>
        <p>${escapeHtml(payload.sourceNote || "Searchable list")}</p>
      </article>
    </section>
    <div class="reference-list-cards">
      ${(payload.rows || []).length ? payload.rows.map(renderReferenceListRow).join("") : `<article class="assistant-card"><strong>No rows matched</strong><p>Try a broader part number, make, model, keyway, or programmer search.</p></article>`}
    </div>
  `;
}

async function loadReferenceList() {
  if (!referenceListResult) return;
  try {
    if (referenceListStatus) referenceListStatus.textContent = "Loading reference list...";
    const source = cleanInput(referenceListForm?.elements.referenceSource?.value || "parts");
    const q = cleanInput(referenceListForm?.elements.referenceQuery?.value || "");
    const params = new URLSearchParams({ source, limit: "120" });
    if (q) params.set("q", q);
    const payload = await api(`/api/reference-lists?${params.toString()}`, { timeoutMs: 18000 });
    renderReferenceList(payload);
    if (referenceListStatus) referenceListStatus.textContent = `Showing ${payload.returnedRows || 0} of ${payload.matchedRows || 0} matched rows.`;
  } catch (error) {
    if (referenceListStatus) referenceListStatus.textContent = error.message;
    referenceListResult.innerHTML = `<article class="assistant-card"><strong>Reference list unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function openWorkbenchTarget(target) {
  const payload = latestWorkbench || {};
  const queries = payload.activeQueries || {};
  if (target === "part-history") {
    showView("part-history");
    if (partHistoryForm) {
      partHistoryForm.elements.partNumber.value = queries.part || payload.query || "";
      if (partHistoryForm.elements.partNumber.value) partHistoryForm.requestSubmit();
    }
    return;
  }
  if (target === "lishi") {
    showView("lishi");
    const vehicle = payload.vehicle || currentWorkbenchProfile()?.vehicle || {};
    if (lishiLookupForm) {
      lishiLookupForm.elements.lishiQuery.value = queries.lishi || "";
      lishiLookupForm.elements.lishiYear.value = vehicle.year || "";
      lishiLookupForm.elements.lishiMake.value = vehicle.make || "";
      lishiLookupForm.elements.lishiModel.value = vehicle.model || "";
    }
    loadLishiLookup(lishiLookupParamsFromForm());
    return;
  }
  if (target === "code-desk") {
    showView("code-desk");
    const vehicle = payload.vehicle || currentWorkbenchProfile()?.vehicle || {};
    if (codeDeskAutoForm) {
      codeDeskAutoForm.elements.autoQuery.value = queries.auto || "";
      codeDeskAutoForm.elements.autoYear.value = vehicle.year || "";
      codeDeskAutoForm.elements.autoMake.value = vehicle.make || "";
    }
    loadCodeDeskAutoBaseline(queries.auto || "");
    return;
  }
  if (target === "proof-vault") {
    showView("proof-vault");
    if (proofVaultForm) proofVaultForm.elements.proofQuery.value = queries.proof || queries.part || payload.query || "";
    loadProofVault(proofVaultForm?.elements.proofQuery?.value || "");
    return;
  }
  if (target === "reference-lists") {
    showView("reference-lists");
    if (referenceListForm) {
      referenceListForm.elements.referenceSource.value = "parts";
      referenceListForm.elements.referenceQuery.value = queries.part || queries.lishi || payload.query || "";
    }
    loadReferenceList();
    return;
  }
  showView(target);
}

function globalSearchQuery() {
  return cleanInput(globalSearchForm?.elements.globalQuery?.value || "");
}

function renderGlobalResultCard(result = {}) {
  return `
    <article class="global-result-card">
      <div>
        <span>${escapeHtml(result.badge || "Result")}</span>
        <strong>${escapeHtml(result.title || "Search result")}</strong>
        <p>${escapeHtml(result.subtitle || "")}</p>
        ${result.detail ? `<small>${escapeHtml(result.detail)}</small>` : ""}
      </div>
      <button class="secondary-action small" type="button" data-global-open="${escapeHtml(result.target || "workbench")}" data-global-query="${escapeHtml(result.query || latestGlobalSearch?.query || "")}" data-global-source="${escapeHtml(result.source || "")}">Open</button>
    </article>
  `;
}

function renderGlobalGroup(group = {}) {
  return `
    <section class="global-result-group">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">${escapeHtml(group.count || 0)} result${group.count === 1 ? "" : "s"}</p>
          <h3>${escapeHtml(group.label || "Results")}</h3>
        </div>
        <button class="secondary-action small" type="button" data-global-open="${escapeHtml(group.target || "workbench")}" data-global-query="${escapeHtml(latestGlobalSearch?.query || "")}">Open Tool</button>
      </div>
      ${group.note ? `<p class="muted-copy">${escapeHtml(group.note)}</p>` : ""}
      <div class="global-result-list">
        ${(group.results || []).map(renderGlobalResultCard).join("")}
      </div>
    </section>
  `;
}

function renderGlobalSearch(payload = {}) {
  if (!globalSearchResult) return;
  latestGlobalSearch = payload;
  const groups = payload.groups || [];
  globalSearchResult.hidden = false;
  globalSearchResult.innerHTML = `
    <section class="global-result-summary">
      <div>
        <p class="eyebrow">Search packet</p>
        <strong>${escapeHtml(payload.query || "Global search")}</strong>
        <span>${escapeHtml(`${payload.summary?.results || 0} results across ${payload.summary?.groups || groups.length} groups`)}</span>
      </div>
      <button class="secondary-action small" type="button" data-clear-global-search>Clear</button>
    </section>
    <div class="global-result-grid">
      ${groups.length ? groups.map(renderGlobalGroup).join("") : `<article class="assistant-card"><strong>No global matches</strong><p>Try a VIN, part number, keyway, make/model, OE number, FCC, or programmer name.</p></article>`}
    </div>
  `;
  updateAiContextUi();
}

async function runGlobalSearch() {
  const query = globalSearchQuery();
  if (!query) {
    if (globalSearchStatus) globalSearchStatus.textContent = "Enter a VIN, part number, keyway, vehicle, OE number, or programmer.";
    return;
  }
  try {
    if (globalSearchStatus) globalSearchStatus.textContent = "Searching the whole app...";
    const payload = await api("/api/global-search", {
      method: "POST",
      body: JSON.stringify({
        q: query,
        mode: appMode,
        jobs: localArchivedJobs(),
        profile: currentWorkbenchProfile(),
      }),
      timeoutMs: 18000,
    });
    renderGlobalSearch(payload);
    if (globalSearchStatus) globalSearchStatus.textContent = `Found ${payload.summary?.results || 0} results across ${payload.summary?.groups || 0} groups.`;
  } catch (error) {
    if (globalSearchStatus) globalSearchStatus.textContent = error.message;
    if (globalSearchResult) {
      globalSearchResult.hidden = false;
      globalSearchResult.innerHTML = `<article class="assistant-card"><strong>Global search unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
    }
  }
}

function openGlobalSearchTarget(target, query, source = "") {
  const cleanQuery = cleanInput(query || latestGlobalSearch?.query || globalSearchQuery());
  if (target === "vin") {
    showView("vin");
    const normalizedVin = normalizeVinInput(cleanQuery);
    if (normalizedVin.length === 17 && vinForm) {
      vinForm.elements.vin.value = normalizedVin;
      vinForm.requestSubmit();
    } else if (workbenchForm) {
      showView("workbench");
      workbenchForm.elements.workbenchQuery.value = cleanQuery;
      loadJobWorkbench(cleanQuery);
    }
    return;
  }
  if (target === "workbench") {
    showView("workbench");
    if (workbenchForm) workbenchForm.elements.workbenchQuery.value = cleanQuery;
    loadJobWorkbench(cleanQuery);
    return;
  }
  if (target === "part-history") {
    showView("part-history");
    if (partHistoryForm) {
      partHistoryForm.elements.partNumber.value = cleanQuery;
      partHistoryForm.requestSubmit();
    }
    return;
  }
  if (target === "proof-vault") {
    showView("proof-vault");
    if (proofVaultForm) proofVaultForm.elements.proofQuery.value = cleanQuery;
    loadProofVault(cleanQuery);
    return;
  }
  if (target === "lishi") {
    showView("lishi");
    if (lishiLookupForm) lishiLookupForm.elements.lishiQuery.value = cleanQuery;
    loadLishiLookup(lishiLookupParamsFromForm());
    return;
  }
  if (target === "code-desk") {
    showView("code-desk");
    if (codeDeskAutoForm) codeDeskAutoForm.elements.autoQuery.value = cleanQuery;
    loadCodeDeskAutoBaseline(cleanQuery);
    return;
  }
  if (target === "reference-lists") {
    showView("reference-lists");
    if (referenceListForm) {
      referenceListForm.elements.referenceSource.value = source || "parts";
      referenceListForm.elements.referenceQuery.value = cleanQuery;
    }
    loadReferenceList();
    return;
  }
  showView(target);
}

function renderProfileLishiLookup(lookup) {
  const tools = lookup?.tools || [];
  if (!tools.length) return "";
  return `
    <section class="profile-lishi-lookup">
      <div class="panel-header tight">
        <div>
          <p class="eyebrow">Imported Lishi reference</p>
          <h3>Tool matches from master workbook</h3>
        </div>
        <button class="secondary-action small" type="button" data-open-lishi-current>Open Lishi Tool</button>
      </div>
      <div class="part-chip-row">
        ${tools.slice(0, 8).map((tool) => `<span class="part-chip">${escapeHtml(tool.canonical || tool.tool)}</span>`).join("")}
      </div>
      <p class="muted-copy">${escapeHtml(`${lookup.matchedApplications || 0} vehicle/application rows matched. Verify current availability and tool coverage before using.`)}</p>
    </section>
  `;
}

async function startLishiReferenceLookup(profile) {
  if (!profile?.vehicle) return;
  const params = lishiLookupParamsFromProfile(profile);
  const key = params.toString();
  if (!key || profile.lishiLookupKey === key) return;
  profile.lishiLookupKey = key;
  const requestId = ++vinLishiLookupRequestId;
  try {
    const lookup = await api(`/api/lishi-reference?${key}`, { timeoutMs: 12000 });
    if (requestId !== vinLishiLookupRequestId || latestVinProfile !== profile) return;
    latestVinProfile.lishiLookup = lookup;
    renderVinProfile(latestVinProfile);
  } catch (error) {
    if (requestId !== vinLishiLookupRequestId || latestVinProfile !== profile) return;
    latestVinProfile.lishiLookup = { tools: [], applications: [], matchedApplications: 0, error: error.message };
  }
}

function fillWorkedJobFromCurrentLookup() {
  if (!workedJobForm || !latestVinProfile?.vehicle) {
    if (workedJobStatus) workedJobStatus.textContent = "Run a VIN lookup first, then come back here to prefill the job.";
    return;
  }
  const vehicle = latestVinProfile.vehicle || {};
  const snapshot = selectedPartSnapshot(latestVinProfile);
  const lishi = lishiReferenceForProfile(latestVinProfile, snapshot);
  const programmer = selectedProgrammerOption(latestVinProfile);
  const best = snapshot?.best || {};
  workedJobForm.elements.vin.value = latestVinProfile.vin || "";
  workedJobForm.elements.year.value = vehicle.year || "";
  workedJobForm.elements.make.value = vehicle.make || "";
  workedJobForm.elements.model.value = vehicle.model || "";
  workedJobForm.elements.trim.value = vehicle.trim || "";
  workedJobForm.elements.keyType.value = selectedKeyFamily === "proximity" ? "proximity" : "keyed";
  workedJobForm.elements.outcome.value = "worked";
  workedJobForm.elements.exactPart.value = best.partName || snapshot?.identifier || "";
  workedJobForm.elements.partNumber.value = [best.sku, best.oem, best.fcc].filter(Boolean).join(" / ");
  workedJobForm.elements.buttons.value = [snapshot?.buttonLabel, best.fcc].filter(Boolean).join(" / ");
  workedJobForm.elements.lishi.value = lishi.keyways?.[0] || lishi.primary || "";
  workedJobForm.elements.programmer.value = programmer?.name || "";
  workedJobForm.elements.notes.value = [
    snapshot?.typeLabel,
    best.frequency ? `Frequency ${best.frequency}` : "",
    best.chip ? `Chip ${best.chip}` : "",
    lishi.primary ? `Lishi ${lishi.primary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (workedJobStatus) workedJobStatus.textContent = "Filled from the current lookup. Verify the fields, then save.";
}

function feedbackLabel(outcome) {
  return {
    worked: "Worked",
    "failed-program": "Did not program",
    "wrong-fcc": "Wrong FCC",
    "wrong-buttons": "Wrong buttons",
    "ordered-alternate": "Ordered alternate",
    "different-key-style": "Different style",
  }[outcome] || "Feedback";
}

function renderOfferThumb(offer, title = "") {
  const label = offer?.partName || title || offer?.supplier || "Part";
  return offer?.image
    ? `<img class="offer-thumb" src="${escapeHtml(offer.image)}" alt="${escapeHtml(label)}" />`
    : `<div class="offer-thumb empty" aria-hidden="true">${escapeHtml(String(label).charAt(0) || "?")}</div>`;
}

function renderKeyImageFallback(label = "", typeLabel = "") {
  const initials = String(typeLabel || label || "Key")
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return `
    <div class="offer-thumb generated-key-thumb" aria-label="${escapeHtml(`${typeLabel || "Key"} reference image placeholder`)}">
      <span>${escapeHtml(initials || "KEY")}</span>
      <small>${escapeHtml(label || typeLabel || "Verify photo")}</small>
    </div>
  `;
}

function renderOfferPrice(offer) {
  const current = offer.priceValue ? `$${offer.priceValue.toFixed(2)}` : offer.priceFormatted || "Check";
  const list = offer.listPriceValue && offer.priceValue && offer.listPriceValue > offer.priceValue ? `$${offer.listPriceValue.toFixed(2)}` : "";
  return `
    <div class="price-stack">
      ${list ? `<s>${escapeHtml(list)}</s>` : ""}
      <span>${escapeHtml(current)}</span>
    </div>
  `;
}

function renderOfferReference(offer) {
  const details = [
    ["FCC", offer.fcc],
    ["Freq", offer.frequency],
    ["Chip", offer.chip],
    ["Buttons", offer.buttons],
    ["Cross IDs", offer.crossReference],
    ["Cross OE", offer.crossReferenceOe],
    ["Fitment", offer.fitment],
  ].filter(([, value]) => value);

  if (!details.length) {
    return `<div class="part-reference-grid empty"><span>Verify FCC, frequency, chip, buttons, and blade before cutting or programming.</span></div>`;
  }

  return `
    <div class="part-reference-grid">
      ${details
        .slice(0, 6)
        .map(
          ([label, value]) => `
            <span>
              <small>${escapeHtml(label)}</small>
              <strong>${escapeHtml(String(value))}</strong>
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSupplierComparison(lookup, products) {
  if (!lookup) return "";
  if (!products.length && lookup.loginStatus === "searching") {
    return `
      <section class="supplier-compare">
        <article class="assistant-card">
          <strong>Parts search running</strong>
          <p>${escapeHtml(customerSafeCatalogText(lookup.statusMessage || "Parts are loading in the background. You can stay on this screen."))}</p>
        </article>
      </section>
    `;
  }
  const filteredProducts = products.filter(productPassesLiveFilters);
  const offers = sortSupplierOffers(filteredProducts);
  const baselineOffers = sortSupplierOffers(products);
  const hasGradeABaseline = gradeABaselineGroups(baselineOffers).length > 0;
  const supplierStatuses = lookup.supplierStatuses || [];
  const visibleSupplierCounts = supplierCounts(filteredProducts);
  const selectedSupplierCounts = supplierCounts(products);
  const summary = lookup.selectionSummary || {};
  const counts = summary.counts || summary;
  const selectionSummary = ["Recommended", "Possible", "Verify carefully", "Reference only"]
    .filter((rank) => counts[rank])
    .map((rank) => `${rank}: ${counts[rank]}`)
    .join(" | ");
  const topPick = summary.topPick || null;

  if (!products.length) {
    return renderLiveSupplierProducts(lookup, products);
  }

  return `
    <section class="supplier-compare">
      <div class="live-product-workspace">
        ${renderLiveFilters(products, filteredProducts)}
        <div class="compare-board">
          <div class="compare-summary">
            <div>
              <p class="eyebrow">Compare price and inventory</p>
              <h3>${filteredProducts.length} offers</h3>
              <p>${escapeHtml(selectionSummary || "Every matching item is shown. Use filters to narrow condition, stock, type, or parts source.")}</p>
            </div>
            <span>${filteredProducts.length} of ${products.length} shown</span>
          </div>
          ${
            topPick
              ? `<div class="decision-summary">
                  <div>
                    <span>${escapeHtml(topPick.rank)} top pick</span>
                    <strong>${escapeHtml(topPick.name)}</strong>
                    <p>${escapeHtml(
                      [
                        catalogSourceLabelFromName(topPick.supplier),
                        topPick.score ? `${topPick.score}/100` : "",
                        topPick.stock,
                        topPick.price ? `Price ${topPick.price}` : "",
                      ]
                        .filter(Boolean)
                        .join(" | "),
                    )}</p>
                  </div>
                  ${
                    summary.verification?.length
                      ? `<small>Verify: ${escapeHtml(summary.verification.slice(0, 4).join(", "))}</small>`
                      : ""
                  }
                </div>`
              : ""
          }
          ${
            supplierStatuses.length
              ? `<div class="supplier-status-strip">
                  ${supplierStatuses
                    .filter((status) => status.enabled || status.productCount || selectedSupplierCounts[status.name])
                    .map(
                      (status, index) => `
                        <span class="${status.connectorLive && status.productCount ? "ready" : "planned"}">
                          ${escapeHtml(`Parts source ${index + 1}`)}: ${escapeHtml(
                            `${visibleSupplierCounts[status.name] || 0} shown${status.productCount ? ` / ${status.productCount} found` : ""}`,
                          )}
                        </span>
                      `,
                    )
                    .join("")}
                </div>`
              : ""
          }
          ${
            offers.length || hasGradeABaseline
              ? renderOfferLanes(offers, baselineOffers)
              : `<article class="assistant-card"><strong>No offers match those filters</strong><p>Clear a filter or choose a broader condition/type.</p></article>`
          }
        </div>
      </div>
      <p class="supplier-footnote">${escapeHtml(lookup.searchAttempts?.length ? "Parts matches are live/reference results. Out-of-stock items stay visible so the app works as a reference guide, not just a shopping cart." : "")}</p>
    </section>
  `;
}

function renderRecommendedProducts(lookup) {
  const products = (lookup?.products || []).slice(0, 3);
  if (!lookup) return "";

  if (!products.length) {
    return `
      <section class="recommended-parts">
        <div>
          <p class="eyebrow">Recommended parts</p>
          <h3>No live part match yet</h3>
          <p>${escapeHtml(customerSafeCatalogText(lookup.statusMessage || "Connect a parts account or verify this vehicle manually."))}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="recommended-parts">
      <div class="recommendation-heading">
        <div>
          <p class="eyebrow">Recommended parts</p>
          <h3>Start with these matches</h3>
        </div>
        <span>${escapeHtml(`${lookup.products.length} parts results`)}</span>
      </div>
      <div class="recommended-product-list">
        ${products
          .map(
            (product, index) => `
              <article class="recommended-product ${index === 0 ? "best" : ""} ${
                product.keyInfo?.stock === "Out of stock" ? "out-of-stock" : ""
              }">
                ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />` : ""}
                <div>
                  <div class="badge-row">
                    ${productBadges(product, index)
                      .map((badge) => `<span>${escapeHtml(badge)}</span>`)
                      .join("")}
                  </div>
                  <strong>${escapeHtml(product.name)}</strong>
                  <p>${escapeHtml([product.keyInfo?.sku, product.keyInfo?.fcc, product.keyInfo?.oem].filter(Boolean).join(" - ") || "Verify part identifiers before ordering")}</p>
                  <div class="quick-part-meta">
                    <span>${product.price ? `$${escapeHtml(product.price)}` : "Check price"}</span>
                    <span>${escapeHtml(product.keyInfo?.productType || "Verify type")}</span>
                  </div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderLiveSupplierProducts(lookup, baseProducts = null) {
  if (!lookup) return "";
  const products = baseProducts || lookup.products || [];
  const visibleProducts = products.filter(productPassesLiveFilters);
  const attempts = (lookup.searchAttempts || [])
    .slice(0, 4)
    .map((attempt) => `${attempt.query} (${attempt.resultCount})`)
    .join(" · ");

  if (!products.length) {
    return `
      <section class="live-products">
        <p class="eyebrow">Step 3</p>
        <h3>Parts lookup</h3>
        <div class="assistant-card">
          <strong>${escapeHtml(lookup.loginStatus || "No live matches")}</strong>
          <p>${escapeHtml(customerSafeCatalogText(lookup.statusMessage || "No products were returned for this vehicle yet."))}</p>
          <p>${escapeHtml(attempts ? `Searches tried: ${attempts}` : "")}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="live-products">
      <div>
        <p class="eyebrow">Step 3</p>
        <h3>${escapeHtml(keyFamilyLabel(selectedKeyFamily))}</h3>
        <p>${escapeHtml(customerSafeCatalogText(lookup.statusMessage || "Parts search complete."))}</p>
      </div>
      <div class="live-product-workspace">
        ${renderLiveFilters(products, visibleProducts)}
        <div class="live-product-list">
          ${
            visibleProducts.length
              ? visibleProducts
          .map(
            (product, index) => `
              <article class="live-product-card ${index === 0 ? "best" : ""} ${
                product.keyInfo?.stock === "Out of stock" ? "out-of-stock" : ""
              }">
                ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />` : ""}
                <div>
                  <span>${index === 0 ? "Best reference match" : catalogSourceLabelFromName(product.supplier || product.brand)}</span>
                  <strong>${escapeHtml(product.name)}</strong>
                  <p>${escapeHtml([product.keyInfo?.sku, product.keyInfo?.fcc, product.keyInfo?.oem].filter(Boolean).join(" · ") || product.matchedQuery || "")}</p>
                  <dl>
                    <div><dt>Price</dt><dd>${product.price ? `$${escapeHtml(product.price)}` : "Check login"}</dd></div>
                    <div><dt>Type</dt><dd>${escapeHtml(product.keyInfo?.productType || "Verify")}</dd></div>
                    <div><dt>Chip</dt><dd>${escapeHtml(product.keyInfo?.chip || "Verify")}</dd></div>
                    <div><dt>Buttons</dt><dd>${escapeHtml(product.keyInfo?.buttons || "Verify")}</dd></div>
                    <div><dt>Stock</dt><dd>${escapeHtml(product.keyInfo?.stock || "Verify")}</dd></div>
                    <div><dt>Condition</dt><dd>${escapeHtml(product.keyInfo?.condition || "Verify")}</dd></div>
                  </dl>
                  ${product.keyInfo?.crossReference ? `<p>${escapeHtml(`Cross-ref: ${product.keyInfo.crossReference}`)}</p>` : ""}
                  ${product.keyInfo?.fitment ? `<p>${escapeHtml(product.keyInfo.fitment)}</p>` : ""}
                  ${product.url ? `<a href="${escapeHtml(product.url)}" target="_blank" rel="noreferrer">Open parts page</a>` : ""}
                </div>
              </article>
            `,
          )
                  .join("")
              : `<article class="assistant-card"><strong>No products match those filters</strong><p>Clear a filter or choose a broader condition/type.</p></article>`
          }
        </div>
      </div>
      <p class="supplier-footnote">${escapeHtml(attempts ? `Searches tried: ${attempts}` : "")}</p>
    </section>
  `;
}

function renderKeyFamilyStep(lookup) {
  const products = lookup?.products || [];
  if (!products.length) return "";
  ensureSelectedKeyFamily(products);
  const counts = familyCounts(products);
  const selectedProducts = productsForFamily(products, selectedKeyFamily);

  return `
    <section class="workflow-step key-family-step">
      <div class="workflow-heading">
        <p class="eyebrow">Step 3</p>
        <h3>Choose key family</h3>
        <p>Pick the path you are quoting or researching. The next step will show every matching part, including out-of-stock reference items.</p>
      </div>
      <div class="key-family-grid">
        <button class="key-family-option ${selectedKeyFamily === "proximity" ? "active" : ""}" type="button" data-key-family="proximity">
          <span>Proximity keys</span>
          <strong>${counts.proximity}</strong>
          <small>Smart keys, push-to-start, emergency insert references.</small>
        </button>
        <button class="key-family-option ${selectedKeyFamily === "keyed" ? "active" : ""}" type="button" data-key-family="keyed">
          <span>Flip / transponder keys</span>
          <strong>${counts.keyed}</strong>
          <small>Remote head keys, transponder keys, switchblades, blades, tools.</small>
        </button>
      </div>
      <div class="selected-family-strip">
        <strong>${escapeHtml(keyFamilyLabel(selectedKeyFamily))}</strong>
        <span>${selectedProducts.length} of ${products.length} parts selected</span>
      </div>
    </section>
  `;
}

function renderSelectedPartsStep(lookup) {
  const products = lookup?.products || [];
  if (!products.length) return renderLiveSupplierProducts(lookup);
  ensureSelectedKeyFamily(products);
  const selectedProducts = productsForFamily(products, selectedKeyFamily);
  return `
    <section class="workflow-step selected-parts-step">
      <div class="workflow-heading">
        <p class="eyebrow">Step 4</p>
        <h3>Selected options</h3>
        <p>${escapeHtml(`${selectedProducts.length} ${keyFamilyLabel(selectedKeyFamily).toLowerCase()} shown, including out-of-stock reference products.`)}</p>
      </div>
      ${renderLiveSupplierProducts(lookup, selectedProducts)}
    </section>
  `;
}

function renderVitalVehicleFacts(profile) {
  const vehicle = profile.vehicle || {};
  const facts = [
    ["Year / Make / Model", [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")],
    ["Trim / Series", [vehicle.trim, vehicle.series].filter(Boolean).join(" / ")],
    ["Body", [vehicle.bodyClass, vehicle.vehicleType].filter(Boolean).join(" / ")],
    ["Engine", [vehicle.engine, vehicle.engineModel, vehicle.engineCylinders ? `${vehicle.engineCylinders} cyl` : ""].filter(Boolean).join(" / ")],
    ["Drive / Weight", [vehicle.driveType, vehicle.gvwr].filter(Boolean).join(" / ")],
    ["Build plant", [vehicle.plantCity, vehicle.plantCountry].filter(Boolean).join(", ")],
  ].filter(([, value]) => value);
  return `
    <section class="vital-vehicle-grid">
      ${facts
        .map(
          ([label, value]) => `
            <article>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderVehicleApprovalScreen(profile, context) {
  const { vehicle, title } = context;
  const identifier = profile.vin || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const identityStatus = profile.vin
    ? profile.vinDetails?.checkDigitValid
      ? "VIN OK"
      : "Check VIN"
    : "Y/M/M lookup";
  return `
    <section class="program-screen quick-guide">
      <div class="quick-vehicle">
        <p class="eyebrow">Screen 2</p>
        <h3>${escapeHtml(title || "Vehicle details unavailable")}</h3>
        <div class="vin-strip">
          <span>${escapeHtml(identifier)}</span>
          <span>${escapeHtml(identityStatus)}</span>
          <span>${escapeHtml(vehicle.identitySource || "VIN decode")}</span>
        </div>
      </div>
      ${renderVitalVehicleFacts(profile)}
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-home>Edit VIN / start over</button>`,
        `<button class="primary-action" type="button" data-approve-vehicle>Next: Choose key type</button>`,
        `<button class="secondary-action" type="button" data-view-vehicle-details>View details</button>`,
      ])}
    </section>
  `;
}

function renderVehicleDetailsScreen(profile, context) {
  const { title } = context;
  return `
    <section class="program-screen quick-guide">
      <div class="quick-vehicle">
        <p class="eyebrow">Vehicle details</p>
        <h3>${escapeHtml(title || "Vehicle details")}</h3>
      </div>
      ${renderVehicleDossier(profile)}
      ${renderVinDetails(profile.vinDetails)}
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back to vehicle</button>`,
        `<button class="primary-action" type="button" data-approve-vehicle>Next: Choose key type</button>`,
      ])}
    </section>
  `;
}

function renderKeyFamilyScreen(profile) {
  const lookup = profile.liveSupplierLookup;
  const products = lookup?.products || [];
  if (!products.length) {
    return `
      <section class="program-screen key-family-step">
        <div class="workflow-heading">
          <p class="eyebrow">Screen 3</p>
          <h3>No parts returned</h3>
          <p>Go back and verify the vehicle, parts login, or reference source.</p>
        </div>
        ${renderWorkflowActions([
          `<button class="secondary-action" type="button" data-vin-back="vehicle">Back</button>`,
        ])}
      </section>
    `;
  }

  const counts = familyCounts(products);
  return `
    <section class="program-screen key-family-step">
      <div class="workflow-heading">
        <p class="eyebrow">Screen 3</p>
        <h3>Choose key family</h3>
        <p>Select the path for this vehicle. Your choice opens a new screen with only those key choices, including out-of-stock reference parts.</p>
      </div>
      <div class="key-family-grid">
        <button class="key-family-option" type="button" data-key-family="proximity">
          <span>Proximity keys</span>
          <strong>${counts.proximity}</strong>
          <small>Smart keys, push-to-start, emergency insert references.</small>
        </button>
        <button class="key-family-option" type="button" data-key-family="keyed">
          <span>Flip / transponder keys</span>
          <strong>${counts.keyed}</strong>
          <small>Remote head keys, transponder keys, switchblades, blades, tools.</small>
        </button>
        <button class="key-family-option" type="button" data-key-family="supporting">
          <span>Supporting items</span>
          <strong>${counts.supporting}</strong>
          <small>Insert blades, Lishi/tools, shells, and reference parts.</small>
        </button>
      </div>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back to vehicle</button>`,
      ])}
    </section>
  `;
}

function renderKeyPackageScreen(profile) {
  return `
    <section class="program-screen key-package-step">
      <div class="workflow-heading">
        <p class="eyebrow">Screen 3</p>
        <h3>Choose ignition type</h3>
      </div>
      <div class="key-package-grid">
        ${keyPackageOptions
          .map(
            (option) => `
              <button class="key-package-option ${selectedKeyPackage === option.id ? "active" : ""}" type="button" data-key-package="${escapeHtml(option.id)}">
                <span>${escapeHtml(option.title)}</span>
              </button>
            `,
          )
          .join("")}
      </div>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back to vehicle</button>`,
      ])}
    </section>
  `;
}

function renderKeyChoicesScreen(profile) {
  const products = profile.liveSupplierLookup?.products || [];
  ensureSelectedKeyFamily(products);
  let selectedProducts = productsForFamily(products, selectedKeyFamily);
  if (!selectedProducts.length && products.length) {
    selectedProducts = products.filter((product) => productKeyFamily(product) !== "supporting" && isDisplayKeyProduct(product));
  }
  const packageOption = selectedPackageOption();
  const decisionNote = profile.vin
    ? "VIN identified the vehicle, but FCC, buttons, board, and package still need parts/vehicle verification."
    : "Year/make/model search broadens the results. Use buttons, FCC, keyway, trim, and customer key style to narrow the exact part.";
  return `
    <section class="program-screen selected-parts-step">
      <div class="workflow-heading">
        <p class="eyebrow">Screen 4</p>
        <h3>${escapeHtml(keyFamilyLabel(selectedKeyFamily))}</h3>
        <p>${escapeHtml(`${selectedProducts.length} selected options shown. ${packageOption ? `Package clue: ${packageOption.title}. ` : ""}${decisionNote}`)}</p>
      </div>
      ${renderPartChoiceBoard(profile.liveSupplierLookup, selectedProducts)}
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="package">Back to key type</button>`,
      ])}
    </section>
  `;
}

function renderVinDetails(details) {
  if (!details) return "";
  return `
    <section class="decoded-vehicle">
      <div>
        <p class="eyebrow">VIN anatomy</p>
        <h3>${details.checkDigitValid ? "VIN check digit passed" : "VIN check digit mismatch"}</h3>
      </div>
      <div class="detail-grid">
        ${renderDetailItem("WMI", details.wmi)}
        ${renderDetailItem("VDS", details.vds)}
        ${renderDetailItem("Check digit", `${details.checkDigit} / expected ${details.expectedCheckDigit}`)}
        ${renderDetailItem("Year code", `${details.modelYearCode} -> ${details.derivedModelYear}`)}
        ${renderDetailItem("Plant code", details.plantCode)}
        ${renderDetailItem("Serial", details.serial)}
      </div>
    </section>
  `;
}

function renderKeyRequirements(requirements) {
  if (!requirements) return "";
  return `
    <section class="key-requirements">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Derived key requirements</p>
          <h3>${escapeHtml(requirements.headline)}</h3>
        </div>
      </div>
      <div class="requirement-grid">
        ${requirements.requirements
          .map(
            (item) => `
              <article class="requirement-card">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
                <p>${escapeHtml(item.confidence)} confidence · ${escapeHtml(item.source)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
      <div class="notes-block">
        <p class="eyebrow">Cannot derive from VIN alone</p>
        <ul>${requirements.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </section>
  `;
}

function renderVinProfileLegacy(profile) {
  latestVinProfile = profile;
  const vehicle = profile.vehicle;
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");

  vinResult.innerHTML = `
    <section class="decoded-vehicle">
      <div>
        <p class="eyebrow">Decoded vehicle</p>
        <h3>${escapeHtml(title || "Vehicle details unavailable")}</h3>
      </div>
      <div class="detail-grid">
        ${renderDetailItem("VIN", profile.vin)}
        ${renderDetailItem("Body", vehicle.bodyClass)}
        ${renderDetailItem("Engine", vehicle.engine)}
        ${renderDetailItem("Drive", vehicle.driveType)}
        ${renderDetailItem("Plant", [vehicle.plantCity, vehicle.plantCountry].filter(Boolean).join(", "))}
        ${renderDetailItem("Confidence", profile.confidence)}
      </div>
    </section>
    ${renderVinDetails(profile.vinDetails)}
    ${renderKeyRequirements(profile.keyRequirements)}
    <div class="recommendation-grid">
      ${renderOptionList("Key options", profile.keys)}
      ${renderOptionList("Programmers", profile.programmers)}
      ${renderOptionList("Origination tools", profile.tools)}
    </div>
    <div class="recommendation-grid support-grid">
      ${renderCheckList("Verify before dispatch", profile.verifyBeforeDispatch)}
      ${renderMatchedJobs(profile.matchedJobs)}
      ${renderCatalogApplication(profile.catalogApplication)}
    </div>
    <div class="recommendation-grid support-grid">
      ${renderProgrammingReference(profile.programmingReference)}
    </div>
    ${renderSourceReadiness(profile.sourceReadiness)}
    <div class="assistant-card source-card">
      <strong>${profile.keySystem ? "Verified database match" : "Brand fallback"}</strong>
      <p>${escapeHtml(profile.source)}</p>
    </div>
  `;

  vinRecommendation.innerHTML = `
    <strong>${escapeHtml(profile.recommendation.headline)}</strong>
    <p>${escapeHtml(profile.recommendation.summary)}</p>
    <div class="tag-row">
      ${profile.recommendation.reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}
    </div>
  `;
}

function renderVinProfile(profile) {
  latestVinProfile = profile;
  window.requestAnimationFrame(() => saveCurrentJobContext(profile));
  vinForm.classList.add("is-hidden");
  ymmForm?.classList.add("is-hidden");
  const vehicle = profile.vehicle;
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const requirements = Object.fromEntries(
    (profile.keyRequirements?.requirements || []).map((item) => [item.label, item]),
  );
  const quick = {
    keyType: requirements["Likely key style"]?.value || "Unknown",
    programMethod: requirements["Program method"]?.value || profile.programmingReference?.programMethod || "Verify",
    programmer: requirements["Required programmer"]?.value || profile.programmers?.[0]?.name || "Verify",
    tool: requirements["Origination / tool path"]?.value || profile.tools?.[0]?.name || "Verify",
    security: requirements["Security requirements"]?.value || "Verify",
    part: requirements["Parts confidence"]?.value || "Parts lookup required",
  };
  const bestSupplier = profile.supplierCandidates?.[0];
  ensureSelectedKeyFamily(profile.liveSupplierLookup?.products || []);
  const sourceBadge = profile.keySystem
    ? "Verified local match"
    : profile.programmingReference
      ? "Programming data match"
      : profile.lookupMode === "ymm"
        ? "Y/M/M parts search"
        : "Needs verification";

  const context = { vehicle, title, quick, bestSupplier, sourceBadge };
  let screenMarkup = "";
  if (vinWorkflowStep === "package") {
    screenMarkup = renderKeyPackageScreen(profile);
  } else if (vinWorkflowStep === "vehicle-details") {
    screenMarkup = renderVehicleDetailsScreen(profile, context);
  } else if (vinWorkflowStep === "family") {
    screenMarkup = renderKeyFamilyScreen(profile);
  } else if (vinWorkflowStep === "parts") {
    screenMarkup = renderKeyChoicesScreen(profile);
  } else if (vinWorkflowStep === "lishi") {
    screenMarkup = renderLishiDecodeScreen(profile);
  } else if (vinWorkflowStep === "programmers") {
    screenMarkup = renderProgrammerCoverageScreen(profile);
  } else if (vinWorkflowStep === "summary") {
    screenMarkup = renderFinalJobSummaryScreen(profile);
  } else if (vinWorkflowStep === "suppliers") {
    vinWorkflowStep = "summary";
    screenMarkup = renderFinalJobSummaryScreen(profile);
  } else {
    vinWorkflowStep = "vehicle";
    screenMarkup = renderVehicleApprovalScreen(profile, context);
  }
  vinResult.innerHTML = `${renderMobileContextHeader(profile, vinWorkflowStep)}<section class="vin-result-dispatch">${renderDispatchPack(profile)}</section>${screenMarkup}`;

  vinRecommendation.innerHTML = renderDispatchPack(profile);
  startLishiReferenceLookup(profile);
  updateAiContextUi();
  return;

  vinResult.innerHTML = `
    <section class="workflow-step quick-guide">
      <div class="quick-vehicle">
        <p class="eyebrow">Step 2</p>
        <h3>${escapeHtml(title || "Vehicle details unavailable")}</h3>
        <div class="vin-strip">
          <span>${escapeHtml(profile.vin)}</span>
          <span>${profile.vinDetails?.checkDigitValid ? "VIN OK" : "Check VIN"}</span>
          <span>${escapeHtml(sourceBadge)}</span>
        </div>
      </div>
      <div class="answer-grid">
        <article>
          <span>Key type</span>
          <strong>${escapeHtml(quick.keyType)}</strong>
          <p>${escapeHtml(profile.programmingReference?.immobilizerSystem || "Immobilizer not verified")}</p>
        </article>
        <article>
          <span>Programming</span>
          <strong>${escapeHtml(quick.programMethod)}</strong>
          <p>${escapeHtml(quick.security)}</p>
        </article>
        <article>
          <span>Programmer</span>
          <strong>${escapeHtml(quick.programmer)}</strong>
          <p>${profile.programmingReference?.allKeysLostSupported ? "AKL supported" : "AKL needs verification"}</p>
        </article>
        <article>
          <span>Tool / path</span>
          <strong>${escapeHtml(quick.tool)}</strong>
          <p>${escapeHtml(quick.part)}</p>
        </article>
        <article class="wide-answer">
          <span>Best parts clue</span>
          <strong>${escapeHtml(bestSupplier?.hlPartNumber || bestSupplier?.supplierSku || "Needs match")}</strong>
          <p>${escapeHtml(bestSupplier ? `${bestSupplier.confidence} confidence · FCC ${bestSupplier.fccId || "verify"}` : "No parts candidate yet")}</p>
        </article>
      </div>
    </section>

    ${renderKeyFamilyStep(profile.liveSupplierLookup)}

    ${renderSelectedPartsStep(profile.liveSupplierLookup)}

    <details class="deep-detail">
      <summary>More info for this job</summary>
      <section class="quick-checks">
        ${renderCheckList("Verify before dispatch", profile.verifyBeforeDispatch)}
      </section>
      ${renderKeyRequirements(profile.keyRequirements)}
      ${renderSupplierCandidates(profile.supplierCandidates)}
      <div class="recommendation-grid">
        ${renderOptionList("Key options", profile.keys)}
        ${renderOptionList("Programmers", profile.programmers)}
        ${renderOptionList("Origination tools", profile.tools)}
      </div>
    </details>

    <details class="deep-detail">
      <summary>Old-timer detail: VIN, sources, and matched jobs</summary>
      <section class="decoded-vehicle">
        <div>
          <p class="eyebrow">Decoded vehicle</p>
          <h3>${escapeHtml(title || "Vehicle details unavailable")}</h3>
        </div>
        <div class="detail-grid">
          ${renderDetailItem("VIN", profile.vin)}
          ${renderDetailItem("Body", vehicle.bodyClass)}
          ${renderDetailItem("Engine", vehicle.engine)}
          ${renderDetailItem("Drive", vehicle.driveType)}
          ${renderDetailItem("Plant", [vehicle.plantCity, vehicle.plantCountry].filter(Boolean).join(", "))}
          ${renderDetailItem("Confidence", profile.confidence)}
        </div>
      </section>
      ${renderVinDetails(profile.vinDetails)}
      <div class="recommendation-grid support-grid">
        ${renderMatchedJobs(profile.matchedJobs)}
        ${renderCatalogApplication(profile.catalogApplication)}
        ${renderProgrammingReference(profile.programmingReference)}
      </div>
      ${renderSourceReadiness(profile.sourceReadiness)}
      <div class="assistant-card source-card">
        <strong>${profile.keySystem ? "Verified database match" : "Brand fallback"}</strong>
        <p>${escapeHtml(profile.source)}</p>
      </div>
    </details>
  `;

  vinRecommendation.innerHTML = `
    <strong>${escapeHtml(profile.liveSupplierLookup?.loginStatus === "connected" ? "Live parts connected" : "Parts search fallback")}</strong>
    <p>${escapeHtml(customerSafeCatalogText(profile.liveSupplierLookup?.statusMessage || "Current matches use imported parts labels until live lookup is connected."))}</p>
    <div class="tag-row">
      <span>Parts sources</span><span>${escapeHtml(`${profile.liveSupplierLookup?.products?.length || 0} products`)}</span><span>Verify before ordering</span>
    </div>
  `;
}

function ensureJobSaveModal() {
  let modal = document.querySelector("#jobSaveModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "jobSaveModal";
  modal.className = "job-save-modal";
  modal.innerHTML = `
    <form class="job-save-sheet" id="jobSaveForm">
      <div class="scanner-head">
        <div>
          <p class="eyebrow">Save job result</p>
          <strong id="jobSaveTitle">Selected part</strong>
        </div>
        <button class="secondary-action small" type="button" data-close-job-save>Close</button>
      </div>
      <label>
        Exact part used
        <input name="exactPart" autocomplete="off" />
      </label>
      <label>
        Parts / part number
        <input name="partNumber" autocomplete="off" />
      </label>
      <label>
        Lishi / keyway used
        <input name="lishi" autocomplete="off" />
      </label>
      <label>
        Programmer used
        <input name="programmer" autocomplete="off" />
      </label>
      <label>
        Tool / blade / code source
        <input name="tool" autocomplete="off" />
      </label>
      <label>
        Final outcome
        <select name="outcome">
          <option value="worked">Programmed successfully</option>
          <option value="failed-program">Did not program</option>
          <option value="wrong-fcc">Wrong FCC</option>
          <option value="wrong-buttons">Wrong buttons</option>
          <option value="different-key-style">Different key style</option>
        </select>
      </label>
      <label>
        Key type
        <select name="keyType">
          <option value="proximity">Proximity / smart</option>
          <option value="keyed">Flip / transponder</option>
        </select>
      </label>
      <label>
        Failure reason
        <input name="failureReason" autocomplete="off" />
      </label>
      <label>
        Notes
        <textarea name="notes" rows="3"></textarea>
      </label>
      <button class="primary-action" type="submit">Save worked job</button>
    </form>
  `;
  document.body.appendChild(modal);
  return modal;
}

function openJobSaveModal(offer) {
  const modal = ensureJobSaveModal();
  const form = modal.querySelector("form");
  const vehicleTitle = latestVinProfile?.vehicle ? [latestVinProfile.vehicle.year, latestVinProfile.vehicle.make, latestVinProfile.vehicle.model].filter(Boolean).join(" ") : "Vehicle";
  const snapshot = selectedPartSnapshot(latestVinProfile);
  const lishi = latestVinProfile ? lishiReferenceForProfile(latestVinProfile, snapshot) : null;
  const programmer = selectedProgrammerOption(latestVinProfile);
  pendingJobOfferId = offerIdentityKey(offer);
  modal.querySelector("#jobSaveTitle").textContent = offer.partName;
  form.elements.exactPart.value = offer.partName || "";
  form.elements.partNumber.value = [offer.sku, offer.oem, offer.fcc].filter(Boolean).join(" / ");
  form.elements.lishi.value = lishi?.keyways?.[0] || lishi?.primary || "";
  form.elements.programmer.value = programmer?.name || latestVinProfile?.programmingReference?.programmer || latestVinProfile?.programmers?.[0]?.name || "";
  form.elements.tool.value = latestVinProfile?.tools?.[0]?.name || "";
  form.elements.outcome.value = "worked";
  form.elements.keyType.value = selectedKeyFamily === "proximity" ? "proximity" : "keyed";
  form.elements.failureReason.value = "";
  form.elements.notes.value = `${vehicleTitle}\n${[offer.sku, offer.oem, offer.fcc, offer.buttons, lishi?.keyways?.[0] ? `Lishi ${lishi.keyways[0]}` : ""].filter(Boolean).join(" | ")}`;
  modal.classList.add("active");
}

function closeJobSaveModal() {
  pendingJobOfferId = "";
  document.querySelector("#jobSaveModal")?.classList.remove("active");
}

function supplierLookupParams(profile) {
  const vehicle = profile.vehicle || {};
  const params = new URLSearchParams();
  [
    ["vin", profile.vin || ""],
    ["year", vehicle.year || ""],
    ["make", vehicle.make || ""],
    ["model", vehicle.model || ""],
    ["trim", vehicle.trim || ""],
    ["bodyClass", vehicle.bodyClass || ""],
    ["engine", vehicle.engine || ""],
    ["driveType", vehicle.driveType || ""],
    ["plantCity", vehicle.plantCity || ""],
    ["plantCountry", vehicle.plantCountry || ""],
    ["identitySource", vehicle.identitySource || ""],
  ].forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function vinInput() {
  return vinForm.querySelector("input[name='vin']");
}

function submitCurrentVin() {
  vinForm.requestSubmit ? vinForm.requestSubmit() : vinForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

function ensureVinScannerModal() {
  let modal = document.querySelector("#vinScannerModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "vinScannerModal";
  modal.className = "scanner-modal";
  modal.innerHTML = `
    <div class="scanner-sheet">
      <div class="scanner-head">
        <div>
          <p class="eyebrow">VIN scanner</p>
          <strong>Scan door label barcode</strong>
        </div>
        <button class="secondary-action small" type="button" data-close-scanner>Close</button>
      </div>
      <video class="scanner-video" playsinline muted></video>
      <div class="scanner-frame" aria-hidden="true"></div>
      <p class="scanner-status">Point the camera at the VIN barcode. Manual entry still works below.</p>
      <div class="scanner-manual">
        <input name="manualVinScan" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Enter VIN manually" />
        <button class="primary-action small" type="button" data-use-scanned-vin>Use VIN</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function stopVinScanner() {
  if (activeVinScan?.stream) {
    activeVinScan.stream.getTracks().forEach((track) => track.stop());
  }
  if (activeVinScan?.frameId) cancelAnimationFrame(activeVinScan.frameId);
  activeVinScan = null;
  document.querySelector("#vinScannerModal")?.classList.remove("active");
}

function acceptScannedVin(value) {
  const vin = normalizeVinInput(value);
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false;
  vinInput().value = vin;
  stopVinScanner();
  submitCurrentVin();
  return true;
}

async function startVinScanner() {
  const modal = ensureVinScannerModal();
  const video = modal.querySelector("video");
  const status = modal.querySelector(".scanner-status");
  const manual = modal.querySelector("input[name='manualVinScan']");
  manual.value = vinInput().value || "";
  modal.classList.add("active");

  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Camera access is not available in this browser. Enter the VIN manually.";
    return;
  }
  if (!("BarcodeDetector" in window)) {
    status.textContent = "Barcode scanning is not supported in this browser yet. Enter the VIN manually below.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
    video.srcObject = stream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ["code_39", "code_128", "data_matrix", "qr_code"] });
    activeVinScan = { stream, detector, frameId: null };
    const scan = async () => {
      if (!activeVinScan) return;
      try {
        const codes = await detector.detect(video);
        const found = codes.map((code) => code.rawValue).find((value) => /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVinInput(value)));
        if (found && acceptScannedVin(found)) return;
        status.textContent = "Scanning... hold steady on the VIN barcode.";
      } catch {
        status.textContent = "Scanner had trouble reading. Try better light or manual entry.";
      }
      if (activeVinScan) activeVinScan.frameId = requestAnimationFrame(scan);
    };
    scan();
  } catch (error) {
    status.textContent = `Camera unavailable: ${error.message}`;
  }
}

async function startSupplierLookup(profile) {
  const vehicle = profile.vehicle || {};
  if (!vehicle.year || !vehicle.make || !vehicle.model) return;
  const requestId = ++supplierLookupRequestId;
  try {
    const lookup = await api(`/api/supplier-lookup?${supplierLookupParams(profile)}`);
    if (requestId !== supplierLookupRequestId || latestVinProfile !== profile) return;
    latestVinProfile.liveSupplierLookup = lookup;
    cacheLookupProfile(lookupCacheKeyFromProfile(latestVinProfile), latestVinProfile);
    renderVinProfile(latestVinProfile);
  } catch (error) {
    if (requestId !== supplierLookupRequestId || latestVinProfile !== profile) return;
    latestVinProfile.liveSupplierLookup = {
      ...(latestVinProfile.liveSupplierLookup || {}),
      loginStatus: "error",
      statusMessage: error.message || "Parts lookup failed.",
      products: latestVinProfile.liveSupplierLookup?.products || [],
    };
    cacheLookupProfile(lookupCacheKeyFromProfile(latestVinProfile), latestVinProfile);
    renderVinProfile(latestVinProfile);
  }
}

function profileReloadUrl(profile) {
  if (profile?.vin) return `/api/vin/${encodeURIComponent(profile.vin)}`;
  const vehicle = profile?.vehicle || {};
  return `/api/vehicle-lookup?year=${encodeURIComponent(vehicle.year || "")}&make=${encodeURIComponent(vehicle.make || "")}&model=${encodeURIComponent(vehicle.model || "")}`;
}

async function refreshProfileAfterWorkedJob(result, programmerName = "") {
  if (!latestVinProfile?.vehicle) return null;
  const previousProfile = latestVinProfile;
  const previousLookup = previousProfile.liveSupplierLookup;
  const previousStep = vinWorkflowStep;
  const previousFamily = selectedKeyFamily;
  const previousPartChoice = selectedPartChoiceKey;
  const previousFilters = Object.fromEntries(Object.entries(liveProductFilters).map(([key, value]) => [key, new Set(value)]));

  const refreshed = await api(profileReloadUrl(previousProfile));
  if (previousLookup?.products?.length) refreshed.liveSupplierLookup = previousLookup;
  if (result?.profile) refreshed.verifiedProfile = result.profile;

  vinWorkflowStep = previousStep;
  selectedKeyFamily = previousFamily;
  selectedPartChoiceKey = previousPartChoice;
  Object.entries(previousFilters).forEach(([key, value]) => {
    liveProductFilters[key] = value;
  });

  selectWorkedProgrammerOption(refreshed, programmerName);
  renderVinProfile(refreshed);
  startSupplierLookup(refreshed);
  return refreshed;
}

function renderVinError(message) {
  vinResult.innerHTML = `<div class="assistant-card"><strong>VIN decode failed</strong><p>${escapeHtml(message)}</p></div>`;
  vinRecommendation.innerHTML = `<strong>Check VIN</strong><p>Confirm the 17-character VIN from the dash tag, door sticker, registration, or RO.</p>`;
}

function routeDisplayLabel(id = activeViewId) {
  return routeMeta[id]?.eyebrow || id.replace(/-/g, " ");
}

function compactList(value, limit = 5) {
  return [...new Set((Array.isArray(value) ? value : [value]).flat().map((item) => cleanInput(item)).filter(Boolean))].slice(0, limit);
}

function vehicleTitleFromVehicle(vehicle = {}) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
}

function activeScreenQuery() {
  return {
    command: globalSearchQuery(),
    workbench: workbenchQueryFromForm(),
    "part-history": cleanInput(partHistoryForm?.elements.partNumber?.value || latestPartHistory?.query || ""),
    "proof-vault": cleanInput(proofVaultForm?.elements.proofQuery?.value || latestProofVault?.query || ""),
    "code-desk": cleanInput(codeDeskAutoForm?.elements.autoQuery?.value || codeDeskForm?.elements.query?.value || ""),
    lishi: cleanInput(lishiLookupForm?.elements.lishiQuery?.value || latestLishiLookup?.query || ""),
    coverage: latestCoverageDashboard ? "programmer coverage" : "",
    vin: latestVinProfile?.vin || vehicleTitleFromVehicle(latestVinProfile?.vehicle || {}),
  }[activeViewId] || "";
}

function compactProfileForAi(profile = currentWorkbenchProfile()) {
  if (!profile?.vehicle) return null;
  return {
    vin: profile.vin || "",
    lookupMode: profile.lookupMode || "",
    vehicle: profile.vehicle,
    title: vehicleTitleFromVehicle(profile.vehicle),
    confidence: profile.confidence || "",
    selectedPart: profile.selectedPart || null,
    recommendation: profile.recommendation?.headline || profile.recommendation?.summary || "",
    programmers: (profile.programmers || []).slice(0, 4).map((item) => item.name || item),
    tools: (profile.tools || []).slice(0, 4).map((item) => item.name || item),
    keys: (profile.keys || []).slice(0, 4).map((item) => item.name || item),
    matchedJobs: profile.matchedJobs?.length || 0,
    lishi: profile.lishiLookup
      ? {
          tools: (profile.lishiLookup.tools || []).slice(0, 4).map((tool) => tool.canonical || tool.tool),
          matchedApplications: profile.lishiLookup.matchedApplications || 0,
        }
      : null,
  };
}

function compactPartHistoryForAi(payload = latestPartHistory) {
  if (!payload) return null;
  return {
    query: payload.query || "",
    primaryIdentifier: payload.primaryIdentifier || "",
    matchedJobs: payload.jobs?.length || 0,
    matchedReferenceRows: payload.referenceStats?.matchedReferenceRows || payload.crossReferences?.length || 0,
    identifiers: {
      lr: compactList(payload.identifiers?.lr || [], 4),
      mw: compactList(payload.identifiers?.mw || [], 4),
      ti: compactList(payload.identifiers?.ti || [], 4),
      oe: compactList(payload.identifiers?.oe || [], 6),
    },
    topProgrammers: (payload.programmerEvidence?.programmers || []).slice(0, 4).map((programmer) => ({
      name: programmer.name,
      jobs: programmer.jobs,
      observedCoveragePercent: programmer.observedCoveragePercent,
    })),
  };
}

function compactProofVaultForAi(payload = latestProofVault) {
  if (!payload) return null;
  const summary = payload.summary || {};
  return {
    query: payload.query || "",
    totalJobs: summary.totalJobs || 0,
    matchingJobs: summary.matchingJobs || payload.records?.length || 0,
    provenJobs: summary.provenJobs || 0,
    warningJobs: summary.warningJobs || 0,
    unknownJobs: summary.unknownJobs || 0,
    files: proofVaultAttachmentCount(proofVaultAttachments()),
  };
}

function compactCodeDeskForAi() {
  const auto = latestCodeDeskAutoBaseline || {};
  const result = latestCodeDeskResult || {};
  return {
    autoQuery: auto.query || cleanInput(codeDeskAutoForm?.elements.autoQuery?.value || ""),
    autoMatches: auto.rows?.length || auto.returnedRows || 0,
    totalAutoRows: auto.totalRows || 0,
    selectedSystem: result.system?.name || selectedCodeDeskSystem?.().name || "",
    mode: result.mode || codeDeskForm?.elements.mode?.value || "",
    query: result.query || cleanInput(codeDeskForm?.elements.query?.value || ""),
    bitting: result.bitting?.join("") || "",
    verifiedCandidates: result.verifiedCandidates?.length || 0,
    importedRecords: codeDeskImportedRecords.length,
  };
}

function compactLishiForAi(payload = latestLishiLookup) {
  if (!payload) return null;
  return {
    query: payload.query || cleanInput(lishiLookupForm?.elements.lishiQuery?.value || ""),
    matchedTools: payload.tools?.length || payload.returnedTools || 0,
    matchedApplications: payload.matchedApplications || payload.applications?.length || 0,
    tools: (payload.tools || []).slice(0, 5).map((tool) => tool.canonical || tool.tool),
    applications: (payload.applications || []).slice(0, 5).map((application) =>
      [application.yearRange, application.manufacturer, application.model, application.tool].filter(Boolean).join(" "),
    ),
  };
}

function compactCoverageForAi(payload = latestCoverageDashboard) {
  if (!payload) return null;
  const summary = payload.summary || {};
  return {
    automotiveJobs: summary.automotiveJobs || 0,
    observedCoveragePercent: summary.observedCoveragePercent,
    programmerProofPercent: summary.programmerProofPercent,
    partProofPercent: summary.partProofPercent,
    topProgrammers: (payload.programmers || []).slice(0, 4).map((item) => ({
      name: item.key,
      jobs: item.jobs,
      observedCoveragePercent: item.observedCoveragePercent,
    })),
    gaps: {
      missingProgrammer: payload.gaps?.missingProgrammer?.length || 0,
      missingPart: payload.gaps?.missingPart?.length || 0,
      needsOutcome: payload.gaps?.needsOutcome?.length || 0,
    },
  };
}

function compactGlobalSearchForAi(payload = latestGlobalSearch) {
  if (!payload) return null;
  return {
    query: payload.query || "",
    results: payload.summary?.results || 0,
    groups: (payload.groups || []).map((group) => `${group.label}: ${group.count}`).slice(0, 6),
  };
}

function compactRecentJobsForAi() {
  return jobs.slice(0, 8).map((job) => ({
    id: job.id,
    title: [job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || job.vehicle || job.title || job.customer || job.id,
    vin: job.vin || "",
    status: job.status || "",
    service: job.service || "",
    programmer: job.programmer || "",
    partNumber: job.partNumber || job.exactPart || job.sku || "",
    outcome: job.outcome?.key || job.outcome || "",
  }));
}

function buildAiClientContext() {
  const profile = compactProfileForAi();
  return {
    activeView: activeViewId,
    screen: routeDisplayLabel(activeViewId),
    appMode,
    query: activeScreenQuery(),
    workflow: {
      vinStep: vinWorkflowStep,
      selectedKeyFamily,
      selectedKeyPackage,
      selectedPartChoiceKey,
      selectedProgrammerKey,
    },
    currentProfile: profile,
    workbench: latestWorkbench
      ? {
          title: latestWorkbench.title,
          query: latestWorkbench.query,
          activeQueries: latestWorkbench.activeQueries,
          overview: latestWorkbench.overview,
          aiBrief: latestWorkbench.aiBrief,
          warnings: latestWorkbench.warnings,
          vehicle: latestWorkbench.vehicle,
        }
      : null,
    partHistory: compactPartHistoryForAi(),
    proofVault: compactProofVaultForAi(),
    codeDesk: compactCodeDeskForAi(),
    lishi: compactLishiForAi(),
    coverage: compactCoverageForAi(),
    globalSearch: compactGlobalSearchForAi(),
    jobs: compactRecentJobsForAi(),
  };
}

function aiContextSummaryText(context = buildAiClientContext()) {
  const vehicle = context.currentProfile?.title || vehicleTitleFromVehicle(context.workbench?.vehicle || {});
  const query = context.query || context.workbench?.activeQueries?.part || context.globalSearch?.query || "";
  const pieces = [
    `${context.screen || "Current screen"} is active`,
    vehicle ? `vehicle ${vehicle}` : "",
    query ? `query ${query}` : "",
    context.workbench?.aiBrief?.confidencePercent ? `${context.workbench.aiBrief.confidencePercent}% packet confidence` : "",
    context.partHistory?.matchedJobs ? `${context.partHistory.matchedJobs} part-history jobs` : "",
    context.proofVault?.matchingJobs ? `${context.proofVault.matchingJobs} proof records` : "",
  ].filter(Boolean);
  return pieces.join(" | ") || "No job context loaded yet";
}

function aiPromptSuggestions(context = buildAiClientContext()) {
  const q = context.query || context.workbench?.activeQueries?.part || "this job";
  const base = {
    command: [`Run a complete locksmith field audit for this search`, `Where should I open this search next?`, `Build a job plan from the current search`, `What proof should I look for first?`],
    vin: [`Run a VIN-to-key readiness audit`, `Build the next-step checklist for this VIN`, `What should I verify before ordering?`, `Summarize this job for the customer`],
    workbench: [`Run a complete field audit from this packet`, `What proof is missing?`, `Create a technician checklist`, `Build a dispatch plan`],
    "part-history": [`Is ${q} proven enough to trust?`, `What programmer proof exists for ${q}?`, `What should I save after this job?`, `Build the best part verification path`],
    "proof-vault": [`What proof is missing for ${q}?`, `Write a customer-safe proof summary`, `What would improve coverage percentage?`, `Build the attachment checklist`],
    "code-desk": [`What do I need before using code data?`, `Explain this bitting/code result safely`, `What should I verify before cutting?`, `Build a code-use authorization checklist`],
    lishi: [`Which Lishi result should I verify first?`, `Build a Lishi verification checklist`, `What should I confirm at the lock?`, `Turn this into a decode workflow`],
    coverage: [`Where are my biggest coverage gaps?`, `Which programmer evidence is strongest?`, `What should I log on the next job?`, `Build my next coverage cleanup list`],
    learn: [`Check this worked-job entry before saving`, `What fields matter most for proof?`, `How should I describe the outcome?`, `Make this saved job useful for future AI`],
    ai: [`Run a complete locksmith field audit`, `Create a technician checklist`, `Create a customer-facing note`, `Build a save-back checklist`],
  };
  return [...(base[context.activeView] || base.command), `Create a quote-prep checklist for ${q}`].slice(0, 6);
}

function aiRouteQuickActions(context = buildAiClientContext()) {
  const subject = context.query || context.currentProfile?.title || context.workbench?.title || "current screen";
  const top = latestAiAdvisor?.topAction;
  if (top) {
    return [
      { label: "Do Next", target: top.target || "ai", prompt: top.prompt || `Help me with ${top.title}` },
      { label: "AI Audit", target: "ai", prompt: `Run a complete locksmith field audit for ${subject}.` },
      { label: "Open AI Bench", target: "ai" },
    ];
  }
  return [
    { label: "AI Audit", target: "ai", prompt: `Run a complete locksmith field audit for ${subject}.` },
    { label: "Dispatch Plan", target: "ai", prompt: `Build a dispatch plan for ${subject}.` },
    { label: "Open AI Bench", target: "ai" },
  ];
}

function renderAiContextChips(context = buildAiClientContext()) {
  const chips = [
    context.screen,
    context.query ? `Search: ${context.query}` : "",
    context.currentProfile?.title,
    context.workbench?.aiBrief?.confidencePercent ? `AI ${context.workbench.aiBrief.confidencePercent}%` : "",
    context.coverage?.observedCoveragePercent ? `${context.coverage.observedCoveragePercent}% coverage` : "",
  ].filter(Boolean);
  return chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("");
}

function renderAiContextPanel(context = buildAiClientContext()) {
  const facts = [
    ["Screen", context.screen],
    ["Active search", context.query || "No active search"],
    ["Vehicle", context.currentProfile?.title || vehicleTitleFromVehicle(context.workbench?.vehicle || {}) || "No VIN/YMM context"],
    ["Workbench", context.workbench?.aiBrief?.decision || "No packet built yet"],
    ["Part proof", context.partHistory ? `${context.partHistory.matchedJobs} jobs / ${context.partHistory.matchedReferenceRows} reference rows` : "Not loaded"],
    ["Proof vault", context.proofVault ? `${context.proofVault.matchingJobs} matches / ${context.proofVault.files} files` : "Not loaded"],
    ["Lishi", context.lishi ? `${context.lishi.matchedTools} tools / ${context.lishi.matchedApplications} applications` : "Not loaded"],
    ["Code Desk", context.codeDesk ? `${context.codeDesk.autoMatches} auto rows / ${context.codeDesk.verifiedCandidates} verified candidates` : "Not loaded"],
    ["Coverage", context.coverage ? `${context.coverage.automotiveJobs} jobs / ${context.coverage.observedCoveragePercent ?? "N/A"}% observed` : "Not loaded"],
  ];
  return facts
    .map(
      ([label, value]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
}

function aiMemoryFromState(advisor = latestAiAdvisor) {
  const memory = latestAiMemory || {};
  const advisorMemory = advisor?.memory || {};
  return {
    personality: memory.personality || advisorMemory.personality || {
      name: "TimLock Field Copilot",
      voice: "Direct, verification-first, and built around locksmith proof.",
      catchphrase: "Verify the job, then move clean.",
    },
    feedback: memory.feedback || advisorMemory.feedback || {},
    shopRules: {
      total: memory.shopRules?.total ?? advisorMemory.shopRules ?? 0,
      relevant: memory.shopRules?.relevant || [],
    },
    corrections: memory.corrections || [],
    learningSignals: memory.learningSignals || [],
    totalJobs: advisorMemory.totalJobs || 0,
    automotiveJobs: advisorMemory.automotiveJobs || 0,
  };
}

function renderAiPersonalityPanel(advisor = latestAiAdvisor) {
  const memory = aiMemoryFromState(advisor);
  const personality = memory.personality || {};
  const feedback = memory.feedback || {};
  const signals = [
    ...(memory.learningSignals || []),
    memory.corrections?.length ? `${memory.corrections.length} correction${memory.corrections.length === 1 ? "" : "s"} matched` : "",
    memory.totalJobs ? `${memory.totalJobs} saved jobs in memory` : "",
  ].filter(Boolean);
  const ruleChips = (memory.shopRules?.relevant || []).slice(0, 3).map((rule) => `Rule: ${rule.title}`);
  return `
    <section class="ai-personality-strip">
      <div class="ai-personality-mark">TL</div>
      <div class="ai-personality-copy">
        <p class="eyebrow">AI personality</p>
        <h3>${escapeHtml(personality.name || "TimLock Field Copilot")}</h3>
        <p>${escapeHtml(personality.voice || "Verification-first locksmith field assistant.")}</p>
        <span>${escapeHtml(personality.catchphrase || "Verify the job, then move clean.")}</span>
      </div>
      <div class="ai-memory-metrics">
        <article><strong>${escapeHtml(memory.shopRules?.total || 0)}</strong><span>shop rules</span></article>
        <article><strong>${escapeHtml(feedback.used || 0)}</strong><span>used</span></article>
        <article><strong>${escapeHtml(feedback.helpful || 0)}</strong><span>helpful</span></article>
        <article><strong>${escapeHtml(feedback.wrong || 0)}</strong><span>corrections</span></article>
      </div>
    </section>
    ${
      signals.length || ruleChips.length
        ? `<div class="ai-learning-strip">${[...ruleChips, ...signals].slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
        : ""
    }
  `;
}

function aiAdvisorScoreClass(score) {
  const value = Number(score);
  if (value >= 80) return "ready";
  if (value >= 55) return "warn";
  return "danger";
}

function renderAiAdvisorPanel(advisor = latestAiAdvisor) {
  if (!aiOpportunityPanel) return;
  if (!advisor) {
    aiOpportunityPanel.innerHTML = `
      ${renderAiPersonalityPanel(advisor)}
      <article class="ai-opportunity-card loading">
        <div>
          <p class="eyebrow">AI opportunities</p>
          <strong>Scanning saved jobs, proof, and coverage...</strong>
          <span>The assistant will surface the best cleanup or workflow move here.</span>
        </div>
      </article>
    `;
    return;
  }
  const actions = advisor.actions || [];
  const top = advisor.topAction || actions[0];
  aiOpportunityPanel.innerHTML = `
    ${renderAiPersonalityPanel(advisor)}
    <section class="ai-advisor-overview">
      <div class="ai-score mini ${aiAdvisorScoreClass(advisor.readinessScore)}">
        <strong>${escapeHtml(advisor.readinessScore ?? 0)}</strong>
        <span>memory</span>
      </div>
      <div>
        <p class="eyebrow">AI opportunities</p>
        <h3>${escapeHtml(advisor.headline || "AI is ready")}</h3>
        <p>${escapeHtml((advisor.summary || []).join(" | "))}</p>
      </div>
      ${
        top
          ? `<button class="primary-action small" type="button" data-ai-advisor-open="${escapeHtml(top.target || "ai")}" data-ai-advisor-prompt="${escapeHtml(top.prompt || "")}">Do Next</button>`
          : ""
      }
    </section>
    ${
      actions.length
        ? `<div class="ai-opportunity-list">
            ${actions.slice(0, 4).map((action) => `
              <article>
                <div>
                  <span>${escapeHtml(action.source || action.impact || "AI")}</span>
                  <strong>${escapeHtml(action.title)}</strong>
                  <p>${escapeHtml(action.detail)}</p>
                </div>
                <button class="secondary-action small" type="button" data-ai-advisor-open="${escapeHtml(action.target || "ai")}" data-ai-advisor-prompt="${escapeHtml(action.prompt || "")}">Open</button>
              </article>
            `).join("")}
          </div>`
        : ""
    }
  `;
}

function compactAiPacketList(items, limit = 10) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === "string") return cleanInput(item);
      if (!item || typeof item !== "object") return "";
      return cleanInput([item.title || item.label || item.status || item.target, item.detail || item.reason || item.prompt].filter(Boolean).join(": "));
    })
    .filter(Boolean)
    .slice(0, limit);
}

function aiCommanderPacketPayload(commander = latestAiCommander) {
  const packet = commander?.fieldPacket || {};
  const mission = commander?.mission || {};
  const learning = commander?.learningLoop || {};
  const copyBlocks = packet.copyBlocks || {};
  const subject = cleanInput(mission.subject || commander?.headline || "Current job");
  return {
    schemaVersion: "timlock-field-command-packet/v1",
    exportedAt: new Date().toISOString(),
    generatedAt: commander?.generatedAt || "",
    title: commander?.title || "TimLock Field Commander",
    subject,
    headline: commander?.headline || "",
    readiness: {
      score: Number(commander?.readinessScore ?? packet.readinessScore ?? 0),
      label: commander?.readinessLabel || packet.readinessLabel || "Unknown",
      priority: packet.priority || "",
    },
    mission: {
      decision: mission.decision || packet.dispatchDecision || "Verify the job details before relying on this packet.",
      nextBestAction: mission.nextBestAction || packet.nextBestAction || null,
      customerSafeNote: mission.customerSafeNote || copyBlocks.customerNote || "",
      workOrderNote: mission.workOrderNote || copyBlocks.workOrderNote || "",
    },
    scorecards: (commander?.dataScorecards || []).map((card) => ({
      label: cleanInput(card.label),
      value: cleanInput(card.value),
      tone: cleanInput(card.tone),
    })),
    nextMoves: (commander?.actionStack || []).slice(0, 8).map((action, index) => ({
      step: index + 1,
      title: cleanInput(action.title || `Action ${index + 1}`),
      detail: cleanInput(action.detail || ""),
      tool: cleanInput(action.target || ""),
      prompt: cleanInput(action.prompt || ""),
      impact: cleanInput(action.impact || action.source || ""),
    })),
    routePlan: (packet.routePlan || []).slice(0, 8).map((route) => ({
      label: cleanInput(route.label || route.target || "Tool"),
      status: cleanInput(route.status || "next"),
      reason: cleanInput(route.reason || ""),
      target: cleanInput(route.target || ""),
    })),
    risks: compactAiPacketList(commander?.riskRadar || [], 10),
    blockers: compactAiPacketList(packet.blockers || [], 8),
    warnings: compactAiPacketList(packet.warnings || [], 8),
    proofGaps: compactAiPacketList(packet.proofGaps || [], 8),
    technicianPlan: compactAiPacketList(packet.technicianPlan || [], 10),
    saveBackChecklist: compactAiPacketList(learning.saveBackChecklist || packet.saveBackChecklist || [], 10),
    learningSignals: compactAiPacketList(learning.signals || [], 8),
    copyBlocks: {
      technicianChecklist: copyBlocks.technicianChecklist || "",
      customerNote: mission.customerSafeNote || copyBlocks.customerNote || "",
      workOrderNote: mission.workOrderNote || copyBlocks.workOrderNote || "",
    },
  };
}

function aiCommanderPacketText(commander = latestAiCommander) {
  const payload = aiCommanderPacketPayload(commander);
  const lines = [
    "TIMLOCK FIELD COMMAND PACKET",
    `Generated: ${new Date(payload.exportedAt).toLocaleString()}`,
    `Subject: ${payload.subject}`,
    `Readiness: ${payload.readiness.score}% - ${payload.readiness.label}`,
    "",
    "Decision:",
    payload.mission.decision,
  ];
  const appendList = (title, items, formatter = (item) => item) => {
    const cleanItems = (items || []).map(formatter).map(cleanInput).filter(Boolean);
    if (!cleanItems.length) return;
    lines.push("", `${title}:`);
    cleanItems.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  };
  appendList("Next Moves", payload.nextMoves, (item) => [item.title, item.detail, item.tool ? `Tool: ${item.tool}` : ""].filter(Boolean).join(" | "));
  appendList("Risk Radar", payload.risks);
  appendList("Blockers", payload.blockers);
  appendList("Warnings", payload.warnings);
  appendList("Proof Gaps", payload.proofGaps);
  appendList("Technician Plan", payload.technicianPlan);
  appendList("Save Back After Job", payload.saveBackChecklist);
  if (payload.copyBlocks.customerNote) lines.push("", "Customer Note:", payload.copyBlocks.customerNote);
  if (payload.copyBlocks.workOrderNote) lines.push("", "Work Order Note:", payload.copyBlocks.workOrderNote);
  if (payload.copyBlocks.technicianChecklist) lines.push("", "Tech Checklist:", payload.copyBlocks.technicianChecklist);
  return `${lines.join("\n")}\n`;
}

function aiCommanderPacketFilename(payload) {
  const slug = cleanInput(payload.subject || payload.title || "field-command")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "field-command";
  return `timlock-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
}

function setAiCommanderStatus(message) {
  const status = aiCommanderPanel?.querySelector("[data-ai-commander-status]");
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
}

async function copyTextToClipboard(text) {
  const cleanText = cleanInput(text);
  if (!cleanText) throw new Error("No packet text is available yet.");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(cleanText);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = cleanText;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function copyAiCommanderPacket() {
  await copyTextToClipboard(aiCommanderPacketText());
  setAiCommanderStatus("Field command packet copied.");
}

async function copyAiCommanderBlock(key) {
  const payload = aiCommanderPacketPayload();
  const text = payload.copyBlocks?.[key] || "";
  await copyTextToClipboard(text || aiCommanderPacketText());
  setAiCommanderStatus(key === "customerNote" ? "Customer note copied." : key === "workOrderNote" ? "Work order note copied." : "Technician checklist copied.");
}

function exportAiCommanderPacket() {
  const payload = aiCommanderPacketPayload();
  downloadJson(aiCommanderPacketFilename(payload), payload);
  setAiCommanderStatus("Field command packet exported.");
}

function packetListHtml(title, items) {
  const cleanItems = (items || []).map(cleanInput).filter(Boolean);
  if (!cleanItems.length) return "";
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <ul>${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function aiCommanderPrintHtml(payload) {
  const scorecards = payload.scorecards?.length
    ? `<div class="scorecards">${payload.scorecards.map((card) => `
        <article>
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>
      `).join("")}</div>`
    : "";
  const nextMoves = (payload.nextMoves || []).map((item) => [item.title, item.detail, item.tool ? `Tool: ${item.tool}` : ""].filter(Boolean).join(" | "));
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(payload.subject)} - TimLock Field Packet</title>
        <style>
          body { margin: 28px; color: #171c22; font-family: Arial, Helvetica, sans-serif; line-height: 1.45; }
          header { border-bottom: 2px solid #171c22; padding-bottom: 16px; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 28px; }
          h2 { margin: 18px 0 8px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; }
          p { margin: 5px 0; }
          button { margin-bottom: 18px; padding: 10px 14px; border: 0; border-radius: 6px; background: #171c22; color: #fff; font-weight: 700; }
          .meta { color: #5a6470; font-size: 13px; }
          .decision { border: 1px solid #cbd3dc; border-radius: 7px; padding: 12px; background: #f6f8fa; }
          .scorecards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0; }
          .scorecards article { border: 1px solid #cbd3dc; border-radius: 6px; padding: 9px; }
          .scorecards span { display: block; color: #5a6470; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .scorecards strong { display: block; margin-top: 4px; }
          li { margin: 5px 0; }
          @media print { button { display: none; } body { margin: 18mm; } }
        </style>
      </head>
      <body>
        <button type="button" onclick="window.print()">Print Packet</button>
        <header>
          <p class="meta">TimLock Field Command Packet</p>
          <h1>${escapeHtml(payload.subject)}</h1>
          <p>${escapeHtml(payload.headline || payload.title)}</p>
          <p class="meta">Generated ${escapeHtml(new Date(payload.exportedAt).toLocaleString())} | Readiness ${escapeHtml(payload.readiness.score)}% - ${escapeHtml(payload.readiness.label)}</p>
        </header>
        <section class="decision">
          <h2>Decision</h2>
          <p>${escapeHtml(payload.mission.decision)}</p>
        </section>
        ${scorecards}
        ${packetListHtml("Next Moves", nextMoves)}
        ${packetListHtml("Risk Radar", payload.risks)}
        ${packetListHtml("Blockers", payload.blockers)}
        ${packetListHtml("Warnings", payload.warnings)}
        ${packetListHtml("Proof Gaps", payload.proofGaps)}
        ${packetListHtml("Technician Plan", payload.technicianPlan)}
        ${packetListHtml("Save Back After Job", payload.saveBackChecklist)}
        ${payload.copyBlocks.customerNote ? `<section><h2>Customer Note</h2><p>${escapeHtml(payload.copyBlocks.customerNote)}</p></section>` : ""}
        ${payload.copyBlocks.workOrderNote ? `<section><h2>Work Order Note</h2><p>${escapeHtml(payload.copyBlocks.workOrderNote)}</p></section>` : ""}
      </body>
    </html>
  `;
}

function printAiCommanderPacket() {
  const payload = aiCommanderPacketPayload();
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    setAiCommanderStatus("Print was blocked by the browser. Use Copy Packet or Export JSON.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(aiCommanderPrintHtml(payload));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  setAiCommanderStatus("Printable field packet opened.");
}

async function handleAiCommanderAction(action, button) {
  const original = button?.textContent || "";
  try {
    if (button) button.disabled = true;
    if (action === "copy") {
      await copyAiCommanderPacket();
      if (button) button.textContent = "Copied";
    } else if (action === "print") {
      printAiCommanderPacket();
      if (button) button.textContent = "Opened";
    } else if (action === "export") {
      exportAiCommanderPacket();
      if (button) button.textContent = "Exported";
    } else if (action === "customerNote" || action === "workOrderNote" || action === "technicianChecklist") {
      await copyAiCommanderBlock(action);
      if (button) button.textContent = "Copied";
    }
  } catch (error) {
    setAiCommanderStatus(error.message);
  } finally {
    if (button) {
      window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1200);
    }
  }
}

function renderAiCommanderPanel(commander = latestAiCommander) {
  if (!aiCommanderPanel) return;
  if (!commander) {
    aiCommanderPanel.innerHTML = `
      <article class="ai-commander-card loading">
        <div class="ai-score mini warn"><strong>--</strong><span>ready</span></div>
        <div>
          <p class="eyebrow">Field Commander</p>
          <h3>Waiting for job context</h3>
          <p>Open a VIN, Workbench, Part History, Proof Vault, Lishi, or Code Desk result and the AI will build a command plan from it.</p>
        </div>
      </article>
    `;
    return;
  }
  const scoreClass = aiAdvisorScoreClass(commander.readinessScore);
  const actions = commander.actionStack || [];
  const risks = commander.riskRadar || [];
  const cards = commander.dataScorecards || [];
  const learning = commander.learningLoop || {};
  const copyBlocks = commander.fieldPacket?.copyBlocks || {};
  const hasCustomerNote = Boolean(commander.mission?.customerSafeNote || copyBlocks.customerNote);
  const hasWorkOrderNote = Boolean(commander.mission?.workOrderNote || copyBlocks.workOrderNote);
  const hasTechChecklist = Boolean(copyBlocks.technicianChecklist);
  aiCommanderPanel.innerHTML = `
    <section class="ai-commander-card">
      <div class="ai-score mini ${scoreClass}">
        <strong>${escapeHtml(commander.readinessScore ?? 0)}</strong>
        <span>ready</span>
      </div>
      <div>
        <p class="eyebrow">${escapeHtml(commander.title || "Field Commander")}</p>
        <h3>${escapeHtml(commander.headline || "Command plan ready")}</h3>
        <p>${escapeHtml(commander.mission?.decision || "Use this as the job command layer and verify the field details.")}</p>
      </div>
      <button class="secondary-action small" type="button" id="refreshAiCommanderInline">Refresh</button>
    </section>
    <div class="ai-command-tools" aria-label="Field command packet actions">
      <button class="primary-action small" type="button" data-ai-commander-action="copy">Copy Packet</button>
      <button class="secondary-action small" type="button" data-ai-commander-action="print">Print Packet</button>
      <button class="secondary-action small" type="button" data-ai-commander-action="export">Export JSON</button>
      ${hasCustomerNote ? `<button class="secondary-action small" type="button" data-ai-commander-action="customerNote">Customer Note</button>` : ""}
      ${hasWorkOrderNote ? `<button class="secondary-action small" type="button" data-ai-commander-action="workOrderNote">Work Order Note</button>` : ""}
      ${hasTechChecklist ? `<button class="secondary-action small" type="button" data-ai-commander-action="technicianChecklist">Tech Checklist</button>` : ""}
    </div>
    <div class="ai-commander-status" data-ai-commander-status hidden></div>
    ${
      cards.length
        ? `<div class="ai-command-scorecards">${cards.map((card) => `
            <article class="${escapeHtml(card.tone || "")}">
              <span>${escapeHtml(card.label)}</span>
              <strong>${escapeHtml(card.value)}</strong>
            </article>
          `).join("")}</div>`
        : ""
    }
    <div class="ai-command-grid">
      <section>
        <p class="eyebrow">Next moves</p>
        ${actions.slice(0, 5).map((action) => `
          <article>
            <div>
              <strong>${escapeHtml(action.title)}</strong>
              <p>${escapeHtml(action.detail)}</p>
            </div>
            <button class="secondary-action small" type="button" data-ai-action-target="${escapeHtml(action.target || "ai")}" data-ai-action-prompt="${escapeHtml(action.prompt || "")}">Open</button>
          </article>
        `).join("") || `<article><div><strong>No command actions yet</strong><p>Run a search or build a workbench packet first.</p></div></article>`}
      </section>
      <section>
        <p class="eyebrow">Risk radar</p>
        ${(risks.length ? risks : ["No major risk flags beyond standard authorization."]).slice(0, 5).map((risk) => `
          <article>
            <div>
              <strong>${escapeHtml(risk)}</strong>
              <p>${escapeHtml(learning.trainingInstruction || "Save the final outcome so the next recommendation improves.")}</p>
            </div>
          </article>
        `).join("")}
      </section>
    </div>
  `;
  aiCommanderPanel.querySelector("#refreshAiCommanderInline")?.addEventListener("click", () => loadAiCommander());
}

function renderAiActions(actions = [], prompts = []) {
  const actionButtons = actions
    .slice(0, 5)
    .map(
      (action) => `
        <button class="secondary-action small" type="button" data-ai-action-target="${escapeHtml(action.target || "ai")}" data-ai-action-prompt="${escapeHtml(action.prompt || "")}">
          ${escapeHtml(action.label || "Open")}
        </button>
      `,
    )
    .join("");
  const promptButtons = prompts
    .slice(0, 4)
    .map((prompt) => `<button class="secondary-action small" type="button" data-ai-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`)
    .join("");
  return `${actionButtons}${promptButtons}`;
}

function renderAiFieldPacket(packet = {}, { compact = false } = {}) {
  if (!packet || !Number.isFinite(Number(packet.readinessScore))) return "";
  const score = Number(packet.readinessScore);
  const scoreClass = score >= 80 ? "ready" : score >= 55 ? "warn" : "danger";
  const blockers = packet.blockers || [];
  const warnings = packet.warnings || [];
  const proofGaps = packet.proofGaps || [];
  const routePlan = packet.routePlan || [];
  const plan = packet.technicianPlan || [];
  const saveBack = packet.saveBackChecklist || [];
  const copyBlocks = packet.copyBlocks || {};
  return `
    <section class="ai-field-packet ${compact ? "compact" : ""}">
      <div class="ai-field-head">
        <div class="ai-score ${scoreClass}">
          <strong>${escapeHtml(score)}</strong>
          <span>readiness</span>
        </div>
        <div>
          <p class="eyebrow">${escapeHtml(packet.priority || "AI field packet")}</p>
          <h3>${escapeHtml(packet.readinessLabel || "Field readiness")}</h3>
          <p>${escapeHtml(packet.dispatchDecision || "Use this packet as a planning aid and verify at the job.")}</p>
        </div>
      </div>
      ${
        packet.confidenceDrivers?.length
          ? `<div class="ai-driver-row">${packet.confidenceDrivers.slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : ""
      }
      ${
        blockers.length || warnings.length || proofGaps.length
          ? `<div class="ai-alert-grid">
              <article class="${blockers.length ? "danger" : ""}">
                <strong>Blockers</strong>
                <ul>${(blockers.length ? blockers : ["No hard blockers from current context."]).slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </article>
              <article class="${warnings.length ? "warn" : ""}">
                <strong>Warnings</strong>
                <ul>${(warnings.length ? warnings : ["Normal verification only."]).slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </article>
              <article>
                <strong>Proof gaps</strong>
                <ul>${(proofGaps.length ? proofGaps : ["No major proof gaps beyond standard authorization."]).slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </article>
            </div>`
          : ""
      }
      ${
        routePlan.length
          ? `<div class="ai-route-plan">
              <strong>Route plan</strong>
              ${routePlan.slice(0, compact ? 3 : 6).map((route) => `
                <article>
                  <div>
                    <span>${escapeHtml(route.status || "Next")}</span>
                    <strong>${escapeHtml(route.label || route.target || "Tool")}</strong>
                    <p>${escapeHtml(route.reason || "Open this tool for more detail.")}</p>
                  </div>
                  <button class="secondary-action small" type="button" data-ai-action-target="${escapeHtml(route.target || "ai")}" data-ai-action-prompt="${escapeHtml(route.prompt || "")}">Open</button>
                </article>
              `).join("")}
            </div>`
          : ""
      }
      ${
        !compact && plan.length
          ? `<div class="ai-two-column">
              <article>
                <strong>Technician plan</strong>
                <ul>${plan.slice(0, 7).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </article>
              <article>
                <strong>Save back after job</strong>
                <ul>${saveBack.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </article>
            </div>`
          : ""
      }
      ${
        !compact && Object.keys(copyBlocks).length
          ? `<div class="ai-copy-grid">
              <button class="secondary-action small" type="button" data-copy-ai-block="technicianChecklist">Copy Tech Checklist</button>
              <button class="secondary-action small" type="button" data-copy-ai-block="customerNote">Copy Customer Note</button>
              <button class="secondary-action small" type="button" data-copy-ai-block="workOrderNote">Copy Work Order Note</button>
            </div>`
          : ""
      }
    </section>
  `;
}

function renderAiMessage(message) {
  const checklist = Array.isArray(message.checklist) && message.checklist.length
    ? `<ul>${message.checklist.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const actions = message.role === "assistant" && message.actions?.length
    ? `<div class="ai-message-actions">${renderAiActions(message.actions)}</div>`
    : "";
  const fieldPacket = message.role === "assistant" ? renderAiFieldPacket(message.fieldPacket, { compact: true }) : "";
  const personality = message.personality || message.memory?.personality || message.fieldPacket?.personality || latestAiMemory?.personality;
  const persona = message.role === "assistant" && personality?.name
    ? `<div class="message-personality"><span>${escapeHtml(personality.name)}</span>${personality.catchphrase ? `<small>${escapeHtml(personality.catchphrase)}</small>` : ""}</div>`
    : "";
  const feedback = message.role === "assistant" && message.responseId
    ? `<div class="ai-feedback-row" data-ai-feedback-row="${escapeHtml(message.responseId)}">
        <button type="button" data-ai-feedback="helpful" data-ai-response-id="${escapeHtml(message.responseId)}">Helpful</button>
        <button type="button" data-ai-feedback="used" data-ai-response-id="${escapeHtml(message.responseId)}">Used it</button>
        <button type="button" data-ai-feedback="wrong" data-ai-response-id="${escapeHtml(message.responseId)}">Wrong</button>
        <button type="button" data-ai-feedback="save-rule" data-ai-response-id="${escapeHtml(message.responseId)}">Save rule</button>
        ${message.feedbackStatus ? `<span>${escapeHtml(message.feedbackStatus)}</span>` : ""}
      </div>`
    : "";
  return `
    <div class="message ${escapeHtml(message.role)}">
      ${persona}
      ${message.title ? `<strong>${escapeHtml(message.title)}</strong>` : ""}
      <p>${escapeHtml(message.text).replace(/\n/g, "<br>")}</p>
      ${fieldPacket}
      ${checklist}
      ${actions}
      ${feedback}
    </div>
  `;
}

function renderChat() {
  if (!chatLogElement) return;
  chatLogElement.innerHTML = chatLog.map(renderAiMessage).join("");
  chatLogElement.scrollTop = chatLogElement.scrollHeight;
}

function renderAiResponsePanel(payload = latestAiResponse) {
  if (!aiActionPanel) return;
  if (!payload) {
    aiActionPanel.innerHTML = `
      <p class="eyebrow">Guardrails</p>
      <ul class="plain-list">
        <li>Ownership and authorization first</li>
        <li>Parts, proof, and programmer verification</li>
        <li>Customer-safe summaries and technician checklists</li>
        <li>No bypass or unauthorized-entry instructions</li>
      </ul>
    `;
    return;
  }
  aiActionPanel.innerHTML = `
    <p class="eyebrow">AI recommended actions</p>
    ${payload.contextView && payload.contextView !== activeViewId ? `<p class="muted-copy">Last AI response came from ${escapeHtml(routeDisplayLabel(payload.contextView))}. Run a fresh audit for this screen when needed.</p>` : ""}
    ${renderAiFieldPacket(payload.fieldPacket)}
    <div class="ai-action-list">${renderAiActions(payload.nextActions || [], payload.suggestedPrompts || [])}</div>
    ${
      payload.checklist?.length
        ? `<div class="ai-checklist"><strong>Checklist</strong><ul>${payload.checklist.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`
        : ""
    }
  `;
}

function updateAiContextUi() {
  const context = buildAiClientContext();
  const prompts = aiPromptSuggestions(context);
  if (aiRouteEyebrow) aiRouteEyebrow.textContent = "Screen-aware AI";
  if (aiRouteTitle) aiRouteTitle.textContent = `${routeDisplayLabel(context.activeView)} copilot`;
  if (aiRouteSummary) aiRouteSummary.textContent = aiContextSummaryText(context);
  if (aiRouteActions) {
    aiRouteActions.innerHTML = renderAiActions(aiRouteQuickActions(context), prompts.slice(0, 1));
  }
  if (aiContextChips) aiContextChips.innerHTML = renderAiContextChips(context);
  if (aiQuickPrompts) {
    aiQuickPrompts.innerHTML = prompts.map((prompt) => `<button type="button" data-ai-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join("");
  }
  if (aiContextPanel) aiContextPanel.innerHTML = renderAiContextPanel(context);
  renderAiCommanderPanel();
  renderAiAdvisorPanel();
  renderAiResponsePanel();
}

async function askAi(prompt, { open = true } = {}) {
  const cleanPrompt = cleanInput(prompt);
  if (!cleanPrompt) return;
  if (open && activeViewId !== "ai") showView("ai");
  const context = buildAiClientContext();
  chatLog.push({ role: "user", text: cleanPrompt });
  chatLog.push({ role: "assistant", text: "Reading the current screen context...", title: "Working" });
  renderChat();
  updateAiContextUi();

  try {
    const payload = await api("/api/ai", {
      method: "POST",
      body: JSON.stringify({
        prompt: cleanPrompt,
        jobId: jobs[0]?.id || null,
        context,
      }),
      timeoutMs: 16000,
    });
    payload.contextView = context.activeView;
    payload.prompt = cleanPrompt;
    latestAiResponse = payload;
    latestAiMemory = payload.memory || latestAiMemory;
    loadAiCommander({ quiet: true });
    chatLog.splice(chatLog.length - 1, 1, {
      role: "assistant",
      title: payload.title || "AI Bench",
      text: payload.response,
      checklist: payload.checklist || [],
      actions: payload.nextActions || [],
      fieldPacket: payload.fieldPacket || null,
      responseId: payload.id,
      prompt: cleanPrompt,
      contextView: context.activeView,
      contextSummary: payload.contextSummary || [],
      personality: payload.personality || payload.memory?.personality || null,
      memory: payload.memory || null,
    });
  } catch (error) {
    chatLog.splice(chatLog.length - 1, 1, { role: "assistant", title: "AI unavailable", text: `Backend error: ${error.message}` });
  } finally {
    renderChat();
    updateAiContextUi();
  }
}

async function loadAiMemory() {
  try {
    latestAiMemory = await api("/api/ai/memory", { timeoutMs: 10000, noStatus: true });
    renderAiAdvisorPanel();
    renderChat();
  } catch (error) {
    console.warn("AI memory unavailable", error);
  }
}

async function submitAiFeedback(value, responseId, button = null) {
  const message = chatLog.find((item) => item.responseId === responseId);
  if (!message) return;
  const context = buildAiClientContext();
  const label = {
    helpful: "Helpful",
    used: "Used",
    wrong: "Marked wrong",
    "save-rule": "Saved as rule",
    suppress: "Suppressed",
  }[value] || "Saved";
  const ruleSeed =
    message.fieldPacket?.dispatchDecision ||
    message.checklist?.slice(0, 3).join("; ") ||
    message.text ||
    message.prompt ||
    "Remember this AI guidance for similar jobs.";
  button?.setAttribute("disabled", "disabled");
  try {
    const payload = await api("/api/ai/feedback", {
      method: "POST",
      body: JSON.stringify({
        responseId,
        value,
        title: `${label}: ${message.title || routeDisplayLabel(message.contextView || activeViewId)}`,
        note:
          value === "wrong"
            ? `Marked wrong from ${routeDisplayLabel(message.contextView || activeViewId)}. Re-check assumptions before repeating this answer.`
            : ruleSeed,
        prompt: message.prompt || latestAiResponse?.prompt || "",
        target: message.contextView || activeViewId,
        contextSummary: message.contextSummary || latestAiResponse?.contextSummary || [],
        query: context.query || context.workbench?.activeQueries?.part || "",
        vehicle: context.currentProfile?.title || vehicleTitleFromVehicle(context.workbench?.vehicle || {}),
        tags: [context.screen, value].filter(Boolean),
        ruleTitle: value === "save-rule" ? `Shop rule: ${context.query || context.screen || "AI guidance"}` : "",
        ruleBody: value === "save-rule" ? ruleSeed : "",
      }),
      timeoutMs: 10000,
      noStatus: true,
    });
    latestAiMemory = payload.memory || latestAiMemory;
    message.feedbackStatus = payload.rule ? "Rule saved into AI memory" : `${label} feedback saved`;
    renderChat();
    renderAiAdvisorPanel();
    loadAiAdvisor();
  } catch (error) {
    message.feedbackStatus = `Feedback failed: ${error.message}`;
    renderChat();
  } finally {
    button?.removeAttribute("disabled");
  }
}

function apiUrls(path) {
  const urls = [path];
  const fallback = window.LOCKFORGE_API_ORIGIN || localStorage.getItem("lockforgeApiOrigin") || apiFallbackOrigin;
  if (fallback) {
    const fallbackUrl = `${fallback.replace(/\/$/, "")}${path}`;
    if (new URL(fallbackUrl).origin !== window.location.origin) urls.push(fallbackUrl);
  }
  return urls;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  if (!timeoutMs) return fetch(url, options);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function api(path, options = {}) {
  let lastError = null;
  const urls = apiUrls(path);
  const { timeoutMs, noStatus, noFallback = false, headers = {}, ...fetchOptions } = options;
  const defaultTimeout = path.startsWith("/api/vin/") || path.startsWith("/api/vehicle-lookup") ? 15000 : 12000;
  const requestTimeout = Number(timeoutMs) || defaultTimeout;

  for (const [index, url] of urls.entries()) {
    try {
      const shouldFastFail = index === 0 && urls.length > 1 && !url.startsWith("http");
      const response = await fetchWithTimeout(url, {
        headers: { "Content-Type": "application/json", ...headers },
        ...fetchOptions,
      }, shouldFastFail ? Math.min(2500, requestTimeout) : requestTimeout);

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`The app server returned ${response.status || "a non-JSON response"} for ${path}.`);
      }
      if (!response.ok) {
        const requestError = new Error(payload.error || `Request failed with ${response.status}`);
        requestError.code = payload.code || "";
        requestError.auth = payload.auth || null;
        requestError.status = response.status;
        throw requestError;
      }
      if (!noStatus && path !== "/api/health" && navigator.onLine !== false) {
        if (latestApiHealth?.status === "degraded") latestApiHealth = null;
        updateConnectionStatus();
      }
      return payload;
    } catch (error) {
      if (error?.auth) {
        latestAuthStatus = error.auth;
        renderAuthStatus();
      }
      if (["AUTH_REQUIRED", "OWNER_REQUIRED", "BAD_LOGIN", "ROLE_NOT_CONFIGURED"].includes(error?.code)) {
        throw error;
      }
      const message =
        error?.name === "AbortError"
          ? `The app server took longer than ${Math.round(requestTimeout / 1000)} seconds for ${path}.`
          : error.message;
      lastError = new Error(message);
      if (error?.code) lastError.code = error.code;
      if (!noStatus && path !== "/api/health") {
        setAppStatus(url.startsWith("http") ? "Server slow" : "Trying cloud server", url.startsWith("http") ? "degraded" : "busy", message);
      }
      if (noFallback) throw lastError;
      if (!url.startsWith("http")) continue;
      throw lastError;
    }
  }

  throw new Error(
    `${lastError?.message || "Request failed"} If this happens only on one device, refresh the page or use the Render Node web-service URL, not a static site URL.`,
  );
}

async function refreshApiHealth({ quiet = false } = {}) {
  if (navigator.onLine === false) {
    latestApiHealth = { status: "degraded", error: "Device is offline." };
    updateConnectionStatus();
    return null;
  }
  if (!quiet) setAppStatus("Checking server", "busy", "Running a fast health check.");
  try {
    latestApiHealth = await api("/api/health", { timeoutMs: 5000, noStatus: true });
    updateConnectionStatus();
    return latestApiHealth;
  } catch (error) {
    latestApiHealth = { status: "degraded", error: error.message };
    updateConnectionStatus();
    return null;
  }
}

function bootTask(label, task) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.warn(`${label} failed`, error);
      if (["AUTH_REQUIRED", "OWNER_REQUIRED"].includes(error?.code)) {
        return;
      }
      if (navigator.onLine !== false) {
        latestApiHealth = { status: "degraded", error: error.message };
        updateConnectionStatus();
      }
    });
}

function normalizeVinInput(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function loadJobs() {
  const payload = await api("/api/jobs");
  jobs = mergeJobLists(payload.jobs || [], localArchivedJobs());
  selectedJobId = jobs[0]?.id || null;
  rememberJobs(jobs);
  renderJobs();
  syncLocalJobsToServer();
  loadAiAdvisor();
}

async function loadCoverageDashboard() {
  if (!coverageDashboard) return;
  try {
    if (coverageDashboardStatus) coverageDashboardStatus.textContent = "Calculating observed coverage proof...";
    const payload = await api("/api/coverage-dashboard", {
      method: "POST",
      body: JSON.stringify({ jobs: localArchivedJobs() }),
    });
    renderCoverageDashboard(payload);
    if (coverageDashboardStatus) coverageDashboardStatus.textContent = `Updated coverage from ${payload.summary?.automotiveJobs || 0} automotive jobs.`;
  } catch (error) {
    if (coverageDashboardStatus) coverageDashboardStatus.textContent = error.message;
    coverageDashboard.innerHTML = `<article class="assistant-card"><strong>Coverage unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

async function loadAiAdvisor() {
  try {
    const payload = await api("/api/ai/advisor", {
      method: "POST",
      body: JSON.stringify({ jobs: localArchivedJobs() }),
      timeoutMs: 14000,
      noStatus: true,
    });
    latestAiAdvisor = payload;
    renderAiAdvisorPanel(payload);
    updateAiContextUi();
  } catch (error) {
    latestAiAdvisor = {
      headline: "AI advisor unavailable",
      summary: [error.message],
      readinessScore: 0,
      readinessLabel: "Offline",
      actions: [],
    };
    renderAiAdvisorPanel(latestAiAdvisor);
  }
}

async function loadAiCommander({ quiet = false } = {}) {
  if (!aiCommanderPanel) return null;
  try {
    if (!quiet) {
      aiCommanderPanel.innerHTML = `
        <article class="ai-commander-card loading">
          <div class="ai-score mini warn"><strong>...</strong><span>AI</span></div>
          <div>
            <p class="eyebrow">Field Commander</p>
            <h3>Building command plan</h3>
            <p>Reading active screen, proof, parts, coverage, saved jobs, AI feedback, and shop rules.</p>
          </div>
        </article>
      `;
    }
    const payload = await api("/api/ai/commander", {
      method: "POST",
      body: JSON.stringify({ context: buildAiClientContext(), jobs: localArchivedJobs() }),
      timeoutMs: 14000,
      noStatus: true,
    });
    latestAiCommander = payload;
    renderAiCommanderPanel(payload);
    return payload;
  } catch (error) {
    latestAiCommander = {
      title: "Field Commander unavailable",
      headline: "AI command layer is offline",
      readinessScore: 0,
      readinessLabel: "Offline",
      mission: { decision: error.message },
      actionStack: [],
      riskRadar: [error.message],
      dataScorecards: [],
    };
    renderAiCommanderPanel(latestAiCommander);
    return null;
  }
}

async function loadVehicles() {
  const payload = await api("/api/vehicles");
  vehicles = payload.vehicles;
  renderVehicles();
}

async function loadInsights() {
  calendarAnalysis = await api("/api/calendar-analysis");
  renderInsights();
}

async function loadKeyIntelligence() {
  const payload = await api("/api/key-intelligence");
  keyIntelligence = payload.records || [];
  renderKeyRecords();
}

async function loadSources() {
  const payload = await api("/api/sources");
  sourceConnectors = payload.connectors || [];
  renderSources();
}

async function loadSupplierAccounts() {
  if (!supplierAccountList) return;
  const payload = await api("/api/supplier-accounts");
  supplierAccounts = payload.accounts || [];
  renderSupplierAccounts();
}

async function loadReferenceVault() {
  if (!referenceVaultList) return;
  const payload = await api("/api/reference-vault");
  referenceVaultEntries = payload.entries || [];
  renderReferenceVault();
}

async function loadPublicReferenceSources() {
  if (!publicSourceList) return;
  publicReferenceSources = await api("/api/public-reference-sources");
  renderPublicReferenceSources();
}

applyAppMode(loadAppMode());

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyAppMode(button.dataset.setMode);
    loadAiMemory();
    if (latestGlobalSearch && globalSearchQuery()) runGlobalSearch();
  });
});

authRoleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    authRoleSelection = button.dataset.authRole === "subscriber" ? "subscriber" : "owner";
    if (authStatus) authStatus.textContent = authRoleSelection === "owner" ? "Owner password required." : "Subscriber password required.";
    renderAuthStatus();
  });
});

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(authForm);
  const password = String(data.get("password") || "");
  try {
    await signIn(authRoleSelection, password);
    authForm.reset();
  } catch (error) {
    if (authStatus) authStatus.textContent = error.message;
  }
});

logoutButton?.addEventListener("click", signOut);

navItems.forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

appBackButton?.addEventListener("click", goBackInApp);

mobileMenuToggle?.addEventListener("click", () => {
  setMobileMenu(!document.body.classList.contains("mobile-menu-open"));
});

mobileMenuBackdrop?.addEventListener("click", closeMobileMenu);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});

window.addEventListener("popstate", () => {
  const route = routeFromLocation() || "command";
  showView(route, { push: false });
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewTarget));
});

const initialRoute = routeFromLocation() || activeViewId || "command";
replaceRouteHash(initialRoute);
showView(initialRoute, { push: false, scroll: false });

globalSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  runGlobalSearch();
});

refreshCoverageDashboardButton?.addEventListener("click", () => loadCoverageDashboard());
syncProofVaultButton?.addEventListener("click", async () => {
  if (proofVaultStatus) proofVaultStatus.textContent = "Syncing local proof...";
  await syncLocalJobsToServer();
  await loadProofVault();
});
migrateProofVaultButton?.addEventListener("click", migrateBrowserProofAttachments);
exportProofVaultButton?.addEventListener("click", exportProofVaultBackup);
importProofVaultButton?.addEventListener("click", () => proofVaultImportInput?.click());
proofVaultImportInput?.addEventListener("change", async () => {
  await importProofVaultBackup(proofVaultImportInput.files?.[0]);
  proofVaultImportInput.value = "";
});
refreshStorageStatusButton?.addEventListener("click", () => loadStorageStatus());
runStorageDiagnosticsButton?.addEventListener("click", runStorageDiagnostics);
migrateStorageProofButton?.addEventListener("click", migrateBrowserProofAttachments);
exportServerBackupButton?.addEventListener("click", exportServerBackup);
importServerBackupButton?.addEventListener("click", () => serverBackupImportInput?.click());
serverBackupImportInput?.addEventListener("change", async () => {
  await importServerBackup(serverBackupImportInput.files?.[0]);
  serverBackupImportInput.value = "";
});
codeDeskForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  runCodeDesk();
});
importCodeDeskButton?.addEventListener("click", () => codeDeskImportInput?.click());
exportCodeDeskButton?.addEventListener("click", exportCodeDeskRecords);
clearCodeDeskButton?.addEventListener("click", () => {
  saveCodeDeskImports([]);
  if (codeDeskResult) codeDeskResult.dataset.ready = "";
  renderCodeDesk();
  if (codeDeskStatus) codeDeskStatus.textContent = "Imported Code Desk records cleared.";
});
codeDeskImportInput?.addEventListener("change", async () => {
  await importCodeDeskFile(codeDeskImportInput.files?.[0]);
  codeDeskImportInput.value = "";
});
codeDeskAutoForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadCodeDeskAutoBaseline();
});
exportCodeDeskAutoButton?.addEventListener("click", exportCodeDeskAutoBaseline);
refreshAiCommanderButton?.addEventListener("click", () => loadAiCommander());

lishiLookupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadLishiLookup(lishiLookupParamsFromForm());
});

workbenchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadJobWorkbench(workbenchQueryFromForm());
});

refreshWorkbenchButton?.addEventListener("click", () => loadJobWorkbench(workbenchQueryFromForm()));

clearWorkbenchButton?.addEventListener("click", () => {
  latestWorkbench = null;
  try {
    localStorage.removeItem(currentJobContextKey);
  } catch {}
  if (workbenchForm) workbenchForm.reset();
  if (workbenchStatus) workbenchStatus.textContent = "Workbench context cleared.";
  if (workbenchResult) {
    workbenchResult.innerHTML = `<article class="assistant-card"><strong>Workbench cleared</strong><p>Run a VIN lookup or search a part number to build a fresh job packet.</p></article>`;
  }
  updateAiContextUi();
});

referenceListForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadReferenceList();
});

if (supplierSelect) {
  supplierSelect.addEventListener("change", () => {
    selectedSupplierId = supplierSelect.value;
    supplierSettingsStatus.textContent = "";
    renderSupplierAccounts();
  });
}

document.addEventListener("change", (event) => {
  const proofInput = event.target.closest("[data-proof-attach]");
  if (proofInput) {
    addProofAttachment(proofInput.dataset.proofAttach, proofInput.files?.[0]).finally(() => {
      proofInput.value = "";
    });
    return;
  }

  const input = event.target.closest("[data-live-filter]");
  if (!input || !latestVinProfile) return;

  const group = input.dataset.liveFilter;
  const value = input.value;
  if (!liveProductFilters[group]) return;

  if (input.checked) liveProductFilters[group].add(value);
  else liveProductFilters[group].delete(value);
  renderVinProfile(latestVinProfile);
});

document.addEventListener("click", (event) => {
  const aiCommanderButton = event.target.closest("[data-ai-commander-action]");
  if (aiCommanderButton) {
    handleAiCommanderAction(aiCommanderButton.dataset.aiCommanderAction, aiCommanderButton);
    return;
  }

  const aiFeedbackButton = event.target.closest("[data-ai-feedback]");
  if (aiFeedbackButton) {
    submitAiFeedback(aiFeedbackButton.dataset.aiFeedback, aiFeedbackButton.dataset.aiResponseId, aiFeedbackButton);
    return;
  }

  const migrateLocalProofButton = event.target.closest("[data-migrate-local-proof]");
  if (migrateLocalProofButton) {
    migrateBrowserProofAttachments();
    return;
  }

  const aiPromptButton = event.target.closest("[data-ai-prompt]");
  if (aiPromptButton) {
    askAi(aiPromptButton.dataset.aiPrompt);
    return;
  }

  const aiActionButton = event.target.closest("[data-ai-action-target]");
  if (aiActionButton) {
    const target = aiActionButton.dataset.aiActionTarget || "ai";
    const prompt = cleanInput(aiActionButton.dataset.aiActionPrompt || "");
    if (target && target !== "ai") {
      showView(target);
      return;
    }
    showView("ai");
    if (prompt) askAi(prompt, { open: false });
    return;
  }

  const aiCopyButton = event.target.closest("[data-copy-ai-block]");
  if (aiCopyButton) {
    const key = aiCopyButton.dataset.copyAiBlock;
    const text = latestAiResponse?.fieldPacket?.copyBlocks?.[key] || "";
    if (text && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        aiCopyButton.textContent = "Copied";
        window.setTimeout(() => {
          aiCopyButton.textContent =
            key === "customerNote" ? "Copy Customer Note" : key === "workOrderNote" ? "Copy Work Order Note" : "Copy Tech Checklist";
        }, 1400);
      });
    }
    return;
  }

  const aiAdvisorButton = event.target.closest("[data-ai-advisor-open]");
  if (aiAdvisorButton) {
    const target = aiAdvisorButton.dataset.aiAdvisorOpen || "ai";
    const prompt = cleanInput(aiAdvisorButton.dataset.aiAdvisorPrompt || "");
    if (target === "ai") {
      showView("ai");
      if (prompt) askAi(prompt, { open: false });
    } else {
      showView(target);
    }
    return;
  }

  const codeSystemButton = event.target.closest("[data-code-system]");
  if (codeSystemButton) {
    renderCodeDesk();
    const systemId = codeSystemButton.dataset.codeSystem;
    const select = codeDeskForm?.elements.system;
    if (select && codeDeskAvailableSystems().some((system) => system.id === systemId)) {
      select.value = systemId;
      if (codeDeskResult) codeDeskResult.dataset.ready = "";
      renderCodeDesk();
      codeDeskForm.elements.query?.focus();
      if (codeDeskStatus) codeDeskStatus.textContent = `${selectedCodeDeskSystem().name} selected. Import the exact depth-space card before production cutting.`;
    }
  }

  const openCurrentLishiButton = event.target.closest("[data-open-lishi-current]");
  if (openCurrentLishiButton && latestVinProfile?.vehicle) {
    const vehicle = latestVinProfile.vehicle || {};
    const snapshot = selectedPartSnapshot(latestVinProfile);
    const lishi = lishiReferenceForProfile(latestVinProfile, snapshot);
    showView("lishi");
    if (lishiLookupForm) {
      lishiLookupForm.elements.lishiQuery.value = (lishi.keyways || []).join(" ") || lishi.primary || "";
      lishiLookupForm.elements.lishiYear.value = vehicle.year || "";
      lishiLookupForm.elements.lishiMake.value = vehicle.make || "";
      lishiLookupForm.elements.lishiModel.value = vehicle.model || "";
    }
    loadLishiLookup(lishiLookupParamsFromForm());
    return;
  }

  const openWorkbenchButton = event.target.closest("[data-open-workbench-current]");
  if (openWorkbenchButton) {
    if (latestVinProfile?.vehicle) saveCurrentJobContext(latestVinProfile);
    showView("workbench");
    loadJobWorkbench(workbenchQueryFromForm());
    return;
  }

  const workbenchTargetButton = event.target.closest("[data-workbench-open]");
  if (workbenchTargetButton) {
    openWorkbenchTarget(workbenchTargetButton.dataset.workbenchOpen);
    return;
  }

  const clearGlobalSearchButton = event.target.closest("[data-clear-global-search]");
  if (clearGlobalSearchButton) {
    latestGlobalSearch = null;
    if (globalSearchResult) {
      globalSearchResult.hidden = true;
      globalSearchResult.innerHTML = "";
    }
    if (globalSearchStatus) globalSearchStatus.textContent = "";
    updateAiContextUi();
    return;
  }

  const globalOpenButton = event.target.closest("[data-global-open]");
  if (globalOpenButton) {
    openGlobalSearchTarget(
      globalOpenButton.dataset.globalOpen,
      globalOpenButton.dataset.globalQuery,
      globalOpenButton.dataset.globalSource,
    );
    return;
  }

  const scannerCloseButton = event.target.closest("[data-close-scanner]");
  if (scannerCloseButton) {
    stopVinScanner();
    return;
  }

  const scannedVinButton = event.target.closest("[data-use-scanned-vin]");
  if (scannedVinButton) {
    const value = document.querySelector("#vinScannerModal input[name='manualVinScan']")?.value || "";
    if (!acceptScannedVin(value)) {
      document.querySelector("#vinScannerModal .scanner-status").textContent = "Enter a valid 17-character VIN.";
    }
    return;
  }

  const jobSaveCloseButton = event.target.closest("[data-close-job-save]");
  if (jobSaveCloseButton) {
    closeJobSaveModal();
    return;
  }

  const resetButton = event.target.closest("[data-vin-reset], [data-vin-home]");
  if (resetButton) {
    resetVinWorkflow();
    return;
  }

  const recentPartButton = event.target.closest("[data-part-history-search]");
  if (recentPartButton && partHistoryForm) {
    partHistoryForm.elements.partNumber.value = recentPartButton.dataset.partHistorySearch || "";
    partHistoryForm.requestSubmit();
    return;
  }

  const copyPartProofButton = event.target.closest("[data-copy-part-proof]");
  if (copyPartProofButton) {
    copyPartHistoryProof();
    return;
  }

  const copyCoverageProofButton = event.target.closest("[data-copy-coverage-proof]");
  if (copyCoverageProofButton) {
    copyCoverageProof();
    return;
  }

  const copyProofVaultButton = event.target.closest("[data-copy-proof-vault-summary]");
  if (copyProofVaultButton) {
    copyProofVaultSummary();
    return;
  }

  const copyDispatchButton = event.target.closest("[data-copy-dispatch-pack]");
  if (copyDispatchButton && latestVinProfile) {
    const original = copyDispatchButton.textContent;
    copyDispatchButton.textContent = "Copied";
    copyDispatchButton.disabled = true;
    copyDispatchPack(latestVinProfile)
      .catch((error) => alert(error.message))
      .finally(() => {
        window.setTimeout(() => {
          copyDispatchButton.textContent = original;
          copyDispatchButton.disabled = false;
        }, 900);
      });
    return;
  }

  const saveDispatchButton = event.target.closest("[data-save-dispatch-pack]");
  if (saveDispatchButton && latestVinProfile) {
    saveDispatchPack(latestVinProfile);
    saveDispatchButton.textContent = "Saved";
    window.setTimeout(() => {
      saveDispatchButton.textContent = "Save";
    }, 900);
    return;
  }

  const removeProofAttachmentButton = event.target.closest("[data-remove-proof-attachment]");
  if (removeProofAttachmentButton) {
    removeProofAttachment(removeProofAttachmentButton.dataset.proofJobId, removeProofAttachmentButton.dataset.removeProofAttachment);
    return;
  }

  const proofSearchButton = event.target.closest("[data-proof-search-part]");
  if (proofSearchButton) {
    const query = proofSearchButton.dataset.proofSearchPart || "";
    if (proofVaultForm) proofVaultForm.elements.proofQuery.value = query;
    loadProofVault(query);
    return;
  }

  const backButton = event.target.closest("[data-vin-back]");
  if (backButton && latestVinProfile) {
    vinWorkflowStep = backButton.dataset.vinBack;
    if (["vehicle", "vehicle-details", "package", "family"].includes(vinWorkflowStep)) selectedPartChoiceKey = "";
    if (["vehicle", "vehicle-details", "package", "family", "parts"].includes(vinWorkflowStep)) selectedProgrammerKey = "";
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    renderVinProfile(latestVinProfile);
    return;
  }

  const approveButton = event.target.closest("[data-approve-vehicle]");
  if (approveButton && latestVinProfile) {
    vinWorkflowStep = "package";
    renderVinProfile(latestVinProfile);
    return;
  }

  const detailsButton = event.target.closest("[data-view-vehicle-details]");
  if (detailsButton && latestVinProfile) {
    vinWorkflowStep = "vehicle-details";
    renderVinProfile(latestVinProfile);
    return;
  }

  const packageButton = event.target.closest("[data-key-package]");
  if (packageButton && latestVinProfile) {
    const option = keyPackageOptions.find((item) => item.id === packageButton.dataset.keyPackage);
    applyKeyPackage(option);
    vinWorkflowStep = "parts";
    renderVinProfile(latestVinProfile);
    return;
  }

  const familyButton = event.target.closest("[data-key-family]");
  if (familyButton && latestVinProfile) {
    selectedKeyFamily = familyButton.dataset.keyFamily;
    selectedPartChoiceKey = "";
    selectedProgrammerKey = "";
    vinWorkflowStep = "parts";
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    renderVinProfile(latestVinProfile);
    return;
  }

  const partChoiceButton = event.target.closest("[data-select-part-choice]");
  if (partChoiceButton && latestVinProfile) {
    selectedPartChoiceKey = partChoiceButton.dataset.selectPartChoice;
    selectedProgrammerKey = "";
    vinWorkflowStep = "lishi";
    renderVinProfile(latestVinProfile);
    return;
  }

  const continueProgrammersButton = event.target.closest("[data-continue-programmers]");
  if (continueProgrammersButton && latestVinProfile) {
    vinWorkflowStep = "programmers";
    renderVinProfile(latestVinProfile);
    return;
  }

  const programmerButton = event.target.closest("[data-select-programmer]");
  if (programmerButton && latestVinProfile) {
    selectedProgrammerKey = programmerButton.dataset.selectProgrammer;
    vinWorkflowStep = "summary";
    renderVinProfile(latestVinProfile);
    return;
  }

  const saveSelectedJobButton = event.target.closest("[data-save-selected-job]");
  if (saveSelectedJobButton && latestVinProfile) {
    const snapshot = selectedPartSnapshot(latestVinProfile);
    if (snapshot?.best) openJobSaveModal(snapshot.best);
    return;
  }

  const clearPartChoiceButton = event.target.closest("[data-clear-part-choice]");
  if (clearPartChoiceButton && latestVinProfile) {
    selectedPartChoiceKey = "";
    selectedProgrammerKey = "";
    renderVinProfile(latestVinProfile);
    return;
  }

  const feedbackButton = event.target.closest("[data-part-feedback]");
  if (feedbackButton && latestVinProfile) {
    const offer = findOfferByIdentity(feedbackButton.dataset.partId);
    if (!offer) return;
    const outcome = feedbackButton.dataset.partFeedback;
    const group = feedbackButton.closest("[data-feedback-group]");
    group?.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    feedbackButton.textContent = "Saving...";
    savePartOutcome(outcome, offer)
      .then((result) => {
        if (result.profile && latestVinProfile) {
          latestVinProfile.verifiedProfile = result.profile;
        }
        if (result.job) {
          jobs.unshift(result.job);
          selectedJobId = result.job.id;
          rememberJobs([result.job]);
          renderJobs();
          loadCoverageDashboard();
        }
        feedbackButton.textContent = `Saved: ${feedbackLabel(outcome)}`;
        if (outcome === "worked" && latestVinProfile) {
          startSupplierLookup(latestVinProfile);
        } else if (latestVinProfile) {
          renderVinProfile(latestVinProfile);
        }
      })
      .catch((error) => {
        group?.querySelectorAll("button").forEach((button) => {
          button.disabled = false;
        });
        feedbackButton.textContent = feedbackLabel(outcome);
        alert(error.message);
      });
    return;
  }

  const saveJobButton = event.target.closest("[data-save-job-part]");
  if (saveJobButton && latestVinProfile) {
    const offer = findOfferByIdentity(saveJobButton.dataset.saveJobPart);
    if (offer) openJobSaveModal(offer);
    return;
  }

  const editSupplierButton = event.target.closest("[data-edit-supplier]");
  if (editSupplierButton) {
    selectedSupplierId = editSupplierButton.dataset.editSupplier;
    supplierSettingsStatus.textContent = "";
    renderSupplierAccounts();
    return;
  }

  const clearButton = event.target.closest("[data-live-filter-clear]");
  if (!clearButton || !latestVinProfile) return;

  Object.values(liveProductFilters).forEach((selected) => selected.clear());
  renderVinProfile(latestVinProfile);
});

jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(jobForm);
  const submitButton = jobForm.querySelector("button[type='submit']");

  try {
    submitButton.disabled = true;
    const payload = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        customer: data.get("customer"),
        vehicle: data.get("vehicle"),
        service: data.get("service"),
        verification: data.get("verification"),
      }),
    });
    jobs.unshift(payload.job);
    selectedJobId = payload.job.id;
    rememberJobs([payload.job]);
    renderJobs();
    loadCoverageDashboard();
    jobForm.reset();
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

scanButton?.addEventListener("click", startVinScanner);
fillWorkedJobFromLookupButton?.addEventListener("click", fillWorkedJobFromCurrentLookup);

document.addEventListener("submit", async (event) => {
  if (event.target?.id !== "jobSaveForm") return;
  event.preventDefault();
  const offer = findOfferByIdentity(pendingJobOfferId);
  if (!offer || !latestVinProfile) return;
  const form = event.target;
  const submitButton = form.querySelector("button[type='submit']");
  const data = new FormData(form);
  try {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    const outcome = data.get("outcome") || "worked";
    const programmerName = cleanInput(data.get("programmer"));
    const lishiName = cleanInput(data.get("lishi"));
    const exactPartName = cleanInput(data.get("exactPart"));
    if (!exactPartName || !lishiName || !programmerName) {
      alert("Enter the exact key, Lishi/keyway, and programmer used so confidence can improve.");
      return;
    }
    const part = {
      ...partPayloadFromOffer(offer),
      name: exactPartName || offer.partName,
      sku: data.get("partNumber") || offer.sku,
      keyway: lishiName,
      lishi: lishiName,
      programmer: programmerName,
    };
    const result = await savePartOutcome(outcome, offer, {
      part,
      job: {
        exactPart: data.get("exactPart"),
        partNumber: data.get("partNumber"),
        lishi: data.get("lishi"),
        programmer: data.get("programmer"),
        tool: data.get("tool"),
        keyType: data.get("keyType"),
        failureReason: data.get("failureReason"),
        notes: data.get("notes"),
      },
    });
    if (result.profile) latestVinProfile.verifiedProfile = result.profile;
    jobs.unshift(result.job);
    selectedJobId = result.job.id;
    rememberJobs([result.job]);
    renderJobs();
    loadCoverageDashboard();
    closeJobSaveModal();
    await refreshProfileAfterWorkedJob(result, programmerName);
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save worked job";
  }
});

workedJobForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(workedJobForm);
  const payload = workedJobPayloadFromForm(data);
  const validation = validateWorkedJobPayload(payload);
  const submitButton = workedJobForm.querySelector("button[type='submit']");
  if (validation) {
    workedJobStatus.textContent = validation;
    return;
  }
  try {
    submitButton.disabled = true;
    workedJobStatus.textContent = "Saving reference...";
    const result = await saveWorkedJobPayload(payload);
    jobs.unshift(result.job);
    selectedJobId = result.job.id;
    rememberJobs([result.job]);
    renderJobs();
    loadCoverageDashboard();
    await refreshProfileAfterWorkedJob(result, payload.part.programmer);
    workedJobForm.reset();
    workedJobStatus.textContent = `Saved ${payload.vehicle.year} ${payload.vehicle.make} ${payload.vehicle.model}: ${payload.part.name} / ${payload.part.lishi} / ${payload.part.programmer}.`;
  } catch (error) {
    workedJobStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

workedJobImportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(workedJobImportForm);
  const text = cleanInput(data.get("spreadsheet"));
  const submitButton = workedJobImportForm.querySelector("button[type='submit']");
  if (!text) {
    workedJobImportStatus.textContent = "Paste the spreadsheet rows first.";
    return;
  }
  try {
    submitButton.disabled = true;
    workedJobImportStatus.textContent = "Importing worked jobs into the reference engine...";
    const result = await api("/api/worked-jobs/import", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    await loadJobs();
    await loadCoverageDashboard();
    workedJobImportStatus.textContent = `Imported ${result.imported} worked jobs, updated ${result.profilesUpdated} vehicle profiles, skipped ${result.skipped}, duplicates ${result.duplicates}.`;
    if (result.imported) workedJobImportForm.reset();
  } catch (error) {
    workedJobImportStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

partHistoryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(partHistoryForm);
  const query = cleanInput(data.get("partNumber"));
  const submitButton = partHistoryForm.querySelector("button[type='submit']");
  if (!query) {
    partHistoryStatus.textContent = "Enter a part number first.";
    return;
  }
  try {
    submitButton.disabled = true;
    partHistoryStatus.textContent = "Searching saved jobs and parts cross-reference...";
    if (partHistoryResult) {
      partHistoryResult.innerHTML = `
        <div class="lookup-loading">
          <article><strong>1. Expanding part numbers</strong><p>Checking LR#, MW#, TI#, OE#, and aliases.</p></article>
          <article><strong>2. Reading job proof</strong><p>Matching saved work history and programmer outcomes.</p></article>
        </div>
      `;
    }
    const payload = await api("/api/part-history", {
      method: "POST",
      body: JSON.stringify({ q: query, jobs: localArchivedJobs() }),
      timeoutMs: 20000,
    });
    savePartHistoryRecent(query);
    renderPartHistoryRecents();
    renderPartHistory(payload);
    partHistoryStatus.textContent = `Found ${payload.jobs?.length || 0} job match${payload.jobs?.length === 1 ? "" : "es"} for ${payload.primaryIdentifier || query}; searched ${payload.referenceStats?.searchableJobCount || 0} saved jobs.`;
  } catch (error) {
    partHistoryStatus.textContent = error.message;
    if (partHistoryResult) {
      partHistoryResult.innerHTML = `<article class="assistant-card"><strong>Part history unavailable</strong><p>${escapeHtml(error.message)}</p></article>`;
    }
  } finally {
    submitButton.disabled = false;
  }
});

proofVaultForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadProofVault(proofVaultForm.elements.proofQuery.value);
});

keyIntelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(keyIntelForm);
  const payload = Object.fromEntries(data.entries());
  payload.yearEnd = payload.yearStart;

  try {
    const result = await api("/api/key-intelligence", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const index = keyIntelligence.findIndex((record) => record.id === result.record.id);
    if (index >= 0) keyIntelligence[index] = result.record;
    else keyIntelligence.unshift(result.record);
    renderKeyRecords();
  } catch (error) {
    alert(error.message);
  }
});

if (supplierSettingsForm) {
  supplierSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(supplierSettingsForm);
    const submitButton = supplierSettingsForm.querySelector("button[type='submit']");

    try {
      submitButton.disabled = true;
      supplierSettingsStatus.textContent = "Saving parts login...";
      const supplierId = data.get("supplierId") || selectedSupplierId;
      const supplier = supplierAccounts.find((account) => account.id === supplierId);
      const payload = await api(`/api/supplier-accounts/${encodeURIComponent(supplierId)}`, {
        method: "POST",
        body: JSON.stringify({
          name: supplier?.name || supplierId,
          loginUrl: data.get("loginUrl"),
          username: data.get("username"),
          password: data.get("password"),
          enabled: data.get("enabled") === "on",
        }),
      });
      const index = supplierAccounts.findIndex((account) => account.id === payload.account.id);
      if (index >= 0) supplierAccounts[index] = payload.account;
      else supplierAccounts.push(payload.account);
      renderSupplierAccounts();
      supplierSettingsStatus.textContent = "Parts login saved. Password stays hidden after save.";
    } catch (error) {
      supplierSettingsStatus.textContent = customerSafeCatalogText(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

syncPublicSourcesButton?.addEventListener("click", async () => {
  try {
    syncPublicSourcesButton.disabled = true;
    publicSourceStatus.textContent = "Pulling free public web data...";
    publicReferenceSources = await api("/api/public-reference-sources/sync", { method: "POST" });
    renderPublicReferenceSources();
    publicSourceStatus.textContent = "Public source pull complete. These facts now feed the TimLock-App data layer.";
  } catch (error) {
    publicSourceStatus.textContent = error.message;
  } finally {
    syncPublicSourcesButton.disabled = false;
  }
});

function splitVaultRows(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function parseVaultKeyRows(value) {
  return splitVaultRows(value).map((row) => {
    const [name, type, fcc, chip, buttons, insert, notes] = row.split("|").map((part) => part.trim());
    return { name, type, fcc, chip, buttons, insert, notes, confidence: "verify" };
  });
}

function parseVaultProgrammerRows(value) {
  return splitVaultRows(value).map((row) => {
    const [name, coverage, addKey, allKeysLost, pin, online, notes] = row.split("|").map((part) => part.trim());
    return { name, coverage, addKey, allKeysLost, pin, online, notes, confidence: "verify" };
  });
}

if (referenceVaultForm) {
  referenceVaultForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(referenceVaultForm);
    const submitButton = referenceVaultForm.querySelector("button[type='submit']");
    try {
      submitButton.disabled = true;
      referenceVaultStatus.textContent = "Saving original reference entry...";
      const payload = {
        title: data.get("title"),
        summary: data.get("summary"),
        status: "active",
        confidence: "medium",
        vehicle: {
          startYear: data.get("startYear"),
          endYear: data.get("endYear"),
          make: data.get("make"),
          model: data.get("model"),
        },
        keyway: { primary: data.get("keyway") },
        lishi: { primary: data.get("lishi") },
        keySystems: data.get("keySystems"),
        keys: parseVaultKeyRows(data.get("keys")),
        programmers: parseVaultProgrammerRows(data.get("programmers")),
        eeprom: data.get("eeprom"),
        fieldTools: data.get("fieldTools"),
        warnings: data.get("warnings"),
      };
      const result = await api("/api/reference-vault", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      referenceVaultEntries.unshift(result.entry);
      renderReferenceVault();
      referenceVaultForm.reset();
      referenceVaultStatus.textContent = "Reference entry saved. VIN/YMM lookups can now use this original guidance.";
    } catch (error) {
      referenceVaultStatus.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
}

aiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(aiForm);
  const prompt = data.get("prompt").trim();
  if (!prompt) return;
  aiForm.reset();
  await askAi(prompt, { open: false });
});

vinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(vinForm);
  const vin = normalizeVinInput(data.get("vin"));
  const submitButton = vinForm.querySelector("button[type='submit']");

  try {
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      throw new Error("Enter a valid 17-character VIN. VINs do not use I, O, or Q.");
    }
    vinForm.querySelector("input[name='vin']").value = vin;
    submitButton.disabled = true;
    vinWorkflowStep = "vehicle";
    selectedKeyFamily = "";
    selectedKeyPackage = "";
    selectedPartChoiceKey = "";
    selectedProgrammerKey = "";
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    vinResult.innerHTML = `
      <div class="lookup-loading">
        <article class="active"><strong>1. Decoding VIN</strong><p>Reading vehicle identity with a server timeout guard.</p></article>
        <article><strong>2. Building field pack</strong><p>Cached profile will be used if the cloud server is slow.</p></article>
        <article><strong>3. Preparing parts search</strong><p>Parts load after the vehicle is shown.</p></article>
      </div>
    `;
    setAppStatus("Decoding VIN", "busy", "The request will fail fast instead of hanging.");
    const profile = await api(`/api/vin/${encodeURIComponent(vin)}`, { timeoutMs: 15000 });
    cacheLookupProfile(lookupCacheKeyFromVin(vin), profile);
    renderVinProfile(profile);
    startSupplierLookup(profile);
  } catch (error) {
    const cached = cachedLookupProfile(lookupCacheKeyFromVin(vin), error.message);
    if (cached) {
      setAppStatus("Using field cache", "degraded", error.message);
      renderVinProfile(cached);
    } else {
      renderVinError(error.message);
    }
  } finally {
    submitButton.disabled = false;
  }
});

if (ymmForm) {
  ymmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(ymmForm);
    const year = String(data.get("year") || "").trim();
    const make = String(data.get("make") || "").trim();
    const model = String(data.get("model") || "").trim();
    const submitButton = ymmForm.querySelector("button[type='submit']");

    try {
      if (!/^(19|20)\d{2}$/.test(year) || !make || !model) {
        throw new Error("Enter year, make, and model to search parts without a VIN.");
      }
      submitButton.disabled = true;
      vinWorkflowStep = "vehicle";
      selectedKeyFamily = "";
      selectedKeyPackage = "";
      selectedPartChoiceKey = "";
      selectedProgrammerKey = "";
      Object.values(liveProductFilters).forEach((selected) => selected.clear());
      vinResult.innerHTML = `
        <div class="lookup-loading">
          <article class="active"><strong>1. Building vehicle profile</strong><p>Using year, make, and model because VIN cannot prove exact key package.</p></article>
          <article><strong>2. Building field pack</strong><p>Cached profile will be used if the cloud server is slow.</p></article>
          <article><strong>3. Preparing parts search</strong><p>Parts will load after the vehicle is shown.</p></article>
        </div>
      `;
      setAppStatus("Building lookup", "busy", "The request will fail fast instead of hanging.");
      const profile = await api(
        `/api/vehicle-lookup?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
        { timeoutMs: 12000 },
      );
      cacheLookupProfile(lookupCacheKeyFromVehicle({ year, make, model }), profile);
      renderVinProfile(profile);
      startSupplierLookup(profile);
    } catch (error) {
      const cached = cachedLookupProfile(lookupCacheKeyFromVehicle({ year, make, model }), error.message);
      if (cached) {
        setAppStatus("Using field cache", "degraded", error.message);
        renderVinProfile(cached);
      } else {
        renderVinError(error.message);
      }
    } finally {
      submitButton.disabled = false;
    }
  });
}

window.addEventListener("online", () => refreshApiHealth({ quiet: true }));
window.addEventListener("offline", updateConnectionStatus);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});

installAppButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  installAppButton.disabled = true;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  updateInstallButton();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

renderChat();
renderJobs();
renderVehicles();
renderInsights();
renderKeyRecords();
renderSources();
renderSupplierAccounts();
renderReferenceVault();
renderPublicReferenceSources();
renderPartHistoryRecents();
renderCodeDesk();
renderStorageStatus();
renderAiAdvisorPanel();
renderAiCommanderPanel();
renderAuthStatus();
updateConnectionStatus();
refreshApiHealth({ quiet: true });
window.setInterval(() => refreshApiHealth({ quiet: true }), 60000);
bootTask("auth status", loadAuthStatus);
bootTask("jobs", loadJobs);
bootTask("coverage dashboard", loadCoverageDashboard);
bootTask("ai advisor", loadAiAdvisor);
bootTask("ai memory", loadAiMemory);
bootTask("ai commander", () => loadAiCommander({ quiet: true }));
bootTask("vehicles", loadVehicles);
bootTask("insights", loadInsights);
bootTask("key intelligence", loadKeyIntelligence);
bootTask("sources", loadSources);
bootTask("supplier accounts", loadSupplierAccounts);
bootTask("reference vault", loadReferenceVault);
bootTask("public sources", loadPublicReferenceSources);
bootTask("storage status", () => loadStorageStatus({ quiet: true }));
updateInstallButton();
