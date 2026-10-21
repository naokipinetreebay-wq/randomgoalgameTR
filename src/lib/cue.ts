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

/** Short electronic pip, about 0.08s. */
export function playWhistle() {
  const audio = audioContext();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(1480, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}
