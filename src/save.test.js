import { describe, expect, it } from "vitest";
import { Creature } from "./ecosystem.js";
import { loadWorld, saveWorld } from "./save.js";
import { World } from "./world.js";

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value)
  };
}

describe("save/load", () => {
  it("round-trips world state without losing creature traits", () => {
    const storage = memoryStorage();
    const world = new World({ seed: false, mode: "hardmode" });
    const creature = new Creature(333, 272, "predator", {
      energy: 177,
      age: 12345,
      color: "hsl(280 50% 42%)",
      size: 12.5,
      lifespan: 155000,
      speed: 21
    });
    world.spawn(creature, "seed");
    world.elapsedMs = 54321;

    expect(saveWorld(world, storage)).toBe(true);
    const restored = loadWorld(storage);

    expect(restored.mode).toBe("hardmode");
    expect(restored.elapsedMs).toBe(54321);
    expect(restored.creatures).toHaveLength(1);
    expect(restored.creatures[0].serialize()).toMatchObject(creature.serialize());
  });
});
