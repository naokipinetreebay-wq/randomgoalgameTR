"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRoom } from "@/lib/ws";

export default function HomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await createRoom();
      router.push(`/r/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <div className="home-card">
        <p className="eyebrow">Random Goal Game TR</p>
        <h1>ランダムゴールゲーム</h1>
        <p>
          複数ゴールに青・朱・黄を割り当て、チームは自分の色のゴールを狙います。自分の色が無いラウンドは守り時間です。
        </p>
        <button type="button" className="btn primary" disabled={busy} onClick={onCreate}>
          {busy ? "作成中…" : "ルームを作成"}
        </button>
        {error ? (
          <p className="muted" style={{ marginTop: 12, color: "var(--bad)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
