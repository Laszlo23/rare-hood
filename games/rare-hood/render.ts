import { spriteFrame, type GenerationSprites } from "@rarefriends/friendsdk/sprites";
import { rayHit, type Guard, type Sim, type Vec } from "./engine";

const ART = 16;

export function chooseScale(viewW: number, viewH: number): number {
  const byH = Math.floor(viewH / (11 * ART));
  const byW = Math.floor(viewW / (15 * ART));
  return Math.max(2, Math.min(4, Math.min(byH, byW)));
}

type Ctx = CanvasRenderingContext2D;

function pix(ctx: Ctx, originX: number, originY: number, scale: number, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(originX + x * scale, originY + y * scale, w * scale, h * scale);
}

function drawFloor(ctx: Ctx, ox: number, oy: number, scale: number, col: number, row: number) {
  const alt = (col + row) % 2 === 0;
  pix(ctx, ox, oy, scale, 0, 0, 16, 16, alt ? "#1a1240" : "#221850");
  pix(ctx, ox, oy, scale, 0, 15, 16, 1, "#120c30");
  if ((col * 3 + row) % 7 === 0) pix(ctx, ox, oy, scale, 4, 6, 5, 1, "#312468");
}

function drawWall(ctx: Ctx, ox: number, oy: number, scale: number, col: number, row: number) {
  pix(ctx, ox, oy, scale, 0, 0, 16, 16, "#100828");
  pix(ctx, ox, oy, scale, 0, 0, 16, 3, "#6a48e8");
  pix(ctx, ox, oy, scale, 0, 13, 16, 3, "#070414");
  const brick = (col + row) % 2 === 0 ? 2 : 8;
  pix(ctx, ox, oy, scale, brick, 5, 6, 4, "#2a1860");
  pix(ctx, ox, oy, scale, brick, 5, 6, 1, "#8d6bff");
}

function drawPillar(ctx: Ctx, ox: number, oy: number, scale: number) {
  drawFloor(ctx, ox, oy, scale, 1, 1);
  pix(ctx, ox, oy, scale, 3, 2, 10, 12, "#4c3a96");
  pix(ctx, ox, oy, scale, 5, 3, 2, 10, "#d8ccff");
  pix(ctx, ox, oy, scale, 2, 1, 12, 2, "#efe8ff");
  pix(ctx, ox, oy, scale, 2, 13, 12, 2, "#1a1038");
}

function drawCrate(ctx: Ctx, ox: number, oy: number, scale: number) {
  drawFloor(ctx, ox, oy, scale, 0, 1);
  pix(ctx, ox, oy, scale, 2, 4, 12, 10, "#8a4b22");
  pix(ctx, ox, oy, scale, 2, 4, 12, 2, "#e39a55");
  pix(ctx, ox, oy, scale, 7, 4, 2, 10, "#5c2e12");
  pix(ctx, ox, oy, scale, 2, 8, 12, 2, "#5c2e12");
}

function drawTorch(ctx: Ctx, ox: number, oy: number, scale: number, time: number, reduced: boolean) {
  drawFloor(ctx, ox, oy, scale, 2, 3);
  pix(ctx, ox, oy, scale, 7, 7, 2, 8, "#6b4428");
  const flick = reduced ? 0 : Math.sin(time * 11 + ox) > 0 ? 1 : 0;
  pix(ctx, ox, oy, scale, 5, 2 + flick, 6, 5, "#ffb020");
  pix(ctx, ox, oy, scale, 6, 3 + flick, 4, 3, "#fff1b0");
  pix(ctx, ox, oy, scale, 7, 1 + flick, 2, 2, "#ff4d8d");
}

function drawBanner(ctx: Ctx, ox: number, oy: number, scale: number) {
  drawFloor(ctx, ox, oy, scale, 4, 2);
  pix(ctx, ox, oy, scale, 4, 1, 8, 2, "#ffd24a");
  pix(ctx, ox, oy, scale, 5, 3, 6, 10, "#ff2d8a");
  pix(ctx, ox, oy, scale, 7, 3, 2, 10, "#7a1048");
  pix(ctx, ox, oy, scale, 5, 12, 2, 2, "#ff2d8a");
  pix(ctx, ox, oy, scale, 9, 12, 2, 2, "#ff2d8a");
}

function drawPouch(ctx: Ctx, ox: number, oy: number, scale: number, time: number, reduced: boolean) {
  const bob = reduced ? 0 : Math.sin(time * 4 + ox) > 0 ? 0 : 1;
  pix(ctx, ox, oy, scale, 5, 6 + bob, 6, 6, "#ffd24a");
  pix(ctx, ox, oy, scale, 6, 4 + bob, 4, 2, "#c89216");
  pix(ctx, ox, oy, scale, 7, 7 + bob, 2, 2, "#fff6c2");
}

function drawGate(ctx: Ctx, ox: number, oy: number, scale: number, open: boolean, time: number, reduced: boolean) {
  drawFloor(ctx, ox, oy, scale, 0, 0);
  pix(ctx, ox, oy, scale, 2, 2, 12, 13, open ? "#123228" : "#241018");
  pix(ctx, ox, oy, scale, 3, 3, 10, 11, open ? "#1f6b45" : "#4a1830");
  const glow = open && !reduced && Math.sin(time * 5) > 0;
  pix(ctx, ox, oy, scale, 7, 6, 2, 4, glow ? "#d8ffe8" : open ? "#7dffa8" : "#ff4d8d");
  pix(ctx, ox, oy, scale, 1, 1, 14, 1, "#ffd24a");
}

function drawTile(ctx: Ctx, ch: string, ox: number, oy: number, scale: number, col: number, row: number, time: number, reduced: boolean, gateOpen: boolean) {
  if (ch === "#") drawWall(ctx, ox, oy, scale, col, row);
  else if (ch === "P") drawPillar(ctx, ox, oy, scale);
  else if (ch === "C") drawCrate(ctx, ox, oy, scale);
  else if (ch === "T") drawTorch(ctx, ox, oy, scale, time, reduced);
  else if (ch === "B") drawBanner(ctx, ox, oy, scale);
  else if (ch === "$") drawFloor(ctx, ox, oy, scale, col, row);
  else if (ch === "E") drawGate(ctx, ox, oy, scale, gateOpen, time, reduced);
  else drawFloor(ctx, ox, oy, scale, col, row);
}

function drawGuard(ctx: Ctx, guard: Guard, originX: number, originY: number, scale: number) {
  const ox = originX - 8 * scale;
  const oy = originY - 14 * scale;
  const visor = guard.hue === "cyan" ? "#7af7ff" : guard.hue === "amber" ? "#ffd24a" : "#ff4fd8";
  pix(ctx, ox, oy, scale, 4, 9, 8, 5, "#5b3fd4");
  pix(ctx, ox, oy, scale, 5, 13, 2, 3, "#ffd24a");
  pix(ctx, ox, oy, scale, 9, 13, 2, 3, "#ffd24a");
  pix(ctx, ox, oy, scale, 2, 2, 12, 8, "#2a1860");
  pix(ctx, ox, oy, scale, 3, 3, 10, 6, "#8d6bff");
  pix(ctx, ox, oy, scale, 3, 5, 10, 2, visor);
  pix(ctx, ox, oy, scale, 12, 7, 3, 3, visor);
  pix(ctx, ox, oy, scale, 13, 8, 1, 1, "#fff6c2");
  if (guard.duty) {
    pix(ctx, ox, oy, scale, 6, -2, 4, 3, "#ffd24a");
    pix(ctx, ox, oy, scale, 7, -1, 2, 1, "#1a1030");
  }
}

function drawFriendPixels(ctx: Ctx, sprites: GenerationSprites, sim: Sim, ox: number, oy: number, scale: number) {
  const picked = spriteFrame(sprites, sim.facing, sim.walking, sim.frame, sim.side);
  const rows = picked.frame.rows;
  for (let y = 0; y < 16; y += 1) {
    const row = rows[y] ?? "";
    for (let x = 0; x < 16; x += 1) {
      if (row[x] !== "#") continue;
      pix(ctx, ox, oy, scale, x - 1, y, 1, 1, "#f4f0ff");
      pix(ctx, ox, oy, scale, x + 1, y, 1, 1, "#f4f0ff");
      pix(ctx, ox, oy, scale, x, y - 1, 1, 1, "#f4f0ff");
      pix(ctx, ox, oy, scale, x, y + 1, 1, 1, "#f4f0ff");
    }
  }
  for (let y = 0; y < 16; y += 1) {
    const row = rows[y] ?? "";
    for (let x = 0; x < 16; x += 1) {
      if (row[x] === "#") pix(ctx, ox, oy, scale, x, y, 1, 1, "#14081c");
    }
  }
}

function drawHood(ctx: Ctx, ox: number, oy: number, scale: number, filled: boolean) {
  pix(ctx, ox, oy, scale, 2, 10, 4, 7, "#9b1d4a");
  pix(ctx, ox, oy, scale, 10, 10, 4, 8, "#ff4d8d");
  pix(ctx, ox, oy, scale, 3, -1, 10, 4, "#3a1464");
  pix(ctx, ox, oy, scale, 1, 2, 3, 6, "#3a1464");
  pix(ctx, ox, oy, scale, 12, 2, 3, 6, "#3a1464");
  pix(ctx, ox, oy, scale, 12, -2, 2, 2, "#3dff9a");
  if (!filled) {
    pix(ctx, ox, oy, scale, 4, 4, 8, 8, "#f4f0ff");
    pix(ctx, ox, oy, scale, 5, 6, 2, 2, "#14081c");
    pix(ctx, ox, oy, scale, 9, 6, 2, 2, "#14081c");
  }
}

function drawHero(ctx: Ctx, sim: Sim, sprites: GenerationSprites | null, tile: number, camX: number, camY: number, scale: number) {
  const ox = sim.x * tile - camX - 8 * scale;
  const oy = sim.y * tile - camY - 12 * scale;
  drawHood(ctx, ox, oy, scale, sprites !== null);
  if (sprites) drawFriendPixels(ctx, sprites, sim, ox, oy, scale);
  const alertH = Math.round(sim.alert * 10);
  if (alertH > 0) {
    pix(ctx, ox, oy, scale, 3, 18, 10, 1, "#3a1830");
    pix(ctx, ox, oy, scale, 3, 18, alertH, 1, "#ff2d6a");
  }
}

function beamColor(hue: Guard["hue"], alpha: number): string {
  if (hue === "cyan") return `rgba(90, 255, 244, ${alpha})`;
  if (hue === "magenta") return `rgba(255, 79, 216, ${alpha})`;
  return `rgba(255, 190, 60, ${alpha})`;
}

function drawBeams(ctx: Ctx, sim: Sim, tile: number, camX: number, camY: number, reduced: boolean) {
  ctx.save();
  ctx.translate(-camX, -camY);
  ctx.globalCompositeOperation = "lighter";
  sim.guards.forEach((guard, index) => {
    const flick = reduced ? 1 : 0.82 + Math.sin(sim.time * 7 + index) * 0.18;
    const gx = guard.x * tile;
    const gy = guard.y * tile;
    const reach = guard.beamLength * tile;
    const gradient = ctx.createRadialGradient(gx, gy, scaleSafe(tile), gx, gy, reach);
    gradient.addColorStop(0, beamColor(guard.hue, 0.72 * flick));
    gradient.addColorStop(0.45, beamColor(guard.hue, 0.28 * flick));
    gradient.addColorStop(1, beamColor(guard.hue, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    const steps = 16;
    for (let i = 0; i <= steps; i += 1) {
      const angle = guard.facing - guard.beamHalf + (2 * guard.beamHalf * i) / steps;
      const hit = rayHit(sim.level.rows, guard.x, guard.y, angle, guard.beamLength);
      ctx.lineTo(hit.x * tile, hit.y * tile);
    }
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function scaleSafe(tile: number): number {
  return Math.max(2, tile * 0.15);
}

function playInsets(viewW: number, viewH: number) {
  const compact = viewW < 520;
  return {
    top: compact ? 50 : 56,
    bottom: Math.max(56, Math.min(112, Math.round(viewH * (compact ? 0.42 : 0.1)))),
    left: compact ? 78 : 0,
    right: compact ? 88 : 0,
  };
}

function cameraOffset(player: number, view: number, map: number, safeStart: number, safeEnd: number): number {
  const focus = (safeStart + safeEnd) / 2;
  const ideal = player - focus;
  const keepMin = player - safeEnd;
  const keepMax = player - safeStart;
  const preferMin = Math.min(0, map - view);
  const preferMax = Math.max(0, map - view);
  const low = Math.max(keepMin, preferMin);
  const high = Math.min(keepMax, preferMax);
  if (low <= high) return Math.min(high, Math.max(low, ideal));
  return Math.min(keepMax, Math.max(keepMin, ideal));
}

export function worldFromScreen(sim: Sim, viewW: number, viewH: number, screenX: number, screenY: number): Vec {
  const scale = chooseScale(viewW, viewH);
  const tile = ART * scale;
  const mapW = (sim.level.rows[0]?.length ?? 0) * tile;
  const mapH = sim.level.rows.length * tile;
  const insets = playInsets(viewW, viewH);
  const camX = cameraOffset(sim.x * tile, viewW, mapW, insets.left, viewW - insets.right);
  const camY = cameraOffset(sim.y * tile, viewH, mapH, insets.top, viewH - insets.bottom);
  return { x: (screenX + camX) / tile, y: (screenY + camY) / tile };
}

function drawCoin(ctx: Ctx, x: number, y: number, scale: number) {
  pix(ctx, x, y, scale, -2, -2, 5, 5, "#c89216");
  pix(ctx, x, y, scale, -1, -1, 3, 3, "#ffd24a");
  pix(ctx, x, y, scale, 0, 0, 1, 1, "#fff6c2");
}

export function drawScene(
  ctx: Ctx,
  sim: Sim,
  viewW: number,
  viewH: number,
  sprites: GenerationSprites | null,
  reducedMotion: boolean,
) {
  const scale = chooseScale(viewW, viewH);
  const tile = ART * scale;
  const mapW = (sim.level.rows[0]?.length ?? 0) * tile;
  const mapH = sim.level.rows.length * tile;
  const insets = playInsets(viewW, viewH);
  const camX = cameraOffset(sim.x * tile, viewW, mapW, insets.left, viewW - insets.right);
  const camY = cameraOffset(sim.y * tile, viewH, mapH, insets.top, viewH - insets.bottom);
  const shake = reducedMotion ? 0 : sim.shake;
  const sx = shake ? Math.sin(sim.time * 58) * shake * 10 : 0;
  const sy = shake ? Math.cos(sim.time * 47) * shake * 8 : 0;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = "#070414";
  ctx.fillRect(-8, -8, viewW + 16, viewH + 16);
  const open = sim.taken.every(Boolean);
  sim.level.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      drawTile(ctx, ch, x * tile - camX, y * tile - camY, scale, x, y, sim.time, reducedMotion, open);
    });
  });
  sim.level.pouches.forEach((pouch, index) => {
    if (sim.taken[index]) return;
    drawPouch(ctx, pouch.x * tile - camX - tile / 2, pouch.y * tile - camY - tile / 2, scale, sim.time + index, reducedMotion);
  });
  drawBeams(ctx, sim, tile, camX, camY, reducedMotion);
  const actors = [
    ...sim.guards.map(guard => ({ y: guard.y, draw: () => drawGuard(ctx, guard, guard.x * tile - camX, guard.y * tile - camY, scale) })),
    { y: sim.y, draw: () => drawHero(ctx, sim, sprites, tile, camX, camY, scale) },
  ].sort((a, b) => a.y - b.y);
  for (const actor of actors) actor.draw();
  if (sim.aim) {
    const markerX = sim.aim.x * tile - camX;
    const markerY = sim.aim.y * tile - camY;
    const called = sim.guards[sim.aimGuard];
    ctx.strokeStyle = called ? "#7af7ff" : "#ff4d8d";
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.arc(markerX, markerY, tile * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    if (called) {
      ctx.setLineDash([scale * 2, scale * 2]);
      ctx.beginPath();
      ctx.moveTo(called.x * tile - camX, called.y * tile - camY);
      ctx.lineTo(markerX, markerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (sim.flight) {
    const flight = sim.flight;
    const progress = Math.min(1, flight.t);
    const worldX = flight.fromX + (flight.toX - flight.fromX) * progress;
    const worldY = flight.fromY + (flight.toY - flight.fromY) * progress;
    const lift = Math.sin(progress * Math.PI) * tile * 0.75;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(worldX * tile - camX - scale, worldY * tile - camY, scale * 3, scale);
    drawCoin(ctx, worldX * tile - camX, worldY * tile - camY - lift, scale);
  }
  if (sim.lure && sim.lureLife > 0) {
    const pulse = reducedMotion ? 1 : 0.65 + Math.sin(sim.time * 10) * 0.35;
    ctx.globalAlpha = pulse;
    drawCoin(ctx, sim.lure.x * tile - camX, sim.lure.y * tile - camY, scale);
    ctx.globalAlpha = 1;
  }
  if (!reducedMotion) {
    for (const particle of sim.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x * tile - camX, particle.y * tile - camY, scale, scale);
      ctx.globalAlpha = 1;
    }
  }
  if (sim.alert > 0.04) {
    ctx.fillStyle = `rgba(255, 24, 80, ${sim.alert * 0.28})`;
    ctx.fillRect(0, 0, viewW, Math.max(8, viewH * 0.08));
    ctx.fillRect(0, viewH - Math.max(8, viewH * 0.08), viewW, Math.max(8, viewH * 0.1));
  }
  ctx.restore();
}
