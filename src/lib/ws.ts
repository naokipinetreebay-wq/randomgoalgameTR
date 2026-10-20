"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, Role, RoomSnapshot, ServerMessage } from "./types";

function wsUrl(room: string, role: Role, deviceId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const q = new URLSearchParams({ room, role, deviceId });
  return `${proto}//${window.location.host}/ws?${q}`;
}

export function useDeviceId(key: string): string {
  const [id, setId] = useState("");
  useEffect(() => {
    const storageKey = `rg-device-${key}`;
    let existing = localStorage.getItem(storageKey);
    if (!existing) {
      existing = crypto.randomUUID();
      localStorage.setItem(storageKey, existing);
    }
    setId(existing);
  }, [key]);
  return id;
}

export function useRoomSocket(room: string, role: Role, deviceId: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!room || !deviceId) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(wsUrl(room, role, deviceId));
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1200);
      };
      ws.onerror = () => setError("接続エラー");
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === "snapshot") setSnapshot(msg.snapshot);
        if (msg.type === "error") setError(msg.message);
      };
    };

    connect();
    ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
      }
    }, 20000);

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      wsRef.current?.close();
    };
  }, [room, role, deviceId]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { snapshot, error, connected, send };
}

export async function createRoom(): Promise<string> {
  const res = await fetch("/api/rooms", { method: "POST" });
  if (!res.ok) throw new Error("ルーム作成に失敗しました");
  const data = (await res.json()) as { code: string };
  return data.code;
}
