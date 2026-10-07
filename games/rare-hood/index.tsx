"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { createFriendReader, type GenerationSprites } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import { QUIET_BONUS, catchLine, catchTitle, createSim, formatClock, nearPouch, pouchesLeft, speedBonus, step, type CatchReport, type Input, type Sim } from "./engine";
import { LEVELS } from "./levels";
import { drawScene, worldFromScreen } from "./render";
import "./style.css";

type Phase = "loading" | "error" | "briefing" | "play" | "caught" | "escaped" | "victory";

type Hud = { alert: number; left: number; total: number; near: boolean; coins: number; call: string; clock: number };

const EMPTY_HUD: Hud = { alert: 0, left: 0, total: 0, near: false, coins: 0, call: "", clock: 0 };

function callLabel(sim: Sim): string {
  if (!sim.aim) return "";
  const guard = sim.guards[sim.aimGuard];
  if (!guard) return "Nobody hears that";
  return guard.duty ? `${guard.hue} guard looks again` : `${guard.hue} guard will look`;
}

function hudOf(sim: Sim): Hud {
  return {
    alert: Math.round(sim.alert * 20) / 20,
    left: pouchesLeft(sim),
    total: sim.level.pouches.length,
    near: nearPouch(sim),
    coins: sim.purse,
    call: callLabel(sim),
    clock: Math.ceil(sim.clock),
  };
}

function sameHud(a: Hud, b: Hud): boolean {
  return a.alert === b.alert && a.left === b.left && a.total === b.total && a.near === b.near && a.coins === b.coins && a.call === b.call && a.clock === b.clock;
}

function clockClass(seconds: number): string {
  if (seconds <= 8) return "hood-clock hood-clock-hot";
  if (seconds <= 15) return "hood-clock hood-clock-low";
  return "hood-clock";
}

function overlayKind(phase: Phase): "loading" | "error" | "briefing" | "caught" | "escaped" | "victory" | "none" {
  switch (phase) {
    case "loading":
    case "error":
    case "briefing":
    case "caught":
    case "escaped":
    case "victory":
      return phase;
    case "play":
      return "none";
    default: {
      const never: never = phase;
      return never;
    }
  }
}

export default function RareHood({ friendId, client, paused }: GameComponentProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [levelIndex, setLevelIndex] = useState(0);
  const [hood, setHood] = useState(0);
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [sprites, setSprites] = useState<GenerationSprites | null>(null);
  const [spriteError, setSpriteError] = useState("");
  const [spriteTry, setSpriteTry] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [spare, setSpare] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [report, setReport] = useState<CatchReport | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Sim | null>(null);
  const soundRef = useRef<FriendSoundKit | null>(null);
  const keysRef = useRef(new Set<string>());
  const stickRef = useRef({ x: 0, y: 0, active: false });
  const stealRef = useRef(false);
  const throwRef = useRef(false);
  const aimScreenRef = useRef<{ x: number; y: number } | null>(null);
  const phaseRef = useRef<Phase>("loading");
  const pausedRef = useRef(paused);
  const menuRef = useRef(false);
  const reducedRef = useRef(false);
  const spritesRef = useRef<GenerationSprites | null>(null);
  const hoodLock = useRef(false);
  phaseRef.current = phase;
  pausedRef.current = paused;
  menuRef.current = menu;
  reducedRef.current = reduced;
  spritesRef.current = sprites;

  const level = LEVELS[levelIndex] ?? LEVELS[0];

  useEffect(() => {
    const kit = createFriendSoundKit({ muted: true });
    soundRef.current = kit;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      kit.dispose();
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    setPhase("loading");
    setError("");
    setLevelIndex(0);
    setHood(0);
    setMenu(false);
    hoodLock.current = false;
    const opening = createSim(LEVELS[0]);
    simRef.current = opening;
    setHud(hudOf(opening));
    void client.read().then(snapshot => {
      if (cancel) return;
      if (snapshot.friendId !== friendId) {
        setError("This session does not match the selected Friend.");
        setPhase("error");
        return;
      }
      setPhase("briefing");
    }).catch(cause => {
      if (cancel) return;
      setError(cause instanceof Error ? cause.message : "Could not load the preview.");
      setPhase("error");
    });
    return () => { cancel = true; };
  }, [client, friendId]);

  useEffect(() => {
    let cancel = false;
    setSprites(null);
    setSpriteError("");
    void createFriendReader().read(friendId).then(art => {
      if (!cancel) setSprites(art);
    }).catch(cause => {
      if (!cancel) setSpriteError(cause instanceof Error ? cause.message : "Friend artwork did not load.");
    });
    return () => { cancel = true; };
  }, [friendId, spriteTry]);

  useEffect(() => {
    const keys = keysRef.current;
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      keys.add(event.key);
      const playing = phaseRef.current === "play" && !menuRef.current && !pausedRef.current;
      if ((event.key === "e" || event.key === "E" || event.key === " ") && playing) {
        stealRef.current = true;
        event.preventDefault();
      }
      if ((event.key === "q" || event.key === "Q") && playing) {
        throwRef.current = true;
        event.preventDefault();
      }
      if (event.key.startsWith("Arrow")) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => { keys.delete(event.key); };
    const stop = () => {
      keys.clear();
      stickRef.current = { x: 0, y: 0, active: false };
    };
    const hidden = () => { if (document.hidden) stop(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      const frozen = pausedRef.current || menuRef.current || phaseRef.current !== "play";
      const canvasSize = canvasRef.current;
      const viewW = canvasSize?.clientWidth ?? 0;
      const viewH = canvasSize?.clientHeight ?? 0;
      const pointer = aimScreenRef.current;
      if (sim && !frozen) {
        const aim = pointer && viewW > 0 && viewH > 0 ? worldFromScreen(sim, viewW, viewH, pointer.x, pointer.y) : null;
        const input: Input = { ...readAxes(keysRef.current, stickRef.current), steal: stealRef.current, aim, throwCoin: throwRef.current };
        const result = step(sim, input, dt, reducedRef.current);
        stealRef.current = input.steal;
        throwRef.current = input.throwCoin;
        if (result.stole) soundRef.current?.play("reward");
        if (result.threw) soundRef.current?.play("select");
        if (result.called) soundRef.current?.play("action-ready");
        if (result.alerted || result.hurried) soundRef.current?.play("anticipation");
        if (result.caught) {
          phaseRef.current = "caught";
          setReport(sim.catch);
          setPhase("caught");
          soundRef.current?.play("impact");
        } else if (result.escaped && !hoodLock.current) {
          hoodLock.current = true;
          const bonus = speedBonus(sim.clock);
          setSpare(sim.clock);
          setSpeed(bonus);
          const payout = sim.level.payout + (sim.spotted ? 0 : QUIET_BONUS) + bonus;
          const lastCastle = sim.level.id >= LEVELS.length;
          setQuiet(!sim.spotted);
          setHood(bank => bank + payout);
          phaseRef.current = lastCastle ? "victory" : "escaped";
          setPhase(lastCastle ? "victory" : "escaped");
          soundRef.current?.play(lastCastle ? "reveal-legendary" : "reveal-rare");
        }
      } else {
        stealRef.current = false;
        throwRef.current = false;
      }
      if (sim) {
        const next = hudOf(sim);
        setHud(prev => sameHud(prev, next) ? prev : next);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          const cssW = canvas.clientWidth;
          const cssH = canvas.clientHeight;
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const width = Math.max(1, Math.floor(cssW * dpr));
          const height = Math.max(1, Math.floor(cssH * dpr));
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = false;
          if (cssW > 0 && cssH > 0) drawScene(ctx, sim, cssW, cssH, spritesRef.current, reducedRef.current);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  function trackAim(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    aimScreenRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function unlockSound() {
    void soundRef.current?.unlock();
  }

  function toggleSound() {
    setMuted(current => {
      const next = !current;
      soundRef.current?.setMuted(next);
      if (!next) void soundRef.current?.unlock();
      return next;
    });
  }

  function showLevel(index: number, nextPhase: "briefing" | "play") {
    const castle = LEVELS[index] ?? LEVELS[0];
    simRef.current = createSim(castle);
    hoodLock.current = false;
    setHud(hudOf(simRef.current));
    setReport(null);
    setLevelIndex(index);
    setMenu(false);
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    if (nextPhase === "play") {
      soundRef.current?.play("action-start");
      rootRef.current?.focus();
    }
  }

  const kind = overlayKind(phase);
  const taken = hud.total - hud.left;

  return (
    <div className="hood" ref={rootRef} tabIndex={0} onPointerDown={unlockSound} data-reduced={reduced ? "true" : "false"}>
      <canvas
        ref={canvasRef}
        aria-label="Castle heist"
        onPointerMove={event => { trackAim(event); }}
        onPointerDown={event => {
          if (event.button !== 0) return;
          trackAim(event);
          if (phaseRef.current === "play" && !menuRef.current && !pausedRef.current) throwRef.current = true;
          unlockSound();
        }}
        onPointerLeave={() => { aimScreenRef.current = null; }}
      />
      <div className="hood-hud">
        <div className="hood-chip">
          <strong>{level.name}</strong>
          <span>Castle {level.id} / {LEVELS.length}</span>
          <span className={clockClass(hud.clock)}>{formatClock(hud.clock)}</span>
        </div>
        <div className="hood-chip">
          <span>Pouches {taken}/{hud.total}</span>
          <span className="hood-bank">{hood} simulated HOOD</span>
          <span className="hood-coins">{hud.coins} coins</span>
          {hud.call ? <span className="hood-call">{hud.call}</span> : null}
        </div>
        <div className="hood-alert" aria-label={`Alert ${Math.round(hud.alert * 100)} percent`}>
          <i style={{ width: `${hud.alert * 100}%` }} />
        </div>
        {phase !== "loading" && phase !== "error" && <button type="button" onClick={() => { setMenu(true); unlockSound(); }}>Settings</button>}
      </div>
      {spriteError && phase !== "loading" && phase !== "error" && (
        <button type="button" className="hood-art-retry" onClick={() => setSpriteTry(tryCount => tryCount + 1)}>Retry Friend art</button>
      )}
      {sprites && <p className="hood-family">{sprites.familyName}</p>}
      <div className="hood-touch">
        <Stick onChange={vector => { stickRef.current = vector; }} />
        <button type="button" className="hood-steal" disabled={!hud.near || phase !== "play" || menu || paused} onPointerDown={event => {
          event.preventDefault();
          if (phaseRef.current === "play" && !menuRef.current && !pausedRef.current) stealRef.current = true;
          unlockSound();
        }}>Steal</button>
        <button type="button" className="hood-throw" disabled={hud.coins <= 0 || phase !== "play" || menu || paused} onPointerDown={event => {
          event.preventDefault();
          if (phaseRef.current === "play" && !menuRef.current && !pausedRef.current) throwRef.current = true;
          unlockSound();
        }}>Throw</button>
      </div>
      {menu && (
        <div className="hood-panel" role="dialog" aria-label="Settings">
          <h2>Settings</h2>
          <button type="button" onClick={toggleSound}>{muted ? "Sound off" : "Sound on"}</button>
          <label>
            <input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />
            Reduce motion
          </label>
          <p>Simulated HOOD stays in this browser session. Reloading clears it. Nothing is sent to a wallet.</p>
          <button type="button" onClick={() => setMenu(false)}>Close</button>
        </div>
      )}
      {kind === "loading" && <div className="hood-panel"><p>Loading game…</p></div>}
      {kind === "error" && (
        <div className="hood-panel">
          <p>{error || "Could not load the preview."}</p>
          <button type="button" onClick={() => {
            setPhase("loading");
            setError("");
            void client.read().then(snapshot => {
              if (snapshot.friendId !== friendId) {
                setError("This session does not match the selected Friend.");
                setPhase("error");
                return;
              }
              simRef.current = createSim(LEVELS[0]);
              setLevelIndex(0);
              setPhase("briefing");
            }).catch(cause => {
              setError(cause instanceof Error ? cause.message : "Could not load the preview.");
              setPhase("error");
            });
          }}>Retry</button>
        </div>
      )}
      {kind === "briefing" && !menu && (
        <div className="hood-panel">
          <p className="hood-kicker">Rare Hood</p>
          <h2>{level.name}</h2>
          <p>{level.blurb}</p>
          <p>{level.guards.length} {level.guards.length === 1 ? "guard" : "guards"} · escape pays <strong>{level.payout} simulated HOOD</strong> · clear it in <strong>{formatClock(level.limit)}</strong></p>
          <p>You carry <strong>{hud.coins} coins</strong>. Throw one onto a tile and the nearest guard who can hear it leaves the route to look. Stay unseen for <strong>+{QUIET_BONUS} simulated HOOD</strong>. Every 10 seconds left on the clock adds <strong>+1 simulated HOOD</strong>.</p>
          <button type="button" onClick={() => showLevel(levelIndex, "play")}>{level.enterLabel}</button>
        </div>
      )}
      {kind === "caught" && !menu && (
        <div className="hood-panel" role="status">
          <h2>{report ? catchTitle(report) : "Caught"}</h2>
          <p>{report ? catchLine(report) : "The castle stopped the heist."}</p>
          {report && <p>You lasted {formatClock(report.limit - report.clock)} of {formatClock(report.limit)}. This castle&apos;s simulated HOOD stays in the vault.</p>}
          <button type="button" onClick={() => showLevel(levelIndex, "play")}>Retry this castle</button>
        </div>
      )}
      {kind === "escaped" && !menu && (
        <div className="hood-panel" role="status">
          <h2>Out the gate</h2>
          <p>+{level.payout} simulated HOOD{quiet ? ` and +${QUIET_BONUS} for a quiet getaway` : ""}{speed > 0 ? ` and +${speed} for time left` : ""}. Finished with {formatClock(spare)} still on the clock. Banked {hood}.</p>
          <button type="button" onClick={() => showLevel(levelIndex + 1, "briefing")}>Next castle</button>
        </div>
      )}
      {kind === "victory" && !menu && (
        <div className="hood-panel" role="status">
          <h2>The throne is light</h2>
          <p>You banked {hood} simulated HOOD. The preview does not transfer it.</p>
          <button type="button" onClick={() => showLevel(0, "briefing")}>Play the Gatehouse again</button>
        </div>
      )}
    </div>
  );
}

function readAxes(keys: Set<string>, stick: { x: number; y: number; active: boolean }): Pick<Input, "x" | "y" | "sneak"> {
  let x = 0;
  let y = 0;
  if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("d") || keys.has("D") || keys.has("ArrowRight")) x += 1;
  if (keys.has("w") || keys.has("W") || keys.has("ArrowUp")) y -= 1;
  if (keys.has("s") || keys.has("S") || keys.has("ArrowDown")) y += 1;
  if (stick.active) {
    x += stick.x;
    y += stick.y;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y, sneak: keys.has("Shift") };
}

function Stick({ onChange }: { onChange: (vector: { x: number; y: number; active: boolean }) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  function update(event: ReactPointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    setKnob({ x, y });
    onChange({ x, y, active: true });
  }
  function release() {
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0, active: false });
  }
  return (
    <div
      className="hood-stick"
      ref={ref}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <i style={{ transform: `translate(${knob.x * 24}px, ${knob.y * 24}px)` }} />
    </div>
  );
}
