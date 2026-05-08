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
  activeProbeResults: document.querySelector("#activeProbeResults"),
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
const activeProbeResults = [];
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

      const explainer = document.createElement("div");
      explainer.className = "detail-explainer";
      for (const paragraph of describeSignal(signal)) {
        const line = document.createElement("p");
        line.textContent = paragraph;
        explainer.append(line);
      }
      detailPanel.append(explainer);

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

function describeSignal(signal) {
  const value = valueToText(signal.value);
  const stateText = {
    available: "This observation returned a value during the local scan.",
    unavailable: "This observation was attempted passively, but the browser did not provide a usable value.",
    blocked: "This observation was refused or denied by the browser environment.",
    unsupported: "This browser does not appear to expose this capability here.",
    "not-requested": "This capability may exist, but the page deliberately did not activate it.",
  }[signal.state] || "This observation produced a restrained result.";

  const categoryText = {
    device: "Device telemetry helps compare the runtime shape of the browser, but it is not a hardware inventory.",
    environment: "Environment telemetry describes user-agent preferences and local presentation context.",
    graphics: "Rendering telemetry can help distinguish browser or GPU environments, and can be fingerprint-sensitive.",
    identity: "Identity-surface telemetry describes browser-exposed labels. It can be spoofed and should not be treated as proof.",
    input: "Input telemetry describes interaction capability, not the person using the device.",
    navigation: "Navigation telemetry explains how this page was reached and loaded inside this tab.",
    network: "Network telemetry is capability and coarse-status only; this page does not make outbound probes.",
    performance: "Performance telemetry is a local runtime gauge and varies with browser state.",
    permissions: "Permission telemetry reads browser permission state only and does not open prompts.",
    rendering: "Rendering telemetry is a small local sample, not a full rendering fingerprint.",
    security: "Security telemetry explains which browser protections or constraints apply to this page.",
    storage: "Storage telemetry describes capability or quota posture; this page does not write persistent data.",
    timeline: "Timeline telemetry helps reconstruct the page session sequence inside this tab.",
    "weak indicators": "Weak indicators are hints only. They are useful for triage, not attribution.",
  }[signal.category] || "This telemetry describes a browser-exposed surface.";

  const privacyText = {
    high: "Privacy note: treat this as sensitive. The result stays local and is included only in the on-page report/export.",
    medium: "Privacy note: this can contribute to browser fingerprinting, so the page keeps it local.",
    low: "Privacy note: this is relatively low sensitivity, but still remains local.",
    withheld: "Privacy note: the browser did not offer a timely value, and the page continued without inventing one.",
  }[signal.sensitivity || "low"];

  const proofText = signal.state === "available" && value
    ? `Observed value: ${value}. This is what the browser offered at scan time, not an independent verification.`
    : "Observed value: not offered. Absence is recorded without substituting a fake value.";

  return [stateText, categoryText, proofText, privacyText];
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

function safeMessage(error) {
  const name = error?.name || "withheld";
  if (name === "NotAllowedError") return "The browser refused on your behalf.";
  if (name === "NotFoundError") return "No matching surface was offered.";
  if (name === "NotSupportedError") return "This door does not exist here.";
  if (name === "SecurityError") return "The security context kept the door sealed.";
  return "The glass stayed dark.";
}

function recordActiveProbe(name, state, summary, details = [], sensitiveText = "", sensitiveLabel = "Raw revealed value") {
  const result = {
    name,
    state,
    summary,
    details,
    sensitiveText,
    sensitiveLabel,
    sensitiveTextIncluded: Boolean(sensitiveText),
    observedAt: new Date().toISOString(),
  };
  activeProbeResults.unshift(result);
  renderActiveProbeResults();
}

function renderActiveProbeResults() {
  els.activeProbeResults.replaceChildren(
    ...activeProbeResults.map((result) => {
      const card = document.createElement("article");
      card.className = "probe-result";
      card.dataset.state = result.state;

      const title = document.createElement("h3");
      title.textContent = result.name;

      const summary = document.createElement("p");
      summary.textContent = result.summary;

      const stamp = document.createElement("small");
      stamp.textContent = result.observedAt;

      card.append(title, summary, stamp);

      if (result.details.length) {
        const list = document.createElement("ul");
        for (const detail of result.details) {
          const item = document.createElement("li");
          item.textContent = detail;
          list.append(item);
        }
        card.append(list);
      }

      if (result.sensitiveTextIncluded) {
        const warning = document.createElement("p");
        warning.className = "sensitive-warning";
        warning.textContent = "Sensitive value revealed by explicit user action. Included in JSON export.";

        const label = document.createElement("p");
        label.className = "sensitive-label";
        label.textContent = result.sensitiveLabel;

        const pre = document.createElement("pre");
        pre.className = "sensitive-output";
        pre.textContent = result.sensitiveText;
        card.append(warning, label, pre);
      }

      return card;
    }),
  );
}

async function probeClipboard(button) {
  if (!navigator.clipboard?.readText) {
    recordActiveProbe("Clipboard text length", "unsupported", "The clipboard API was not offered here.");
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    recordActiveProbe(
      "Clipboard text length",
      "available",
      text ? `Clipboard text was readable: ${text.length} characters. Content was not retained.` : "Clipboard text was readable but empty.",
      ["The page measured length only.", "No clipboard content was written to the report."],
    );
  } catch (error) {
    recordActiveProbe("Clipboard text length", "blocked", safeMessage(error), ["No clipboard content was retained."]);
  }
}

async function probeClipboardContent() {
  if (!navigator.clipboard?.readText) {
    recordActiveProbe("Clipboard content", "unsupported", "The clipboard API was not offered here.");
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    const displayed = text.length ? text : "[clipboard text was empty]";
    recordActiveProbe(
      "Clipboard content",
      "available",
      text ? `Clipboard content was revealed locally: ${text.length} characters.` : "Clipboard text was readable but empty.",
      [
        "This probe was explicitly selected by the user.",
        "The value is displayed locally and included in the JSON export.",
      ],
      displayed,
      "Clipboard API returned this exact text",
    );
  } catch (error) {
    recordActiveProbe("Clipboard content", "blocked", safeMessage(error), ["No clipboard content was retained."]);
  }
}

async function probeGeolocation() {
  if (!navigator.geolocation?.getCurrentPosition) {
    recordActiveProbe("Location prompt", "unsupported", "Geolocation was not offered here.");
    return;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 10000,
      });
    });
    const coords = position.coords;
    recordActiveProbe(
      "Location prompt",
      "available",
      `Location answered with roughly ${Math.round(coords.accuracy)}m accuracy.`,
      [
        `Latitude: ${coords.latitude.toFixed(4)}`,
        `Longitude: ${coords.longitude.toFixed(4)}`,
        `Timestamp: ${new Date(position.timestamp).toISOString()}`,
      ],
    );
  } catch (error) {
    recordActiveProbe("Location prompt", "blocked", safeMessage(error), ["No coordinates were retained."]);
  }
}

async function probePreciseLocation() {
  if (!navigator.geolocation?.getCurrentPosition) {
    recordActiveProbe("Precise location", "unsupported", "Geolocation was not offered here.");
    return;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    });
    const coords = position.coords;
    const details = [
      `Latitude: ${coords.latitude}`,
      `Longitude: ${coords.longitude}`,
      `Accuracy meters: ${coords.accuracy}`,
      `Altitude: ${coords.altitude ?? "not offered"}`,
      `Altitude accuracy: ${coords.altitudeAccuracy ?? "not offered"}`,
      `Heading: ${coords.heading ?? "not offered"}`,
      `Speed: ${coords.speed ?? "not offered"}`,
      `Timestamp: ${new Date(position.timestamp).toISOString()}`,
    ];
    recordActiveProbe(
      "Precise location",
      "available",
      "Precise geolocation was revealed locally by explicit user action.",
      ["This may expose sensitive physical location.", "Included in JSON export."],
      details.join("\n"),
      "Geolocation API returned these fields",
    );
  } catch (error) {
    recordActiveProbe("Precise location", "blocked", safeMessage(error), ["No precise coordinates were retained."]);
  }
}

async function probeMediaDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    recordActiveProbe("Media device list", "unsupported", "Media device enumeration was not offered here.");
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const details = devices.map((device, index) => {
      const label = device.label || "label withheld";
      return `${index + 1}. ${device.kind}: ${label}`;
    });
    recordActiveProbe(
      "Media device list",
      "available",
      `${devices.length} media device entries were offered.`,
      details.length ? details : ["No devices were offered."],
    );
  } catch (error) {
    recordActiveProbe("Media device list", "blocked", safeMessage(error), ["No device list was retained."]);
  }
}

async function probeMediaIdentifiers() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    recordActiveProbe("Media identifiers", "unsupported", "Media device enumeration was not offered here.");
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const sensitive = devices.map((device, index) => [
      `Device ${index + 1}`,
      `kind: ${device.kind}`,
      `label: ${device.label || "label withheld"}`,
      `deviceId: ${device.deviceId || "not offered"}`,
      `groupId: ${device.groupId || "not offered"}`,
    ].join("\n")).join("\n\n");
    recordActiveProbe(
      "Media identifiers",
      devices.length ? "available" : "unavailable",
      devices.length
        ? `${devices.length} media device identifier records were revealed locally.`
        : "No media device identifiers were offered.",
      ["This can expose stable-ish device correlation data.", "Included in JSON export."],
      sensitive || "[no media identifiers were offered]",
      "MediaDevices API returned these identifiers",
    );
  } catch (error) {
    recordActiveProbe("Media identifiers", "blocked", safeMessage(error), ["No media identifiers were retained."]);
  }
}

function probeHiddenFields() {
  const selectors = [
    "input[type='hidden']",
    "input[type='password']",
    "input[aria-hidden='true']",
    "textarea[aria-hidden='true']",
    "[hidden]",
    "[aria-hidden='true']",
  ];
  const nodes = [...document.querySelectorAll(selectors.join(","))]
    .filter((node) => !node.closest("#activeProbeResults"));

  const sensitive = nodes.map((node, index) => {
    const tag = node.tagName.toLowerCase();
    const type = node.getAttribute("type") || "";
    const name = node.getAttribute("name") || "";
    const id = node.id || "";
    const value = "value" in node ? node.value : node.textContent;
    return [
      `Node ${index + 1}`,
      `selector: ${tag}${type ? `[type=${type}]` : ""}`,
      `id: ${id || "not offered"}`,
      `name: ${name || "not offered"}`,
      `value/text: ${value || "empty"}`,
    ].join("\n");
  }).join("\n\n");

  recordActiveProbe(
    "Page hidden fields",
    nodes.length ? "available" : "unavailable",
    nodes.length
      ? `${nodes.length} hidden or obscured current-page nodes were revealed.`
      : "No hidden or obscured fields were found in this page.",
    [
      "Scope is the current whispers document only.",
      "This cannot inspect other browser tabs, other sites, or cross-origin documents.",
    ],
    sensitive || "[no hidden or obscured fields were found]",
    "Current document hidden/obscured node values",
  );
}

async function probeWebRtcCandidates() {
  if (!window.RTCPeerConnection) {
    recordActiveProbe("WebRTC local candidates", "unsupported", "WebRTC was not offered here.");
    return;
  }

  const candidates = [];
  let peer;
  try {
    peer = new RTCPeerConnection({ iceServers: [] });
    peer.createDataChannel("whispers-local-check");
    peer.addEventListener("icecandidate", (event) => {
      if (event.candidate?.candidate) candidates.push(event.candidate.candidate);
    });
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await wait(1400);

    const details = candidates.map((candidate) => candidate.replace(/\s+/g, " ").trim());
    recordActiveProbe(
      "WebRTC local candidates",
      details.length ? "available" : "unavailable",
      details.length
        ? `${details.length} local ICE candidate strings were produced without STUN servers.`
        : "No local ICE candidates were offered.",
      details.length ? details : ["No STUN servers were configured.", "No external discovery request was made."],
    );
  } catch (error) {
    recordActiveProbe("WebRTC local candidates", "blocked", safeMessage(error), ["Peer connection was closed."]);
  } finally {
    if (peer) peer.close();
  }
}

async function probeKeyboardLayout() {
  if (!navigator.keyboard?.getLayoutMap) {
    recordActiveProbe("Keyboard layout map", "unsupported", "Keyboard layout map was not offered here.");
    return;
  }

  try {
    const layout = await navigator.keyboard.getLayoutMap();
    const keys = ["KeyA", "KeyQ", "KeyZ", "Digit1", "Minus", "Equal"];
    const details = keys.map((key) => `${key}: ${layout.get(key) || "not offered"}`);
    recordActiveProbe("Keyboard layout map", "available", "A small keyboard layout sample answered.", details);
  } catch (error) {
    recordActiveProbe("Keyboard layout map", "blocked", safeMessage(error), ["No layout values were retained."]);
  }
}

async function probePersistence() {
  if (!navigator.storage?.persist) {
    recordActiveProbe("Persistent storage request", "unsupported", "Persistent storage request was not offered here.");
    return;
  }

  try {
    const granted = await navigator.storage.persist();
    recordActiveProbe(
      "Persistent storage request",
      granted ? "available" : "blocked",
      granted ? "The browser granted persistent storage mode." : "The browser did not grant persistent storage mode.",
      ["The page did not write persistent data."],
    );
  } catch (error) {
    recordActiveProbe("Persistent storage request", "blocked", safeMessage(error), ["The page did not write persistent data."]);
  }
}

async function runActiveProbe(button) {
  const probe = button.dataset.probe;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Running...";
  try {
    if (probe === "clipboard") await probeClipboard(button);
    if (probe === "clipboard-content") await probeClipboardContent();
    if (probe === "geolocation") await probeGeolocation();
    if (probe === "precise-location") await probePreciseLocation();
    if (probe === "media") await probeMediaDevices();
    if (probe === "media-identifiers") await probeMediaIdentifiers();
    if (probe === "hidden-fields") probeHiddenFields();
    if (probe === "webrtc") await probeWebRtcCandidates();
    if (probe === "keyboard") await probeKeyboardLayout();
    if (probe === "persistence") await probePersistence();
  } finally {
    button.textContent = original;
    button.disabled = false;
  }
}

function buildReport() {
  const activeNames = new Set(activeProbeResults.map((result) => result.name));
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
      activePermissionPromptsOpened: activeNames.has("Location prompt"),
      clipboardReadAttempted: activeNames.has("Clipboard text length") || activeNames.has("Clipboard content"),
      clipboardContentRevealed: activeNames.has("Clipboard content"),
      mediaDeviceEnumerationAttempted: activeNames.has("Media device list"),
      mediaIdentifiersRevealed: activeNames.has("Media identifiers"),
      geolocationPromptAttempted: activeNames.has("Location prompt"),
      preciseLocationRevealed: activeNames.has("Precise location"),
      hiddenFieldsRevealed: activeNames.has("Page hidden fields"),
      webRtcIpDiscoveryAttempted: activeNames.has("WebRTC local candidates"),
      persistentStorageRequestAttempted: activeNames.has("Persistent storage request"),
    },
    activeProbes: activeProbeResults,
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
  for (const button of document.querySelectorAll(".probe-button")) {
    button.addEventListener("click", () => runActiveProbe(button));
  }

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
