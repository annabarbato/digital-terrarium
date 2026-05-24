import "../styles.css";
import { Camera } from "./camera.js";
import { Renderer } from "./renderer.js";
import { SoundBoard } from "./sounds.js";
import { UI } from "./ui.js";
import { World } from "./world.js";
import { exportSnapshot, exportWorldJson, loadWorld, saveWorld, startAutoSave } from "./save.js";

const canvas = document.querySelector("#terrarium");
const camera = new Camera();
camera.attach(canvas);

let world = loadWorld() ?? new World();
let speed = 1;
let lastTime = performance.now();
let accumulator = 0;
const fixedStepMs = 1000 / 30;

const renderer = new Renderer(canvas, camera);
const sounds = new SoundBoard();
sounds.bindUnlock(window);

const ui = new UI({
  world,
  canvas,
  onPauseToggle: () => {
    world.paused = !world.paused;
  },
  onSpeedChange: (nextSpeed) => {
    speed = nextSpeed;
  },
  onModeChange: (mode) => {
    world.mode = mode;
    saveWorld(world);
  },
  onReset: () => {
    world.reset();
    saveWorld(world);
  },
  onClear: () => {
    world.clear();
    saveWorld(world);
  },
  onSnapshot: exportSnapshot,
  onExport: () => exportWorldJson(world)
});

startAutoSave(() => world);

function tick(now) {
  const frameDelta = Math.min(120, now - lastTime);
  lastTime = now;
  accumulator += frameDelta * speed;

  while (accumulator >= fixedStepMs) {
    world.update(fixedStepMs);
    accumulator -= fixedStepMs;
  }

  const events = world.drainEvents();
  for (const event of events) {
    sounds.play(event.kind);
  }
  ui.handleEvents(events);
  ui.setWorld(world);
  ui.update(speed);
  renderer.render(world);
  requestAnimationFrame(tick);
}

window.addEventListener("beforeunload", () => {
  saveWorld(world);
});

window.__terrarium = {
  get world() {
    return world;
  },
  reset() {
    world = new World();
    ui.setWorld(world);
  }
};

ui.update(speed);
renderer.render(world);
requestAnimationFrame(tick);
