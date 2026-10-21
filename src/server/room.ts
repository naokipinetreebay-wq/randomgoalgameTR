import { WebSocket } from "ws";
import {
  ColorCountConfig,
  DEFAULT_CONFIG,
  GoalColor,
  RoomConfig,
  RoomSnapshot,
  TimingMode,
  TransitionMode,
} from "../lib/types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 90 * 60 * 1000;
const MAX_DISPLAYS = 12;
/** Must match DisplayScreen local timings */
const TRANSITION_LEAD_MS: Record<TransitionMode, number> = {
  instant: 0,
  countdown: 0,
  blink: 0,
  fade: 0,
};
const BLACK_GAP_MS = 280;

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pickTransition(config: RoomConfig): TransitionMode {
  if (config.transition !== "random") return config.transition;
  const options: TransitionMode[] = ["instant", "countdown", "blink", "fade"];
  return options[Math.floor(Math.random() * options.length)];
}

function nextIntervalMs(config: RoomConfig): number {
  if (config.timingMode === "fixed") {
    return Math.max(0.5, config.fixedSeconds) * 1000;
  }
  if (config.timingMode === "random") {
    const min = Math.min(config.randomMinSeconds, config.randomMaxSeconds);
    const max = Math.max(config.randomMinSeconds, config.randomMaxSeconds);
    return (min + Math.random() * (max - min)) * 1000;
  }
  return 0;
}

function activeColors(config: RoomConfig): GoalColor[] {
  return config.colorCount === 2 ? ["blue", "vermilion"] : ["blue", "vermilion", "yellow"];
}

function sampleCount(cfg: ColorCountConfig, n: number): number {
  if (cfg.mode === "fixed") return clamp(cfg.fixed, 0, n);
  const min = clamp(Math.min(cfg.min, cfg.max), 0, n);
  const max = clamp(Math.max(cfg.min, cfg.max), 0, n);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Partition N slots across colors so totals equal N. */
function partitionCounts(config: RoomConfig, n: number): Record<GoalColor, number> {
  const colors = activeColors(config);
  const raw: Record<GoalColor, number> = { blue: 0, vermilion: 0, yellow: 0 };
  for (const c of colors) {
    raw[c] = sampleCount(config[c], n);
  }

  let sum = colors.reduce((s, c) => s + raw[c], 0);

  if (sum === 0 && n > 0) {
    raw[colors[Math.floor(Math.random() * colors.length)]] = n;
    sum = n;
  }

  if (sum > n) {
    let overflow = sum - n;
    const order = shuffle(colors);
    while (overflow > 0) {
      for (const c of order) {
        if (overflow <= 0) break;
        if (raw[c] > 0) {
          raw[c] -= 1;
          overflow -= 1;
        }
      }
      if (order.every((c) => raw[c] === 0) && overflow > 0) break;
    }
  } else if (sum < n) {
    let need = n - sum;
    const order = shuffle(colors);
    let i = 0;
    while (need > 0) {
      raw[order[i % order.length]] += 1;
      need -= 1;
      i += 1;
    }
  }

  return raw;
}

export type ClientSocket = WebSocket & {
  role?: "controller" | "display";
  deviceId?: string;
  roomCode?: string;
};

interface DisplayClient {
  id: string;
  label: string;
  socket: ClientSocket | null;
  color: GoalColor;
}

export class Room {
  code: string;
  config: RoomConfig = structuredClone(DEFAULT_CONFIG);
  displays = new Map<string, DisplayClient>();
  controllers = new Set<ClientSocket>();
  roundId = 0;
  nextChangeAt: number | null = null;
  transition: TransitionMode = "instant";
  transitionEndsAt: number | null = null;
  blackEndsAt: number | null = null;
  previousColors: Record<string, GoalColor> = {};
  deviceOffsets: Record<string, number> = {};
  roundStartedAt: number | null = null;
  lastCounts: Record<GoalColor, number> = { blue: 0, vermilion: 0, yellow: 0 };
  lastActivity = Date.now();
  private timer: NodeJS.Timeout | null = null;

  constructor(code: string) {
    this.code = code;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  isExpired(now = Date.now()) {
    if (this.config.running) return false;
    if (this.controllers.size > 0) return false;
    if ([...this.displays.values()].some((d) => d.socket)) return false;
    return now - this.lastActivity > ROOM_TTL_MS;
  }

  addController(socket: ClientSocket) {
    this.controllers.add(socket);
    this.touch();
    this.sendSnapshot(socket);
  }

  removeController(socket: ClientSocket) {
    this.controllers.delete(socket);
  }

  addDisplay(socket: ClientSocket, deviceId: string, label?: string) {
    this.touch();
    const existing = this.displays.get(deviceId);
    if (existing) {
      existing.socket = socket;
      if (label) existing.label = label;
      this.broadcast();
      return { ok: true as const };
    }
    if (this.displays.size >= MAX_DISPLAYS) {
      return { ok: false as const, error: "Display上限（12台）に達しています" };
    }
    this.displays.set(deviceId, {
      id: deviceId,
      label: label || `G${this.displays.size + 1}`,
      socket,
      color: "blue",
    });
    // Mid-session join waits for the next natural round (do not reset everyone)
    this.broadcast();
    return { ok: true as const };
  }

  removeDisplaySocket(socket: ClientSocket) {
    for (const d of this.displays.values()) {
      if (d.socket === socket) {
        d.socket = null;
        break;
      }
    }
    this.broadcast();
  }

  setLabel(deviceId: string, label: string) {
    const d = this.displays.get(deviceId);
    if (d) {
      d.label = label.slice(0, 24);
      this.touch();
      this.broadcast();
    }
  }

  updateConfig(partial: Partial<RoomConfig>) {
    const prevTiming = this.config.timingMode;
    this.config = {
      ...this.config,
      ...partial,
      blue: { ...this.config.blue, ...(partial.blue || {}) },
      vermilion: { ...this.config.vermilion, ...(partial.vermilion || {}) },
      yellow: { ...this.config.yellow, ...(partial.yellow || {}) },
    };
    const n = Math.max(0, this.displays.size);
    for (const key of ["blue", "vermilion", "yellow"] as const) {
      const c = this.config[key];
      c.fixed = clamp(c.fixed, 0, Math.max(n, 12));
      c.min = clamp(c.min, 0, Math.max(n, 12));
      c.max = clamp(c.max, 0, Math.max(n, 12));
      if (c.min > c.max) [c.min, c.max] = [c.max, c.min];
    }
    this.config.fixedSeconds = clamp(this.config.fixedSeconds, 0.5, 60);
    this.config.randomMinSeconds = clamp(this.config.randomMinSeconds, 0.5, 60);
    this.config.randomMaxSeconds = clamp(this.config.randomMaxSeconds, 0.5, 60);
    this.config.staggerMaxSeconds = clamp(this.config.staggerMaxSeconds ?? 2, 0, 10);
    if (this.config.syncMode !== "staggered") this.config.syncMode = "simultaneous";
    if (this.config.sound !== "on") this.config.sound = "off";
    if (this.config.colorCount !== 2 && this.config.colorCount !== 3) {
      this.config.colorCount = 3;
    }
    this.touch();
    // Timing mode changes while running used to leave a dead timer / no timer
    this.applyTimingModeChange(prevTiming);
    this.broadcast();
  }

  start() {
    this.config.running = true;
    this.touch();
    this.assignRound(true);
  }

  stop() {
    this.config.running = false;
    this.clearTimer();
    this.nextChangeAt = null;
    this.transitionEndsAt = null;
    this.blackEndsAt = null;
    this.touch();
    this.broadcast();
  }

  next() {
    if (!this.config.running) this.config.running = true;
    this.touch();
    this.assignRound(true);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private maxStaggerMs() {
    return this.config.syncMode === "staggered"
      ? Math.max(0, (this.config.staggerMaxSeconds ?? 2) * 1000)
      : 0;
  }

  /** Schedule the next auto round from now (keeps current colors). */
  private armAutoTimer() {
    this.clearTimer();
    if (!this.config.running || this.config.timingMode === "manual") {
      this.nextChangeAt = null;
      return;
    }
    const lead = TRANSITION_LEAD_MS[this.transition];
    const interval = nextIntervalMs(this.config);
    const now = Date.now();
    this.nextChangeAt =
      now + interval + this.maxStaggerMs() + lead + BLACK_GAP_MS + 200;
    const delay = this.nextChangeAt - Date.now();
    this.timer = setTimeout(() => {
      if (this.config.running && this.config.timingMode !== "manual") {
        this.assignRound(false);
      }
    }, Math.max(100, delay));
  }

  private applyTimingModeChange(prevTiming: TimingMode) {
    if (!this.config.running) return;
    if (this.config.timingMode === "manual") {
      // Stop auto-advance immediately (otherwise it freezes after the current interval)
      this.clearTimer();
      this.nextChangeAt = null;
      return;
    }
    // Switched back to fixed/random, or still auto but had no live timer
    if (prevTiming === "manual" || !this.timer) {
      this.armAutoTimer();
    }
  }

  private assignColors(): Record<string, GoalColor> {
    const ids = shuffle([...this.displays.keys()]);
    const n = ids.length;
    const counts = partitionCounts(this.config, n);
    this.lastCounts = counts;
    const result: Record<string, GoalColor> = {};
    let idx = 0;
    for (const color of activeColors(this.config)) {
      for (let i = 0; i < counts[color]; i++) {
        const id = ids[idx++];
        if (id) result[id] = color;
      }
    }
    return result;
  }

  private assignRound(fromManual: boolean) {
    this.clearTimer();
    this.touch();
    const previous: Record<string, GoalColor> = {};
    for (const d of this.displays.values()) {
      previous[d.id] = d.color;
    }
    const colors = this.assignColors();
    this.roundId += 1;
    this.transition = pickTransition(this.config);
    this.previousColors = previous;

    for (const [id, color] of Object.entries(colors)) {
      const d = this.displays.get(id);
      if (d) d.color = color;
    }

    const ids = [...this.displays.keys()];
    const maxStaggerMs = this.maxStaggerMs();
    // Spread devices across 0..max so staggered mode is visibly not simultaneous
    const offsets: Record<string, number> = {};
    if (maxStaggerMs > 0 && ids.length > 1) {
      const order = shuffle(ids);
      for (let i = 0; i < order.length; i++) {
        offsets[order[i]] = Math.round((i / (order.length - 1)) * maxStaggerMs);
      }
    } else {
      for (const id of ids) offsets[id] = 0;
    }
    this.deviceOffsets = offsets;

    const lead = TRANSITION_LEAD_MS[this.transition];
    const now = Date.now();
    this.roundStartedAt = now;
    this.transitionEndsAt = now + lead;
    this.blackEndsAt = now + lead + BLACK_GAP_MS;

    if (this.config.timingMode === "manual") {
      this.nextChangeAt = null;
      this.broadcast();
      return;
    }

    this.armAutoTimer();
    this.broadcast();
    void fromManual;
  }

  snapshot(): RoomSnapshot {
    const primaryColors: Record<string, GoalColor> = {};
    const displays = [...this.displays.values()].map((d) => {
      primaryColors[d.id] = d.color;
      return {
        id: d.id,
        label: d.label,
        color: d.color,
        connected: !!d.socket && d.socket.readyState === WebSocket.OPEN,
      };
    });
    return {
      code: this.code,
      config: this.config,
      displays,
      roundId: this.roundId,
      primaryColors,
      previousColors: { ...this.previousColors },
      deviceOffsets: { ...this.deviceOffsets },
      colorCounts: { ...this.lastCounts },
      roundStartedAt: this.roundStartedAt,
      nextChangeAt: this.nextChangeAt,
      transition: this.transition,
      transitionEndsAt: this.transitionEndsAt,
      blackEndsAt: this.blackEndsAt,
      serverNow: Date.now(),
    };
  }

  sendSnapshot(socket: ClientSocket) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "snapshot", snapshot: this.snapshot() }));
    }
  }

  broadcast() {
    const payload = JSON.stringify({ type: "snapshot", snapshot: this.snapshot() });
    for (const c of this.controllers) {
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    }
    for (const d of this.displays.values()) {
      if (d.socket && d.socket.readyState === WebSocket.OPEN) d.socket.send(payload);
    }
  }

  destroy() {
    this.clearTimer();
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();

  createRoom(): Room {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    const room = this.rooms.get(code.toUpperCase());
    if (room?.isExpired()) {
      room.destroy();
      this.rooms.delete(room.code);
      return undefined;
    }
    return room;
  }

  sweep() {
    for (const [code, room] of this.rooms) {
      if (room.isExpired()) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }
}
