const els = {
  tocList: document.querySelector("#tocList"),
  leadLine: document.querySelector("#leadLine"),
  narrativeText: document.querySelector("#narrativeText"),
  absenceLine: document.querySelector("#absenceLine"),
  scanProgressBar: document.querySelector("#scanProgressBar"),
  scanProgressText: document.querySelector("#scanProgressText"),
  scanStatus: document.querySelector("#scanStatus"),
  scanLog: document.querySelector("#scanLog"),
  scanOverlay: document.querySelector("#scanOverlay"),
  scanTargetGrid: document.querySelector("#scanTargetGrid"),
  ledgerStandby: document.querySelector("#ledgerStandby"),
  ledgerGrid: document.querySelector("#ledgerGrid"),
  exportReport: document.querySelector("#exportReport"),
  breadcrumbList: document.querySelector("#breadcrumbList"),
  machineryToggle: document.querySelector("#machineryToggle"),
  machineryPanel: document.querySelector("#machineryPanel"),
  categoryControls: document.querySelector("#categoryControls"),
  fingerprintHash: document.querySelector("#fingerprintHash"),
  instabilityNote: document.querySelector("#instabilityNote"),
  confessionsToggle: document.querySelector("#confessionsToggle"),
  confessionsPanel: document.querySelector("#confessionsPanel"),
  secondQuestionNote: document.querySelector("#secondQuestionNote"),
  marginSecret: document.querySelector("#marginSecret"),
};

window.WHISPERS_SESSION_STARTED_AT = window.WHISPERS_SESSION_STARTED_AT || new Date().toISOString();
let signals = [];
let discoveredSignals = [];
let machineryOpened = false;
let scanComplete = false;
const selectedCategories = new Set(["environment", "device"]);
const watchInstability = createToggleInstabilityWatcher(() => {
  els.instabilityNote.hidden = false;
});

function buildToc() {
  const sections = [...document.querySelectorAll("[data-toc]")].filter((section) => !section.hidden);
  els.tocList.replaceChildren(
    ...sections.map((section) => {
      if (!section.id) section.id = section.dataset.toc.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${section.id}`;
      link.textContent = section.dataset.toc;
      item.append(link);
      return item;
    }),
  );
}

function renderLedger() {
  els.ledgerStandby.hidden = scanComplete;
  const cards = signals.map((signal, index) => {
    const hasMore = Boolean(signal.source || signal.crumb?.length || signal.details?.length);
    const article = hasMore ? document.createElement("button") : document.createElement("article");
    article.className = "signal-card";
    article.dataset.state = signal.state;
    article.dataset.scanIndex = String(index);
    if (!scanComplete) article.classList.add("scan-pending");
    if (hasMore) {
      article.type = "button";
      article.classList.add("signal-card--button");
      article.setAttribute("aria-expanded", "false");
      if (!scanComplete) article.disabled = true;
    }

    const title = document.createElement("h3");
    title.textContent = signal.label;

    const sentence = document.createElement("p");
    sentence.textContent = signalSentence(signal);

    const value = valueToText(signal.value);
    if (value) {
      const valueEl = document.createElement("span");
      valueEl.className = "value";
      valueEl.textContent = value;
      sentence.append(valueEl);
    }

    const meta = document.createElement("p");
    meta.className = "signal-meta";
    meta.textContent = hasMore ? "Open telemetry" : `${signal.category} / ${signal.sensitivity || "low"}`;

    article.append(title, sentence, meta);
    if (hasMore) {
      const detailPanel = document.createElement("div");
      detailPanel.className = "signal-details";
      detailPanel.hidden = true;

      const source = document.createElement("p");
      source.className = "detail-source";
      source.textContent = signal.source || "browser surface";
      detailPanel.append(source);

      const facts = document.createElement("dl");
      facts.className = "detail-facts";
      for (const [name, data] of [
        ["State", signal.state],
        ["Category", signal.category],
        ["Sensitivity", signal.sensitivity || "low"],
      ]) {
        const term = document.createElement("dt");
        term.textContent = name;
        const description = document.createElement("dd");
        description.textContent = data;
        facts.append(term, description);
      }
      detailPanel.append(facts);

      if (signal.crumb?.length) {
        const trail = document.createElement("ol");
        trail.className = "detail-trail";
        for (const crumb of signal.crumb) {
          const item = document.createElement("li");
          item.textContent = crumb;
          trail.append(item);
        }
        detailPanel.append(trail);
      }

      if (signal.details?.length) {
        const subhead = document.createElement("p");
        subhead.className = "detail-subhead";
        subhead.textContent = "Offered entries";
        detailPanel.append(subhead);

      const list = document.createElement("ul");
      for (const plugin of signal.details) {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = plugin.name || "Unnamed plugin";
        item.append(name);

        const pieces = [plugin.description, plugin.filename].filter(Boolean);
        if (pieces.length) {
          const small = document.createElement("span");
          small.textContent = pieces.join(" / ");
          item.append(small);
        }
        list.append(item);
      }
      detailPanel.append(list);
      }
      article.append(detailPanel);
      article.addEventListener("click", () => {
        const open = detailPanel.hidden;
        detailPanel.hidden = !open;
        article.setAttribute("aria-expanded", String(open));
        meta.textContent = open ? "Close telemetry" : "Open telemetry";
      });
    }
    return article;
  });
  els.ledgerGrid.replaceChildren(...cards);
}

function setScanProgress(current, total, label) {
  const percent = total ? Math.round((current / total) * 100) : 0;
  els.scanProgressBar.style.width = `${percent}%`;
  els.scanProgressText.textContent = `${String(percent).padStart(2, "0")}%`;
  els.scanStatus.textContent = label;
}

function appendScanLog(text) {
  const item = document.createElement("li");
  item.textContent = text;
  els.scanLog.append(item);
  while (els.scanLog.children.length > 5) {
    els.scanLog.removeChild(els.scanLog.firstElementChild);
  }
}

function scanLineFor(signal) {
  const source = signal.source ? ` via ${signal.source}` : "";
  if (signal.state === "available") return `${signal.label}: signal locked${source}`;
  if (signal.state === "blocked") return `${signal.label}: refused on your behalf${source}`;
  if (signal.state === "not-requested") return `${signal.label}: left sealed${source}`;
  if (signal.state === "unsupported") return `${signal.label}: not supported here${source}`;
  return `${signal.label}: the glass stayed dark${source}`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function targetPosition(index) {
  const positions = [
    [7, 16],
    [68, 14],
    [40, 9],
    [12, 68],
    [72, 58],
    [51, 76],
    [24, 42],
    [82, 32],
    [5, 48],
    [62, 82],
    [31, 23],
    [78, 74],
  ];
  return positions[index % positions.length];
}

function renderScanTarget(signal, index) {
  const [left, top] = targetPosition(index);
  const target = document.createElement("div");
  target.className = "scan-target";
  target.dataset.state = signal.state;
  target.style.setProperty("--target-left", `${left}%`);
  target.style.setProperty("--target-top", `${top}%`);

  const label = document.createElement("strong");
  label.textContent = signal.label;

  const status = document.createElement("span");
  status.textContent = signal.state === "available" ? "LOCK" : signal.state.toUpperCase();

  const source = document.createElement("small");
  source.textContent = signal.source || "browser surface";

  target.append(label, status, source);
  els.scanTargetGrid.append(target);

  while (els.scanTargetGrid.children.length > 12) {
    els.scanTargetGrid.removeChild(els.scanTargetGrid.firstElementChild);
  }
}

async function runScanSequence() {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const delay = reducedMotion ? 0 : 260;
  const total = signals.length;

  discoveredSignals = [];
  els.ledgerGrid.replaceChildren();
  els.scanTargetGrid.replaceChildren();
  els.scanOverlay.hidden = false;
  els.scanOverlay.classList.remove("scan-overlay--complete");
  els.ledgerStandby.hidden = false;
  els.ledgerStandby.textContent = "Local sweep running. Report modules withheld.";
  renderBreadcrumbs();

  setScanProgress(0, total, "Local sweep armed. Reading quiet surfaces.");
  appendScanLog("No outbound channel opened.");

  for (let index = 0; index < signals.length; index += 1) {
    const signal = signals[index];
    if (!reducedMotion) await wait(delay + (index % 5) * 80);
    discoveredSignals.push(signal);
    renderScanTarget(signal, index);
    renderBreadcrumbs();
    appendScanLog(scanLineFor(signal));
    setScanProgress(index + 1, total, `Discovering source trail ${index + 1} of ${total}.`);
  }

  scanComplete = true;
  setScanProgress(total, total, "Report compiled. Telemetry remains local.");
  appendScanLog("Report ready. Revealing telemetry modules.");
  if (!reducedMotion) await wait(650);
  els.scanOverlay.classList.add("scan-overlay--complete");
  renderNarrative();
  renderLedger();
  renderBreadcrumbs();
  renderCategoryControls();
  await updateFingerprint();
  els.exportReport.disabled = false;
  els.ledgerStandby.hidden = true;
  if (!reducedMotion) await wait(700);
  els.scanOverlay.hidden = true;
}

function renderBreadcrumbs() {
  const visibleSignals = scanComplete ? signals : discoveredSignals;
  const rows = visibleSignals.map((signal) => {
    const item = document.createElement("article");
    item.className = "breadcrumb-item";

    const title = document.createElement("h3");
    title.textContent = signal.label;

    const source = document.createElement("p");
    source.className = "breadcrumb-source";
    source.textContent = signal.source || "browser surface";

    const trail = document.createElement("ol");
    for (const crumb of signal.crumb || []) {
      const step = document.createElement("li");
      step.textContent = crumb;
      trail.append(step);
    }

    item.append(title, source, trail);
    return item;
  });
  els.breadcrumbList.replaceChildren(...rows);
}

function renderNarrative() {
  const lateLine = hourLine();
  if (lateLine) els.leadLine.textContent = lateLine;
  els.narrativeText.textContent = buildNarrative(signals);

  const absence = absenceLine(signals);
  els.absenceLine.hidden = !absence;
  els.absenceLine.textContent = absence;
}

function renderCategoryControls() {
  const categories = [...new Set(signals.map((signal) => signal.category))].sort();
  els.categoryControls.replaceChildren(
    ...categories.map((category) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = category;
      input.checked = selectedCategories.has(category);
      input.addEventListener("change", () => {
        if (input.checked) selectedCategories.add(category);
        else selectedCategories.delete(category);
        watchInstability();
        updateFingerprint();
      });
      label.append(input, document.createTextNode(category));
      return label;
    }),
  );
}

function buildReport() {
  return {
    report: "whispers local telemetry scan",
    generatedAt: new Date().toISOString(),
    sessionStartedAt: window.WHISPERS_SESSION_STARTED_AT,
    location: {
      protocol: window.location.protocol,
      origin: window.location.origin === "null" ? "not offered" : window.location.origin,
      pathname: window.location.pathname,
    },
    privacy: {
      networkCallsMadeByPage: false,
      persistentStorageWritesMadeByPage: false,
      activePermissionPromptsOpened: false,
      clipboardReadAttempted: false,
      mediaDeviceEnumerationAttempted: false,
      geolocationPromptAttempted: false,
      webRtcIpDiscoveryAttempted: false,
    },
    signals: signals.map((signal) => ({
      label: signal.label,
      category: signal.category,
      state: signal.state,
      value: valueToText(signal.value) || "not offered",
      source: signal.source || "browser surface",
      sensitivity: signal.sensitivity || "low",
      detail: signal.detail || "",
      breadcrumb: signal.crumb || [],
      entries: signal.details || [],
    })),
  };
}

function downloadReport() {
  const blob = new Blob([JSON.stringify(buildReport(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `whispers-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function digest(text) {
  if (!crypto?.subtle) return "Hashing is not supported here.";
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buffer)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function updateFingerprint() {
  const parts = signals
    .filter((signal) => selectedCategories.has(signal.category))
    .filter((signal) => valueToText(signal.value))
    .map((signal) => `${signal.category}:${signal.label}:${valueToText(signal.value)}`)
    .sort();

  if (!parts.length) {
    els.fingerprintHash.textContent = "No selected category produced a value. The glass stayed dark.";
    return;
  }

  const hash = await digest(parts.join("|"));
  els.fingerprintHash.textContent = `local hash: ${hash}`;
}

function setDisclosure(button, panel, open) {
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Close" : "Open";
  panel.hidden = !open;
  buildToc();
}

function bindDisclosures() {
  els.exportReport.addEventListener("click", downloadReport);

  els.machineryToggle.addEventListener("click", () => {
    const open = els.machineryPanel.hidden;
    machineryOpened = machineryOpened || open;
    setDisclosure(els.machineryToggle, els.machineryPanel, open);
  });

  els.confessionsToggle.addEventListener("click", () => {
    const open = els.confessionsPanel.hidden;
    setDisclosure(els.confessionsToggle, els.confessionsPanel, open);
    if (open && machineryOpened) els.secondQuestionNote.hidden = false;
  });
}

async function init() {
  bindDisclosures();
  initEasterEggs({
    onKonami: () => revealBriefly(els.marginSecret),
  });

  signals = await collectSignals();
  els.narrativeText.textContent = "The scan is still moving. The report is withheld until the sweep finishes.";
  els.absenceLine.hidden = true;
  els.ledgerGrid.replaceChildren();
  renderBreadcrumbs();
  buildToc();
  await runScanSequence();

  window.addEventListener("resize", async () => {
    const viewport = signals.find((signal) => signal.label === "Viewport");
    if (!viewport) return;
    viewport.value = `${window.innerWidth} x ${window.innerHeight}`;
    renderLedger();
    renderBreadcrumbs();
    await updateFingerprint();
  });
}

init();
