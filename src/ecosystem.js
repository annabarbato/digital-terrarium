export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 480;

export const LAYERS = {
  air: { top: 0, bottom: 212 },
  water: { top: 212, bottom: 326 },
  habitat: { top: 226, bottom: 462 },
  soil: { top: 326, bottom: 480 }
};

export const CREATURE_CONFIG = {
  plant: {
    diet: [],
    layer: "soil",
    speed: 0,
    senseRadius: 0,
    eatRadius: 0,
    energyGain: 0,
    energyCostPerSecond: -1.8,
    maxEnergy: 220,
    initialEnergy: 104,
    reproductionEnergy: 156,
    reproductionCost: 54,
    reproductionChancePerSecond: 0.045,
    maturityMs: 7000,
    lifespanMs: 180000,
    sizeRange: [5, 9],
    mutationChance: 0.08,
    baseColors: ["#00aa00", "#19b12e", "#3fbf4f", "#7bbf24"],
    maxPopulation: 190
  },
  herbivore: {
    diet: ["plant"],
    layer: "habitat",
    speed: 24,
    senseRadius: 118,
    eatRadius: 18,
    energyGain: 70,
    energyCostPerSecond: 4.1,
    maxEnergy: 230,
    initialEnergy: 118,
    reproductionEnergy: 164,
    reproductionCost: 72,
    reproductionChancePerSecond: 0.095,
    maturityMs: 8500,
    lifespanMs: 125000,
    sizeRange: [6, 10],
    mutationChance: 0.15,
    baseColors: ["#78d9ff", "#ff88b8", "#fff069", "#91d870"],
    maxPopulation: 115
  },
  predator: {
    diet: ["herbivore"],
    layer: "habitat",
    speed: 19,
    senseRadius: 152,
    eatRadius: 11,
    energyGain: 104,
    energyCostPerSecond: 6.3,
    maxEnergy: 250,
    initialEnergy: 132,
    reproductionEnergy: 188,
    reproductionCost: 94,
    reproductionChancePerSecond: 0.035,
    maturityMs: 16000,
    lifespanMs: 150000,
    sizeRange: [9, 14],
    mutationChance: 0.1,
    baseColors: ["#8b1a44", "#5b2b8d", "#b03030", "#3c305d"],
    maxPopulation: 42
  }
};

let nextCreatureId = 1;

export function random(min, max) {
  return min + Math.random() * (max - min);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function colorToHsl(hex) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
        break;
    }
    hue *= 60;
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
}

export function hslToCss({ h, s, l }) {
  return `hsl(${Math.round((h + 360) % 360)} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%)`;
}

export function randomColor(type) {
  const palette = CREATURE_CONFIG[type].baseColors;
  const base = palette[Math.floor(Math.random() * palette.length)];
  const hsl = colorToHsl(base);
  hsl.h += random(-7, 7);
  hsl.s += random(-6, 6);
  hsl.l += random(-5, 5);
  return hslToCss(hsl);
}

export function randomSize(type) {
  const [min, max] = CREATURE_CONFIG[type].sizeRange;
  return random(min, max);
}

export class Creature {
  constructor(x, y, type, traits = {}) {
    if (!CREATURE_CONFIG[type]) {
      throw new Error(`Unknown creature type: ${type}`);
    }

    const config = CREATURE_CONFIG[type];
    this.id = traits.id ?? nextCreatureId++;
    this.x = x;
    this.y = y;
    this.vx = traits.vx ?? random(-0.5, 0.5);
    this.vy = traits.vy ?? random(-0.5, 0.5);
    this.type = type;
    this.energy = traits.energy ?? config.initialEnergy;
    this.age = traits.age ?? 0;
    this.color = traits.color ?? randomColor(type);
    this.size = clamp(traits.size ?? randomSize(type), config.sizeRange[0] - 2, config.sizeRange[1] + 3);
    this.lifespan = traits.lifespan ?? config.lifespanMs * random(0.82, 1.18);
    this.speed = traits.speed ?? config.speed * random(0.88, 1.14);
    this.wanderAngle = traits.wanderAngle ?? random(0, Math.PI * 2);
    this.dead = traits.dead ?? false;
    this.mutationLabel = traits.mutationLabel ?? null;
  }

  update(deltaTime, world) {
    if (this.dead) {
      return;
    }

    const config = CREATURE_CONFIG[this.type];
    const seconds = deltaTime / 1000;
    this.age += deltaTime;

    if (this.type === "plant") {
      this.energy = clamp(this.energy - config.energyCostPerSecond * seconds, 0, config.maxEnergy);
      this.tryReproduce(world, seconds);
    } else {
      const movement = this.chooseMovement(world, seconds);
      this.move(movement.x, movement.y, seconds, world);
      this.energy = clamp(this.energy - config.energyCostPerSecond * seconds, -10, config.maxEnergy);
      this.eatNearby(world);
      this.tryReproduce(world, seconds);
    }

    if (this.energy <= 0) {
      world.kill(this, "starved");
      return;
    }

    if (this.age > this.lifespan) {
      world.kill(this, "old-age");
    }
  }

  chooseMovement(world, seconds) {
    const food = this.findNearestFood(world);
    const threat = this.type === "herbivore" ? this.findNearestThreat(world) : null;
    let dx = 0;
    let dy = 0;

    if (food) {
      const foodDistance = Math.max(1, distance(this, food));
      dx += ((food.x - this.x) / foodDistance) * 1.2;
      dy += ((food.y - this.y) / foodDistance) * 1.2;
    }

    if (threat) {
      const threatDistance = Math.max(1, distance(this, threat));
      dx += ((this.x - threat.x) / threatDistance) * 1.9;
      dy += ((this.y - threat.y) / threatDistance) * 1.9;
    }

    this.wanderAngle += random(-0.85, 0.85) * seconds * 4.5;
    dx += Math.cos(this.wanderAngle) * 0.34;
    dy += Math.sin(this.wanderAngle) * 0.34;

    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  move(dx, dy, seconds, world) {
    const speed = this.speed * seconds;
    this.vx = dx * speed;
    this.vy = dy * speed;
    this.x += this.vx;
    this.y += this.vy;
    world.constrainCreature(this);
  }

  findNearestFood(world) {
    const config = CREATURE_CONFIG[this.type];
    if (config.diet.length === 0) {
      return null;
    }

    const candidates = world.queryNearby(
      this.x,
      this.y,
      config.senseRadius,
      (candidate) => candidate.id !== this.id && !candidate.dead && config.diet.includes(candidate.type)
    );

    let nearest = null;
    let nearestDistance = Infinity;
    for (const candidate of candidates) {
      const candidateDistance = distance(this, candidate);
      if (candidateDistance < nearestDistance) {
        nearest = candidate;
        nearestDistance = candidateDistance;
      }
    }
    return nearest;
  }

  findNearestThreat(world) {
    const threats = world.queryNearby(
      this.x,
      this.y,
      86,
      (candidate) => candidate.type === "predator" && !candidate.dead
    );

    let nearest = null;
    let nearestDistance = Infinity;
    for (const threat of threats) {
      const threatDistance = distance(this, threat);
      if (threatDistance < nearestDistance) {
        nearest = threat;
        nearestDistance = threatDistance;
      }
    }
    return nearest;
  }

  eatNearby(world) {
    const config = CREATURE_CONFIG[this.type];
    if (config.diet.length === 0) {
      return false;
    }

    const meal = world
      .queryNearby(
        this.x,
        this.y,
        config.eatRadius + this.size,
        (candidate) => candidate.id !== this.id && !candidate.dead && config.diet.includes(candidate.type)
      )
      .find((candidate) => distance(this, candidate) <= config.eatRadius + this.size + candidate.size * 0.45);

    if (!meal) {
      return false;
    }

    world.kill(meal, `${this.type}-ate-${meal.type}`);
    this.energy = clamp(this.energy + config.energyGain, 0, config.maxEnergy);
    world.addEffect({
      type: "eat",
      x: meal.x,
      y: meal.y,
      color: this.color,
      age: 0,
      life: 420
    });
    return true;
  }

  tryReproduce(world, seconds) {
    const config = CREATURE_CONFIG[this.type];
    if (
      this.energy < config.reproductionEnergy ||
      this.age < config.maturityMs ||
      !world.canSpawn(this.type) ||
      Math.random() > config.reproductionChancePerSecond * seconds
    ) {
      return null;
    }

    const child = this.reproduce(world);
    this.energy -= config.reproductionCost;
    world.spawn(child, "birth");
    return child;
  }

  reproduce(world, options = {}) {
    const config = CREATURE_CONFIG[this.type];
    const spread = this.type === "plant" ? 28 : 12;
    const child = new Creature(
      this.x + random(-spread, spread),
      this.y + random(-spread * 0.45, spread * 0.45),
      this.type,
      {
        energy: config.initialEnergy * random(0.72, 0.96),
        color: this.color,
        size: this.size + random(-1.1, 1.1),
        lifespan: this.lifespan * random(0.94, 1.06),
        speed: this.speed * random(0.95, 1.05)
      }
    );

    const mutated = options.forceMutation || Math.random() < config.mutationChance;
    if (mutated) {
      const before = child.color;
      child.color = this.mutateColor();
      child.size = clamp(child.size + random(-1.8, 1.8), config.sizeRange[0] - 2, config.sizeRange[1] + 3);
      child.speed = Math.max(0, child.speed * random(0.92, 1.1));
      child.mutationLabel = describeMutation(this.type, before, child.color);
    }

    world.constrainCreature(child);
    return child;
  }

  mutateColor() {
    const match = this.color.match(/hsl\(([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/);
    if (!match) {
      return randomColor(this.type);
    }

    const h = Number(match[1]) + random(-44, 44);
    const s = Number(match[2]) + random(-14, 18);
    const l = Number(match[3]) + random(-12, 12);
    return hslToCss({ h, s, l });
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      type: this.type,
      energy: this.energy,
      age: this.age,
      color: this.color,
      size: this.size,
      lifespan: this.lifespan,
      speed: this.speed,
      wanderAngle: this.wanderAngle,
      dead: this.dead,
      mutationLabel: this.mutationLabel
    };
  }

  static deserialize(data) {
    return new Creature(data.x, data.y, data.type, data);
  }
}

export function describeMutation(type, previousColor, nextColor) {
  if (previousColor === nextColor) {
    return `New size variant: ${type}`;
  }
  const colorName = approximateColorName(nextColor);
  return `New color variant: ${colorName} ${type}`;
}

export function approximateColorName(cssColor) {
  const match = cssColor.match(/hsl\(([-\d.]+)\s+/);
  if (!match) {
    return "bright";
  }

  const hue = ((Number(match[1]) % 360) + 360) % 360;
  if (hue < 18 || hue >= 345) return "red";
  if (hue < 42) return "orange";
  if (hue < 72) return "yellow";
  if (hue < 155) return "green";
  if (hue < 195) return "cyan";
  if (hue < 245) return "blue";
  if (hue < 292) return "purple";
  return "pink";
}
