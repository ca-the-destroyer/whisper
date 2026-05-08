const STATES = {
  available: "available",
  unavailable: "unavailable",
  blocked: "blocked",
  unsupported: "unsupported",
  notRequested: "not-requested",
};

const stateLines = {
  [STATES.available]: "The browser answered.",
  [STATES.unavailable]: "The browser had no answer.",
  [STATES.blocked]: "The browser refused on your behalf.",
  [STATES.unsupported]: "This door does not exist here.",
  [STATES.notRequested]: "We left it alone.",
};

function stateToProse(state) {
  return stateLines[state] || "The glass stayed dark.";
}

function valueToText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value;
  return "";
}

function signalSentence(signal) {
  const value = valueToText(signal.value);
  const detail = signal.detail ? ` ${signal.detail}` : "";
  if (signal.state === STATES.available && value) {
    return `${stateToProse(signal.state)}${detail}`;
  }
  return `${stateToProse(signal.state)}${detail}`;
}

function buildNarrative(signals) {
  const available = signals.filter((signal) => signal.state === STATES.available);
  const unavailable = signals.filter((signal) =>
    [STATES.unavailable, STATES.blocked, STATES.unsupported].includes(signal.state),
  );
  const requested = signals.filter((signal) => signal.state !== STATES.notRequested);

  if (!requested.length) {
    return "We left the browser alone, and the page became mostly weather.";
  }

  if (available.length > unavailable.length) {
    return `The scan accumulated ${available.length} quiet answers and kept them inside this tab. The pattern grew denser, but it did not become more certain.`;
  }

  if (unavailable.length > available.length) {
    return `The browser kept more doors closed than open. The result is not a failure; it is a portrait with the windows painted over.`;
  }

  return "The browser answered and withheld in equal measure. The record is partial, which is another way of saying honest.";
}

function absenceLine(signals) {
  const quietCount = signals.filter((signal) =>
    [STATES.unavailable, STATES.blocked, STATES.unsupported].includes(signal.state),
  ).length;
  if (quietCount >= 4) return "Good. Some windows should stay painted shut.";
  if (quietCount > 0) return "A few instruments lifted their hands from the table.";
  return "";
}

function hourLine(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "The hour was impolite, so the page lowered its voice.";
  if (hour < 7) return "Morning had not quite decided to arrive.";
  return "";
}
