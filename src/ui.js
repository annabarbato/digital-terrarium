export class UI {
  constructor({ world, canvas, onPauseToggle, onSpeedChange, onModeChange, onReset, onClear, onSnapshot, onExport }) {
    this.world = world;
    this.canvas = canvas;
    this.stats = new Map(
      [...document.querySelectorAll("[data-stat]")].map((element) => [element.dataset.stat, element])
    );
    this.historyLog = document.querySelector("#historyLog");
    this.ticker = document.querySelector("#mutationTicker");
    this.pauseButton = document.querySelector('[data-action="togglePause"]');
    this.speedSelect = document.querySelector('[data-action="speed"]');
    this.modeSelect = document.querySelector('[data-action="mode"]');
    this.tickerTimeout = null;

    this.pauseButton.addEventListener("click", onPauseToggle);
    this.speedSelect.addEventListener("change", () => onSpeedChange(Number(this.speedSelect.value)));
    this.modeSelect.addEventListener("change", () => onModeChange(this.modeSelect.value));
    document.querySelector('[data-action="reset"]').addEventListener("click", onReset);
    document.querySelector('[data-action="clear"]').addEventListener("click", onClear);
    document.querySelector('[data-action="snapshot"]').addEventListener("click", () => onSnapshot(this.canvas));
    document.querySelector('[data-action="export"]').addEventListener("click", onExport);
  }

  setWorld(world) {
    this.world = world;
    this.modeSelect.value = world.mode;
  }

  update(speed) {
    const stats = this.world.getStats();
    this.write("plants", stats.counts.plant);
    this.write("herbivores", stats.counts.herbivore);
    this.write("predators", stats.counts.predator);
    this.write("lifespan", `${Math.round(stats.averageLifespanMs / 1000)}s`);
    this.write("diversity", stats.diversity);
    this.write("health", stats.health.toUpperCase());
    this.write("elapsed", formatTime(stats.elapsedMs));
    this.pauseButton.textContent = this.world.paused ? "PLAY" : "PAUSE";
    this.speedSelect.value = String(speed);
    this.modeSelect.value = this.world.mode;
    this.renderHistory();
  }

  handleEvents(events) {
    const notable = events.findLast((event) => event.kind === "mutation" || event.kind === "extinction");
    if (notable) {
      this.showTicker(notable.message);
    }
  }

  write(key, value) {
    const target = this.stats.get(key);
    if (target) {
      target.textContent = value;
    }
  }

  renderHistory() {
    if (!this.historyLog) {
      return;
    }

    this.historyLog.replaceChildren(
      ...this.world.history.slice(0, 8).map((entry) => {
        const item = document.createElement("li");
        item.textContent = `${formatTime(entry.time)} ${entry.message}`;
        return item;
      })
    );
  }

  showTicker(message) {
    this.ticker.textContent = message;
    this.ticker.classList.add("is-visible");
    window.clearTimeout(this.tickerTimeout);
    this.tickerTimeout = window.setTimeout(() => {
      this.ticker.classList.remove("is-visible");
    }, 4200);
  }
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
