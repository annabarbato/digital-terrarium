import { LAYERS, WORLD_HEIGHT, WORLD_WIDTH, clamp } from "./ecosystem.js";

const PIXEL = 2;

export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = camera;
    this.noise = this.createNoise();
    this.ctx.imageSmoothingEnabled = false;
  }

  render(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.restore();

    ctx.save();
    this.camera.apply(ctx);
    this.drawEnvironment(ctx);
    this.drawEffects(ctx, world.effects.filter((effect) => effect.type === "eat"));
    this.drawCreatures(ctx, world.creatures, world.elapsedMs);
    this.drawEffects(ctx, world.effects.filter((effect) => effect.type !== "eat"));
    ctx.restore();

    this.drawGlass(ctx, world.getStats().health, world.elapsedMs);
  }

  createNoise() {
    const dots = [];
    for (let index = 0; index < 620; index += 1) {
      dots.push({
        x: Math.floor(Math.random() * WORLD_WIDTH),
        y: Math.floor(Math.random() * WORLD_HEIGHT),
        shade: Math.random()
      });
    }
    return dots;
  }

  drawEnvironment(ctx) {
    ctx.fillStyle = "#b9d8ca";
    ctx.fillRect(0, 0, WORLD_WIDTH, LAYERS.air.bottom);

    ctx.fillStyle = "#7db7c8";
    ctx.fillRect(0, LAYERS.water.top, WORLD_WIDTH, LAYERS.water.bottom - LAYERS.water.top);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let y = LAYERS.water.top + 12; y < LAYERS.water.bottom; y += 22) {
      for (let x = (y % 44) - 44; x < WORLD_WIDTH; x += 56) {
        ctx.fillRect(x, y, 24, 2);
      }
    }

    ctx.fillStyle = "#8b7355";
    ctx.fillRect(0, LAYERS.soil.top, WORLD_WIDTH, WORLD_HEIGHT - LAYERS.soil.top);
    ctx.fillStyle = "#6d563d";
    for (let y = LAYERS.soil.top; y < WORLD_HEIGHT; y += 13) {
      for (let x = (y % 26) - 8; x < WORLD_WIDTH; x += 26) {
        ctx.fillRect(x, y, 10, 3);
      }
    }

    for (const dot of this.noise) {
      if (dot.y < LAYERS.air.bottom) {
        ctx.fillStyle = dot.shade > 0.55 ? "rgba(255,255,255,0.2)" : "rgba(52,94,85,0.11)";
      } else if (dot.y < LAYERS.water.bottom) {
        ctx.fillStyle = dot.shade > 0.45 ? "rgba(255,255,255,0.18)" : "rgba(24,80,96,0.15)";
      } else {
        ctx.fillStyle = dot.shade > 0.5 ? "rgba(190,160,108,0.35)" : "rgba(60,42,28,0.28)";
      }
      ctx.fillRect(dot.x, dot.y, 2, 2);
    }

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, LAYERS.water.top - 2, WORLD_WIDTH, 2);
    ctx.fillRect(0, LAYERS.soil.top - 2, WORLD_WIDTH, 2);
  }

  drawCreatures(ctx, creatures, elapsedMs) {
    const sorted = [...creatures].sort((a, b) => a.y - b.y);
    for (const creature of sorted) {
      if (creature.dead) {
        continue;
      }
      const wiggle = Math.sin(elapsedMs / 160 + creature.id) * (creature.type === "plant" ? 0.5 : 1.8);
      ctx.save();
      ctx.translate(Math.round(creature.x), Math.round(creature.y + wiggle));
      if (creature.vx < -0.02) {
        ctx.scale(-1, 1);
      }
      if (creature.type === "plant") {
        this.drawPlant(ctx, creature);
      } else if (creature.type === "herbivore") {
        this.drawHerbivore(ctx, creature, elapsedMs);
      } else {
        this.drawPredator(ctx, creature, elapsedMs);
      }
      ctx.restore();
    }
  }

  drawPlant(ctx, creature) {
    const scale = clamp(creature.size / 7, 0.7, 1.45);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#3b6b2d";
    ctx.fillRect(-PIXEL, -2 * PIXEL, PIXEL, 5 * PIXEL);
    ctx.fillStyle = creature.color;
    ctx.fillRect(-4 * PIXEL, -4 * PIXEL, 3 * PIXEL, 2 * PIXEL);
    ctx.fillRect(PIXEL, -5 * PIXEL, 3 * PIXEL, 2 * PIXEL);
    ctx.fillRect(-2 * PIXEL, -7 * PIXEL, 3 * PIXEL, 2 * PIXEL);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(PIXEL, -5 * PIXEL, PIXEL, PIXEL);
  }

  drawHerbivore(ctx, creature, elapsedMs) {
    const scale = clamp(creature.size / 11, 0.52, 1.02);
    const step = Math.floor(Math.sin(elapsedMs / 95 + creature.id) * PIXEL);
    const variant = creature.id % 4;
    ctx.scale(scale, scale);

    if (variant === 0) {
      this.drawBeetleBug(ctx, creature, step);
    } else if (variant === 1) {
      this.drawSeedBug(ctx, creature, step);
    } else if (variant === 2) {
      this.drawSkimmerBug(ctx, creature, step);
    } else {
      this.drawShellBug(ctx, creature, step);
    }
  }

  drawBeetleBug(ctx, creature, step) {
    ctx.fillStyle = "#1d2930";
    this.drawPixelRows(ctx, [
      [-3, -2, 5],
      [-2, -4, 9],
      [-1, -5, 11],
      [0, -5, 11],
      [1, -4, 9],
      [2, -2, 5]
    ]);
    ctx.fillStyle = creature.color;
    this.drawPixelRows(ctx, [
      [-2, -2, 5],
      [-1, -3, 7],
      [0, -3, 7],
      [1, -2, 5]
    ]);
    this.drawTinyFeet(ctx, step, 4);
    this.drawCreatureShine(ctx, -1, -1);
    this.drawCreatureEye(ctx, 3, -1);
  }

  drawSeedBug(ctx, creature, step) {
    ctx.fillStyle = "#1d2930";
    this.drawPixelRows(ctx, [
      [-4, 0, 2],
      [-3, -2, 6],
      [-2, -4, 9],
      [-1, -5, 11],
      [0, -4, 9],
      [1, -2, 6],
      [2, 0, 2]
    ]);
    ctx.fillStyle = creature.color;
    this.drawPixelRows(ctx, [
      [-3, -1, 3],
      [-2, -2, 6],
      [-1, -3, 7],
      [0, -2, 6],
      [1, -1, 3]
    ]);
    ctx.fillStyle = "#1d2930";
    ctx.fillRect(4 * PIXEL, -2 * PIXEL, 2 * PIXEL, PIXEL);
    this.drawTinyFeet(ctx, step, 3);
    this.drawCreatureShine(ctx, -1, -2);
    this.drawCreatureEye(ctx, 2, -2);
  }

  drawSkimmerBug(ctx, creature, step) {
    ctx.fillStyle = "#1d2930";
    this.drawPixelRows(ctx, [
      [-2, -5, 8],
      [-1, -6, 12],
      [0, -5, 11],
      [1, -3, 7],
      [2, -1, 3]
    ]);
    ctx.fillStyle = creature.color;
    this.drawPixelRows(ctx, [
      [-1, -4, 7],
      [0, -3, 7],
      [1, -2, 4]
    ]);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(-5 * PIXEL, -4 * PIXEL, 5 * PIXEL, PIXEL);
    ctx.fillRect(-4 * PIXEL, 3 * PIXEL, 4 * PIXEL, PIXEL);
    this.drawTinyFeet(ctx, step, 2);
    this.drawCreatureEye(ctx, 3, -1);
  }

  drawShellBug(ctx, creature, step) {
    ctx.fillStyle = "#1d2930";
    this.drawPixelRows(ctx, [
      [-4, -1, 3],
      [-3, -3, 7],
      [-2, -4, 9],
      [-1, -5, 11],
      [0, -5, 11],
      [1, -4, 9],
      [2, -2, 5]
    ]);
    ctx.fillStyle = creature.color;
    this.drawPixelRows(ctx, [
      [-3, -1, 3],
      [-2, -2, 5],
      [-1, -3, 7],
      [0, -3, 7],
      [1, -2, 5]
    ]);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-PIXEL, -3 * PIXEL, PIXEL, 5 * PIXEL);
    this.drawTinyFeet(ctx, step, 4);
    this.drawCreatureShine(ctx, -2, -1);
    this.drawCreatureEye(ctx, 3, -2);
  }

  drawPixelRows(ctx, rows) {
    for (const [row, start, width] of rows) {
      ctx.fillRect(start * PIXEL, row * PIXEL, width * PIXEL, PIXEL);
    }
  }

  drawTinyFeet(ctx, step, spread) {
    ctx.fillStyle = "#1d2930";
    ctx.fillRect(-spread * PIXEL, -3 * PIXEL + step, PIXEL, PIXEL);
    ctx.fillRect(spread * PIXEL, 2 * PIXEL - step, PIXEL, PIXEL);
  }

  drawCreatureShine(ctx, x, y) {
    ctx.fillStyle = "rgba(255,255,255,0.36)";
    ctx.fillRect(x * PIXEL, y * PIXEL, 2 * PIXEL, PIXEL);
  }

  drawCreatureEye(ctx, x, y) {
    ctx.fillStyle = "#101010";
    ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
  }

  drawPredator(ctx, creature, elapsedMs) {
    const scale = clamp(creature.size / 11, 0.8, 1.55);
    const jaw = Math.sin(elapsedMs / 140 + creature.id) > 0 ? 1 : 0;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#101010";
    ctx.fillRect(-5 * PIXEL, -4 * PIXEL, 9 * PIXEL, 8 * PIXEL);
    ctx.fillStyle = creature.color;
    ctx.fillRect(-6 * PIXEL, -3 * PIXEL, 10 * PIXEL, 6 * PIXEL);
    ctx.fillRect(2 * PIXEL, -5 * PIXEL, 3 * PIXEL, 4 * PIXEL);
    ctx.fillStyle = "#fff069";
    ctx.fillRect(2 * PIXEL, -3 * PIXEL, PIXEL, PIXEL);
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(5 * PIXEL, -PIXEL + jaw, PIXEL, PIXEL);
    ctx.fillRect(5 * PIXEL, PIXEL + jaw, PIXEL, PIXEL);
  }

  drawEffects(ctx, effects) {
    for (const effect of effects) {
      const progress = effect.age / effect.life;
      const radius = Math.floor(4 + progress * 18);
      ctx.globalAlpha = clamp(1 - progress, 0, 1);
      ctx.fillStyle = effect.color ?? "#ffffff";

      if (effect.type === "death") {
        for (let index = 0; index < 6; index += 1) {
          const angle = (Math.PI * 2 * index) / 6;
          ctx.fillRect(
            Math.round(effect.x + Math.cos(angle) * radius),
            Math.round(effect.y + Math.sin(angle) * radius),
            3,
            3
          );
        }
      } else if (effect.type === "birth") {
        ctx.strokeStyle = effect.color ?? "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(effect.x - radius / 2, effect.y - radius / 2, radius, radius);
      } else {
        ctx.fillRect(effect.x - 2, effect.y - radius / 3, 4, 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawGlass(ctx, health, elapsedMs) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = "#dff8ff";
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(34, 16);
    ctx.lineTo(190, 156);
    ctx.moveTo(212, 12);
    ctx.lineTo(382, 172);
    ctx.stroke();

    if (health === "extinct" || health === "dying") {
      ctx.globalAlpha = 0.05 + Math.sin(elapsedMs / 90) * 0.02;
      ctx.fillStyle = "#ff4f7b";
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#101010";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, WORLD_WIDTH - 3, WORLD_HEIGHT - 3);
    ctx.restore();
  }
}
