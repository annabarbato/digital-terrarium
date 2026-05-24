import { describe, expect, it } from "vitest";
import { CREATURE_CONFIG, Creature } from "./ecosystem.js";
import { World } from "./world.js";

describe("Creature food chain behavior", () => {
  it("lets herbivores eat nearby plants and gain energy", () => {
    const world = new World({ seed: false });
    const plant = new Creature(120, 340, "plant", { energy: 80 });
    const herbivore = new Creature(120, 318, "herbivore", { energy: 40 });
    world.spawn(plant, "seed");
    world.spawn(herbivore, "seed");

    world.update(100);

    expect(world.countByType("plant")).toBe(0);
    expect(world.countByType("herbivore")).toBe(1);
    expect(herbivore.energy).toBeGreaterThan(80);
  });

  it("lets predators eat nearby herbivores", () => {
    const world = new World({ seed: false });
    const herbivore = new Creature(220, 268, "herbivore", { energy: 80 });
    const predator = new Creature(220, 268, "predator", { energy: 50 });
    world.spawn(herbivore, "seed");
    world.spawn(predator, "seed");

    world.update(100);

    expect(world.countByType("herbivore")).toBe(0);
    expect(world.countByType("predator")).toBe(1);
    expect(predator.energy).toBeGreaterThan(100);
  });

  it("kills creatures from starvation and old age", () => {
    const starvedWorld = new World({ seed: false });
    const starving = new Creature(100, 260, "herbivore", { energy: 0.1 });
    starvedWorld.spawn(starving, "seed");
    starvedWorld.update(1000);
    expect(starvedWorld.countByType("herbivore")).toBe(0);

    const agedWorld = new World({ seed: false });
    const aged = new Creature(100, 340, "plant", { age: 2000, lifespan: 1000 });
    agedWorld.spawn(aged, "seed");
    agedWorld.update(16);
    expect(agedWorld.countByType("plant")).toBe(0);
  });

  it("creates offspring and spends parent energy when reproducing", () => {
    const world = new World({ seed: false });
    const parent = new Creature(180, 340, "plant", {
      energy: 190,
      age: CREATURE_CONFIG.plant.maturityMs + 1
    });
    world.spawn(parent, "seed");

    const child = parent.reproduce(world);
    parent.energy -= CREATURE_CONFIG.plant.reproductionCost;
    world.spawn(child, "birth");

    expect(world.countByType("plant")).toBe(2);
    expect(parent.energy).toBeLessThan(190);
    expect(child.type).toBe("plant");
  });

  it("can mutate offspring color and size within allowed bounds", () => {
    const world = new World({ seed: false });
    const parent = new Creature(250, 270, "herbivore", {
      color: "hsl(190 80% 62%)",
      size: 8
    });

    const child = parent.reproduce(world, { forceMutation: true });
    const [min, max] = CREATURE_CONFIG.herbivore.sizeRange;

    expect(child.color).not.toBe(parent.color);
    expect(child.size).toBeGreaterThanOrEqual(min - 2);
    expect(child.size).toBeLessThanOrEqual(max + 3);
    expect(child.mutationLabel).toContain("variant");
  });
});
