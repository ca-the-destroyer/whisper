const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function initEasterEggs({ onKonami }) {
  let index = 0;
  window.addEventListener("keydown", (event) => {
    const expected = KONAMI[index];
    if (event.key !== expected) {
      index = event.key === KONAMI[0] ? 1 : 0;
      return;
    }

    index += 1;
    if (index === KONAMI.length) {
      index = 0;
      onKonami();
    }
  });
}

function revealBriefly(element, duration = 4200) {
  if (!element) return;
  element.hidden = false;
  window.clearTimeout(revealBriefly.timer);
  revealBriefly.timer = window.setTimeout(() => {
    element.hidden = true;
  }, duration);
}

function createToggleInstabilityWatcher(onUnstable) {
  const hits = [];
  return () => {
    const now = Date.now();
    hits.push(now);
    while (hits.length && now - hits[0] > 3200) hits.shift();
    if (hits.length >= 4) onUnstable();
  };
}
