"use client";

import { useEffect, useRef, useState } from "react";
import { playWhistle, unlockCue } from "@/lib/cue";
import { resolvePlayView } from "@/lib/playView";
import { COLORS, GoalColor, RoomSnapshot } from "@/lib/types";

const BLACK_MS = 280;
const BLINK_PERIOD_MS = 280;
const FADE_END_OPACITY = 0.22;

export function DisplayScreen({
  snapshot,
  deviceId,
}: {
  snapshot: RoomSnapshot;
  deviceId: string;
}) {
  const skewRef = useRef(0);
  const lastServerNowRef = useRef<number | null>(null);
  if (lastServerNowRef.current !== snapshot.serverNow) {
    lastServerNowRef.current = snapshot.serverNow;
    skewRef.current = snapshot.serverNow - Date.now();
  }

  const [, setTick] = useState(0);
  const [soundReady, setSoundReady] = useState(false);
  const heardRound = useRef<number | null>(null);
  const soundOn = snapshot.config.sound === "on";

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!soundOn) return;
    const arm = () => {
      if (unlockCue()) setSoundReady(true);
    };
    window.addEventListener("pointerdown", arm);
    return () => window.removeEventListener("pointerdown", arm);
  }, [soundOn]);

  useEffect(() => {
    let wake: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          wake = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* ignore */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wake?.release().catch(() => undefined);
    };
  }, []);

  const estNow = Date.now() + skewRef.current;
  const view = resolvePlayView(snapshot, estNow);
  const next: GoalColor = view.primaryColors[deviceId] || "blue";
  const prev: GoalColor = view.previousColors?.[deviceId] ?? next;
  const colorChanged = prev !== next;
  const deviceOffset = view.deviceOffsets?.[deviceId] ?? 0;
  const transition = view.transition;
  const roundStartedAt = view.roundStartedAt ?? Date.now();
  const elapsed = estNow - roundStartedAt - deviceOffset;
  const showingNext = elapsed >= 0 && !(colorChanged && elapsed < BLACK_MS);

  useEffect(() => {
    if (!showingNext) return;
    if (heardRound.current === view.roundId) return;
    const first = heardRound.current === null;
    heardRound.current = view.roundId;
    if (!first && soundOn && soundReady && colorChanged) playWhistle();
  }, [colorChanged, showingNext, view.roundId, soundOn, soundReady]);

  let fillStyle: React.CSSProperties = { background: COLORS[next] };
  let overlay: React.ReactNode = null;

  if (elapsed < 0) {
    fillStyle = { background: COLORS[prev] };
  } else if (colorChanged && elapsed < BLACK_MS) {
    fillStyle = { background: "#000000" };
  } else {
    const showStart = roundStartedAt + deviceOffset + (colorChanged ? BLACK_MS : 0);
    const showEnd = view.nextChangeAt ?? showStart + 8_000;
    const showDur = Math.max(500, showEnd - showStart);
    const intoShow = Math.max(0, estNow - showStart);
    const t = Math.min(1, intoShow / showDur);

    if (transition === "fade") {
      fillStyle = {
        background: COLORS[next],
        opacity: 1 - t * (1 - FADE_END_OPACITY),
      };
    } else if (transition === "blink") {
      if (t >= 0.5) {
        const on = Math.floor(intoShow / BLINK_PERIOD_MS) % 2 === 0;
        fillStyle = on
          ? { background: COLORS[next] }
          : { background: "#000000" };
      } else {
        fillStyle = { background: COLORS[next] };
      }
    } else if (transition === "countdown" && view.nextChangeAt != null) {
      fillStyle = { background: COLORS[next] };
      const remainMs = view.nextChangeAt - estNow;
      if (remainMs > 0) {
        overlay = (
          <div className="countdown-num">{Math.max(1, Math.ceil(remainMs / 1000))}</div>
        );
      }
    } else {
      fillStyle = { background: COLORS[next] };
    }
  }

  return (
    <div className="display-root">
      <div className="display-fill" style={fillStyle} />
      {overlay}
      {soundOn && !soundReady ? (
        <button type="button" className="sound-unlock" onClick={() => unlockCue() && setSoundReady(true)}>
          音を鳴らすには画面をタップ
        </button>
      ) : null}
    </div>
  );
}
