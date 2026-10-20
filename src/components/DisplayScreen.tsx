"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, GoalColor, RoomSnapshot, TransitionMode } from "@/lib/types";

const BLACK_MS = 280;

function leadMsFor(transition: TransitionMode): number {
  if (transition === "blink") return 1600;
  if (transition === "fade") return 1200;
  return 0;
}

export function DisplayScreen({
  snapshot,
  deviceId,
}: {
  snapshot: RoomSnapshot;
  deviceId: string;
}) {
  const next: GoalColor = snapshot.primaryColors[deviceId] || "blue";
  const prev: GoalColor = snapshot.previousColors?.[deviceId] ?? next;
  const colorChanged = prev !== next;
  const deviceOffset = snapshot.deviceOffsets?.[deviceId] ?? 0;

  const skewRef = useRef(0);
  skewRef.current = snapshot.serverNow - Date.now();

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

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

  const transition = snapshot.transition;
  const leadMs = leadMsFor(transition);
  const roundStartedAt = snapshot.roundStartedAt ?? snapshot.transitionEndsAt ?? Date.now();
  const estNow = Date.now() + skewRef.current;
  const elapsed = estNow - roundStartedAt - deviceOffset;
  const blackEnd = leadMs + (colorChanged ? BLACK_MS : 0);

  let style: React.CSSProperties = { background: COLORS[next] };
  let overlay: React.ReactNode = null;

  if (elapsed < 0) {
    style = { background: COLORS[prev] };
  } else if (elapsed < leadMs) {
    style = { background: COLORS[prev] };
    if (transition === "blink") {
      const on = Math.floor(elapsed / 220) % 2 === 0;
      style = on ? { background: COLORS[prev] } : { background: "#111111" };
    } else if (transition === "fade") {
      style = {
        background: COLORS[prev],
        opacity: Math.max(0.2, 1 - elapsed / leadMs),
      };
    }
  } else if (elapsed < blackEnd && colorChanged) {
    style = { background: "#000000" };
  } else {
    style = { background: COLORS[next] };
    if (transition === "countdown" && snapshot.nextChangeAt != null) {
      const remainMs = snapshot.nextChangeAt - estNow;
      if (remainMs > 0) {
        const sec = Math.max(1, Math.ceil(remainMs / 1000));
        overlay = <div className="countdown-num">{sec}</div>;
      }
    }
  }

  return (
    <div className="display-root" style={style}>
      {overlay}
    </div>
  );
}
