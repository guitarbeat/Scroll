/**
 * Web Audio API synthesizer for authentic quill scratch on parchment/vellum.
 * Generates dynamic friction noise filtered through bandpass and low-pass filters,
 * with subtle resonance and natural ink-drag attenuation.
 */

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Creates 2 seconds of high-fidelity pink/brownian textured noise buffer with micro-granularity
 */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }

  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Pink noise filter approximation + occasional microscopic parchment fiber catches
    b0 = 0.99765 * b0 + white * 0.0990460;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    const pink = b0 + b1 + b2 + white * 0.1848;
    // Add micro fiber grit
    const grit = (Math.random() < 0.03 ? (Math.random() - 0.5) * 1.5 : 0);
    data[i] = (pink * 0.12 + grit * 0.15);
  }

  noiseBuffer = buffer;
  return buffer;
}

export class QuillScratchAudio {
  private noiseSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private bandpassFilter: BiquadFilterNode | null = null;
  private isPlaying = false;
  private lastX = 0;
  private lastY = 0;
  private lastTime = 0;
  private targetGain = 0;
  private currentGain = 0;
  private rafId: number | null = null;

  private initGraph(ctx: AudioContext) {
    if (this.gainNode && this.lowpassFilter && this.bandpassFilter) return;

    // 1. Gain control
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);

    // 2. Low-pass filter (simulates ink-dampened parchment texture, cuts harsh high frequencies > 2200Hz)
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1600, ctx.currentTime);
    lowpass.Q.setValueAtTime(1.2, ctx.currentTime);

    // 3. Bandpass filter around the reed/feather nib resonance (around 650Hz - 1100Hz)
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(850, ctx.currentTime);
    bandpass.Q.setValueAtTime(1.5, ctx.currentTime);

    // Chain: Source -> Bandpass -> Lowpass -> Gain -> Master
    bandpass.connect(lowpass);
    lowpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    this.gainNode = gainNode;
    this.lowpassFilter = lowpass;
    this.bandpassFilter = bandpass;
  }

  public startStroke(x: number, y: number) {
    const ctx = getAudioContext();
    if (!ctx) return;

    this.initGraph(ctx);
    if (!this.gainNode || !this.bandpassFilter || !this.lowpassFilter) return;

    this.lastX = x;
    this.lastY = y;
    this.lastTime = performance.now();

    // Start looped noise source if not currently running
    if (!this.isPlaying) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = getNoiseBuffer(ctx);
        source.loop = true;
        source.connect(this.bandpassFilter);
        source.start();
        this.noiseSource = source;
        this.isPlaying = true;
      } catch {
        return;
      }
    }

    // Gentle initial nib touch sound
    const now = ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(0.001, now);
    this.gainNode.gain.linearRampToValueAtTime(0.045, now + 0.025);

    this.targetGain = 0.045;
    this.currentGain = 0.045;
    this.startGainSmoothing();
  }

  public updateStroke(x: number, y: number) {
    if (!this.isPlaying || !this.gainNode || !this.lowpassFilter || !this.bandpassFilter) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = performance.now();
    const dt = Math.max(8, now - this.lastTime);
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.hypot(dx, dy);
    const speed = dist / dt; // pixels per ms (typically 0.1 to 3.5)

    this.lastX = x;
    this.lastY = y;
    this.lastTime = now;

    // Dynamic velocity mapping:
    // Faster strokes scrape louder and slightly brighter (higher low-pass cutoff)
    // Stationary holding quietens down
    const normalizedSpeed = Math.min(1, speed / 2.2);
    this.targetGain = Math.max(0.008, Math.min(0.095, 0.02 + normalizedSpeed * 0.075));

    const audioNow = ctx.currentTime;
    // Vary low-pass cutoff between 1100Hz (soft slow ink drag) and 2400Hz (faster sharp quill scratch)
    const cutoff = 1100 + normalizedSpeed * 1300;
    this.lowpassFilter.frequency.setTargetAtTime(cutoff, audioNow, 0.04);

    // Subtle shifting resonance of the slit nib
    const nibResonance = 700 + Math.sin(x * 0.05 + y * 0.05) * 200 + normalizedSpeed * 300;
    this.bandpassFilter.frequency.setTargetAtTime(nibResonance, audioNow, 0.05);
  }

  public endStroke() {
    this.targetGain = 0;
    const ctx = getAudioContext();
    if (!ctx || !this.gainNode) {
      this.cleanup();
      return;
    }

    const now = ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    // Smooth release decay (40ms) to avoid audio pops
    this.gainNode.gain.setTargetAtTime(0, now, 0.035);

    setTimeout(() => {
      if (this.targetGain === 0) {
        this.cleanup();
      }
    }, 120);
  }

  private startGainSmoothing() {
    if (this.rafId !== null) return;

    const loop = () => {
      if (!this.isPlaying || !this.gainNode) {
        this.rafId = null;
        return;
      }

      // Smooth gain tracking
      this.currentGain += (this.targetGain - this.currentGain) * 0.22;
      const ctx = getAudioContext();
      if (ctx) {
        try {
          this.gainNode.gain.setValueAtTime(this.currentGain, ctx.currentTime);
        } catch {}
      }

      if (this.currentGain < 0.001 && this.targetGain === 0) {
        this.rafId = null;
        return;
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private cleanup() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {}
      this.noiseSource = null;
    }
    this.isPlaying = false;
    this.currentGain = 0;
    this.targetGain = 0;
  }
}

export const quillAudio = new QuillScratchAudio();
