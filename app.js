let jobs = [];
let vehicles = [];
let calendarAnalysis = null;
let keyIntelligence = [];
let sourceConnectors = [];
let supplierAccounts = [];
let selectedSupplierId = "key-innovations";
let selectedJobId = null;
let latestVinProfile = null;
let vinWorkflowStep = "entry";
let selectedKeyFamily = "";
let selectedKeyPackage = "";
let selectedPartChoiceKey = "";
let supplierLookupRequestId = 0;
let activeVinScan = null;
let pendingJobOfferId = "";
let deferredInstallPrompt = null;
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
    text: "Pick a job and I will help with safe prep: customer verification, parts checklist, tool readiness, quote range, and documentation.",
  },
];

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
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

function showView(id) {
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === id));
}

function updateConnectionStatus() {
  const online = navigator.onLine !== false;
  if (connectionStatus) connectionStatus.textContent = online ? "Online" : "Offline shell";
  appStatusBanner?.classList.toggle("offline", !online);
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
    supplierAccountList.innerHTML = `<article class="source-card-row"><strong>No supplier accounts</strong><p>Supplier registry has not loaded yet.</p></article>`;
    return;
  }

  if (!supplierAccounts.some((account) => account.id === selectedSupplierId)) {
    selectedSupplierId = supplierAccounts[0].id;
  }
  const selectedAccount = supplierAccounts.find((account) => account.id === selectedSupplierId) || supplierAccounts[0];
  if (supplierSelect) {
    supplierSelect.innerHTML = supplierAccounts
      .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
      .join("");
    supplierSelect.value = selectedAccount.id;
  }

  supplierSettingsForm.elements.loginUrl.value = selectedAccount.loginUrl || "";
  supplierSettingsForm.elements.username.value = selectedAccount.username || "";
  supplierSettingsForm.elements.password.value = "";
  supplierSettingsForm.elements.enabled.checked = Boolean(selectedAccount.enabled);

  supplierAccountList.innerHTML = supplierAccounts
    .map(
      (account) => `
        <article class="source-card-row supplier-account-row ${account.id === selectedAccount.id ? "selected" : ""}">
          <div>
            <strong>${escapeHtml(account.name)}</strong>
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
        <p class="eyebrow">Local vPIC catalog</p>
        <div class="assistant-card">
          <strong>No local application match</strong>
          <p>Live VIN decode still worked. Run or widen the vPIC sync to add this year/make/model locally.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="option-section">
      <p class="eyebrow">Local vPIC catalog</p>
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
          <strong>No supplier candidates yet</strong>
          <p>Add catalog fitment or Key DB part clues to improve candidate matching.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="supplier-candidates">
      <p class="eyebrow">${compact ? "Step 3" : "Supplier part candidates"}</p>
      ${compact ? "<h3>Possible Key Innovations matches</h3>" : ""}
      <div class="supplier-list">
        ${candidates
          .slice(0, compact ? 4 : candidates.length)
          .map(
            (candidate, index) => `
              <article class="supplier-card ${index === 0 ? "best" : ""}">
                <div>
                  <span>${index === 0 ? "Best candidate" : candidate.confidence}</span>
                  <strong>${escapeHtml(candidate.hlPartNumber || candidate.supplierSku || "Candidate")}</strong>
                </div>
                <dl>
                  <div><dt>SKU</dt><dd>${escapeHtml(candidate.supplierSku || "Verify")}</dd></div>
                  <div><dt>FCC</dt><dd>${escapeHtml(candidate.fccId || "Verify")}</dd></div>
                  <div><dt>OEM</dt><dd>${escapeHtml((candidate.oemPartNumbers || []).slice(0, 3).join(", ") || "Verify")}</dd></div>
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
  const buttons = product.keyInfo?.buttons || buttonCountFromText(product.name);
  if (!buttons) return "Button layout unknown";
  if (/remote start/i.test(buttons)) return "Remote start";
  const count = String(buttons).match(/\b([2-7])\b/);
  return count ? `${count[1]} button` : String(buttons);
}

function liveFilterValue(product, group) {
  if (group === "condition") return conditionBucket(product);
  if (group === "stock") return stockBucket(product);
  if (group === "type") return partTypeBucket(product);
  if (group === "supplier") return product.supplier || "Key Innovations";
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
  if (serverFamily === "proximity") return "proximity";
  if (["remote-head", "transponder"].includes(serverFamily)) return "keyed";
  if (["insert", "tool", "supporting"].includes(serverFamily)) return "supporting";

  const text = [product.name, product.keyInfo?.productType, product.keyInfo?.buttons, product.keyInfo?.chip]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
  return products.filter((product) => productKeyFamily(product) === family);
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
  return `<div class="workflow-actions">${actions.join("")}</div>`;
}

function stepLabel(step) {
  return {
    vehicle: "Vehicle",
    "vehicle-details": "Details",
    package: "Key type",
    parts: "Pictures",
    suppliers: "Reference",
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
        <article>
          <small>Watch outs</small>
          <ul>${renderList(reference.warnings)}</ul>
        </article>
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
    ["Watch", (reference.warnings || [])[0] || "VIN alone is not enough"],
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
  const supplierList = baseline?.supplierOutcomes ? Object.values(baseline.supplierOutcomes) : [];
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
                supplierList.length
                  ? `Worked suppliers: ${supplierList.map((item) => `${item.supplier} x${item.workedCount}`).join(", ")}`
                  : baseline.suppliers?.length ? `Suppliers: ${baseline.suppliers.join(", ")}` : "",
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
          <span>These matches are boosted above supplier guesses because someone marked the part worked.</span>
        </div>
        <small>${escapeHtml(`${groups.length} parts / ${totalWorked || verifiedOffers.length} worked`)}</small>
      </div>
      ${groups.map((group) => renderExactPartGroup({ ...group, focusMode: "verified", focusNote: "Shop-confirmed part. Compare supplier price, stock, and condition before ordering." }, offers)).join("")}
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
  Object.values(liveProductFilters).forEach((selected) => selected.clear());
  vinForm.classList.remove("is-hidden");
  ymmForm?.classList.remove("is-hidden");
  vinResult.innerHTML = "";
  vinRecommendation.innerHTML = `
    <strong>Catalog source ready</strong>
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
      ${renderLiveFilterGroup("Supplier", "supplier", products)}
    </div>
  `;
}

function productBadges(product, index) {
  const badges = [];
  if (index === 0) badges.push("Best match");
  if (product.keyInfo?.condition) badges.push(product.keyInfo.condition);
  if (product.keyInfo?.stock && product.keyInfo.stock !== "Verify") badges.push(product.keyInfo.stock);
  if (product.keyInfo?.fcc) badges.push("FCC");
  if (product.keyInfo?.buttons) badges.push(`${product.keyInfo.buttons} button`);
  return badges.slice(0, 5);
}

function normalizePrice(value) {
  const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function buttonCountFromText(value) {
  const match = String(value || "").match(/\b(\d)\s*(?:button|btn)\b/i);
  return match ? match[1] : "";
}

function normalizedSupplierOffer(product) {
  const buttons = product.keyInfo?.buttons || buttonCountFromText(product.name);
  return {
    supplier: product.supplier || "Key Innovations",
    partName: product.name || "Supplier part",
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
  group.label = exactPartLabel(group);
  group.supplierCount = new Set(group.offers.map((offer) => offer.supplier)).size;
  group.conditions = [...new Set(group.offers.map((offer) => offer.condition && offer.condition !== "Verify" ? offer.condition : conditionBucket(offer.rawProduct)).filter(Boolean))];
  group.fccs = [...new Set(group.offers.map((offer) => offer.fcc).filter(Boolean))];
  group.frequencies = [...new Set(group.offers.map((offer) => offer.frequency).filter(Boolean))];
  group.buttons = [...new Set(group.offers.map((offer) => offer.buttons).filter(Boolean))];
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
  const label = exactPartLabel(group);
  const normalizedLabel = String(label || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  if (normalizedLabel && normalizedLabel.length >= 4) return `part:${normalizedLabel}`;
  const best = group.bestOffer || group.offers[0];
  const fallback = partNumberTokens([best.oem, best.sku, best.partName, best.fcc].filter(Boolean).join(" "))[0];
  return fallback ? `part:${fallback}` : group.key;
}

function visualPartChoiceGroups(offers) {
  const merged = new Map();
  exactPartGroups(offers).forEach((group) => {
    const key = visualPartChoiceKey(group);
    if (!merged.has(key)) merged.set(key, []);
    merged.get(key).push(...group.offers);
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
          ? "Showing every exact supplier match for this KI Grade A option, with refurbished/equivalent offers included."
          : "Showing every exact supplier match for this KI Grade A option. Verify condition when another supplier does not publish it.",
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
    ["Supplier", offer.supplier],
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
            ? `<p><strong>Known alternates:</strong> ${escapeHtml(alternates.map((item) => `${item.supplier} ${item.priceFormatted || item.price || ""}`.trim()).join(" | "))}</p>`
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
        <p>${escapeHtml(offer.supplier)}</p>
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
        <strong>${escapeHtml(offer.supplier)}</strong>
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
        ${offer.productUrl ? `<a class="supplier-tab-link" href="${escapeHtml(offer.productUrl)}" target="_blank" rel="noreferrer">Open supplier</a>` : ""}
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
  return [offer.supplier, offer.priceValue ? `$${offer.priceValue.toFixed(2)}` : offer.priceFormatted || "", offer.stock].filter(Boolean).join(" - ");
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
    group.focusMode === "grade-a" ? "KI Refurbished Grade A baseline" : "",
    group.supplierCount > 1 ? `${group.supplierCount} suppliers match` : "single supplier match",
    group.fccs.length ? `FCC ${group.fccs[0]}` : "",
    group.buttons.length ? `${group.buttons[0]} button` : "",
    gradeA && group.focusMode !== "grade-a" ? "KI Grade A available" : "",
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
        <p>${escapeHtml(decision.why.join(" + ") || "Best available supplier/ranking match.")}</p>
      </div>
      <div class="decision-grid">
        <span><small>${gradeAFocus ? "KI Grade A option" : "Value option"}</small><strong>${escapeHtml(supplierLabel(decision.valueOption))}</strong></span>
        <span><small>${gradeAFocus ? "Other supplier check" : "Best in stock"}</small><strong>${escapeHtml(supplierLabel(gradeAFocus ? decision.supplierCheck : decision.bestInStock))}</strong></span>
        <span><small>Condition spread</small><strong>${escapeHtml(decision.conditions)}</strong></span>
        <span><small>Verify</small><strong>${escapeHtml(decision.verify.length ? decision.verify.join(", ") : "photo + blade before ordering")}</strong></span>
      </div>
      ${decision.risks.length ? `<p class="decision-risks">${escapeHtml(`Risk flags: ${decision.risks.join(" | ")}`)}</p>` : ""}
    </div>
  `;
}

function renderExactPartGroup(group, allOffers) {
  const best = group.bestOffer;
  const suppliers = group.offers.map((offer) => offer.supplier).join(" / ");
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
        ? "KI Grade A baseline"
        : group.supplierCount >= 3
        ? "Strong supplier agreement"
        : group.supplierCount === 2
          ? "Supplier agreement"
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
          <span>${escapeHtml(`${group.supplierCount} supplier${group.supplierCount === 1 ? "" : "s"} | ${group.agreementScore}%`)}</span>
        </div>
      </div>
      <div class="agreement-strip">
        <span>${escapeHtml(`${group.supplierCount} supplier${group.supplierCount === 1 ? "" : "s"} agree`)}</span>
        <span>${escapeHtml(`${group.inStockCount} in stock`)}</span>
        <span>${escapeHtml(group.conditions.length ? group.conditions.join(" / ") : "Condition verify")}</span>
        ${group.focusMode === "verified" ? `<span>${escapeHtml(`${group.offers.reduce((count, offer) => count + (offer.profileWorkedCount || 0), 0) || group.offers.length} worked`)}</span>` : ""}
        ${group.focusMode === "grade-a" ? `<span>${escapeHtml(`${group.offers.length} Grade A/equivalent offers`)}</span>` : ""}
      </div>
      ${renderDecisionCard(group)}
      <div class="exact-supplier-tabs" aria-label="${escapeHtml(`${group.label} supplier comparison`)}">
        ${group.offers.map((offer) => renderSupplierComparisonTab(offer, allOffers)).join("")}
      </div>
      <p class="exact-group-foot">${escapeHtml(suppliers)}</p>
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
          <strong>Key Innovations Refurbished Grade A</strong>
          <span>All KI Grade A options are shown first, including out-of-stock parts, with equivalent-condition matches from other suppliers.</span>
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
  const chosen = selectedPartChoiceKey === group.key;
  const buttonLabel = group.buttons[0] ? `${group.buttons[0]} button` : buttonLayoutBucket(offer.rawProduct);
  const typeLabel = partTypeBucket(offer.rawProduct);
  return `
    <button class="part-choice-card ${chosen ? "active" : ""}" type="button" data-select-part-choice="${escapeHtml(group.key)}">
      <div class="part-choice-image">
        ${
          offer.image
            ? renderOfferThumb(offer, group.label)
            : `<div class="offer-thumb empty" aria-hidden="true">No photo</div>`
        }
      </div>
      <div class="part-choice-copy">
        <span>${escapeHtml(typeLabel)}</span>
        <strong>${escapeHtml(buttonLabel || "Button layout verify")}</strong>
        <small>${escapeHtml("Select if the picture/buttons match")}</small>
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
          <p>${escapeHtml("Pick the key, remote, or blade style first. The next screen opens the field reference for that choice.")}</p>
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

function renderSelectedSupplierScreen(profile) {
  const products = profile.liveSupplierLookup?.products || [];
  let selectedProducts = productsForFamily(products, selectedKeyFamily);
  if (!selectedProducts.length && products.length) {
    selectedProducts = products.filter((product) => productKeyFamily(product) !== "supporting");
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
  const buttonLabel = group.buttons[0] ? `${group.buttons[0]} button` : buttonLayoutBucket(best.rawProduct);
  const typeLabel = partTypeBucket(best.rawProduct);
  const reference = profile.vehicleReference || {};
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
        ["Keyway", reference.keyway?.primary],
        ["Lishi / decode", reference.lishi?.primary],
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
        `<button class="secondary-action" type="button" data-vin-back="parts">Back</button>`,
        `<button class="secondary-action" type="button" data-vin-reset>Home</button>`,
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
  return api("/api/part-outcomes", {
    method: "POST",
    body: JSON.stringify({
      outcome,
      vin: latestVinProfile.vin,
      vehicle: latestVinProfile.vehicle,
      part: partPayloadFromOffer(offer),
      ...extra,
    }),
  });
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
    ["Fitment", offer.fitment],
  ].filter(([, value]) => value);

  if (!details.length) {
    return `<div class="part-reference-grid empty"><span>Verify FCC, frequency, chip, buttons, and blade before cutting or programming.</span></div>`;
  }

  return `
    <div class="part-reference-grid">
      ${details
        .slice(0, 5)
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
          <strong>Supplier search running</strong>
          <p>${escapeHtml(lookup.statusMessage || "Parts are loading in the background. You can stay on this screen.")}</p>
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
              <p>${escapeHtml(selectionSummary || "Every matching item is shown. Use filters to narrow condition, stock, type, or supplier.")}</p>
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
                        topPick.supplier,
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
                      (status) => `
                        <span class="${status.connectorLive && status.productCount ? "ready" : "planned"}">
                          ${escapeHtml(status.name)}: ${escapeHtml(
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
      <p class="supplier-footnote">${escapeHtml(lookup.searchAttempts?.length ? "Supplier offers are live results. Out-of-stock items stay visible so the app works as a reference guide, not just a shopping cart." : "")}</p>
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
          <p>${escapeHtml(lookup.statusMessage || "Connect a supplier account or verify this vehicle manually.")}</p>
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
        <span>${escapeHtml(`${lookup.products.length} supplier results`)}</span>
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
        <h3>Key Innovations live lookup</h3>
        <div class="assistant-card">
          <strong>${escapeHtml(lookup.loginStatus || "No live matches")}</strong>
          <p>${escapeHtml(lookup.statusMessage || "No products were returned for this vehicle yet.")}</p>
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
        <p>${escapeHtml(lookup.statusMessage || "Live supplier search complete.")}</p>
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
                  <span>${index === 0 ? "Best live match" : product.brand || "Key Innovations"}</span>
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
                  ${product.keyInfo?.fitment ? `<p>${escapeHtml(product.keyInfo.fitment)}</p>` : ""}
                  ${product.url ? `<a href="${escapeHtml(product.url)}" target="_blank" rel="noreferrer">Open supplier page</a>` : ""}
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
        <span>${selectedProducts.length} of ${products.length} supplier parts selected</span>
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

function renderVehicleApprovalScreen(profile, context) {
  const { vehicle, title, sourceBadge } = context;
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
          <span>${escapeHtml(sourceBadge)}</span>
        </div>
      </div>
      ${renderWorkflowActions([
        `<button class="primary-action" type="button" data-approve-vehicle>Approve vehicle</button>`,
        `<button class="secondary-action" type="button" data-view-vehicle-details>View details</button>`,
        `<button class="secondary-action" type="button" data-vin-reset>Home</button>`,
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
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back</button>`,
        `<button class="primary-action" type="button" data-approve-vehicle>Approve vehicle</button>`,
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
          <h3>No supplier parts returned</h3>
          <p>Go back and verify the vehicle, supplier login, or catalog source.</p>
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
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back</button>`,
      ])}
    </section>
  `;
}

function renderKeyPackageScreen(profile) {
  const vehicle = profile.vehicle || {};
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const packageOption = selectedPackageOption();
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
      ${renderFieldReferencePreview(profile.vehicleReference)}
      <details class="reference-drawer">
        <summary>Vehicle reference</summary>
        ${renderVehicleReferenceCard(profile.vehicleReference)}
      </details>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back</button>`,
      ])}
    </section>
  `;
}

function renderKeyChoicesScreen(profile) {
  const products = profile.liveSupplierLookup?.products || [];
  ensureSelectedKeyFamily(products);
  let selectedProducts = productsForFamily(products, selectedKeyFamily);
  if (!selectedProducts.length && products.length) {
    selectedProducts = products.filter((product) => productKeyFamily(product) !== "supporting");
  }
  const packageOption = selectedPackageOption();
  const decisionNote = profile.vin
    ? "VIN identified the vehicle, but FCC, buttons, board, and package still need supplier/vehicle verification."
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
        `<button class="secondary-action" type="button" data-vin-back="package">Back</button>`,
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
    part: requirements["Supplier part confidence"]?.value || "Supplier lookup required",
  };
  const bestSupplier = profile.supplierCandidates?.[0];
  ensureSelectedKeyFamily(profile.liveSupplierLookup?.products || []);
  const sourceBadge = profile.keySystem
    ? "Verified local match"
    : profile.programmingReference
      ? "Programming data match"
      : profile.lookupMode === "ymm"
        ? "Y/M/M supplier search"
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
  } else if (vinWorkflowStep === "suppliers") {
    screenMarkup = renderSelectedSupplierScreen(profile);
  } else {
    vinWorkflowStep = "vehicle";
    screenMarkup = renderVehicleApprovalScreen(profile, context);
  }
  vinResult.innerHTML = `${renderMobileContextHeader(profile, vinWorkflowStep)}${screenMarkup}`;

  vinRecommendation.innerHTML = `
    <strong>Reference mode</strong>
    <p>${escapeHtml("Decode the vehicle, choose the visible key style, then use the final screen as a field reference for identifiers, keyway, tools, and programming checks.")}</p>
    <div class="tag-row">
      <span>Vehicle</span><span>Keyway</span><span>Buttons</span><span>FCC</span><span>Programming</span>
    </div>
  `;
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
          <span>Best supplier candidate</span>
          <strong>${escapeHtml(bestSupplier?.hlPartNumber || bestSupplier?.supplierSku || "Needs match")}</strong>
          <p>${escapeHtml(bestSupplier ? `${bestSupplier.confidence} confidence · FCC ${bestSupplier.fccId || "verify"}` : "No catalog candidate yet")}</p>
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
    <strong>${escapeHtml(profile.liveSupplierLookup?.loginStatus === "connected" ? "Live supplier connected" : "Supplier search fallback")}</strong>
    <p>${escapeHtml(profile.liveSupplierLookup?.statusMessage || "Current matches use imported Key Innovations labels until live supplier lookup is connected.")}</p>
    <div class="tag-row">
      <span>Key Innovations</span><span>${escapeHtml(`${profile.liveSupplierLookup?.products?.length || 0} live products`)}</span><span>Verify before ordering</span>
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
        Customer / reference
        <input name="customer" value="Shop job" autocomplete="off" />
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
        Customer charge
        <input name="price" inputmode="decimal" placeholder="240" autocomplete="off" />
      </label>
      <label>
        Payment
        <select name="payment">
          <option value="cr">Card</option>
          <option value="ch">Cash</option>
          <option value="inv">Invoice</option>
          <option value="">Not recorded</option>
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
  pendingJobOfferId = offerIdentityKey(offer);
  modal.querySelector("#jobSaveTitle").textContent = offer.partName;
  form.elements.customer.value = "Shop job";
  form.elements.programmer.value = latestVinProfile?.programmingReference?.programmer || latestVinProfile?.programmers?.[0]?.name || "";
  form.elements.tool.value = latestVinProfile?.tools?.[0]?.name || "";
  form.elements.outcome.value = "worked";
  form.elements.keyType.value = selectedKeyFamily === "proximity" ? "proximity" : "keyed";
  form.elements.price.value = "";
  form.elements.payment.value = "cr";
  form.elements.failureReason.value = "";
  form.elements.notes.value = `${vehicleTitle}\n${[offer.supplier, offer.sku, offer.oem, offer.fcc, offer.buttons].filter(Boolean).join(" | ")}`;
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
        <input name="manualVinScan" maxlength="17" autocomplete="off" placeholder="Enter VIN manually" />
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
    renderVinProfile(latestVinProfile);
  } catch (error) {
    if (requestId !== supplierLookupRequestId || latestVinProfile !== profile) return;
    latestVinProfile.liveSupplierLookup = {
      ...(latestVinProfile.liveSupplierLookup || {}),
      loginStatus: "error",
      statusMessage: error.message || "Supplier lookup failed.",
      products: latestVinProfile.liveSupplierLookup?.products || [],
    };
    renderVinProfile(latestVinProfile);
  }
}

function renderVinError(message) {
  vinResult.innerHTML = `<div class="assistant-card"><strong>VIN decode failed</strong><p>${escapeHtml(message)}</p></div>`;
  vinRecommendation.innerHTML = `<strong>Check VIN</strong><p>Confirm the 17-character VIN from the dash tag, door sticker, registration, or RO.</p>`;
}

function renderChat() {
  chatLogElement.innerHTML = chatLog
    .map((message) => `<div class="message ${message.role}">${message.text}</div>`)
    .join("");
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

  for (const [index, url] of urls.entries()) {
    try {
      const shouldFastFail = index === 0 && urls.length > 1 && !url.startsWith("http");
      const response = await fetchWithTimeout(url, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      }, shouldFastFail ? 2500 : 0);

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`The app server returned ${response.status || "a non-JSON response"} for ${path}.`);
      }
      if (!response.ok) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (!url.startsWith("http")) continue;
      throw error;
    }
  }

  throw new Error(
    `${lastError?.message || "Request failed"} If this happens only on one device, refresh the page or use the Render Node web-service URL, not a static site URL.`,
  );
}

function normalizeVinInput(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function loadJobs() {
  const payload = await api("/api/jobs");
  jobs = payload.jobs;
  selectedJobId = jobs[0]?.id || null;
  renderJobs();
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

navItems.forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewTarget));
});

if (supplierSelect) {
  supplierSelect.addEventListener("change", () => {
    selectedSupplierId = supplierSelect.value;
    supplierSettingsStatus.textContent = "";
    renderSupplierAccounts();
  });
}

document.addEventListener("change", (event) => {
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

  const resetButton = event.target.closest("[data-vin-reset]");
  if (resetButton) {
    resetVinWorkflow();
    return;
  }

  const backButton = event.target.closest("[data-vin-back]");
  if (backButton && latestVinProfile) {
    vinWorkflowStep = backButton.dataset.vinBack;
    if (vinWorkflowStep !== "parts") selectedPartChoiceKey = "";
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
    vinWorkflowStep = "parts";
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    renderVinProfile(latestVinProfile);
    return;
  }

  const partChoiceButton = event.target.closest("[data-select-part-choice]");
  if (partChoiceButton && latestVinProfile) {
    selectedPartChoiceKey = partChoiceButton.dataset.selectPartChoice;
    vinWorkflowStep = "suppliers";
    renderVinProfile(latestVinProfile);
    return;
  }

  const clearPartChoiceButton = event.target.closest("[data-clear-part-choice]");
  if (clearPartChoiceButton && latestVinProfile) {
    selectedPartChoiceKey = "";
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
    renderJobs();
    jobForm.reset();
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

scanButton?.addEventListener("click", startVinScanner);

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
    const result = await savePartOutcome(outcome, offer, {
      job: {
        customer: data.get("customer"),
        programmer: data.get("programmer"),
        tool: data.get("tool"),
        keyType: data.get("keyType"),
        price: data.get("price"),
        payment: data.get("payment"),
        failureReason: data.get("failureReason"),
        notes: data.get("notes"),
      },
    });
    if (result.profile) latestVinProfile.verifiedProfile = result.profile;
    jobs.unshift(result.job);
    selectedJobId = result.job.id;
    renderJobs();
    closeJobSaveModal();
    if (outcome === "worked") startSupplierLookup(latestVinProfile);
    else renderVinProfile(latestVinProfile);
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save worked job";
  }
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
      supplierSettingsStatus.textContent = "Saving supplier login...";
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
      supplierSettingsStatus.textContent = "Supplier login saved. Password stays hidden after save.";
    } catch (error) {
      supplierSettingsStatus.textContent = error.message;
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

  chatLog.push({ role: "user", text: prompt });
  renderChat();
  aiForm.reset();

  try {
    const payload = await api("/api/ai", {
      method: "POST",
      body: JSON.stringify({ prompt, jobId: jobs[0]?.id || null }),
    });
    chatLog.push({ role: "assistant", text: payload.response });
  } catch (error) {
    chatLog.push({ role: "assistant", text: `Backend error: ${error.message}` });
  } finally {
    renderChat();
  }
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
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    vinResult.innerHTML = `
      <div class="lookup-loading">
        <article><strong>1. Decoding VIN</strong><p>Reading vehicle identity.</p></article>
        <article><strong>2. Preparing supplier search</strong><p>Parts will load after the vehicle is shown.</p></article>
      </div>
    `;
    const profile = await api(`/api/vin/${encodeURIComponent(vin)}`);
    renderVinProfile(profile);
    startSupplierLookup(profile);
  } catch (error) {
    renderVinError(error.message);
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
      Object.values(liveProductFilters).forEach((selected) => selected.clear());
      vinResult.innerHTML = `
        <div class="lookup-loading">
          <article><strong>1. Building vehicle profile</strong><p>Using year, make, and model because VIN cannot prove exact key package.</p></article>
          <article><strong>2. Preparing supplier search</strong><p>Parts will load after the vehicle is shown.</p></article>
        </div>
      `;
      const profile = await api(
        `/api/vehicle-lookup?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      );
      renderVinProfile(profile);
      startSupplierLookup(profile);
    } catch (error) {
      renderVinError(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

window.addEventListener("online", updateConnectionStatus);
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
loadJobs();
loadVehicles();
loadInsights();
loadKeyIntelligence();
loadSources();
loadSupplierAccounts();
updateConnectionStatus();
updateInstallButton();
