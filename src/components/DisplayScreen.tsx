"use client";

import { useEffect, useMemo, useState } from "react";
import { COLORS, GoalColor, RoomSnapshot, TransitionMode } from "@/lib/types";

export function DisplayScreen({
  snapshot,
  deviceId,
}: {
  snapshot: RoomSnapshot;
  deviceId: string;
}) {
  const next: GoalColor = snapshot.primaryColors[deviceId] || "blue";
  const prev: GoalColor = snapshot.previousColors?.[deviceId] ?? next;
  const [now, setNow] = useState(() => Date.now());
  const clockOffset = snapshot.serverNow ? Date.now() - snapshot.serverNow : 0;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
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

  const serverNow = now - clockOffset;
  const effect = useTransitionEffect(
    snapshot.transition,
    snapshot.transitionEndsAt,
    snapshot.blackEndsAt,
    serverNow,
    prev,
    next
  );

  return (
    <div className="display-root" style={effect.style}>
      {effect.overlay}
    </div>
  );
}

function useTransitionEffect(
  transition: TransitionMode,
  transitionEndsAt: number | null,
  blackEndsAt: number | null,
  serverNow: number,
  prev: GoalColor,
  next: GoalColor
) {
  return useMemo(() => {
    const leadEnd = transitionEndsAt ?? 0;
    const blackEnd = blackEndsAt ?? leadEnd;

    if (!blackEndsAt || serverNow >= blackEnd) {
      return {
        style: { background: COLORS[next] } as React.CSSProperties,
        overlay: null as React.ReactNode,
      };
    }

    if (serverNow >= leadEnd) {
      return { style: { background: "#000000" }, overlay: null };
    }

    const lead =
      transition === "countdown" ? 3000 : transition === "blink" ? 1600 : transition === "fade" ? 1200 : 0;
    const remaining = Math.max(0, leadEnd - serverNow);
    const progress = lead > 0 ? 1 - remaining / lead : 1;
    const base: React.CSSProperties = { background: COLORS[prev] };

    if (transition === "countdown" && lead > 0) {
      const sec = Math.max(1, Math.ceil(remaining / 1000));
      return {
        style: base,
        overlay: <div className="countdown-num">{sec}</div>,
      };
    }

    if (transition === "blink") {
      const on = Math.floor(serverNow / 200) % 2 === 0;
      return { style: { ...base, opacity: on ? 1 : 0.2 }, overlay: null };
    }

    if (transition === "fade") {
      return {
        style: { ...base, opacity: Math.max(0.12, 1 - progress) },
        overlay: null,
      };
    }

    return { style: { background: "#000000" }, overlay: null };
  }, [transition, transitionEndsAt, blackEndsAt, serverNow, prev, next]);
}
