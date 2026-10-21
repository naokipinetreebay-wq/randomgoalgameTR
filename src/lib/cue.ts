let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Resume audio. Browsers only allow this after a tap. */
export function unlockCue(): boolean {
  const audio = audioContext();
  if (!audio) return false;
  if (audio.state === "suspended") void audio.resume();
  return audio.state === "running";
}

/** Short electronic whistle, about 0.3s. */
export function playWhistle() {
  const audio = audioContext();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const osc2 = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc2.type = "triangle";
  osc.frequency.setValueAtTime(1700, now);
  osc.frequency.exponentialRampToValueAtTime(2600, now + 0.1);
  osc.frequency.exponentialRampToValueAtTime(2100, now + 0.28);
  osc2.frequency.setValueAtTime(850, now);
  osc2.frequency.exponentialRampToValueAtTime(1300, now + 0.1);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.32);
  osc2.stop(now + 0.32);
}
