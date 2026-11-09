"use client";

import { NumberSelect } from "@/components/NumberSelect";

import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { SessionExit } from "@/components/SessionExit";
import type { ClientMessage, ColorCountConfig, GoalColor, RoomConfig, RoomSnapshot } from "@/lib/types";
import { displayJoinUrl } from "@/lib/roomCode";
import { COLOR_LABELS, COLORS } from "@/lib/types";

function ColorCountEditor({
  color,
  cfg,
  onChange,
}: {
  color: GoalColor;
  cfg: ColorCountConfig;
  onChange: (next: ColorCountConfig) => void;
}) {
  return (
    <div className="color-block">
      <div className="color-title">
        <span className="swatch" style={{ background: COLORS[color] }} />
        {COLOR_LABELS[color]}
      </div>
      <label className="field">
        <span>台数モード</span>
        <select
          value={cfg.mode}
          onChange={(e) => onChange({ ...cfg, mode: e.target.value as ColorCountConfig["mode"] })}
        >
          <option value="fixed">固定</option>
          <option value="random">ランダム</option>
        </select>
      </label>
      {cfg.mode === "fixed" ? (
        <label className="field">
          <span>固定台数: {cfg.fixed}</span>
          <NumberSelect
            min={0}
            max={12}
            step={1}
            value={cfg.fixed}
            onChange={(n) => onChange({ ...cfg, fixed: n })}
          />
        </label>
      ) : (
        <div className="row">
          <label className="field">
            <span>最小 {cfg.min}</span>
            <NumberSelect
              min={0}
              max={12}
              step={1}
              value={cfg.min}
              onChange={(n) => onChange({ ...cfg, min: n })}
            />
          </label>
          <label className="field">
            <span>最大 {cfg.max}</span>
            <NumberSelect
              min={0}
              max={12}
              step={1}
              value={cfg.max}
              onChange={(n) => onChange({ ...cfg, max: n })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function ControllerPanel({
  snapshot,
  connected,
  send,
  clearSessionKeys,
  alsoDisplay = false,
  onStart,
  onStop,
  onNext,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  clearSessionKeys?: string[];
  alsoDisplay?: boolean;
  /** 省略時は start メッセージのみ送る */
  onStart?: () => void;
  onStop?: () => void;
  onNext?: (colors?: Record<string, GoalColor>) => void;
}) {
  const cfg = snapshot.config;
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return displayJoinUrl(snapshot.code);
  }, [snapshot.code]);

  const patch = (partial: Partial<RoomConfig>) => {
    send({ type: "updateConfig", config: partial });
  };

  const colors: GoalColor[] =
    cfg.colorCount === 2 ? ["blue", "vermilion"] : ["blue", "vermilion", "yellow"];
  const manualPick = cfg.timingMode === "manual" && cfg.manualAssign === "pick";
  const [picks, setPicks] = useState<Record<string, GoalColor>>({});

  const switchNow = () => {
    if (manualPick) {
      const chosen: Record<string, GoalColor> = {};
      for (const d of snapshot.displays) chosen[d.id] = picks[d.id] ?? d.color;
      if (onNext) onNext(chosen);
      else send({ type: "next", colors: chosen });
      return;
    }
    if (onNext) onNext();
    else send({ type: "next" });
  };

  return (
    <div className="controller">
      <header className="controller-header">
        <div>
          <p className="eyebrow">Random Goal Game</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "接続中" : "再接続中…"}
        </div>
      </header>

      <section className="panel counts-live">
        <h2>今ラウンドの色別台数</h2>
        <div className="count-chips">
          {colors.map((c) => (
            <div key={c} className="count-chip" style={{ borderColor: COLORS[c] }}>
              <span className="swatch" style={{ background: COLORS[c] }} />
              {COLOR_LABELS[c]} × {snapshot.colorCounts[c] ?? 0}
            </div>
          ))}
        </div>
        <p className="muted">自分の色が0台のチームは守り時間です。</p>
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2>ゴール端末</h2>
          <p className="muted">台数: {snapshot.displays.length}</p>
          <div className="qr-wrap">
            {displayUrl ? <QRCodeSVG value={displayUrl} size={160} /> : null}
          </div>
          <p className="mono url">{displayUrl}</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigator.clipboard.writeText(displayUrl)}
          >
            URLをコピー
          </button>
        </div>

        <div className="panel">
          <h2>操作</h2>
          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (onStart) onStart();
                else send({ type: "start" });
              }}
            >
              開始
            </button>
            {cfg.timingMode === "manual" && !manualPick ? (
              <button type="button" className="btn" onClick={switchNow}>
                切り替え
              </button>
            ) : null}
            {cfg.timingMode !== "manual" ? (
              <button type="button" className="btn" onClick={switchNow}>
                次へ
              </button>
            ) : null}
            <button
              type="button"
              className="btn danger"
              onClick={() => (onStop ? onStop() : send({ type: "stop" }))}
            >
              一時停止
            </button>
          </div>
          <p className="muted">
            状態: {cfg.running ? "ランニング" : "停止"} / ラウンド #{snapshot.roundId}
            {alsoDisplay ? "（開始するとこの端末も色表示に切替）" : ""}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>色の割当</h2>
        <label className="field">
          <span>色数</span>
          <select
            value={cfg.colorCount}
            onChange={(e) => patch({ colorCount: Number(e.target.value) as 2 | 3 })}
          >
            <option value={2}>2色（緑・赤）</option>
            <option value={3}>3色（緑・赤・黄）</option>
          </select>
        </label>
        {colors.map((c) => (
          <ColorCountEditor
            key={c}
            color={c}
            cfg={cfg[c]}
            onChange={(next) => patch({ [c]: next } as Partial<RoomConfig>)}
          />
        ))}
        <p className="muted">合計がゴール台数になるようサーバ側で自動調整します。</p>
      </section>

      <section className="panel">
        <h2>タイミング</h2>
        <label className="field">
          <span>切替</span>
          <select
            value={alsoDisplay && cfg.timingMode === "manual" ? "random" : cfg.timingMode}
            onChange={(e) =>
              patch({ timingMode: e.target.value as RoomConfig["timingMode"] })
            }
          >
            <option value="fixed">固定秒</option>
            <option value="random">ランダム秒</option>
            <option value="manual" disabled={alsoDisplay}>
              手動のみ（切り替えボタン）
              {alsoDisplay ? " — この端末も表示のときは使えません" : ""}
            </option>
          </select>
        </label>
        {alsoDisplay && cfg.timingMode === "manual" ? (
          <p className="muted">
            この端末も表示対象のときは手動のみにできません。ランダム秒へ戻してください。
          </p>
        ) : null}
        {cfg.timingMode === "manual" && !alsoDisplay ? (
          <>
            <label className="field">
              <span>手動の中身</span>
              <select
                value={cfg.manualAssign || "random"}
                onChange={(e) =>
                  patch({ manualAssign: e.target.value as RoomConfig["manualAssign"] })
                }
              >
                <option value="random">ランダム表示（タイミングだけボタン）</option>
                <option value="pick">色を指定して切り替え</option>
              </select>
            </label>
            <label className="field">
              <span>切り替え方</span>
              <select
                value={cfg.manualPreCountdown ? "countdown" : "instant"}
                onChange={(e) =>
                  patch({ manualPreCountdown: e.target.value === "countdown" })
                }
              >
                <option value="instant">即時に切り替わる</option>
                <option value="countdown">3・2・1 のあと切り替わる</option>
              </select>
            </label>
            <p className="muted">
              {manualPick
                ? "各端末の色を選んで「切り替え」を押すと、その色になります。"
                : "色は毎回ランダムです。「切り替え」を押したときだけ表示が変わります。"}
              {cfg.manualPreCountdown
                ? " 押すと全表示が 3→2→1 のあと新しい色になります。"
                : " 押すとすぐ新しい色になります。"}
            </p>
          </>
        ) : null}
        {cfg.timingMode === "fixed" ? (
          <label className="field">
            <span>秒数: {cfg.fixedSeconds}</span>
            <NumberSelect
              min={1}
              max={10}
              step={0.5}
              value={cfg.fixedSeconds}
              onChange={(n) => patch({ fixedSeconds: n })}
            />
          </label>
        ) : null}
        {cfg.timingMode === "random" ? (
          <div className="row">
            <label className="field">
              <span>最小 {cfg.randomMinSeconds}s</span>
              <NumberSelect
                min={1}
                max={10}
                step={0.5}
                value={cfg.randomMinSeconds}
                onChange={(n) => patch({ randomMinSeconds: n })}
              />
            </label>
            <label className="field">
              <span>最大 {cfg.randomMaxSeconds}s</span>
              <NumberSelect
                min={1}
                max={10}
                step={0.5}
                value={cfg.randomMaxSeconds}
                onChange={(n) => patch({ randomMaxSeconds: n })}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>遷移</h2>
        <label className="field">
          <span>演出</span>
          <select
            value={cfg.transition}
            onChange={(e) =>
              patch({ transition: e.target.value as RoomConfig["transition"] })
            }
          >
            <option value="instant">即時</option>
            <option value="countdown">カウントダウン（残り秒）</option>
            <option value="blink">点滅（後半＝残り半分）</option>
            <option value="fade">フェード（表示直後から）</option>
            <option value="random">毎回ランダム</option>
          </select>
        </label>
        <label className="field">
          <span>切替音</span>
          <select
            value={cfg.sound || "off"}
            onChange={(e) => patch({ sound: e.target.value as RoomConfig["sound"] })}
          >
            <option value="off">音なし</option>
            <option value="on">音あり（ぴっ）</option>
          </select>
        </label>
        <label className="field">
          <span>端末どうしの切替</span>
          <select
            value={cfg.syncMode || "simultaneous"}
            onChange={(e) =>
              patch({ syncMode: e.target.value as RoomConfig["syncMode"] })
            }
          >
            <option value="simultaneous">いっせい（全端末同時）</option>
            <option value="staggered">ランダム（端末ごとにずれる）</option>
          </select>
        </label>
        {(cfg.syncMode || "simultaneous") === "staggered" ? (
          <label className="field">
            <span>最大ずれ: {cfg.staggerMaxSeconds ?? 2}秒</span>
            <NumberSelect
              min={0.5}
              max={5}
              step={0.5}
              value={cfg.staggerMaxSeconds ?? 2}
              onChange={(n) => patch({ staggerMaxSeconds: n })}
            />
          </label>
        ) : null}
      </section>

      <section className="panel">
        <h2>参加端末</h2>
        {snapshot.displays.length === 0 ? (
          <p className="muted">まだゴール端末がありません。</p>
        ) : (
          <>
          <ul className={`device-list${manualPick ? " picking" : ""}`}>
            {snapshot.displays.map((d) => {
              const chosen = picks[d.id] ?? d.color;
              return (
                <li key={d.id}>
                  <span className="swatch" style={{ background: COLORS[d.color] }} />
                  <input
                    className="label-input"
                    value={d.label}
                    onChange={(e) =>
                      send({ type: "setLabel", deviceId: d.id, label: e.target.value })
                    }
                    placeholder="名前"
                  />
                  {manualPick ? (
                    <div
                      className={`color-toggles${colors.length === 2 ? " two" : ""}`}
                      role="group"
                      aria-label={`${d.label}の色`}
                    >
                      {colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`color-toggle${chosen === c ? ` on on-${c}` : ""}`}
                          onClick={() =>
                            setPicks((prev) => ({ ...prev, [d.id]: c }))
                          }
                        >
                          {COLOR_LABELS[c]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <span className={`dot ${d.connected ? "ok" : "bad"}`} />
                </li>
              );
            })}
          </ul>
          {manualPick ? (
            <button type="button" className="btn primary switch-near" onClick={switchNow}>
              切り替え
            </button>
          ) : null}
          </>
        )}
      </section>

      <SessionExit
        onStop={() => (onStop ? onStop() : send({ type: "stop" }))}
        clearSessionKeys={clearSessionKeys}
      />
    </div>
  );
}
