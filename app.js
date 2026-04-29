let jobs = [];
let vehicles = [];
let calendarAnalysis = null;
let keyIntelligence = [];
let sourceConnectors = [];
let supplierAccounts = [];
let selectedJobId = null;
let latestVinProfile = null;
let vinWorkflowStep = "entry";
let selectedKeyFamily = "";
const liveProductFilters = {
  condition: new Set(),
  stock: new Set(),
  type: new Set(),
  brand: new Set(),
};

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
const vinForm = document.querySelector("#vinForm");
const vinResult = document.querySelector("#vinResult");
const vinRecommendation = document.querySelector("#vinRecommendation");
const aiForm = document.querySelector("#aiForm");
const chatLogElement = document.querySelector("#chatLog");

function showView(id) {
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === id));
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
    supplierAccountList.innerHTML = `<article class="source-card-row"><strong>No supplier accounts</strong><p>Add Key Innovations first, then we can add other suppliers.</p></article>`;
    return;
  }

  const keyInnovations = supplierAccounts.find((account) => account.id === "key-innovations") || supplierAccounts[0];
  supplierSettingsForm.elements.loginUrl.value = keyInnovations.loginUrl || "";
  supplierSettingsForm.elements.username.value = keyInnovations.username || "";
  supplierSettingsForm.elements.password.value = "";
  supplierSettingsForm.elements.enabled.checked = Boolean(keyInnovations.enabled);

  supplierAccountList.innerHTML = supplierAccounts
    .map(
      (account) => `
        <article class="source-card-row">
          <div>
            <strong>${escapeHtml(account.name)}</strong>
            <span>${account.connected ? "Connected" : account.hasPassword ? "Saved, disabled" : "Not connected"}</span>
          </div>
          <p>${escapeHtml(account.username || "No username saved")}</p>
          <div class="tag-row">
            <span>${account.enabled ? "Live lookup on" : "Live lookup off"}</span>
            <span>${account.hasPassword ? "Password saved" : "Password missing"}</span>
            <span>${account.updatedAt ? `Updated ${new Date(account.updatedAt).toLocaleDateString()}` : "Not updated"}</span>
          </div>
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

function liveFilterValue(product, group) {
  if (group === "condition") return product.keyInfo?.condition || "Unlisted";
  if (group === "stock") return product.keyInfo?.stock || "Unlisted";
  if (group === "type") return product.keyInfo?.productType || "Unlisted";
  if (group === "brand") return product.brand || "Unlisted";
  return "Unlisted";
}

function liveFilterOptions(products, group) {
  return [...new Set(products.map((product) => liveFilterValue(product, group)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function productPassesLiveFilters(product) {
  return Object.entries(liveProductFilters).every(([group, selected]) => {
    if (!selected.size) return true;
    return selected.has(liveFilterValue(product, group));
  });
}

function productKeyFamily(product) {
  const text = [product.name, product.keyInfo?.productType, product.keyInfo?.buttons, product.keyInfo?.chip]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (text.includes("prox") || text.includes("smart")) return "proximity";
  return "keyed";
}

function keyFamilyLabel(family) {
  return family === "proximity" ? "Proximity keys" : "Flip / transponder keys";
}

function productsForFamily(products, family) {
  return products.filter((product) => productKeyFamily(product) === family);
}

function familyCounts(products) {
  return {
    proximity: productsForFamily(products, "proximity").length,
    keyed: productsForFamily(products, "keyed").length,
  };
}

function ensureSelectedKeyFamily(products) {
  const counts = familyCounts(products);
  if (selectedKeyFamily && counts[selectedKeyFamily]) return;
  selectedKeyFamily = counts.proximity ? "proximity" : "keyed";
}

function renderWorkflowActions(actions) {
  return `<div class="workflow-actions">${actions.join("")}</div>`;
}

function resetVinWorkflow() {
  vinWorkflowStep = "entry";
  latestVinProfile = null;
  selectedKeyFamily = "";
  Object.values(liveProductFilters).forEach((selected) => selected.clear());
  vinForm.classList.remove("is-hidden");
  vinResult.innerHTML = "";
  vinRecommendation.innerHTML = `
    <strong>Catalog source ready</strong>
    <p>Enter or scan a VIN to begin the guided lookup.</p>
  `;
}

function renderLiveFilterGroup(label, group, products) {
  const options = liveFilterOptions(products, group);
  if (!options.length) return "";
  return `
    <details class="live-filter-group" ${group === "condition" ? "open" : ""}>
      <summary>${label}</summary>
      <div>
        ${options
          .map(
            (option) => `
              <label class="filter-check">
                <input type="checkbox" data-live-filter="${group}" value="${escapeHtml(option)}" ${
                  liveProductFilters[group].has(option) ? "checked" : ""
                } />
                <span>${escapeHtml(option)}</span>
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
      ${renderLiveFilterGroup("Part Type", "type", products)}
      ${renderLiveFilterGroup("Brand", "brand", products)}
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

function normalizedSupplierOffer(product) {
  return {
    supplier: product.supplier || "Key Innovations",
    partName: product.name || "Supplier part",
    sku: product.keyInfo?.sku || "",
    oem: product.keyInfo?.oem || "",
    fcc: product.keyInfo?.fcc || "",
    condition: product.keyInfo?.condition || "Verify",
    stock: product.keyInfo?.stock || "Verify",
    price: product.price || "",
    priceValue: normalizePrice(product.price),
    image: product.image || "",
    productUrl: product.url || "",
    productType: product.keyInfo?.productType || "Verify",
    buttons: product.keyInfo?.buttons || "",
    chip: product.keyInfo?.chip || "",
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

function compareScore(offer, index) {
  let score = 0;
  if (index === 0) score += 15;
  if (offer.fitmentConfidence === "Exact fitment") score += 30;
  if (offer.stock === "In stock") score += 25;
  if (offer.fcc) score += 15;
  if (offer.condition && !/verify/i.test(offer.condition)) score += 10;
  if (offer.priceValue) score += 5;
  return score;
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
        if ((b.stock === "In stock") !== (a.stock === "In stock")) return b.stock === "In stock" ? 1 : -1;
        return (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity) || b.score - a.score;
      });
      group.bestOffer = group.offers[0];
      group.lowestInStock = group.offers
        .filter((offer) => offer.stock === "In stock" && offer.priceValue)
        .sort((a, b) => a.priceValue - b.priceValue)[0];
      group.inStockCount = group.offers.filter((offer) => offer.stock === "In stock").length;
      return group;
    })
    .sort((a, b) => {
      if ((b.inStockCount > 0) !== (a.inStockCount > 0)) return b.inStockCount > 0 ? 1 : -1;
      return b.bestOffer.score - a.bestOffer.score;
    });
}

function renderOfferBadges(offer) {
  return [offer.fitmentConfidence, offer.stock, offer.condition, offer.fcc ? "FCC" : "", offer.buttons ? `${offer.buttons} button` : ""]
    .filter(Boolean)
    .slice(0, 5)
    .map((badge) => `<span>${escapeHtml(badge)}</span>`)
    .join("");
}

function renderSupplierComparison(lookup, products) {
  if (!lookup) return "";
  const filteredProducts = products.filter(productPassesLiveFilters);
  const groups = groupSupplierOffers(filteredProducts);

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
              <h3>${groups.length} part groups</h3>
            </div>
            <span>${filteredProducts.length} of ${products.length} offers shown</span>
          </div>
          ${
            groups.length
              ? groups
                  .map(
                    (group, index) => `
                      <article class="compare-card ${index === 0 ? "best" : ""}">
                        ${group.image ? `<img src="${escapeHtml(group.image)}" alt="${escapeHtml(group.title)}" />` : ""}
                        <div class="compare-card-body">
                          <div class="compare-card-head">
                            <div>
                              <span>${index === 0 ? "Best comparison match" : "Part group"}</span>
                              <strong>${escapeHtml(group.title)}</strong>
                              <p>${escapeHtml(group.bestOffer.partName)}</p>
                            </div>
                            <div class="compare-price">
                              <small>${group.lowestInStock ? "Lowest in stock" : "Reference only"}</small>
                              <strong>${group.lowestInStock?.priceValue ? `$${group.lowestInStock.priceValue.toFixed(2)}` : "Check"}</strong>
                            </div>
                          </div>
                          <div class="offer-list">
                            ${group.offers
                              .map(
                                (offer) => `
                                  <div class="offer-row ${offer.stock === "Out of stock" ? "out-of-stock" : ""}">
                                    <div>
                                      <strong>${escapeHtml(offer.supplier)}</strong>
                                      <p>${escapeHtml([offer.sku, offer.oem, offer.productType].filter(Boolean).join(" - ") || "Verify identifiers")}</p>
                                      <div class="badge-row">${renderOfferBadges(offer)}</div>
                                    </div>
                                    <div class="offer-actions">
                                      <span>${offer.priceValue ? `$${offer.priceValue.toFixed(2)}` : "Check"}</span>
                                      ${offer.productUrl ? `<a href="${escapeHtml(offer.productUrl)}" target="_blank" rel="noreferrer">Open</a>` : ""}
                                    </div>
                                  </div>
                                `,
                              )
                              .join("")}
                          </div>
                        </div>
                      </article>
                    `,
                  )
                  .join("")
              : `<article class="assistant-card"><strong>No offers match those filters</strong><p>Clear a filter or choose a broader condition/type.</p></article>`
          }
        </div>
      </div>
      <p class="supplier-footnote">${escapeHtml(lookup.searchAttempts?.length ? "Supplier offers are grouped by FCC, OEM, SKU, or part name so additional suppliers can compare under the same part." : "")}</p>
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
  const { vehicle, title, quick, bestSupplier, sourceBadge } = context;
  return `
    <section class="program-screen quick-guide">
      <div class="quick-vehicle">
        <p class="eyebrow">Screen 2</p>
        <h3>${escapeHtml(title || "Vehicle details unavailable")}</h3>
        <div class="vin-strip">
          <span>${escapeHtml(profile.vin)}</span>
          <span>${profile.vinDetails?.checkDigitValid ? "VIN OK" : "Check VIN"}</span>
          <span>${escapeHtml(sourceBadge)}</span>
        </div>
      </div>
      <div class="answer-grid">
        <article>
          <span>Body</span>
          <strong>${escapeHtml(vehicle.bodyClass || "Verify")}</strong>
          <p>${escapeHtml(vehicle.driveType || "Drive not decoded")}</p>
        </article>
        <article>
          <span>Engine</span>
          <strong>${escapeHtml(vehicle.engine || "Verify")}</strong>
          <p>${escapeHtml([vehicle.plantCity, vehicle.plantCountry].filter(Boolean).join(", ") || "Plant not decoded")}</p>
        </article>
        <article>
          <span>Likely key style</span>
          <strong>${escapeHtml(quick.keyType)}</strong>
          <p>${escapeHtml(profile.programmingReference?.immobilizerSystem || "Immobilizer not verified")}</p>
        </article>
        <article>
          <span>Live supplier</span>
          <strong>${escapeHtml(`${profile.liveSupplierLookup?.products?.length || 0} parts`)}</strong>
          <p>${escapeHtml(profile.liveSupplierLookup?.loginStatus || "Supplier search")}</p>
        </article>
        <article class="wide-answer">
          <span>Best catalog clue</span>
          <strong>${escapeHtml(bestSupplier?.hlPartNumber || bestSupplier?.supplierSku || "Needs match")}</strong>
          <p>${escapeHtml(bestSupplier ? `${bestSupplier.confidence} confidence - FCC ${bestSupplier.fccId || "verify"}` : "No catalog candidate yet")}</p>
        </article>
      </div>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-reset>New VIN</button>`,
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
          `<button class="secondary-action" type="button" data-vin-back="vehicle">Back to vehicle</button>`,
          `<button class="secondary-action" type="button" data-vin-reset>New VIN</button>`,
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
      </div>
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back to vehicle</button>`,
        `<button class="secondary-action" type="button" data-vin-reset>New VIN</button>`,
      ])}
    </section>
  `;
}

function renderKeyChoicesScreen(profile) {
  const products = profile.liveSupplierLookup?.products || [];
  ensureSelectedKeyFamily(products);
  const selectedProducts = productsForFamily(products, selectedKeyFamily);
  return `
    <section class="program-screen selected-parts-step">
      <div class="workflow-heading">
        <p class="eyebrow">Screen 4</p>
        <h3>${escapeHtml(keyFamilyLabel(selectedKeyFamily))}</h3>
        <p>${escapeHtml(`${selectedProducts.length} selected options shown, grouped for price and inventory comparison. Out-of-stock reference products stay visible.`)}</p>
      </div>
      ${renderSupplierComparison(profile.liveSupplierLookup, selectedProducts)}
      ${renderWorkflowActions([
        `<button class="secondary-action" type="button" data-vin-back="family">Back to key family</button>`,
        `<button class="secondary-action" type="button" data-vin-back="vehicle">Back to vehicle</button>`,
        `<button class="secondary-action" type="button" data-vin-reset>New VIN</button>`,
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
      : "Needs verification";

  const context = { vehicle, title, quick, bestSupplier, sourceBadge };
  if (vinWorkflowStep === "family") {
    vinResult.innerHTML = renderKeyFamilyScreen(profile);
  } else if (vinWorkflowStep === "parts") {
    vinResult.innerHTML = renderKeyChoicesScreen(profile);
  } else {
    vinWorkflowStep = "vehicle";
    vinResult.innerHTML = renderVehicleApprovalScreen(profile, context);
  }

  vinRecommendation.innerHTML = `
    <strong>${escapeHtml(profile.liveSupplierLookup?.loginStatus === "connected" ? "Live supplier connected" : "Supplier search fallback")}</strong>
    <p>${escapeHtml(profile.liveSupplierLookup?.statusMessage || "Current matches use imported Key Innovations labels until live supplier lookup is connected.")}</p>
    <div class="tag-row">
      <span>Key Innovations</span><span>${escapeHtml(`${profile.liveSupplierLookup?.products?.length || 0} live products`)}</span><span>Verify before ordering</span>
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

function renderVinError(message) {
  vinResult.innerHTML = `<div class="assistant-card"><strong>VIN decode failed</strong><p>${escapeHtml(message)}</p></div>`;
  vinRecommendation.innerHTML = `<strong>Check VIN</strong><p>Confirm the 17-character VIN from the dash tag, door sticker, registration, or RO.</p>`;
}

function renderChat() {
  chatLogElement.innerHTML = chatLog
    .map((message) => `<div class="message ${message.role}">${message.text}</div>`)
    .join("");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The app server returned ${response.status || "a non-JSON response"} for ${path}. On Render, deploy this as a Node web service with npm start, not a static site.`);
  }
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
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
  const resetButton = event.target.closest("[data-vin-reset]");
  if (resetButton) {
    resetVinWorkflow();
    return;
  }

  const backButton = event.target.closest("[data-vin-back]");
  if (backButton && latestVinProfile) {
    vinWorkflowStep = backButton.dataset.vinBack;
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    renderVinProfile(latestVinProfile);
    return;
  }

  const approveButton = event.target.closest("[data-approve-vehicle]");
  if (approveButton && latestVinProfile) {
    vinWorkflowStep = "family";
    renderVinProfile(latestVinProfile);
    return;
  }

  const familyButton = event.target.closest("[data-key-family]");
  if (familyButton && latestVinProfile) {
    selectedKeyFamily = familyButton.dataset.keyFamily;
    vinWorkflowStep = "parts";
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    renderVinProfile(latestVinProfile);
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
      const payload = await api("/api/supplier-accounts/key-innovations", {
        method: "POST",
        body: JSON.stringify({
          name: "Key Innovations",
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
    Object.values(liveProductFilters).forEach((selected) => selected.clear());
    vinResult.innerHTML = `
      <div class="lookup-loading">
        <article><strong>1. Decoding VIN</strong><p>Reading vehicle identity.</p></article>
        <article><strong>2. Searching keys</strong><p>Checking Key Innovations catalog candidates.</p></article>
      </div>
    `;
    const profile = await api(`/api/vin/${encodeURIComponent(vin)}`);
    renderVinProfile(profile);
  } catch (error) {
    renderVinError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

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
