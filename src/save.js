import { World } from "./world.js";

export const STORAGE_KEY = "digital-terrarium:v1";

export function saveWorld(world, storage = globalThis.localStorage) {
  if (!storage) {
    return false;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(world.serialize()));
  return true;
}

export function loadWorld(storage = globalThis.localStorage) {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.creatures)) {
      return null;
    }
    return World.deserialize(data);
  } catch {
    return null;
  }
}

export function startAutoSave(getWorld, intervalMs = 60000, storage = globalThis.localStorage) {
  return window.setInterval(() => {
    const world = getWorld();
    if (world) {
      saveWorld(world, storage);
    }
  }, intervalMs);
}

export function exportWorldJson(world) {
  const blob = new Blob([JSON.stringify(world.serialize(), null, 2)], { type: "application/json" });
  downloadBlob(blob, `terrarium-${Date.now()}.json`);
}

export function exportSnapshot(canvas) {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `terrarium-${Date.now()}.png`);
    }
  }, "image/png");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
