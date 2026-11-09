export type GoalColor = "blue" | "vermilion" | "yellow";
export type TransitionMode = "instant" | "countdown" | "blink" | "fade";
export type TimingMode = "fixed" | "random" | "manual";
export type CountMode = "fixed" | "random";
export type SyncMode = "simultaneous" | "staggered";
export type ManualAssign = "random" | "pick";
export type Role = "controller" | "display";

export interface ColorCountConfig {
  mode: CountMode;
  fixed: number;
  min: number;
  max: number;
}

export interface RoomConfig {
  colorCount: 2 | 3;
  blue: ColorCountConfig;
  vermilion: ColorCountConfig;
  yellow: ColorCountConfig;
  timingMode: TimingMode;
  fixedSeconds: number;
  randomMinSeconds: number;
  randomMaxSeconds: number;
  syncMode: SyncMode;
  staggerMaxSeconds: number;
  transition: TransitionMode | "random";
  sound: "off" | "on";
  manualAssign: ManualAssign;
  /** manual 切替時に 3→2→1 してから色を変える */
  manualPreCountdown: boolean;
  running: boolean;
}

export interface DisplayInfo {
  id: string;
  label: string;
  color: GoalColor;
  connected: boolean;
}

/** 自動モード用。開始時に一度配り、端末時計で色切替を進める */
export interface PlayRound {
  roundId: number;
  colors: Record<string, GoalColor>;
  previousColors: Record<string, GoalColor>;
  deviceOffsets: Record<string, number>;
  colorCounts: Record<GoalColor, number>;
  transition: TransitionMode;
  roundStartedAt: number;
  nextChangeAt: number;
}

export interface PlayPackage {
  rounds: PlayRound[];
}

export interface RoomSnapshot {
  code: string;
  config: RoomConfig;
  displays: DisplayInfo[];
  roundId: number;
  primaryColors: Record<string, GoalColor>;
  previousColors: Record<string, GoalColor>;
  deviceOffsets: Record<string, number>;
  colorCounts: Record<GoalColor, number>;
  roundStartedAt: number | null;
  nextChangeAt: number | null;
  transition: TransitionMode;
  transitionEndsAt: number | null;
  blackEndsAt: number | null;
  playPackage: PlayPackage | null;
  serverNow: number;
}

export type ClientMessage =
  | { type: "hello"; role: Role; deviceId: string; label?: string }
  | { type: "updateConfig"; config: Partial<RoomConfig> }
  | { type: "setLabel"; deviceId: string; label: string }
  | { type: "start"; local?: boolean }
  | { type: "stop" }
  | { type: "next"; colors?: Record<string, GoalColor> }
  | {
      type: "hostPush";
      overlay: {
        playPackage?: PlayPackage | null;
        roundId?: number;
        primaryColors?: Record<string, GoalColor>;
        previousColors?: Record<string, GoalColor>;
        deviceOffsets?: Record<string, number>;
        colorCounts?: Record<GoalColor, number>;
        transition?: TransitionMode;
        roundStartedAt?: number | null;
        nextChangeAt?: number | null;
        transitionEndsAt?: number | null;
        blackEndsAt?: number | null;
        manualCueEndsAt?: number | null;
        hostNow?: number;
      };
    }
  | { type: "ping" };

export type ServerMessage =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "pong" };

const defaultColorConfig = (): ColorCountConfig => ({
  mode: "random",
  fixed: 1,
  min: 0,
  max: 4,
});

export const DEFAULT_CONFIG: RoomConfig = {
  colorCount: 3,
  blue: defaultColorConfig(),
  vermilion: defaultColorConfig(),
  yellow: defaultColorConfig(),
  timingMode: "random",
  fixedSeconds: 3,
  randomMinSeconds: 2,
  randomMaxSeconds: 5,
  syncMode: "simultaneous",
  staggerMaxSeconds: 2,
  transition: "countdown",
  sound: "off",
  manualAssign: "random",
  manualPreCountdown: false,
  running: false,
};

/** 信号機: 緑 / 赤 / 黄 */
export const COLORS: Record<GoalColor, string> = {
  blue: "#00A651",
  vermilion: "#E10600",
  yellow: "#FFB000",
};

export const COLOR_LABELS: Record<GoalColor, string> = {
  blue: "緑",
  vermilion: "赤",
  yellow: "黄",
};
