import { describe, expect, it } from "vitest";
import { Creature } from "./ecosystem.js";
import { World } from "./world.js";

describe("World manager", () => {
  it("uses the spatial grid to return nearby creatures", () => {
    const world = new World({ seed: false, cellSize: 32 });
    for (let index = 0; index < 80; index += 1) {
      world.spawn(new Creature(20 + (index % 20) * 28, 336 + Math.floor(index / 20) * 28, "plant"), "seed");
    }
    const target = new Creature(300, 360, "plant", { color: "hsl(120 80% 40%)" });
    world.spawn(target, "seed");
    world.rebuildSpatialGrid();

    const nearby = world.queryNearby(300, 360, 10, (candidate) => candidate.id === target.id);

    expect(nearby).toHaveLength(1);
    expect(nearby[0]).toBe(target);
    expect(world.grid.lastQueryCellCount).toBeLessThan(world.creatures.length);
  });

  it("tracks population stats and diversity", () => {
    const world = new World({ seed: false });
    world.spawn(new Creature(100, 340, "plant", { color: "hsl(120 70% 38%)", size: 7 }), "seed");
    world.spawn(new Creature(140, 340, "plant", { color: "hsl(135 70% 44%)", size: 8 }), "seed");
    world.spawn(new Creature(140, 270, "herbivore", { color: "hsl(190 90% 62%)", size: 8 }), "seed");
    world.spawn(new Creature(240, 270, "predator", { color: "hsl(318 52% 35%)", size: 11 }), "seed");

    const stats = world.getStats();

    expect(stats.counts).toEqual({ plant: 2, herbivore: 1, predator: 1 });
    expect(stats.diversity).toBe(4);
    expect(stats.health).not.toBe("extinct");
  });

  it("recovers collapsed observe-mode saves on load", () => {
    const world = new World({ seed: false, mode: "observe" });
    for (let index = 0; index < 20; index += 1) {
      world.spawn(new Creature(40 + index * 10, 340, "plant"), "seed");
    }

    const restored = World.deserialize(world.serialize());

    expect(restored.countByType("plant")).toBeGreaterThan(0);
    expect(restored.countByType("herbivore")).toBe(9);
    expect(restored.history[0].message).toBe("Observe mode nudged the food chain.");
  });
});
