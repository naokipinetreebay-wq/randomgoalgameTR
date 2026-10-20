"use client";

import { useParams } from "next/navigation";
import { ControllerPanel } from "@/components/ControllerPanel";
import { useDeviceId, useRoomSocket } from "@/lib/ws";

export default function ControllerPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();
  const deviceId = useDeviceId(`controller-${code}`);
  const { snapshot, error, connected, send } = useRoomSocket(code, "controller", deviceId);

  if (error && !snapshot) {
    return (
      <main className="error-page">
        <div>
          <h1>接続できません</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="error-page">
        <p>ルームに接続中…</p>
      </main>
    );
  }

  return <ControllerPanel snapshot={snapshot} connected={connected} send={send} />;
}
