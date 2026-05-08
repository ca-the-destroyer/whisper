function safeSignal(label, category, collect, fallbackSource = "guarded collector") {
  try {
    return collect();
  } catch {
    return {
      label,
      category,
      state: STATES.unavailable,
      detail: "The instrument slipped back into its case.",
      source: fallbackSource,
      sensitivity: "withheld",
      crumb: ["collector guarded", "exception hidden", "narrative softened"],
    };
  }
}

function makeSignal(label, category, state, value, detail, source, sensitivity = "low", crumb = []) {
  return {
    label,
    category,
    state,
    value,
    detail,
    source,
    sensitivity,
    crumb: crumb.length ? crumb : [source || "browser surface", state],
  };
}

function numberSignal(value, formatter) {
  return Number.isFinite(value) ? formatter(value) : "";
}

function listCount(listLike) {
  if (!listLike || !Number.isFinite(listLike.length)) return "";
  return listLike.length;
}

function asyncFallback(label, category, source) {
  return makeSignal(
    label,
    category,
    STATES.unavailable,
    "",
    "The glass stayed dark.",
    source,
    "withheld",
    ["asked locally", "no timely answer", "scan continued"],
  );
}

function withTimeout(promise, fallback, delay = 900) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(fallback), delay);
    }),
  ]);
}

function getCanvasSignal() {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 60;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return makeSignal(
      "Canvas echo",
      "graphics",
      STATES.unsupported,
      "",
      "The canvas kept its mouth closed.",
      "HTMLCanvasElement.getContext",
      "medium",
      ["created a disposable canvas", "asked for a 2D context", "kept no image"],
    );
  }

  ctx.textBaseline = "top";
  ctx.font = "18px serif";
  ctx.fillStyle = "#d4a44d";
  ctx.fillRect(0, 0, 220, 60);
  ctx.fillStyle = "#101113";
  ctx.fillText("whispers", 12, 18);
  const sample = ctx.getImageData(0, 0, 12, 12).data;
  let sum = 0;
  for (let index = 0; index < sample.length; index += 1) sum = (sum + sample[index] * (index + 1)) % 65535;
  return makeSignal(
    "Canvas echo",
    "graphics",
    STATES.available,
    `local sample ${sum.toString(16).padStart(4, "0")}`,
    "A disposable canvas left a small echo.",
    "CanvasRenderingContext2D.getImageData",
    "medium",
    ["drew text locally", "sampled a tiny pixel region", "discarded the canvas"],
  );
}

function getWebGlSignal() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    return makeSignal(
      "Graphics hand",
      "graphics",
      STATES.unsupported,
      "",
      "The machine declined to name its hand.",
      "HTMLCanvasElement.getContext(webgl)",
      "medium",
      ["created a disposable canvas", "asked for WebGL", "no renderer surfaced"],
    );
  }

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  if (!debugInfo) {
    return makeSignal(
      "Graphics hand",
      "graphics",
      STATES.unavailable,
      "",
      "The machine kept its maker behind the curtain.",
      "WEBGL_debug_renderer_info",
      "medium",
      ["WebGL answered", "debug renderer extension stayed closed"],
    );
  }

  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  return makeSignal(
    "Graphics hand",
    "graphics",
    STATES.available,
    [vendor, renderer],
    "The machine named the hand that draws.",
    "WEBGL_debug_renderer_info",
    "medium",
    ["WebGL answered", "debug extension answered", "vendor and renderer stayed local"],
  );
}

async function getStorageSignal() {
  if (!navigator.storage?.estimate) {
    return makeSignal(
      "Storage estimate",
      "storage",
      STATES.unsupported,
      "",
      "The pantry kept no public inventory.",
      "navigator.storage.estimate",
      "medium",
      ["looked for StorageManager", "estimate was not offered"],
    );
  }

  const estimate = await navigator.storage.estimate();
  const quota = Number.isFinite(estimate.quota) ? estimate.quota : 0;
  const usage = Number.isFinite(estimate.usage) ? estimate.usage : 0;
  if (!quota) {
    return makeSignal(
      "Storage estimate",
      "storage",
      STATES.unavailable,
      "",
      "The pantry declined to count its shelves.",
      "navigator.storage.estimate",
      "medium",
      ["StorageManager answered", "quota stayed unnamed"],
    );
  }

  const usedMb = Math.round(usage / 1024 / 1024);
  const quotaMb = Math.round(quota / 1024 / 1024);
  return makeSignal(
    "Storage estimate",
    "storage",
    STATES.available,
    `${usedMb} MB used of roughly ${quotaMb} MB`,
    "The pantry offered a rough inventory.",
    "navigator.storage.estimate",
    "medium",
    ["called estimate", "rounded bytes to megabytes", "kept the number local"],
  );
}

async function getPermissionSignal(name, label) {
  if (!navigator.permissions?.query) {
    return makeSignal(
      label,
      "permissions",
      STATES.unsupported,
      "",
      "The permission desk was not offered here.",
      `navigator.permissions.query(${name})`,
      "medium",
      ["looked for Permissions API", "query was not offered"],
    );
  }

  try {
    const result = await navigator.permissions.query({ name });
    if (result.state === "denied") {
      return makeSignal(
        label,
        "permissions",
        STATES.blocked,
        "",
        "The browser refused on your behalf.",
        `navigator.permissions.query(${name})`,
        "medium",
        ["asked permission state only", "did not request access", "state was denied"],
      );
    }
    return makeSignal(
      label,
      "permissions",
      STATES.available,
      result.state,
      "The permission desk answered.",
      `navigator.permissions.query(${name})`,
      "medium",
      ["asked permission state only", "did not request access", "state answered"],
    );
  } catch {
    return makeSignal(
      label,
      "permissions",
      STATES.unavailable,
      "",
      "The permission desk closed the folder.",
      `navigator.permissions.query(${name})`,
      "medium",
      ["asked permission state only", "query was withheld"],
    );
  }
}

async function getBatterySignal() {
  if (!navigator.getBattery) {
    return makeSignal(
      "Battery",
      "device",
      STATES.unsupported,
      "",
      "The battery did not answer.",
      "navigator.getBattery",
      "high",
      ["looked for Battery Status API", "door was absent"],
    );
  }

  try {
    const battery = await navigator.getBattery();
    const level = Number.isFinite(battery.level) ? `${Math.round(battery.level * 100)}%` : "";
    const charging = typeof battery.charging === "boolean" ? (battery.charging ? "charging" : "not charging") : "";
    const value = [level, charging].filter(Boolean).join(", ");
    return value
      ? makeSignal(
          "Battery",
          "device",
          STATES.available,
          value,
          "The battery answered in a low voice.",
          "navigator.getBattery",
          "high",
          ["called Battery Status API", "rounded the level", "kept charge state local"],
        )
      : makeSignal(
          "Battery",
          "device",
          STATES.unavailable,
          "",
          "The battery did not answer.",
          "navigator.getBattery",
          "high",
          ["called Battery Status API", "fields stayed dark"],
        );
  } catch {
    return makeSignal(
      "Battery",
      "device",
      STATES.blocked,
      "",
      "The battery did not answer.",
      "navigator.getBattery",
      "high",
      ["called Battery Status API", "browser refused"],
    );
  }
}

function getUserAgentSignals() {
  const data = navigator.userAgentData;
  if (data) {
    return [
      makeSignal(
        "Browser brands",
        "identity",
        STATES.available,
        data.brands?.map((brand) => `${brand.brand} ${brand.version}`) || "",
        "The browser offered a name tag with the edges sanded off.",
        "navigator.userAgentData.brands",
        "medium",
        ["read low-entropy client hints", "kept brands local"],
      ),
      makeSignal(
        "Mobile hint",
        "device",
        STATES.available,
        data.mobile,
        "The browser said whether it travels light.",
        "navigator.userAgentData.mobile",
        "low",
        ["read low-entropy client hint", "no high-entropy request made"],
      ),
      makeSignal(
        "Platform hint",
        "identity",
        data.platform ? STATES.available : STATES.unavailable,
        data.platform || "",
        data.platform ? "The platform gave a broad alias." : "The platform kept its alias folded.",
        "navigator.userAgentData.platform",
        "medium",
        ["read low-entropy client hint", "no high-entropy request made"],
      ),
    ];
  }

  return [
    makeSignal(
      "User agent",
      "identity",
      navigator.userAgent ? STATES.available : STATES.unavailable,
      navigator.userAgent || "",
      navigator.userAgent ? "The old name tag was still pinned on." : "The old name tag was missing.",
      "navigator.userAgent",
      "medium",
      ["read legacy user agent string", "kept full string local"],
    ),
  ];
}

function supportSignal(label, category, supported, source, detailSupported, detailMissing, sensitivity = "medium") {
  return makeSignal(
    label,
    category,
    supported ? STATES.available : STATES.unsupported,
    supported ? "supported" : "",
    supported ? detailSupported : detailMissing,
    source,
    sensitivity,
    supported
      ? ["capability detected", "no active probe run", "state stayed local"]
      : ["capability checked", "not offered here"],
  );
}

function getStorageCapabilitySignals() {
  let indexedDbSupported = false;
  try {
    indexedDbSupported = Boolean(window.indexedDB);
  } catch {
    indexedDbSupported = false;
  }

  let localStorageSupported = false;
  try {
    localStorageSupported = Boolean(window.localStorage);
  } catch {
    localStorageSupported = false;
  }

  let sessionStorageSupported = false;
  try {
    sessionStorageSupported = Boolean(window.sessionStorage);
  } catch {
    sessionStorageSupported = false;
  }

  return [
    supportSignal(
      "IndexedDB capability",
      "storage",
      indexedDbSupported,
      "window.indexedDB",
      "The local database door exists. The page did not open it.",
      "The local database door was not offered.",
      "medium",
    ),
    supportSignal(
      "Cache API capability",
      "storage",
      Boolean(window.caches),
      "window.caches",
      "The cache shelf exists. The page did not write to it.",
      "The cache shelf was not offered.",
      "medium",
    ),
    supportSignal(
      "Local storage capability",
      "storage",
      localStorageSupported,
      "window.localStorage",
      "Persistent key-value storage exists. The page did not write to it.",
      "Persistent key-value storage was not offered.",
      "high",
    ),
    supportSignal(
      "Session storage capability",
      "storage",
      sessionStorageSupported,
      "window.sessionStorage",
      "Tab-scoped storage exists. The page did not write to it.",
      "Tab-scoped storage was not offered.",
      "medium",
    ),
  ];
}

function getSecurityContextSignals() {
  const protocol = window.location.protocol || "";
  const origin = window.location.origin === "null" ? "" : window.location.origin;
  return [
    makeSignal(
      "Secure context",
      "security",
      STATES.available,
      window.isSecureContext ? "secure" : "not secure",
      window.isSecureContext ? "The browser marked this as a secure context." : "Some doors stay closed outside a secure context.",
      "window.isSecureContext",
      "low",
      ["read security context flag", "explains API availability"],
    ),
    makeSignal(
      "Protocol",
      "security",
      protocol ? STATES.available : STATES.unavailable,
      protocol || "",
      protocol ? "The page named its transport shell." : "The transport shell stayed unnamed.",
      "window.location.protocol",
      "low",
      ["read current protocol", "no navigation performed"],
    ),
    makeSignal(
      "Origin",
      "security",
      origin ? STATES.available : STATES.unavailable,
      origin || "",
      origin ? "The page named its origin." : "The origin was not offered here.",
      "window.location.origin",
      "medium",
      ["read current origin", "file pages may report no origin"],
    ),
    makeSignal(
      "Cross-origin isolation",
      "security",
      STATES.available,
      window.crossOriginIsolated ? "isolated" : "not isolated",
      window.crossOriginIsolated ? "The page is cross-origin isolated." : "The page is not cross-origin isolated.",
      "window.crossOriginIsolated",
      "low",
    ),
  ];
}

function getTimelineSignals(navEntry) {
  const resources = performance.getEntriesByType?.("resource") || [];
  const paints = performance.getEntriesByType?.("paint") || [];
  const started = window.WHISPERS_SESSION_STARTED_AT || "";
  return [
    makeSignal(
      "Scan started",
      "timeline",
      started ? STATES.available : STATES.unavailable,
      started,
      started ? "The session start marker was set before collection." : "The start marker was not offered.",
      "window.WHISPERS_SESSION_STARTED_AT",
      "low",
      ["created in memory", "not persisted", "included in export"],
    ),
    makeSignal(
      "Document readiness",
      "timeline",
      STATES.available,
      document.readyState,
      "The document reported its readiness state.",
      "document.readyState",
      "low",
    ),
    makeSignal(
      "Visibility state",
      "timeline",
      STATES.available,
      document.visibilityState,
      "The page reported whether it was visible at scan time.",
      "document.visibilityState",
      "low",
    ),
    makeSignal(
      "Focus state",
      "timeline",
      STATES.available,
      document.hasFocus() ? "focused" : "not focused",
      "The page reported whether it held focus at scan time.",
      "document.hasFocus",
      "low",
    ),
    makeSignal(
      "Resource timing count",
      "timeline",
      STATES.available,
      `${resources.length} entries`,
      "The performance ledger counted locally loaded resources.",
      "performance.getEntriesByType(resource)",
      "medium",
      ["read resource timing entries", "did not fetch anything new"],
    ),
    makeSignal(
      "Paint timing",
      "timeline",
      paints.length ? STATES.available : STATES.unavailable,
      paints.map((entry) => `${entry.name}: ${Math.round(entry.startTime)} ms`),
      paints.length ? "The renderer offered paint timing." : "The renderer offered no paint timing.",
      "performance.getEntriesByType(paint)",
      "low",
    ),
    makeSignal(
      "Unload timing",
      "timeline",
      navEntry && Number.isFinite(navEntry.duration) ? STATES.available : STATES.unavailable,
      navEntry && Number.isFinite(navEntry.duration) ? `${Math.round(navEntry.duration)} ms observed so far` : "",
      navEntry && Number.isFinite(navEntry.duration) ? "The navigation entry reported a local duration." : "The navigation duration stayed dark.",
      "PerformanceNavigationTiming.duration",
      "low",
    ),
  ];
}

function getInputCapabilitySignals() {
  const hoverQuery = window.matchMedia?.("(hover: hover)");
  const anyPointerFine = window.matchMedia?.("(any-pointer: fine)");
  return [
    makeSignal(
      "Hover capability",
      "input",
      STATES.available,
      hoverQuery?.matches ? "hover available" : "hover not primary",
      "The page read whether hover is part of the primary input.",
      "matchMedia(hover)",
      "low",
    ),
    makeSignal(
      "Any fine pointer",
      "input",
      STATES.available,
      anyPointerFine?.matches ? "fine pointer present" : "fine pointer not offered",
      "The page checked whether any precise pointer is present.",
      "matchMedia(any-pointer)",
      "low",
    ),
    supportSignal(
      "Keyboard API capability",
      "input",
      Boolean(navigator.keyboard),
      "navigator.keyboard",
      "The Keyboard API exists. The page did not request layout details.",
      "The Keyboard API was not offered.",
      "medium",
    ),
    supportSignal(
      "Gamepad API capability",
      "input",
      Boolean(navigator.getGamepads),
      "navigator.getGamepads",
      "The Gamepad API exists. The page did not poll devices.",
      "The Gamepad API was not offered.",
      "medium",
    ),
  ];
}

function getNetworkCapabilitySignals() {
  return [
    supportSignal(
      "Service worker capability",
      "network",
      Boolean(navigator.serviceWorker),
      "navigator.serviceWorker",
      "Service workers are supported. The page did not register one.",
      "Service workers were not offered here.",
      "medium",
    ),
    supportSignal(
      "WebRTC capability",
      "network",
      Boolean(window.RTCPeerConnection),
      "window.RTCPeerConnection",
      "WebRTC exists. The page did not create a peer connection or probe IPs.",
      "WebRTC was not offered here.",
      "high",
    ),
    supportSignal(
      "Beacon capability",
      "network",
      Boolean(navigator.sendBeacon),
      "navigator.sendBeacon",
      "Beacon transport exists. The page did not send one.",
      "Beacon transport was not offered.",
      "high",
    ),
  ];
}

function getWeakIndicatorSignals() {
  const ua = navigator.userAgent || "";
  const webdriver = navigator.webdriver;
  const headlessHint = /HeadlessChrome|Headless/i.test(ua);
  const tinyViewport = window.innerWidth <= 800 && window.innerHeight <= 650;
  return [
    makeSignal(
      "WebDriver flag",
      "weak indicators",
      typeof webdriver === "boolean" ? STATES.available : STATES.unavailable,
      typeof webdriver === "boolean" ? (webdriver ? "true" : "false") : "",
      typeof webdriver === "boolean" ? "The browser exposed an automation hint. This is not proof by itself." : "No WebDriver flag was offered.",
      "navigator.webdriver",
      "high",
      ["read weak automation hint", "do not treat as proof"],
    ),
    makeSignal(
      "Headless user-agent hint",
      "weak indicators",
      STATES.available,
      headlessHint ? "present" : "not present",
      headlessHint ? "The user agent contains a headless hint." : "No headless token appeared in the user agent.",
      "navigator.userAgent",
      "medium",
      ["read user agent token", "weak indicator only"],
    ),
    makeSignal(
      "Small viewport hint",
      "weak indicators",
      STATES.available,
      tinyViewport ? "small viewport" : "ordinary viewport",
      tinyViewport ? "The viewport is small enough to be automation-like or simply compact." : "The viewport size is not especially small.",
      "window.innerWidth / innerHeight",
      "low",
      ["read viewport dimensions", "weak indicator only"],
    ),
  ];
}

function getFontSignals() {
  if (!document.fonts?.check) {
    return [
      makeSignal(
        "Font check capability",
        "rendering",
        STATES.unsupported,
        "",
        "The Font Loading API was not offered.",
        "document.fonts.check",
        "medium",
      ),
    ];
  }

  const candidates = ["Arial", "Calibri", "Consolas", "Courier New", "Times New Roman", "Segoe UI"];
  const offered = candidates.filter((font) => document.fonts.check(`12px "${font}"`));
  return [
    makeSignal(
      "Font availability sample",
      "rendering",
      offered.length ? STATES.available : STATES.unavailable,
      offered.length ? offered : "",
      offered.length ? "A small common-font sample answered." : "The common-font sample stayed dark.",
      "document.fonts.check",
      "high",
      ["checked six common names", "no broad font enumeration", "kept result local"],
    ),
  ];
}

async function collectSignals() {
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const colorQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const pointerQuery = window.matchMedia?.("(pointer: coarse)");
  const contrastQuery = window.matchMedia?.("(prefers-contrast: more)");
  const transparencyQuery = window.matchMedia?.("(prefers-reduced-transparency: reduce)");
  const navEntry = performance.getEntriesByType?.("navigation")?.[0];
  const signals = [
    ...getSecurityContextSignals(),
    ...getTimelineSignals(navEntry),
    safeSignal("Local hour", "environment", () =>
      makeSignal("Local hour", "environment", STATES.available, new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }), "The clock answered without leaving the room.", "Date.toLocaleTimeString", "low", [
        "read local browser time",
        "formatted hour and minute",
        "sent nowhere",
      ]),
    ),
    safeSignal("Time zone", "environment", () => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return zone
        ? makeSignal("Time zone", "environment", STATES.available, zone, "The calendar named its weather.", "Intl.DateTimeFormat", "medium", [
            "resolved local date options",
            "read time zone label",
          ])
        : makeSignal("Time zone", "environment", STATES.unavailable, "", "The calendar folded the map.", "Intl.DateTimeFormat", "medium");
    }),
    safeSignal("Language", "environment", () =>
      navigator.language
        ? makeSignal("Language", "environment", STATES.available, navigator.language, "The browser spoke a preference.", "navigator.language", "low", [
            "read primary language",
            "did not inspect content",
          ])
        : makeSignal("Language", "environment", STATES.unavailable, "", "The browser did not choose a tongue.", "navigator.language", "low"),
    ),
    safeSignal("Languages", "environment", () =>
      navigator.languages?.length
        ? makeSignal("Languages", "environment", STATES.available, navigator.languages, "The browser laid out its preferred tongues.", "navigator.languages", "medium", [
            "read language preference list",
            "kept order local",
          ])
        : makeSignal("Languages", "environment", STATES.unavailable, "", "The language list stayed folded.", "navigator.languages", "medium"),
    ),
    safeSignal("Viewport", "device", () =>
      makeSignal(
        "Viewport",
        "device",
        STATES.available,
        `${window.innerWidth} x ${window.innerHeight}`,
        "The pane measured itself.",
        "window.innerWidth / innerHeight",
        "low",
        ["read layout viewport", "updates on resize"],
      ),
    ),
    safeSignal("Screen", "device", () =>
      makeSignal(
        "Screen",
        "device",
        STATES.available,
        `${screen.width} x ${screen.height}`,
        "The screen gave the size of the stage.",
        "screen.width / screen.height",
        "medium",
        ["read screen dimensions", "did not inspect other windows"],
      ),
    ),
    safeSignal("Available screen", "device", () =>
      makeSignal(
        "Available screen",
        "device",
        STATES.available,
        `${screen.availWidth} x ${screen.availHeight}`,
        "The screen marked the part not already claimed.",
        "screen.availWidth / availHeight",
        "medium",
        ["read available screen dimensions", "did not inspect apps"],
      ),
    ),
    safeSignal("Pixel ratio", "device", () =>
      makeSignal(
        "Pixel ratio",
        "device",
        STATES.available,
        numberSignal(window.devicePixelRatio, (value) => `${value}x`),
        "The glass counted its density.",
        "window.devicePixelRatio",
        "medium",
      ),
    ),
    safeSignal("Color depth", "graphics", () =>
      makeSignal(
        "Color depth",
        "graphics",
        STATES.available,
        numberSignal(screen.colorDepth, (value) => `${value} bits`),
        "The glass named its color depth.",
        "screen.colorDepth",
        "low",
      ),
    ),
    safeSignal("CPU threads", "device", () =>
      Number.isFinite(navigator.hardwareConcurrency)
        ? makeSignal("CPU threads", "device", STATES.available, navigator.hardwareConcurrency, "The engine counted some teeth.", "navigator.hardwareConcurrency", "medium")
        : makeSignal("CPU threads", "device", STATES.unavailable, "", "The engine would not count its teeth.", "navigator.hardwareConcurrency", "medium"),
    ),
    safeSignal("Device memory", "device", () =>
      Number.isFinite(navigator.deviceMemory)
        ? makeSignal("Device memory", "device", STATES.available, `${navigator.deviceMemory} GB`, "The asset reported rounded memory.", "navigator.deviceMemory", "medium")
        : makeSignal("Device memory", "device", STATES.unsupported, "", "The memory drawer has no handle here.", "navigator.deviceMemory", "medium"),
    ),
    safeSignal("Cookies", "storage", () =>
      makeSignal(
        "Cookies",
        "storage",
        STATES.available,
        navigator.cookieEnabled ? "enabled" : "not offered",
        navigator.cookieEnabled ? "The cookie jar exists, though this page leaves it shut." : "The cookie jar was not offered.",
        "navigator.cookieEnabled",
        "medium",
        ["read cookie capability flag", "created no cookies"],
      ),
    ),
    safeSignal("Do Not Track", "identity", () => {
      const value = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      return value
        ? makeSignal("Do Not Track", "identity", STATES.available, value, "A boundary flag was visible.", "navigator.doNotTrack", "medium")
        : makeSignal("Do Not Track", "identity", STATES.unavailable, "", "No boundary flag was offered.", "navigator.doNotTrack", "medium");
    }),
    ...getStorageCapabilitySignals(),
    safeSignal("Color scheme", "environment", () =>
      makeSignal(
        "Color scheme",
        "environment",
        STATES.available,
        colorQuery?.matches ? "dark" : "light",
        "The room named its preferred light.",
        "matchMedia(prefers-color-scheme)",
        "low",
      ),
    ),
    safeSignal("Reduced motion", "environment", () =>
      makeSignal(
        "Reduced motion",
        "environment",
        STATES.available,
        motionQuery?.matches ? "requested" : "not requested",
        motionQuery?.matches
          ? "The page moved less because you asked the world to."
          : "The page found no request to slow down.",
        "matchMedia(prefers-reduced-motion)",
        "low",
      ),
    ),
    safeSignal("Contrast", "environment", () =>
      makeSignal(
        "Contrast",
        "environment",
        STATES.available,
        contrastQuery?.matches ? "more requested" : "not requested",
        contrastQuery?.matches ? "The page heard a request for sharper edges." : "No stronger contrast request was offered.",
        "matchMedia(prefers-contrast)",
        "low",
      ),
    ),
    safeSignal("Transparency", "environment", () =>
      makeSignal(
        "Transparency",
        "environment",
        transparencyQuery?.matches ? STATES.available : STATES.unavailable,
        transparencyQuery?.matches ? "reduced" : "",
        transparencyQuery?.matches ? "The page heard a request for less glass." : "The transparency preference was not offered here.",
        "matchMedia(prefers-reduced-transparency)",
        "low",
      ),
    ),
    safeSignal("Pointer", "device", () =>
      makeSignal(
        "Pointer",
        "device",
        STATES.available,
        pointerQuery?.matches ? "coarse" : "fine",
        "The page felt the shape of the hand, not the hand itself.",
        "matchMedia(pointer)",
        "low",
      ),
    ),
    safeSignal("Touch points", "device", () =>
      makeSignal(
        "Touch points",
        "device",
        STATES.available,
        numberSignal(navigator.maxTouchPoints, (value) => value),
        "The glass counted how many fingers it might hear.",
        "navigator.maxTouchPoints",
        "medium",
      ),
    ),
    ...getInputCapabilitySignals(),
    safeSignal("Online flag", "network",
      () => makeSignal(
        "Online flag",
        "network",
        STATES.available,
        navigator.onLine ? "online" : "offline",
        "The browser named only its coarse weather, not a destination.",
        "navigator.onLine",
        "low",
        ["read online flag", "made no network request"],
      ),
    ),
    safeSignal("Connection", "network", () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) {
        return makeSignal("Connection", "network", STATES.unsupported, "", "The connection glass stayed dark.", "navigator.connection", "medium");
      }
      const value = [
        connection.effectiveType,
        numberSignal(connection.downlink, (downlink) => `${downlink} Mbps`),
        connection.saveData ? "save-data" : "",
      ].filter(Boolean);
      return value.length
        ? makeSignal("Connection", "network", STATES.available, value, "The network offered only a silhouette.", "navigator.connection", "medium", [
            "read Network Information API",
            "made no network request",
          ])
        : makeSignal("Connection", "network", STATES.unavailable, "", "The network offered no silhouette.", "navigator.connection", "medium");
    }),
    ...getNetworkCapabilitySignals(),
    safeSignal("Referrer", "navigation", () =>
      document.referrer
        ? makeSignal("Referrer", "navigation", STATES.available, document.referrer, "The doorway remembered where it was entered from.", "document.referrer", "medium")
        : makeSignal("Referrer", "navigation", STATES.unavailable, "", "The doorway remembered no previous room.", "document.referrer", "medium"),
    ),
    safeSignal("History length", "navigation", () =>
      makeSignal("History length", "navigation", STATES.available, history.length, "The tab counted its stack of doors.", "history.length", "low"),
    ),
    safeSignal("Navigation type", "navigation", () =>
      navEntry?.type
        ? makeSignal("Navigation type", "navigation", STATES.available, navEntry.type, "The page remembered how it arrived.", "PerformanceNavigationTiming.type", "low")
        : makeSignal("Navigation type", "navigation", STATES.unavailable, "", "The arrival note was blank.", "PerformanceNavigationTiming.type", "low"),
    ),
    safeSignal("Load timing", "navigation", () => {
      if (!navEntry || !Number.isFinite(navEntry.domContentLoadedEventEnd)) {
        return makeSignal("Load timing", "navigation", STATES.unavailable, "", "The stopwatch stayed face down.", "PerformanceNavigationTiming", "low");
      }
      return makeSignal(
        "Load timing",
        "navigation",
        STATES.available,
        `${Math.round(navEntry.domContentLoadedEventEnd)} ms to DOM ready`,
        "The stopwatch gave one local lap.",
        "PerformanceNavigationTiming.domContentLoadedEventEnd",
        "low",
      );
    }),
    safeSignal("Plugins discovered", "identity", () => {
      const count = listCount(navigator.plugins);
      const details = Array.from(navigator.plugins || [])
        .map((plugin) => ({
          name: plugin.name || "",
          description: plugin.description || "",
          filename: plugin.filename || "",
        }))
        .filter((plugin) => plugin.name || plugin.description || plugin.filename);
      return count !== ""
        ? {
            ...makeSignal(
              "Plugins discovered",
              "identity",
              STATES.available,
              `${count} listed`,
              "The browser counted old masks. Tap to see the names it offered.",
              "navigator.plugins",
              "medium",
              ["read plugin list", "kept names inside this page", "did not load or contact plugins"],
            ),
            details,
            actionLabel: details.length ? "Show plugins" : "No names offered",
          }
        : makeSignal("Plugins discovered", "identity", STATES.unavailable, "", "The old masks were not offered.", "navigator.plugins", "medium");
    }),
    safeSignal("MIME types", "identity", () => {
      const count = listCount(navigator.mimeTypes);
      return count !== ""
        ? makeSignal("MIME types", "identity", STATES.available, `${count} listed`, "The browser counted old content shapes.", "navigator.mimeTypes.length", "medium")
        : makeSignal("MIME types", "identity", STATES.unavailable, "", "The old content shapes were not offered.", "navigator.mimeTypes", "medium");
    }),
    safeSignal("JavaScript heap", "performance", () => {
      const memory = performance.memory;
      return memory?.jsHeapSizeLimit
        ? makeSignal(
            "JavaScript heap",
            "performance",
            STATES.available,
            `${Math.round(memory.usedJSHeapSize / 1024 / 1024)} MB used`,
            "The engine showed a small pressure gauge.",
            "performance.memory",
            "medium",
          )
        : makeSignal("JavaScript heap", "performance", STATES.unsupported, "", "The engine kept its pressure gauge covered.", "performance.memory", "medium");
    }),
    ...getWeakIndicatorSignals(),
    safeSignal("Media devices", "permissions", () =>
      navigator.mediaDevices?.enumerateDevices
        ? makeSignal("Media devices", "permissions", STATES.notRequested, "", "We saw the device desk and left it alone.", "navigator.mediaDevices.enumerateDevices", "high", [
            "capability exists",
            "no device enumeration called",
            "no prompt opened",
          ])
        : makeSignal("Media devices", "permissions", STATES.unsupported, "", "The device desk was not offered here.", "navigator.mediaDevices", "high"),
    ),
    safeSignal("Clipboard", "permissions", () =>
      makeSignal(
        "Clipboard",
        "permissions",
        STATES.notRequested,
        "",
        "The clipboard remained sealed.",
        "navigator.clipboard",
        "high",
        ["capability may exist", "read was not requested", "clipboard stayed sealed"],
      ),
    ),
    safeSignal("Graphics hand", "graphics", getWebGlSignal),
    safeSignal("Canvas echo", "graphics", getCanvasSignal),
    ...getFontSignals(),
    ...getUserAgentSignals(),
  ];

  const asyncSignals = await Promise.all([
    withTimeout(getStorageSignal(), asyncFallback("Storage estimate", "storage", "navigator.storage.estimate")),
    withTimeout(getPermissionSignal("geolocation", "Location permission"), asyncFallback("Location permission", "permissions", "navigator.permissions.query(geolocation)")),
    withTimeout(getPermissionSignal("notifications", "Notification permission"), asyncFallback("Notification permission", "permissions", "navigator.permissions.query(notifications)")),
    withTimeout(getPermissionSignal("camera", "Camera permission"), asyncFallback("Camera permission", "permissions", "navigator.permissions.query(camera)")),
    withTimeout(getPermissionSignal("microphone", "Microphone permission"), asyncFallback("Microphone permission", "permissions", "navigator.permissions.query(microphone)")),
    withTimeout(getPermissionSignal("clipboard-read", "Clipboard read permission"), asyncFallback("Clipboard read permission", "permissions", "navigator.permissions.query(clipboard-read)")),
    withTimeout(getPermissionSignal("clipboard-write", "Clipboard write permission"), asyncFallback("Clipboard write permission", "permissions", "navigator.permissions.query(clipboard-write)")),
    withTimeout(getPermissionSignal("persistent-storage", "Persistent storage permission"), asyncFallback("Persistent storage permission", "permissions", "navigator.permissions.query(persistent-storage)")),
    withTimeout(getPermissionSignal("idle-detection", "Idle detection permission"), asyncFallback("Idle detection permission", "permissions", "navigator.permissions.query(idle-detection)")),
    withTimeout(getBatterySignal(), asyncFallback("Battery", "device", "navigator.getBattery")),
  ]);

  return signals.concat(asyncSignals);
}
