import {
  CREATURE_CONFIG,
  Creature,
  LAYERS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clamp,
  random
} from "./ecosystem.js";

export class SpatialGrid {
  constructor(cellSize = 36) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.lastQueryCellCount = 0;
  }

  rebuild(creatures) {
    this.cells.clear();
    for (const creature of creatures) {
      if (!creature.dead) {
        this.insert(creature);
      }
    }
  }

  insert(creature) {
    const key = this.keyFor(creature.x, creature.y);
    const cell = this.cells.get(key);
    if (cell) {
      cell.push(creature);
    } else {
      this.cells.set(key, [creature]);
    }
  }

  query(x, y, radius, filter = () => true) {
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);
    const results = [];
    this.lastQueryCellCount = 0;

    for (let cy = minCellY; cy <= maxCellY; cy += 1) {
      for (let cx = minCellX; cx <= maxCellX; cx += 1) {
        const cell = this.cells.get(`${cx}:${cy}`);
        this.lastQueryCellCount += 1;
        if (!cell) {
          continue;
        }
        for (const creature of cell) {
          if (filter(creature)) {
            results.push(creature);
          }
        }
      }
    }

    return results;
  }

  keyFor(x, y) {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
  }
}

export class World {
  constructor(options = {}) {
    this.width = options.width ?? WORLD_WIDTH;
    this.height = options.height ?? WORLD_HEIGHT;
    this.mode = options.mode ?? "observe";
    this.creatures = [];
    this.grid = new SpatialGrid(options.cellSize);
    this.events = [];
    this.history = [];
    this.effects = [];
    this.elapsedMs = options.elapsedMs ?? 0;
    this.births = options.births ?? 0;
    this.deaths = options.deaths ?? 0;
    this.totalLifespanMs = options.totalLifespanMs ?? 0;
    this.extinctionMs = 0;
    this.collapseMs = 0;
    this.paused = false;

    if (options.seed !== false) {
      this.seed(options.seedCounts);
    }
  }

  seed(seedCounts = {}) {
    const counts = {
      plant: seedCounts.plant ?? 48,
      herbivore: seedCounts.herbivore ?? 14,
      predator: seedCounts.predator ?? 0
    };

    for (let index = 0; index < counts.plant; index += 1) {
      this.spawn(new Creature(random(20, this.width - 20), random(LAYERS.soil.top + 12, this.height - 18), "plant"), "seed");
    }
    for (let index = 0; index < counts.herbivore; index += 1) {
      this.spawn(new Creature(random(24, this.width - 24), random(LAYERS.water.top + 8, LAYERS.habitat.bottom - 18), "herbivore"), "seed");
    }
    for (let index = 0; index < counts.predator; index += 1) {
      this.spawn(new Creature(random(40, this.width - 40), random(LAYERS.water.top + 10, LAYERS.habitat.bottom - 28), "predator"), "seed");
    }

    this.rebuildSpatialGrid();
    this.addHistory("Ecosystem seeded.");
  }

  reset() {
    this.creatures = [];
    this.effects = [];
    this.events = [];
    this.history = [];
    this.elapsedMs = 0;
    this.births = 0;
    this.deaths = 0;
    this.totalLifespanMs = 0;
    this.extinctionMs = 0;
    this.seed();
  }

  clear() {
    this.creatures = [];
    this.effects = [];
    this.events = [];
    this.addHistory("Terrarium cleared.");
    this.rebuildSpatialGrid();
  }

  update(deltaTime) {
    if (this.paused) {
      return;
    }

    this.elapsedMs += deltaTime;
    this.rebuildSpatialGrid();

    const living = [...this.creatures];
    for (const creature of living) {
      creature.update(deltaTime, this);
    }

    this.creatures = this.creatures.filter((creature) => !creature.dead);
    this.updateEffects(deltaTime);
    this.rebuildSpatialGrid();
    this.handleExtinction(deltaTime);
    this.handleObserveRecovery(deltaTime);
  }

  spawn(creature, reason = "birth") {
    if (!this.canSpawn(creature.type) && reason !== "seed") {
      return null;
    }

    this.constrainCreature(creature);
    this.creatures.push(creature);

    if (reason === "birth") {
      this.births += 1;
      this.addEffect({ type: "birth", x: creature.x, y: creature.y, color: creature.color, age: 0, life: 620 });
      this.emit({
        kind: creature.mutationLabel ? "mutation" : "birth",
        type: creature.type,
        message: creature.mutationLabel ?? `${labelCreature(creature.type)} born.`
      });
    }

    return creature;
  }

  kill(creature, reason = "death") {
    if (!creature || creature.dead) {
      return;
    }

    creature.dead = true;
    this.deaths += 1;
    this.totalLifespanMs += creature.age;
    this.addEffect({ type: "death", x: creature.x, y: creature.y, color: creature.color, age: 0, life: 720 });

    const readableReason = reason === "old-age" ? "aged out" : reason === "starved" ? "starved" : "was eaten";
    this.emit({
      kind: "death",
      type: creature.type,
      message: `${labelCreature(creature.type)} ${readableReason}.`
    });
  }

  canSpawn(type) {
    const config = CREATURE_CONFIG[type];
    if (!config) {
      return false;
    }
    return this.countByType(type) < config.maxPopulation && this.creatures.length < 360;
  }

  queryNearby(x, y, radius, filter) {
    return this.grid.query(x, y, radius, filter);
  }

  rebuildSpatialGrid() {
    this.grid.rebuild(this.creatures);
  }

  constrainCreature(creature) {
    const layerName = CREATURE_CONFIG[creature.type].layer;
    const layer = LAYERS[layerName];
    const margin = Math.max(4, creature.size * 0.6);
    creature.x = clamp(creature.x, margin, this.width - margin);

    if (creature.type === "plant") {
      creature.y = clamp(creature.y, LAYERS.soil.top + margin, this.height - margin);
      return;
    }

    creature.y = clamp(creature.y, layer.top + margin, layer.bottom - margin);
  }

  countByType(type) {
    return this.creatures.reduce((count, creature) => count + (creature.type === type && !creature.dead ? 1 : 0), 0);
  }

  getStats() {
    const counts = {
      plant: this.countByType("plant"),
      herbivore: this.countByType("herbivore"),
      predator: this.countByType("predator")
    };
    const total = counts.plant + counts.herbivore + counts.predator;
    const livingAgeTotal = this.creatures.reduce((sum, creature) => sum + creature.age, 0);
    const completedAverage = this.deaths > 0 ? this.totalLifespanMs / this.deaths : 0;
    const livingAverage = this.creatures.length > 0 ? livingAgeTotal / this.creatures.length : 0;
    const diversity = new Set(
      this.creatures.map((creature) => `${creature.type}:${creature.color}:${Math.round(creature.size)}`)
    ).size;

    return {
      counts,
      total,
      births: this.births,
      deaths: this.deaths,
      averageLifespanMs: Math.max(completedAverage, livingAverage),
      diversity,
      health: this.getHealth(counts, total),
      elapsedMs: this.elapsedMs,
      mode: this.mode
    };
  }

  getHealth(counts, total) {
    if (total === 0) {
      return "extinct";
    }
    if (counts.plant === 0 || counts.herbivore === 0) {
      return "dying";
    }
    if (counts.predator === 0 && this.elapsedMs > 45000) {
      return "stressed";
    }
    const herbivorePressure = counts.herbivore / Math.max(1, counts.plant);
    const predatorPressure = counts.predator / Math.max(1, counts.herbivore);
    if (counts.plant > 70 && counts.herbivore > 22 && counts.predator > 4 && predatorPressure < 0.35) {
      return "thriving";
    }
    if (herbivorePressure > 1.25 || predatorPressure > 0.42 || counts.plant < 10 || counts.herbivore < 5) {
      return "stressed";
    }
    return "stable";
  }

  handleExtinction(deltaTime) {
    const total = this.getStats().total;
    if (total > 0) {
      this.extinctionMs = 0;
      return;
    }

    this.extinctionMs += deltaTime;
    if (this.extinctionMs === deltaTime) {
      this.addHistory("The ecosystem crashed.");
      this.emit({ kind: "extinction", type: "world", message: "Extinction event." });
    }

    if (this.mode === "observe" && this.extinctionMs > 2600) {
      this.extinctionMs = 0;
      this.seed();
      this.addHistory("Observe mode restarted the terrarium.");
    }
  }

  handleObserveRecovery(deltaTime) {
    if (this.mode !== "observe") {
      this.collapseMs = 0;
      return;
    }

    const stats = this.getStats();
    if (stats.total === 0) {
      return;
    }

    const missingFoundation = stats.counts.plant < 8 || stats.counts.herbivore === 0;
    const readyForPredator = stats.elapsedMs > 60000 && stats.counts.predator === 0 && stats.counts.herbivore >= 10;
    if (!missingFoundation && !readyForPredator) {
      this.collapseMs = 0;
      return;
    }

    this.collapseMs += deltaTime;
    if (this.collapseMs < 8000 && !readyForPredator) {
      return;
    }

    if (stats.counts.plant < 8) {
      const neededPlants = 34 - stats.counts.plant;
      for (let index = 0; index < neededPlants; index += 1) {
        this.spawn(new Creature(random(20, this.width - 20), random(LAYERS.soil.top + 12, this.height - 18), "plant"), "seed");
      }
    }

    const refreshedPlantCount = this.countByType("plant");
    if (stats.counts.herbivore === 0 && refreshedPlantCount >= 12) {
      for (let index = 0; index < 9; index += 1) {
        this.spawn(new Creature(random(24, this.width - 24), random(LAYERS.water.top + 8, LAYERS.habitat.bottom - 18), "herbivore"), "seed");
      }
    }

    const refreshedHerbivoreCount = this.countByType("herbivore");
    if (stats.elapsedMs > 60000 && stats.counts.predator === 0 && refreshedHerbivoreCount >= 10) {
      this.spawn(new Creature(random(40, this.width - 40), random(LAYERS.water.top + 10, LAYERS.habitat.bottom - 28), "predator"), "seed");
    }

    this.collapseMs = 0;
    this.addHistory("Observe mode nudged the food chain.");
  }

  addEffect(effect) {
    this.effects.push(effect);
  }

  updateEffects(deltaTime) {
    for (const effect of this.effects) {
      effect.age += deltaTime;
    }
    this.effects = this.effects.filter((effect) => effect.age < effect.life);
  }

  emit(event) {
    const enriched = {
      time: this.elapsedMs,
      ...event
    };
    this.events.push(enriched);

    if (event.kind === "mutation" || event.kind === "extinction") {
      this.addHistory(event.message);
    }
  }

  drainEvents() {
    const drained = [...this.events];
    this.events = [];
    return drained;
  }

  addHistory(message) {
    this.history.unshift({
      time: this.elapsedMs,
      message
    });
    this.history = this.history.slice(0, 18);
  }

  serialize() {
    return {
      version: 1,
      width: this.width,
      height: this.height,
      mode: this.mode,
      elapsedMs: this.elapsedMs,
      births: this.births,
      deaths: this.deaths,
      totalLifespanMs: this.totalLifespanMs,
      history: this.history,
      creatures: this.creatures.map((creature) => creature.serialize())
    };
  }

  static deserialize(data) {
    const world = new World({
      seed: false,
      width: data.width,
      height: data.height,
      mode: data.mode,
      elapsedMs: data.elapsedMs,
      births: data.births,
      deaths: data.deaths,
      totalLifespanMs: data.totalLifespanMs
    });
    world.history = Array.isArray(data.history) ? data.history : [];
    world.creatures = Array.isArray(data.creatures) ? data.creatures.map((creature) => Creature.deserialize(creature)) : [];
    world.rebuildSpatialGrid();
    const stats = world.getStats();
    if (world.mode === "observe" && stats.total > 0 && (stats.counts.plant < 8 || stats.counts.herbivore === 0)) {
      world.collapseMs = 8000;
      world.handleObserveRecovery(0);
    }
    return world;
  }
}

function labelCreature(type) {
  if (type === "plant") {
    return "Plant";
  }
  if (type === "herbivore") {
    return "Herbivore";
  }
  return "Predator";
}
