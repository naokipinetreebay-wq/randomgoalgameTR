"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import type {
  ClientMessage,
  ColorCountConfig,
  GoalColor,
  RoomConfig,
  RoomSnapshot,
} from "@/lib/types";
import { COLOR_LABELS, COLORS } from "@/lib/types";

const STEPS = ["説明", "端末", "色", "切替", "確認"] as const;

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
          <input
            type="range"
            min={0}
            max={12}
            value={cfg.fixed}
            onChange={(e) => onChange({ ...cfg, fixed: Number(e.target.value) })}
          />
        </label>
      ) : (
        <div className="row">
          <label className="field">
            <span>最小 {cfg.min}</span>
            <input
              type="range"
              min={0}
              max={12}
              value={cfg.min}
              onChange={(e) => onChange({ ...cfg, min: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>最大 {cfg.max}</span>
            <input
              type="range"
              min={0}
              max={12}
              value={cfg.max}
              onChange={(e) => onChange({ ...cfg, max: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function SetupWizard({
  snapshot,
  connected,
  send,
  onDone,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [targetCount, setTargetCount] = useState(4);
  const cfg = snapshot.config;

  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/d/${snapshot.code}`;
  }, [snapshot.code]);

  const patch = (partial: Partial<RoomConfig>) => {
    send({ type: "updateConfig", config: partial });
  };

  useEffect(() => {
    if (snapshot.displays.length > 0) {
      setTargetCount((t) => Math.max(t, snapshot.displays.length));
    }
  }, [snapshot.displays.length]);

  const colors: GoalColor[] =
    cfg.colorCount === 2 ? ["blue", "vermilion"] : ["blue", "vermilion", "yellow"];
  const joined = snapshot.displays.length;
  const canLeaveDevices = joined >= 1;

  return (
    <div className="wizard">
      <header className="wizard-top">
        <div>
          <p className="eyebrow">Random Goal · セットアップ</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "接続中" : "再接続中…"}
        </div>
      </header>

      <ol className="wizard-steps" aria-label="手順">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "active" : i < step ? "done" : ""}>
            <span className="n">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="panel wizard-panel">
        {step === 0 ? (
          <div className="wizard-body">
            <h2>ランダムゴールとは</h2>
            <ul className="explain-list">
              <li>各ゴール端末に<strong>青・朱・黄</strong>が付きます</li>
              <li>選手は最初から自分の色を持ち、その色のゴールだけを狙います</li>
              <li>自分の色が0台のラウンドは<strong>守り時間</strong>です</li>
            </ul>
            <p className="muted">色ごとの台数は毎ラウンド変わります。合計はゴール数に自動調整されます。</p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-body">
            <h2>ゴール端末を登録</h2>
            <label className="field">
              <span>目標台数: {targetCount}</span>
              <input
                type="range"
                min={1}
                max={12}
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
              />
            </label>
            <p className="join-meter">
              登録 <strong>{joined}</strong> / 目標 {targetCount}
            </p>
            <div className="qr-wrap">
              {displayUrl ? <QRCodeSVG value={displayUrl} size={168} /> : null}
            </div>
            <p className="mono">{displayUrl}</p>
            <button
              type="button"
              className="btn ghost"
              onClick={() => navigator.clipboard.writeText(displayUrl)}
            >
              URLをコピー
            </button>
            {joined > 0 ? (
              <ul className="device-list" style={{ marginTop: 14 }}>
                {snapshot.displays.map((d) => (
                  <li key={d.id}>
                    <span className="swatch" style={{ background: COLORS[d.color] }} />
                    <input
                      className="label-input"
                      value={d.label}
                      onChange={(e) =>
                        send({ type: "setLabel", deviceId: d.id, label: e.target.value })
                      }
                      placeholder="位置ラベル"
                    />
                    <span className={`dot ${d.connected ? "ok" : "bad"}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>
                まだゴールがありません。
              </p>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-body">
            <h2>色のパラメータ</h2>
            <label className="field">
              <span>色数</span>
              <select
                value={cfg.colorCount}
                onChange={(e) => patch({ colorCount: Number(e.target.value) as 2 | 3 })}
              >
                <option value={2}>2色（青・朱）</option>
                <option value={3}>3色（青・朱・黄）</option>
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
            <p className="muted">合計がゴール台数になるようサーバが調整します。0台＝その色は守り。</p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-body">
            <h2>切替と演出</h2>
            <label className="field">
              <span>タイミング</span>
              <select
                value={cfg.timingMode}
                onChange={(e) =>
                  patch({ timingMode: e.target.value as RoomConfig["timingMode"] })
                }
              >
                <option value="fixed">固定秒</option>
                <option value="random">ランダム秒</option>
                <option value="manual">手動のみ</option>
              </select>
            </label>
            {cfg.timingMode === "fixed" ? (
              <label className="field">
                <span>秒数: {cfg.fixedSeconds}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={cfg.fixedSeconds}
                  onChange={(e) => patch({ fixedSeconds: Number(e.target.value) })}
                />
              </label>
            ) : null}
            {cfg.timingMode === "random" ? (
              <div className="row">
                <label className="field">
                  <span>最小 {cfg.randomMinSeconds}s</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={cfg.randomMinSeconds}
                    onChange={(e) => patch({ randomMinSeconds: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>最大 {cfg.randomMaxSeconds}s</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={cfg.randomMaxSeconds}
                    onChange={(e) => patch({ randomMaxSeconds: Number(e.target.value) })}
                  />
                </label>
              </div>
            ) : null}
            <label className="field">
              <span>遷移演出</span>
              <select
                value={cfg.transition}
                onChange={(e) =>
                  patch({ transition: e.target.value as RoomConfig["transition"] })
                }
              >
                <option value="instant">即時</option>
                <option value="countdown">カウントダウン</option>
                <option value="blink">点滅</option>
                <option value="fade">フェード</option>
                <option value="random">毎回ランダム</option>
              </select>
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-body">
            <h2>準備完了</h2>
            <ul className="summary-list">
              <li>ゴール {joined} 台</li>
              <li>色数 {cfg.colorCount}</li>
              <li>
                切替:{" "}
                {cfg.timingMode === "fixed"
                  ? `${cfg.fixedSeconds}秒固定`
                  : cfg.timingMode === "random"
                    ? `${cfg.randomMinSeconds}〜${cfg.randomMaxSeconds}秒`
                    : "手動"}
              </li>
              <li>演出: {cfg.transition}</li>
            </ul>
            <p className="muted">次の画面で開始・停止・再設定ができます。</p>
          </div>
        ) : null}
      </section>

      <footer className="wizard-nav">
        <button
          type="button"
          className="btn"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          戻る
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn primary"
            disabled={step === 1 && !canLeaveDevices}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 1 && !canLeaveDevices ? "端末を1台以上登録" : "次へ"}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={onDone}>
            コントローラへ
          </button>
        )}
      </footer>
    </div>
  );
}
