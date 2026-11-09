import type {
  ColorCountConfig,
  GoalColor,
  PlayPackage,
  PlayRound,
  RoomConfig,
  RoomSnapshot,
  TransitionMode,
} from "./types";

/** 開始時一括。尽きたら端末側でループ */
export const LOCAL_PACKAGE_ROUNDS = 300;

const BLACK_GAP_MS = 280;
const TRANSITION_LEAD_MS: Record<TransitionMode, number> = {
  instant: 0,
  countdown: 0,
  blink: 0,
  fade: 0,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number) {
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
  return 3000;
}

function maxStaggerMs(config: RoomConfig) {
  return config.syncMode === "staggered"
    ? Math.max(0, (config.staggerMaxSeconds ?? 2) * 1000)
    : 0;
}

function activeColors(config: RoomConfig): GoalColor[] {
  return config.colorCount === 2
    ? ["blue", "vermilion"]
    : ["blue", "vermilion", "yellow"];
}

function sampleCount(cfg: ColorCountConfig, n: number): number {
  if (cfg.mode === "fixed") return clamp(cfg.fixed, 0, n);
  const min = clamp(Math.min(cfg.min, cfg.max), 0, n);
  const max = clamp(Math.max(cfg.min, cfg.max), 0, n);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Partition N slots across colors so totals equal N. */
function partitionCounts(
  config: RoomConfig,
  n: number
): Record<GoalColor, number> {
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

function planOffsets(ids: string[], config: RoomConfig): Record<string, number> {
  const max = maxStaggerMs(config);
  const offsets: Record<string, number> = {};
  if (max > 0 && ids.length > 1) {
    const order = shuffle(ids);
    for (let i = 0; i < order.length; i++) {
      offsets[order[i]] = Math.round((i / (order.length - 1)) * max);
    }
  } else {
    for (const id of ids) offsets[id] = 0;
  }
  return offsets;
}

function zeroCounts(): Record<GoalColor, number> {
  return { blue: 0, vermilion: 0, yellow: 0 };
}

export function assignColors(
  ids: string[],
  config: RoomConfig,
  current: Record<string, GoalColor>,
  pending?: Record<string, GoalColor> | null
): { colors: Record<string, GoalColor>; colorCounts: Record<GoalColor, number> } {
  if (ids.length === 0) {
    return { colors: {}, colorCounts: zeroCounts() };
  }

  if (config.timingMode === "manual" && config.manualAssign === "pick") {
    const allowed = new Set(activeColors(config));
    const colors: Record<string, GoalColor> = {};
    const colorCounts = zeroCounts();
    for (const id of ids) {
      const chosen = pending?.[id];
      const color =
        chosen && allowed.has(chosen) ? chosen : current[id] ?? "blue";
      colors[id] = color;
      colorCounts[color] += 1;
    }
    return { colors, colorCounts };
  }

  const shuffled = shuffle(ids);
  const n = ids.length;
  const colorCounts = partitionCounts(config, n);
  const colors: Record<string, GoalColor> = {};
  let idx = 0;
  for (const color of activeColors(config)) {
    for (let i = 0; i < colorCounts[color]; i++) {
      const id = shuffled[idx++];
      if (id) colors[id] = color;
    }
  }
  return { colors, colorCounts };
}

export function buildLocalPlayPackage(
  ids: string[],
  config: RoomConfig,
  opts?: {
    count?: number;
    startAt?: number;
    fromRoundId?: number;
    previous?: Record<string, GoalColor>;
  }
): PlayPackage {
  const count = opts?.count ?? LOCAL_PACKAGE_ROUNDS;
  let previous: Record<string, GoalColor> = { ...(opts?.previous ?? {}) };
  for (const id of ids) {
    if (!(id in previous)) previous[id] = "blue";
  }
  let t = opts?.startAt ?? Date.now();
  let nextRoundId = opts?.fromRoundId ?? 1;
  const rounds: PlayRound[] = [];

  for (let i = 0; i < count; i++) {
    const { colors, colorCounts } = assignColors(ids, config, previous, null);
    for (const id of ids) {
      if (!(id in colors)) colors[id] = previous[id] ?? "blue";
    }
    const transition = pickTransition(config);
    const offsets = planOffsets(ids, config);
    const lead = TRANSITION_LEAD_MS[transition];
    const interval = nextIntervalMs(config);
    const nextChangeAt =
      t + interval + maxStaggerMs(config) + lead + BLACK_GAP_MS + 200;
    rounds.push({
      roundId: nextRoundId++,
      colors,
      previousColors: { ...previous },
      deviceOffsets: offsets,
      colorCounts,
      transition,
      roundStartedAt: t,
      nextChangeAt,
    });
    previous = colors;
    t = nextChangeAt;
  }
  return { rounds };
}

export type HostOverlay = {
  playPackage: PlayPackage | null;
  roundId: number;
  primaryColors: Record<string, GoalColor>;
  previousColors: Record<string, GoalColor>;
  deviceOffsets: Record<string, number>;
  colorCounts: Record<GoalColor, number>;
  transition: TransitionMode;
  roundStartedAt: number | null;
  nextChangeAt: number | null;
  transitionEndsAt: number | null;
  blackEndsAt: number | null;
  manualCueEndsAt: number | null;
  hostNow: number;
};

export function overlayFromPackage(
  pkg: PlayPackage,
  hostNow = Date.now()
): HostOverlay {
  const first = pkg.rounds[0];
  const lead = first ? TRANSITION_LEAD_MS[first.transition] : 0;
  return {
    playPackage: pkg,
    roundId: first?.roundId ?? 0,
    primaryColors: first?.colors ?? {},
    previousColors: first?.previousColors ?? {},
    deviceOffsets: first?.deviceOffsets ?? {},
    colorCounts: first?.colorCounts ?? zeroCounts(),
    transition: first?.transition ?? "instant",
    roundStartedAt: first?.roundStartedAt ?? null,
    nextChangeAt: first?.nextChangeAt ?? null,
    transitionEndsAt: first ? first.roundStartedAt + lead : null,
    blackEndsAt: first ? first.roundStartedAt + lead + BLACK_GAP_MS : null,
    manualCueEndsAt: null,
    hostNow,
  };
}

/** 手動切替: 即時 or 3秒カウント後にコントローラが押し込む用 */
export function buildManualOverlay(
  ids: string[],
  config: RoomConfig,
  current: Record<string, GoalColor>,
  pending: Record<string, GoalColor> | null,
  phase: "cue" | "reveal",
  now = Date.now()
): HostOverlay {
  if (phase === "cue" && config.manualPreCountdown) {
    const colorCounts = zeroCounts();
    for (const id of ids) {
      const c = current[id] ?? "blue";
      colorCounts[c] += 1;
    }
    return {
      playPackage: null,
      roundId: 0,
      primaryColors: { ...current },
      previousColors: { ...current },
      deviceOffsets: Object.fromEntries(ids.map((id) => [id, 0])),
      colorCounts,
      transition: "countdown",
      roundStartedAt: now,
      nextChangeAt: now + 3000,
      transitionEndsAt: now + 3000,
      blackEndsAt: null,
      manualCueEndsAt: now + 3000,
      hostNow: now,
    };
  }

  const previous = { ...current };
  const { colors, colorCounts } = assignColors(ids, config, current, pending);
  const transition = pickTransition(config);
  const lead = TRANSITION_LEAD_MS[transition];
  const offsets = planOffsets(ids, config);
  return {
    playPackage: null,
    roundId: Date.now(),
    primaryColors: colors,
    previousColors: previous,
    deviceOffsets: offsets,
    colorCounts,
    transition,
    roundStartedAt: now,
    nextChangeAt: null,
    transitionEndsAt: now + lead,
    blackEndsAt: now + lead + BLACK_GAP_MS,
    manualCueEndsAt: null,
    hostNow: now,
  };
}

export function idsFromSnapshot(snapshot: RoomSnapshot): string[] {
  return snapshot.displays.map((d) => d.id);
}

export function currentColorsFromSnapshot(
  snapshot: RoomSnapshot
): Record<string, GoalColor> {
  const out: Record<string, GoalColor> = {};
  for (const d of snapshot.displays) out[d.id] = d.color;
  return { ...snapshot.primaryColors, ...out };
}
