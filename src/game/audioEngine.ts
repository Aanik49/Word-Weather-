import type { GameSettings, WeatherType } from './types';

/**
 * Procedural Bauhaus Audio & Adaptive Music Synthesizer (Web Audio API)
 * - Generates a warm, minimalist Bauhaus marimba + celesta + Rhodes-style ambient score
 *   that adapts its harmonic color & instrumentation live to Rain, Snow, Wind, Sun, or Lobby.
 * - Generates crisp tactile marimba selection notes, tile stacking clicks, weather switch motifs,
 *   and swipe-modulated filtered wind noise.
 */
class BauhausAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private windNode: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private musicEnabled = true;
  private sfxEnabled = true;
  private musicVolume = 0.45;
  private sfxVolume = 0.75;
  private hapticsEnabled = true;

  private currentWeather: WeatherType = 'rain';
  private inGameplay = false;
  private musicTimerId: number | null = null;
  private stepIndex = 0;

  // Pentatonic / Lydian frequencies in Hz
  private readonly SCALE_LOBBY = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
  private readonly SCALE_RAIN = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  private readonly SCALE_SNOW = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
  private readonly SCALE_WIND = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
  private readonly SCALE_SUN = [261.63, 329.63, 370.0, 392.0, 493.88, 523.25, 659.25, 739.99];

  // Ascending selection notes for word chains
  private readonly CHAIN_NOTES = [440.0, 493.88, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  public applySettings(settings: GameSettings): void {
    this.musicEnabled = settings.musicEnabled;
    this.sfxEnabled = settings.sfxEnabled;
    this.musicVolume = settings.musicVolume;
    this.sfxVolume = settings.sfxVolume;
    this.hapticsEnabled = settings.hapticsEnabled;

    if (this.ctx && this.musicGain && this.sfxGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.setTargetAtTime(this.musicEnabled ? this.musicVolume * 0.34 : 0, now, 0.08);
      this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? this.sfxVolume * 0.8 : 0, now, 0.04);
    }

    if (!this.sfxEnabled && this.windGain && this.ctx) {
      this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
    }

    if (this.musicEnabled && this.ctx && this.musicTimerId === null) {
      this.startMusicLoop();
    } else if (!this.musicEnabled && this.musicTimerId !== null) {
      this.stopMusicLoop();
    }
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? this.musicVolume * 0.34 : 0;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? this.sfxVolume * 0.8 : 0;
      this.sfxGain.connect(this.masterGain);

      this.initWindGenerator();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.musicEnabled && this.musicTimerId === null) {
      this.startMusicLoop();
    }
  }

  public setContextState(weather: WeatherType, inGameplay: boolean): void {
    this.currentWeather = weather;
    this.inGameplay = inGameplay;
    if (!inGameplay) {
      this.setWindIntensity(0, false);
    }
  }

  public vibrate(pattern: number | number[]): void {
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported devices
      }
    }
  }

  private initWindGenerator(): void {
    if (!this.ctx || !this.sfxGain || this.windNode) return;
    const sampleLen = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, sampleLen, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Smooth pink-ish noise buffer
    let last = 0;
    for (let i = 0; i < sampleLen; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.045 * white) / 1.045;
      data[i] = last * 2.4;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start();

    this.windNode = src;
    this.windFilter = filter;
    this.windGain = gain;
  }

  public setWindIntensity(ratio: number, active: boolean): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    if (!this.sfxEnabled || !active) {
      this.windGain.gain.setTargetAtTime(0, now, 0.14);
      return;
    }
    const clamped = Math.min(1, Math.max(0.06, ratio));
    this.windGain.gain.setTargetAtTime(clamped * 0.11, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(240 + clamped * 680, now, 0.08);
  }

  // ---------------------------------------------------------------------------
  // ADAPTIVE BAUHAUS AMBIENT MUSIC SEQUENCER
  // ---------------------------------------------------------------------------
  private startMusicLoop(): void {
    if (this.musicTimerId !== null) return;
    this.stepIndex = 0;

    // 138 BPM eighth-note pulse (~217ms) with minimalist rests
    this.musicTimerId = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.musicEnabled || !this.musicGain) {
        return;
      }
      this.playMusicStep(this.stepIndex);
      this.stepIndex = (this.stepIndex + 1) % 32;
    }, 240);
  }

  private stopMusicLoop(): void {
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  private playMusicStep(step: number): void {
    if (!this.ctx || !this.musicGain) return;

    const w = this.currentWeather;
    const activePlay = this.inGameplay;

    // Bass pulse every 8 steps (clean Bauhaus geometric rhythm)
    if (step % 8 === 0) {
      const bassRoots = !activePlay
        ? [130.81, 146.83, 164.81, 130.81]
        : w === 'rain'
          ? [146.83, 130.81, 110.0, 130.81]
          : w === 'snow'
            ? [196.0, 164.81, 174.61, 196.0]
            : w === 'wind'
              ? [110.0, 130.81, 146.83, 123.47]
              : [130.81, 164.81, 196.0, 146.83];
      const root = bassRoots[Math.floor(step / 8) % bassRoots.length];
      this.playWarmPadNote(root, 1.45, 0.24, 'triangle');
    }

    // Minimalist melodic pattern with deliberate architectural silence
    const lobbyPattern = [0, -1, 2, -1, 4, -1, -1, 3, 5, -1, 4, -1, 2, -1, 1, -1];
    const rainPattern = [0, 3, -1, 4, 2, -1, 5, -1, 4, 2, -1, 1, 3, -1, 0, -1];
    const snowPattern = [4, -1, -1, 6, -1, 5, -1, -1, 3, -1, -1, 5, -1, 2, -1, -1];
    const windPattern = [0, -1, 4, 2, -1, 5, 3, -1, 1, -1, 4, 6, -1, 3, -1, -1];
    const sunPattern = [0, -1, 2, 4, -1, 6, -1, 5, 3, -1, 4, 7, -1, 5, -1, 2];

    const pattern = !activePlay
      ? lobbyPattern
      : w === 'rain'
        ? rainPattern
        : w === 'snow'
          ? snowPattern
          : w === 'wind'
            ? windPattern
            : sunPattern;

    const scale = !activePlay
      ? this.SCALE_LOBBY
      : w === 'rain'
        ? this.SCALE_RAIN
        : w === 'snow'
          ? this.SCALE_SNOW
          : w === 'wind'
            ? this.SCALE_WIND
            : this.SCALE_SUN;

    const deg = pattern[step % pattern.length];
    if (deg >= 0) {
      const freq = scale[deg % scale.length];
      if (w === 'snow' && activePlay) {
        this.playCelestaNote(freq, 0.72, 0.16);
      } else if (w === 'sun' && activePlay) {
        this.playWarmPadNote(freq, 0.58, 0.15, 'sine');
      } else {
        this.playMusicMarimba(freq, 0.34, 0.17);
      }
    }

    // Gentle wooden tick on off-beats during active wind/rain
    if (activePlay && (w === 'rain' || w === 'wind') && step % 4 === 2) {
      this.playSoftWoodPulse(w === 'rain' ? 920 : 680, 0.045);
    }
  }

  private playWarmPadNote(freq: number, dur: number, vol: number, type: OscillatorType): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + dur + 0.04);
  }

  private playMusicMarimba(freq: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const oGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 4, now);

    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    oGain.gain.setValueAtTime(0.0008, now);
    oGain.gain.linearRampToValueAtTime(vol * 0.22, now + 0.004);
    oGain.gain.exponentialRampToValueAtTime(0.0008, now + dur * 0.28);

    osc.connect(gain);
    overtone.connect(oGain);
    gain.connect(this.musicGain);
    oGain.connect(this.musicGain);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + dur + 0.03);
    overtone.stop(now + dur * 0.35);
  }

  private playCelestaNote(freq: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    [1, 2.01].forEach((mult, i) => {
      if (!this.ctx || !this.musicGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, now);
      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(i === 0 ? vol : vol * 0.3, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0006, now + (i === 0 ? dur : dur * 0.45));
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    });
  }

  private playSoftWoodPulse(freq: number, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.04);
    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.05);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // ---------------------------------------------------------------------------
  // TACTILE GAMEPLAY SOUND EFFECTS (SFX)
  // ---------------------------------------------------------------------------
  public playMarimbaNote(freq = 523.25, dur = 0.14): void {
    if (!this.sfxEnabled) return;
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    [1, 4].forEach((mult, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.22 : 0.055, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + (idx === 0 ? dur : dur * 0.35));
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    });
  }

  public playTileSelect(chainLength: number): void {
    const idx = Math.max(0, Math.min(this.CHAIN_NOTES.length - 1, chainLength - 1));
    this.playMarimbaNote(this.CHAIN_NOTES[idx], 0.13);
    this.vibrate(10);
  }

  public playTileDeselect(): void {
    this.playMarimbaNote(349.23, 0.09);
  }

  public playStackClick(): void {
    if (!this.sfxEnabled || !this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.038);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playWeatherSwitch(weather: WeatherType): void {
    this.vibrate(14);
    if (!this.sfxEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const motifs: Record<WeatherType, number[]> = {
      rain: [440.0, 349.23],
      snow: [659.25, 880.0, 1046.5],
      wind: [293.66, 392.0, 440.0],
      sun: [523.25, 659.25, 783.99],
    };
    const notes = motifs[weather];
    notes.forEach((f, i) => {
      window.setTimeout(() => this.playMarimbaNote(f, 0.17), i * 50);
    });
  }

  public playWordVictory(wordLen: number, hasPhysicsBonus: boolean): void {
    this.vibrate(hasPhysicsBonus ? [18, 25, 28] : [16, 20, 16]);
    if (!this.sfxEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const baseChord = hasPhysicsBonus
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
      : [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const count = Math.min(baseChord.length, Math.max(3, wordLen));
    baseChord.slice(0, count).forEach((f, i) => {
      window.setTimeout(() => this.playMarimbaNote(f, 0.26), i * 52);
    });
  }

  public playReject(): void {
    this.vibrate([25, 20, 25]);
    if (!this.sfxEnabled) return;
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.linearRampToValueAtTime(118, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playUiClick(): void {
    this.playMarimbaNote(587.33, 0.08);
  }
}

export const audioEngine = new BauhausAudioEngine();
