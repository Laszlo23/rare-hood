import { castleLimit, cell, validateLevels, type BeamHue, type GuardDef, type Level, type Vec } from "./engine";

const WIDTH = 22;
const HEIGHT = 15;

type Grid = string[][];

function grid(): Grid {
  const rows: Grid = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < WIDTH; x += 1) {
      row.push(x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ? "#" : ".");
    }
    rows.push(row);
  }
  return rows;
}

function walled(): Grid {
  const rows = grid();
  for (let y = 1; y < HEIGHT - 1; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) rows[y][x] = "#";
  }
  return rows;
}

function stamp(rows: Grid, x: number, y: number, ch: string) {
  const row = rows[y];
  if (!row || x < 0 || x >= row.length) throw new Error(`Stamp ${ch} missed the map at ${x},${y}.`);
  row[x] = ch;
}

function hwall(rows: Grid, y: number, x0: number, x1: number, doors: readonly number[]) {
  for (let x = x0; x <= x1; x += 1) stamp(rows, x, y, doors.includes(x) ? "." : "#");
}

function vwall(rows: Grid, x: number, y0: number, y1: number, doors: readonly number[]) {
  for (let y = y0; y <= y1; y += 1) stamp(rows, x, y, doors.includes(y) ? "." : "#");
}

function carveRow(rows: Grid, y: number, x0: number, x1: number) {
  for (let x = x0; x <= x1; x += 1) stamp(rows, x, y, ".");
}

function carveCol(rows: Grid, x: number, y0: number, y1: number) {
  for (let y = y0; y <= y1; y += 1) stamp(rows, x, y, ".");
}

function lines(rows: Grid): string[] {
  return rows.map(row => row.join(""));
}

function guard(
  routes: readonly (readonly Vec[])[],
  speed: number,
  beamLength: number,
  beamHalf: number,
  rerouteEvery: number,
  hue: BeamHue,
): GuardDef {
  return { routes, speed, beamLength, beamHalf, rerouteEvery, hue };
}

function level(
  id: number,
  name: string,
  blurb: string,
  enterLabel: string,
  payout: number,
  rows: Grid,
  guards: readonly GuardDef[],
): Level {
  const text = lines(rows);
  let spawn: Vec | null = null;
  let exit: Vec | null = null;
  const pouches: Vec[] = [];
  text.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "S") spawn = cell(x, y);
      else if (ch === "E") exit = cell(x, y);
      else if (ch === "$") pouches.push(cell(x, y));
    });
  });
  if (!spawn || !exit) throw new Error(`${name} is missing a spawn or exit.`);
  return { id, name, blurb, enterLabel, payout, limit: castleLimit(id), rows: text, spawn, exit, pouches, guards };
}

function gatehouse(): Level {
  const rows = grid();
  hwall(rows, 4, 1, 20, [3, 10, 17]);
  hwall(rows, 10, 1, 20, [3, 10, 17]);
  stamp(rows, 6, 2, "P");
  stamp(rows, 14, 6, "P");
  stamp(rows, 8, 12, "P");
  stamp(rows, 2, 2, "S");
  stamp(rows, 4, 2, "$");
  stamp(rows, 11, 7, "$");
  stamp(rows, 16, 12, "$");
  stamp(rows, 19, 2, "E");
  stamp(rows, 2, 6, "T");
  stamp(rows, 19, 8, "T");
  stamp(rows, 5, 12, "B");
  const home = cell(2, 7);
  return level(1, "Gatehouse", "One guard walks the hall, then climbs into the east gallery.", "Enter the Gatehouse", 5, rows, [
    guard([
      [home, cell(19, 7)],
      [home, cell(17, 7), cell(17, 2), cell(15, 2)],
    ], 1.35, 4.2, 0.36, 28, "amber"),
  ]);
}

function greatHall(): Level {
  const rows = grid();
  hwall(rows, 4, 1, 20, [5, 16]);
  hwall(rows, 11, 1, 20, [5, 16]);
  stamp(rows, 8, 3, "P");
  stamp(rows, 14, 3, "P");
  stamp(rows, 10, 9, "C");
  stamp(rows, 7, 13, "P");
  stamp(rows, 2, 2, "S");
  stamp(rows, 4, 2, "$");
  stamp(rows, 18, 2, "$");
  stamp(rows, 6, 8, "$");
  stamp(rows, 15, 8, "$");
  stamp(rows, 19, 13, "E");
  stamp(rows, 3, 8, "T");
  stamp(rows, 18, 6, "T");
  stamp(rows, 12, 13, "B");
  const west = cell(3, 8);
  const east = cell(16, 8);
  return level(2, "Great Hall", "Two beams cross the hall. Wait for a guard to leave the floor.", "Enter the Great Hall", 8, rows, [
    guard([
      [west, cell(18, 8)],
      [west, cell(5, 8), cell(5, 2), cell(12, 2)],
    ], 1.55, 4.8, 0.38, 16, "cyan"),
    guard([
      [east, cell(4, 8)],
      [east, cell(16, 13), cell(10, 13)],
    ], 1.55, 4.8, 0.38, 16, "amber"),
  ]);
}

function treasury(): Level {
  const rows = grid();
  vwall(rows, 7, 1, 13, [7]);
  vwall(rows, 14, 1, 13, [7]);
  stamp(rows, 4, 5, "C");
  stamp(rows, 11, 10, "C");
  stamp(rows, 16, 5, "C");
  stamp(rows, 2, 2, "S");
  stamp(rows, 5, 3, "$");
  stamp(rows, 12, 4, "$");
  stamp(rows, 19, 3, "$");
  stamp(rows, 2, 11, "$");
  stamp(rows, 18, 12, "E");
  stamp(rows, 3, 7, "T");
  stamp(rows, 18, 7, "T");
  stamp(rows, 10, 7, "B");
  const left = cell(3, 7);
  const mid = cell(10, 7);
  const right = cell(17, 7);
  return level(3, "Treasury", "Longer beams fill the galleries. Crates break the light.", "Enter the Treasury", 12, rows, [
    guard([
      [left, cell(18, 7)],
      [left, cell(3, 2), cell(5, 2)],
    ], 1.7, 5.6, 0.4, 12, "amber"),
    guard([
      [mid, cell(10, 2), cell(12, 2)],
      [mid, cell(10, 12), cell(8, 12)],
    ], 1.75, 5.6, 0.4, 12, "magenta"),
    guard([
      [right, cell(17, 2), cell(19, 2)],
      [right, cell(17, 12), cell(19, 12)],
    ], 1.7, 5.8, 0.42, 12, "cyan"),
  ]);
}

function dungeon(): Level {
  const rows = walled();
  carveRow(rows, 2, 1, 19);
  carveRow(rows, 7, 1, 19);
  carveRow(rows, 12, 1, 19);
  carveCol(rows, 3, 2, 12);
  carveCol(rows, 10, 2, 12);
  carveCol(rows, 17, 2, 12);
  for (const [x, y] of [[5, 3], [8, 6], [14, 3], [15, 11], [6, 11], [12, 8]] as const) stamp(rows, x, y, ".");
  stamp(rows, 1, 2, "S");
  stamp(rows, 5, 3, "$");
  stamp(rows, 8, 6, "$");
  stamp(rows, 14, 3, "$");
  stamp(rows, 15, 11, "$");
  stamp(rows, 19, 12, "E");
  stamp(rows, 6, 2, "T");
  stamp(rows, 12, 7, "T");
  stamp(rows, 8, 12, "B");
  const top = cell(3, 2);
  const mid = cell(10, 7);
  const south = cell(17, 12);
  return level(4, "Dungeon", "The corridors are tight. Niches sit just outside the beam.", "Enter the Dungeon", 16, rows, [
    guard([
      [top, cell(17, 2)],
      [top, cell(3, 12)],
    ], 1.9, 5.2, 0.33, 10, "cyan"),
    guard([
      [mid, cell(1, 7)],
      [mid, cell(19, 7)],
      [mid, cell(10, 2)],
      [mid, cell(10, 12)],
    ], 1.9, 5.2, 0.33, 10, "amber"),
    guard([
      [south, cell(3, 12)],
      [south, cell(17, 2)],
    ], 2, 5.2, 0.33, 10, "magenta"),
  ]);
}

function throne(): Level {
  const rows = grid();
  for (const [x, y] of [[4, 3], [8, 3], [12, 3], [16, 3], [4, 7], [8, 7], [12, 7], [16, 7], [4, 11], [8, 11], [12, 11], [16, 11]] as const) {
    stamp(rows, x, y, "P");
  }
  stamp(rows, 6, 6, "C");
  stamp(rows, 14, 8, "C");
  stamp(rows, 2, 2, "S");
  stamp(rows, 6, 2, "$");
  stamp(rows, 14, 5, "$");
  stamp(rows, 3, 9, "$");
  stamp(rows, 18, 10, "$");
  stamp(rows, 9, 12, "$");
  stamp(rows, 19, 13, "E");
  stamp(rows, 2, 7, "T");
  stamp(rows, 19, 5, "T");
  stamp(rows, 10, 1, "B");
  stamp(rows, 10, 13, "B");
  const west = cell(2, 5);
  const heart = cell(10, 5);
  const east = cell(18, 9);
  const foot = cell(6, 13);
  return level(5, "Throne Vault", "Four guards swap lanes. Pillars are the only dark.", "Enter the Throne Vault", 24, rows, [
    guard([
      [west, cell(18, 5)],
      [west, cell(2, 12)],
    ], 2.05, 6.2, 0.46, 5, "amber"),
    guard([
      [heart, cell(10, 1)],
      [heart, cell(10, 13)],
      [heart, cell(2, 5)],
      [heart, cell(18, 5)],
    ], 2.05, 6.2, 0.46, 5, "cyan"),
    guard([
      [east, cell(18, 2)],
      [east, cell(18, 13)],
      [east, cell(6, 9)],
    ], 2.1, 6.2, 0.46, 5, "magenta"),
    guard([
      [foot, cell(18, 13)],
      [foot, cell(6, 9)],
    ], 2.05, 6.2, 0.46, 5, "amber"),
  ]);
}

export const LEVELS: readonly Level[] = [gatehouse(), greatHall(), treasury(), dungeon(), throne()];

validateLevels(LEVELS);
