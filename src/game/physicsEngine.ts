import { audioEngine } from './audioEngine';
import {
  getDailyTargetWord,
  getLetterPoints,
  isValidEnglishWord,
  pickBalancedLetter,
} from './dictionary';
import { WEATHER_META, WEATHER_ORDER } from './palettes';
import type {
  AlignedWordCandidate,
  BauhausPalette,
  CloudEntity,
  FloatingPopup,
  GameMode,
  GameSettings,
  GeometricBurst,
  HudSnapshot,
  LetterTile,
  RoundSummaryData,
  WeatherParticle,
  WeatherType,
} from './types';

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onToast: (message: string, durationMs?: number) => void;
  onInvalidShake: () => void;
  onRoundComplete: (summary: RoundSummaryData) => void;
}

const BURST_POOL_SIZE = 96;

export class WordWeatherEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  private palette: BauhausPalette;
  private settings: GameSettings;
  private mode: GameMode = 'classic';
  private weather: WeatherType = 'rain';
  private paused = false;
  private destroyed = false;

  // Viewport
  private width = 800;
  private height = 600;
  private dpr = 1;

  // Game progress
  private score = 0;
  private wordsFound: string[] = [];
  private combo = 1;
  private comboTimer = 0;
  private readonly comboMaxTime = 7.5;
  private bestCombo = 1;
  private physicsBonuses = 0;
  private level = 1;
  private levelWords = 0;
  private levelGoal = 3;
  private dailyTimer = 90;
  private dailyTargetWord = 'CLOUD';
  private dailyTargetFound = false;
  private roundFinished = false;

  // Entities
  private clouds: CloudEntity[] = [];
  private letters: LetterTile[] = [];
  private selectedIds: number[] = [];
  private weatherParticles: WeatherParticle[] = [];
  private burstPool: GeometricBurst[] = [];
  private popups: FloatingPopup[] = [];
  private alignedWords: AlignedWordCandidate[] = [];

  // Wind & Pointer interaction
  private windVec = { x: 210, y: -12 };
  private isSwipingWind = false;
  private isDraggingLetters = false;
  private activePointerId: number | null = null;
  private swipeStart = { x: 0, y: 0 };
  private swipeCurr = { x: 0, y: 0 };

  // Juice & Timing
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private spawnTimer = 0;
  private alignScanTimer = 0;
  private hudThrottleTimer = 0;
  private hitstopTimer = 0;
  private shakeAmp = 0;
  private stackSoundCooldown = 0;
  private nextTileId = 1;

  constructor(
    canvas: HTMLCanvasElement,
    palette: BauhausPalette,
    settings: GameSettings,
    initialWeather: WeatherType,
    callbacks: EngineCallbacks,
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = context;
    this.palette = palette;
    this.settings = settings;
    this.weather = initialWeather;
    this.callbacks = callbacks;

    // Pre-allocate geometric particle pool
    for (let i = 0; i < BURST_POOL_SIZE; i++) {
      this.burstPool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 8,
        rot: 0,
        vRot: 0,
        color: palette.red,
        shape: 'triangle',
        life: 0,
        maxLife: 0.7,
      });
    }

    this.bindPointerEvents();
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE & PUBLIC API
  // ---------------------------------------------------------------------------
  public start(mode: GameMode, initialWeather?: WeatherType): void {
    this.mode = mode;
    if (initialWeather) {
      this.weather = initialWeather;
    }
    this.paused = false;
    this.roundFinished = false;
    this.score = 0;
    this.wordsFound = [];
    this.combo = 1;
    this.comboTimer = 0;
    this.bestCombo = 1;
    this.physicsBonuses = 0;
    this.level = 1;
    this.levelWords = 0;
    this.levelGoal = 3;
    this.dailyTimer = 90;
    this.dailyTargetWord = getDailyTargetWord();
    this.dailyTargetFound = false;
    this.selectedIds = [];
    this.alignedWords = [];
    this.popups = [];
    this.hitstopTimer = 0;
    this.shakeAmp = 0;

    for (const b of this.burstPool) b.active = false;

    this.resize();
    this.seedArenaLetters();
    this.scanAlignedWords();
    audioEngine.setContextState(this.weather, true);
    this.emitHud();

    if (this.rafId === null) {
      this.lastFrameMs = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.unbindPointerEvents();
    audioEngine.setWindIntensity(0, false);
    audioEngine.setContextState(this.weather, false);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      audioEngine.setWindIntensity(0, false);
      this.isSwipingWind = false;
      this.isDraggingLetters = false;
      this.activePointerId = null;
    } else {
      this.lastFrameMs = performance.now();
      this.syncWindAudio();
    }
  }

  public setPalette(palette: BauhausPalette): void {
    this.palette = palette;
  }

  public setSettings(settings: GameSettings): void {
    this.settings = settings;
    this.emitHud();
  }

  public setWeather(weather: WeatherType, silent = false): void {
    const changed = this.weather !== weather;
    this.weather = weather;
    this.clouds.forEach((c) => {
      c.pulse = 1;
      c.ripple = 1;
    });

    if (changed && !silent) {
      audioEngine.playWeatherSwitch(weather);
      this.callbacks.onToast(WEATHER_META[weather].shortHint, 1500);
    }

    audioEngine.setContextState(weather, true);
    this.syncWindAudio();
    this.emitHud();
  }

  public cycleWeather(): void {
    const idx = WEATHER_ORDER.indexOf(this.weather);
    const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    this.setWeather(next);
  }

  public clearSelection(): void {
    if (this.selectedIds.length === 0) return;
    this.selectedIds = [];
    audioEngine.playTileDeselect();
    this.emitHud();
  }

  public removeSelectedAt(index: number): void {
    if (index < 0 || index >= this.selectedIds.length) return;
    this.selectedIds.splice(index, 1);
    audioEngine.playTileDeselect();
    this.emitHud();
  }

  public popLastSelected(): void {
    if (this.selectedIds.length === 0) return;
    this.selectedIds.pop();
    audioEngine.playTileDeselect();
    this.emitHud();
  }

  public triggerBreezeShuffle(): void {
    if (this.paused || this.roundFinished) return;
    audioEngine.playWeatherSwitch('wind');
    // Apply an energetic gust and refresh half of unselected tiles for fresh combos
    this.selectedIds = [];
    const targetCount = this.width < 640 ? 18 : 24;
    const keepCount = Math.min(this.letters.length, Math.floor(targetCount * 0.4));
    this.letters = this.letters.slice(0, keepCount);
    this.letters.forEach((tile) => {
      tile.vx = (Math.random() - 0.5) * 240;
      tile.vy = -120 - Math.random() * 90;
      tile.scaleX = 1.18;
      tile.scaleY = 0.84;
    });

    while (this.letters.length < targetCount) {
      this.spawnLetter(
        undefined,
        undefined,
        this.getCeilingY() + 24 + Math.random() * Math.max(100, this.height * 0.35),
      );
    }
    this.scanAlignedWords();
    this.callbacks.onToast('Fresh breeze of letters', 1300);
    this.emitHud();
  }

  public finishRoundEarly(): void {
    if (this.roundFinished) return;
    this.finishRound();
  }

  public resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.width = Math.max(280, Math.floor(rect.width));
    this.height = Math.max(260, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.buildClouds();
    this.buildWeatherParticles();

    // Clamp existing tiles inside new bounds
    const floorY = this.getFloorY();
    for (const tile of this.letters) {
      const half = tile.size * 0.5;
      tile.x = Math.max(half + 10, Math.min(this.width - half - 10, tile.x));
      tile.y = Math.max(this.getCeilingY() + half, Math.min(floorY - half, tile.y));
    }
  }

  public submitWord(overrideTileIds?: number[], isPhysicsAlignedCapture = false): void {
    if (this.paused || this.roundFinished) return;

    const ids = overrideTileIds ?? this.selectedIds;
    const chosen = ids
      .map((id) => this.letters.find((l) => l.id === id))
      .filter((l): l is LetterTile => Boolean(l));

    const word = chosen.map((l) => l.char).join('');
    if (word.length < this.settings.minWordLen || !isValidEnglishWord(word, this.settings.minWordLen)) {
      audioEngine.playReject();
      this.callbacks.onInvalidShake();
      this.callbacks.onToast(
        word.length < this.settings.minWordLen
          ? `Need at least ${this.settings.minWordLen} letters`
          : `"${word}" is not in dictionary`,
        1300,
      );
      return;
    }

    // Evaluate Physics Bonus:
    // 1. Aligned row capture (+100%)
    // 2. Tight physical proximity cluster (+50%)
    const isCluster = !isPhysicsAlignedCapture && this.isSelectionPhysicallyClustered(chosen);
    const hasPhysicsBonus = isPhysicsAlignedCapture || isCluster;
    const physicsMult = isPhysicsAlignedCapture ? 2.0 : isCluster ? 1.5 : 1.0;

    const basePts = chosen.reduce((sum, l) => sum + l.pts, 0) * 25;
    const lengthBonus = Math.max(0, (word.length - 3) * 45);
    const isDailyTarget = this.mode === 'daily' && !this.dailyTargetFound && word === this.dailyTargetWord;
    const dailyBonus = isDailyTarget ? 250 : 0;

    const gained = Math.round((basePts + lengthBonus + dailyBonus) * physicsMult * this.combo);

    this.score += gained;
    this.wordsFound.push(word);
    if (hasPhysicsBonus) {
      this.physicsBonuses += 1;
    }
    if (isDailyTarget) {
      this.dailyTargetFound = true;
    }

    this.combo = Math.min(6, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = this.comboMaxTime;
    this.levelWords += 1;

    let leveledUp = false;
    if (this.mode === 'classic' && this.levelWords >= this.levelGoal) {
      this.level += 1;
      this.levelWords = 0;
      this.levelGoal = Math.min(6, 2 + this.level);
      leveledUp = true;
    }

    // Visual & haptic juice
    if (word.length >= 4 || hasPhysicsBonus) {
      this.hitstopTimer = isPhysicsAlignedCapture ? 0.052 : 0.036;
      this.shakeAmp = Math.min(10, 3 + word.length * 0.9 + (hasPhysicsBonus ? 2.5 : 0));
    }

    const usedSet = new Set(chosen.map((l) => l.id));
    chosen.forEach((tile) => this.spawnGeometricBurst(tile.x, tile.y, hasPhysicsBonus ? 16 : 11));

    const cx = chosen.reduce((s, l) => s + l.x, 0) / chosen.length;
    const cy = chosen.reduce((s, l) => s + l.y, 0) / chosen.length;

    const subtext = isDailyTarget
      ? 'DAILY TARGET +250'
      : isPhysicsAlignedCapture
        ? 'ALIGNED 2×'
        : isCluster
          ? 'CLUSTER 1.5×'
          : leveledUp
            ? `LEVEL ${this.level}`
            : this.combo > 2
              ? `${this.combo - 1}× COMBO`
              : undefined;

    this.popups.push({
      x: Math.max(72, Math.min(this.width - 72, cx)),
      y: Math.max(this.getCeilingY() + 30, cy - 10),
      vy: -56,
      text: `${word} +${gained}`,
      subtext,
      accent: isDailyTarget || isPhysicsAlignedCapture ? 'red' : hasPhysicsBonus ? 'blue' : 'yellow',
      life: 1.25,
      maxLife: 1.25,
    });

    audioEngine.playWordVictory(word.length, hasPhysicsBonus);

    // Remove used tiles and replenish from clouds
    this.letters = this.letters.filter((l) => !usedSet.has(l.id));
    this.selectedIds = [];
    const spawnCount = Math.min(5, word.length);
    for (let i = 0; i < spawnCount; i++) {
      this.spawnLetter();
    }

    this.scanAlignedWords();
    this.emitHud();

    if (isDailyTarget) {
      this.callbacks.onToast(`Daily word "${this.dailyTargetWord}" found! +250`, 2000);
    } else if (leveledUp) {
      this.callbacks.onToast(`Level ${this.level} reached`, 1600);
    } else if (isPhysicsAlignedCapture) {
      this.callbacks.onToast(`Physics Alignment! ${word} +${gained}`, 1600);
    }
  }

  // ---------------------------------------------------------------------------
  // INTERNAL SETUP & SPAWNING
  // ---------------------------------------------------------------------------
  private getCeilingY(): number {
    return this.width < 640 ? 96 : 108;
  }

  private getFloorY(): number {
    return this.height - (this.weather === 'snow' ? 16 : 12);
  }

  private getTileSize(): number {
    return this.width < 420 ? 44 : this.width < 768 ? 48 : 52;
  }

  private buildClouds(): void {
    const count = 3;
    const step = this.width / (count + 0.45);
    const rx = this.width < 420 ? 44 : this.width < 640 ? 50 : 66;
    const baseY = this.width < 640 ? 58 : 68;

    this.clouds = [];
    for (let i = 0; i < count; i++) {
      const cx = step * (i + 0.72);
      const cy = i === 1 ? baseY - 10 : baseY;
      this.clouds.push({
        id: i,
        x: cx,
        y: cy,
        baseX: cx,
        baseY: cy,
        rx,
        ry: rx * 0.48,
        phase: i * 1.9,
        pulse: 0,
        ripple: 0,
      });
    }
  }

  private buildWeatherParticles(): void {
    const count = Math.min(76, Math.max(28, Math.floor((this.width * this.height) / 9500)));
    this.weatherParticles = [];
    for (let i = 0; i < count; i++) {
      this.weatherParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        len: 12 + Math.random() * 16,
        r: 2.5 + Math.random() * 3,
        speed: 130 + Math.random() * 185,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private spawnLetter(charOverride?: string, xOverride?: number, yOverride?: number): void {
    const size = this.getTileSize();
    const margin = Math.max(32, size * 0.8);
    const existingChars = this.letters.map((l) => l.char);
    const char = (charOverride ?? pickBalancedLetter(existingChars)).toUpperCase();

    // Spawn from one of the clouds when not overridden
    let x = xOverride;
    if (x === undefined) {
      if (this.clouds.length > 0 && Math.random() < 0.75) {
        const cloud = this.clouds[Math.floor(Math.random() * this.clouds.length)];
        x = cloud.x + (Math.random() - 0.5) * cloud.rx * 1.4;
      } else {
        x = margin + Math.random() * Math.max(40, this.width - margin * 2);
      }
    }
    x = Math.max(margin, Math.min(this.width - margin, x));

    const y = yOverride ?? this.getCeilingY() + size * 0.5 + Math.random() * 10;
    const accents: Array<'paper' | 'blue' | 'yellow'> = ['paper', 'paper', 'paper', 'blue', 'yellow'];

    this.letters.push({
      id: this.nextTileId++,
      char,
      pts: getLetterPoints(char),
      accent: accents[this.nextTileId % accents.length],
      x,
      y,
      vx: (Math.random() - 0.5) * 26,
      vy: 42 + Math.random() * 34,
      size,
      scaleX: 0.35,
      scaleY: 0.35,
      grounded: false,
      alignedWordGroup: -1,
      spawnAnim: 0,
    });
  }

  private seedArenaLetters(): void {
    this.letters = [];
    const total = this.width < 640 ? 14 : 18;
    const ceilY = this.getCeilingY();

    for (let i = 0; i < total; i++) {
      this.spawnLetter(
        undefined,
        undefined,
        ceilY + 34 + Math.random() * Math.max(120, this.height * 0.48),
      );
    }

    // Seed guaranteed playable weather starter letters (including daily target letters in Daily mode)
    const starterWord = this.mode === 'daily' ? this.dailyTargetWord : 'WIND';
    const bonusLetters = this.mode === 'daily' ? ['S', 'U', 'N'] : ['R', 'A', 'I', 'N'];
    const starter = [...starterWord.split(''), ...bonusLetters];

    starter.forEach((ch, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      this.spawnLetter(
        ch,
        this.width * (0.18 + col * 0.21),
        ceilY + 48 + row * (this.getTileSize() + 14),
      );
    });
  }

  // ---------------------------------------------------------------------------
  // PHYSICS-ALIGNED WORD DETECTION & CLUSTER PROXIMITY CHECK
  // ---------------------------------------------------------------------------
  private isSelectionPhysicallyClustered(chosen: LetterTile[]): boolean {
    if (chosen.length < 3) return false;
    const tileSize = this.getTileSize();
    let totalDist = 0;
    for (let i = 1; i < chosen.length; i++) {
      const d = Math.hypot(chosen[i].x - chosen[i - 1].x, chosen[i].y - chosen[i - 1].y);
      if (d > tileSize * 2.65) return false;
      totalDist += d;
    }
    const avgDist = totalDist / (chosen.length - 1);
    return avgDist <= tileSize * 2.15;
  }

  private scanAlignedWords(): void {
    for (const tile of this.letters) {
      tile.alignedWordGroup = -1;
    }
    this.alignedWords = [];
    if (this.letters.length < this.settings.minWordLen) return;

    const tileSize = this.getTileSize();
    const sorted = [...this.letters].sort((a, b) => a.y - b.y || a.x - b.x);

    // Group tiles into horizontal bands (tiles on roughly the same elevation)
    const rows: LetterTile[][] = [];
    for (const tile of sorted) {
      let placed = false;
      for (const row of rows) {
        const refY = row[0].y;
        if (Math.abs(tile.y - refY) <= tileSize * 0.56) {
          row.push(tile);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([tile]);
    }

    const usedInAlignment = new Set<number>();

    for (const row of rows) {
      if (row.length < this.settings.minWordLen) continue;
      row.sort((a, b) => a.x - b.x);

      // Partition into contiguous horizontal runs (touching/nearly touching tiles)
      const runs: LetterTile[][] = [];
      let currentRun: LetterTile[] = [row[0]];
      for (let i = 1; i < row.length; i++) {
        const prev = row[i - 1];
        const curr = row[i];
        const gap = curr.x - prev.x;
        if (gap <= tileSize * 1.48) {
          currentRun.push(curr);
        } else {
          if (currentRun.length >= this.settings.minWordLen) runs.push(currentRun);
          currentRun = [curr];
        }
      }
      if (currentRun.length >= this.settings.minWordLen) runs.push(currentRun);

      // Find longest valid English word inside each physical run
      for (const run of runs) {
        let bestCandidate: AlignedWordCandidate | null = null;
        const maxLen = Math.min(6, run.length);
        for (let len = maxLen; len >= this.settings.minWordLen; len--) {
          for (let start = 0; start <= run.length - len; start++) {
            const slice = run.slice(start, start + len);
            if (slice.some((t) => usedInAlignment.has(t.id))) continue;
            const word = slice.map((t) => t.char).join('');
            if (isValidEnglishWord(word, this.settings.minWordLen)) {
              const centerX = slice.reduce((s, t) => s + t.x, 0) / slice.length;
              const centerY = slice.reduce((s, t) => s + t.y, 0) / slice.length;
              bestCandidate = {
                word,
                tileIds: slice.map((t) => t.id),
                centerX,
                centerY,
              };
              break;
            }
          }
          if (bestCandidate) break;
        }

        if (bestCandidate) {
          const groupIdx = this.alignedWords.length;
          this.alignedWords.push(bestCandidate);
          for (const id of bestCandidate.tileIds) {
            usedInAlignment.add(id);
            const tile = this.letters.find((l) => l.id === id);
            if (tile) tile.alignedWordGroup = groupIdx;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 60FPS FIXED-TIMESTEP SIMULATION LOOP
  // ---------------------------------------------------------------------------
  private loop = (nowMs: number): void => {
    if (this.destroyed) return;

    const rawDt = (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (!this.paused) {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        this.updatePhysics(dt, nowMs * 0.001);
      }
    }

    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private updatePhysics(dt: number, timeSec: number): void {
    // Camera shake decay
    if (this.shakeAmp > 0.05) {
      this.shakeAmp *= Math.pow(0.0015, dt);
    } else {
      this.shakeAmp = 0;
    }

    if (this.stackSoundCooldown > 0) {
      this.stackSoundCooldown -= dt;
    }

    // Combo decay
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
        this.emitHud();
      }
    }

    // Daily timer countdown
    if (this.mode === 'daily' && !this.roundFinished) {
      this.dailyTimer = Math.max(0, this.dailyTimer - dt);
      if (this.dailyTimer <= 0) {
        this.finishRound();
        return;
      }
    }

    // Periodic HUD tick for smooth timer/combo bar
    this.hudThrottleTimer += dt;
    if (this.hudThrottleTimer >= 0.25) {
      this.hudThrottleTimer = 0;
      if (this.mode === 'daily' || this.combo > 1) {
        this.emitHud();
      }
    }

    // Update clouds
    for (const c of this.clouds) {
      c.phase += dt * 1.2;
      c.x = c.baseX + Math.sin(c.phase * 0.7) * 8;
      c.y = c.baseY + Math.cos(c.phase) * 3;
      if (c.pulse > 0) c.pulse = Math.max(0, c.pulse - dt * 2.8);
      if (c.ripple > 0) c.ripple = Math.max(0, c.ripple - dt * 2.1);
    }

    // Replenish tiles smoothly
    const cap = this.width < 640 ? 20 : 26;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.letters.length < cap) {
      this.spawnLetter();
      this.spawnTimer = this.weather === 'rain' ? 0.85 : 1.25;
    }

    const ceilY = this.getCeilingY();
    const floorY = this.getFloorY();
    const w = this.weather;

    // Integrate weather forces on letter tiles
    for (const tile of this.letters) {
      // Spring squash-and-stretch recovery back to (1, 1)
      tile.scaleX += (1 - tile.scaleX) * Math.min(1, dt * 14);
      tile.scaleY += (1 - tile.scaleY) * Math.min(1, dt * 14);

      const wasGrounded = tile.grounded;
      tile.grounded = false;

      if (w === 'rain') {
        tile.vy += 235 * dt;
        tile.vx += Math.sin(timeSec * 2.4 + tile.id) * 24 * dt;
        tile.vx *= Math.pow(0.28, dt);
        tile.vy = Math.min(tile.vy, 285);
      } else if (w === 'snow') {
        // Gentle descent; tiles settle cleanly and stack
        const targetFall = 52;
        tile.vy += (targetFall - tile.vy) * Math.min(1, dt * 4.2);
        tile.vx += (Math.sin(timeSec * 1.8 + tile.id * 1.4) * 22 - tile.vx) * Math.min(1, dt * 3.5);
      } else if (w === 'wind') {
        tile.vx += this.windVec.x * 1.75 * dt;
        tile.vy += (this.windVec.y * 0.85 + 36) * dt;
        tile.vx *= Math.pow(0.32, dt);
        tile.vy *= Math.pow(0.32, dt);
        const speed = Math.hypot(tile.vx, tile.vy);
        if (speed > 345) {
          tile.vx = (tile.vx / speed) * 345;
          tile.vy = (tile.vy / speed) * 345;
        }
      } else if (w === 'sun') {
        // Buoyant golden thermal lift
        tile.vy += (-84 - tile.vy) * Math.min(1, dt * 3.6);
        tile.vx += Math.cos(timeSec * 2.1 + tile.id) * 26 * dt;
        tile.vx *= Math.pow(0.32, dt);
      }

      tile.x += tile.vx * dt;
      tile.y += tile.vy * dt;

      const half = tile.size * 0.5;

      // Side walls
      if (tile.x < half + 10) {
        tile.x = half + 10;
        tile.vx = Math.abs(tile.vx) * 0.62;
      } else if (tile.x > this.width - half - 10) {
        tile.x = this.width - half - 10;
        tile.vx = -Math.abs(tile.vx) * 0.62;
      }

      // Vertical bounds per weather
      if (w === 'sun') {
        if (tile.y < ceilY + half + 6) {
          tile.y = ceilY + half + 6;
          tile.vy = Math.abs(tile.vy) * 0.3;
        }
        if (tile.y > floorY - half) {
          tile.y = floorY - half;
          tile.vy = -88;
        }
      } else {
        if (tile.y < ceilY + half) {
          tile.y = ceilY + half;
          tile.vy = Math.max(24, Math.abs(tile.vy) * 0.4);
        }
        if (tile.y > floorY - half) {
          tile.y = floorY - half;
          if (w === 'snow') {
            if (!wasGrounded && tile.vy > 22) {
              tile.scaleX = 1.14;
              tile.scaleY = 0.86;
              this.playThrottledStackClick();
            }
            tile.vy = 0;
            tile.vx *= Math.pow(0.06, dt);
            tile.grounded = true;
          } else if (w === 'rain') {
            // Recycle bottom raindrop into a fresh letter falling from a cloud (unless selected)
            if (!this.selectedIds.includes(tile.id)) {
              const cloud = this.clouds[Math.floor(Math.random() * Math.max(1, this.clouds.length))];
              tile.x = cloud
                ? Math.max(half + 12, Math.min(this.width - half - 12, cloud.x + (Math.random() - 0.5) * cloud.rx * 1.4))
                : half + 16 + Math.random() * Math.max(40, this.width - tile.size - 32);
              tile.y = ceilY + half;
              tile.vy = 54 + Math.random() * 24;
              tile.char = pickBalancedLetter(this.letters.map((l) => l.char));
              tile.pts = getLetterPoints(tile.char);
              tile.scaleX = 0.5;
              tile.scaleY = 0.5;
            } else {
              tile.vy = -Math.abs(tile.vy) * 0.35;
            }
          } else {
            tile.vy = -Math.abs(tile.vy) * 0.38;
          }
        }
      }
    }

    // Tile-tile collision & crisp AABB stacking in SNOW mode
    if (w === 'snow') {
      this.resolveSnowStacking(floorY);
    } else {
      this.resolveGeneralCollisions();
    }

    // Periodic scan for physically aligned horizontal words
    this.alignScanTimer += dt;
    if (this.alignScanTimer >= 0.22) {
      this.alignScanTimer = 0;
      const prevCount = this.alignedWords.length;
      this.scanAlignedWords();
      if (prevCount !== this.alignedWords.length) {
        this.emitHud();
      }
    }

    // Update ambient weather particles
    for (const pt of this.weatherParticles) {
      if (w === 'rain') {
        pt.x += this.windVec.x * 0.06 * dt;
        pt.y += pt.speed * 1.95 * dt;
      } else if (w === 'snow') {
        pt.phase += dt * 1.9;
        pt.x += (Math.sin(pt.phase) * 26 + this.windVec.x * 0.08) * dt;
        pt.y += pt.speed * 0.26 * dt;
      } else if (w === 'wind') {
        pt.x += (this.windVec.x * 1.9 + Math.sign(this.windVec.x || 1) * 185) * dt;
        pt.y += (this.windVec.y * 0.85 + Math.sin(pt.phase) * 18) * dt;
      } else if (w === 'sun') {
        pt.phase += dt * 1.7;
        pt.x += Math.cos(pt.phase) * 20 * dt;
        pt.y -= pt.speed * 0.36 * dt;
      }

      if (pt.y > this.height + 22) pt.y = -14;
      if (pt.y < -26) pt.y = this.height + 12;
      if (pt.x > this.width + 26) pt.x = -20;
      if (pt.x < -26) pt.x = this.width + 20;
    }

    // Update pooled geometric bursts
    for (const gb of this.burstPool) {
      if (!gb.active) continue;
      gb.life -= dt;
      if (gb.life <= 0) {
        gb.active = false;
        continue;
      }
      gb.x += gb.vx * dt;
      gb.y += gb.vy * dt;
      gb.vy += 280 * dt;
      gb.rot += gb.vRot * dt;
    }

    // Update floating score popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const fp = this.popups[i];
      fp.life -= dt;
      if (fp.life <= 0) {
        this.popups.splice(i, 1);
        continue;
      }
      fp.y += fp.vy * dt;
      fp.vy *= Math.pow(0.45, dt);
    }
  }

  /** Solid box-on-box Bauhaus block stacking solver for Snow mode */
  private resolveSnowStacking(floorY: number): void {
    const passes = 4;
    const pad = 3; // crisp architectural gutter between stacked tiles

    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < this.letters.length; i++) {
        const a = this.letters[i];
        const halfA = a.size * 0.5 + pad * 0.5;
        for (let j = i + 1; j < this.letters.length; j++) {
          const b = this.letters[j];
          const halfB = b.size * 0.5 + pad * 0.5;
          const minX = halfA + halfB;
          const minY = halfA + halfB;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const overlapX = minX - Math.abs(dx);
          const overlapY = minY - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            if (overlapY <= overlapX) {
              // Vertical stacking resolution: top tile rests solidly on bottom tile
              if (dy > 0) {
                // a is above b
                a.y -= overlapY;
                if (a.vy > 18) {
                  a.scaleX = 1.1;
                  a.scaleY = 0.9;
                  this.playThrottledStackClick();
                }
                a.vy = Math.min(a.vy, 0);
                a.vx *= 0.82;
                a.grounded = true;
              } else {
                // b is above a
                b.y -= overlapY;
                if (b.vy > 18) {
                  b.scaleX = 1.1;
                  b.scaleY = 0.9;
                  this.playThrottledStackClick();
                }
                b.vy = Math.min(b.vy, 0);
                b.vx *= 0.82;
                b.grounded = true;
              }
            } else {
              // Horizontal separation
              const push = overlapX * 0.5;
              const sign = dx >= 0 ? 1 : -1;
              a.x -= sign * push;
              b.x += sign * push;
            }
          }
        }

        // Re-clamp to walls and floor after stacking pass
        const half = a.size * 0.5;
        a.x = Math.max(half + 10, Math.min(this.width - half - 10, a.x));
        if (a.y > floorY - half) {
          a.y = floorY - half;
          a.vy = 0;
          a.grounded = true;
        }
      }
    }
  }

  private resolveGeneralCollisions(): void {
    for (let i = 0; i < this.letters.length; i++) {
      const a = this.letters[i];
      for (let j = i + 1; j < this.letters.length; j++) {
        const b = this.letters[j];
        const minD = (a.size + b.size) * 0.54;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001 && dist < minD) {
          const overlap = (minD - dist) * 0.42;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }

  private playThrottledStackClick(): void {
    if (this.stackSoundCooldown <= 0) {
      audioEngine.playStackClick();
      this.stackSoundCooldown = 0.085;
    }
  }

  private spawnGeometricBurst(x: number, y: number, count: number): void {
    const p = this.palette;
    const colors = [p.red, p.blue, p.yellow, p.ink];
    const shapes: Array<'triangle' | 'circle' | 'square'> = ['triangle', 'circle', 'square'];
    let spawned = 0;

    for (let i = 0; i < this.burstPool.length && spawned < count; i++) {
      const gb = this.burstPool[i];
      if (gb.active) continue;
      const ang = (Math.PI * 2 * spawned) / count + (Math.random() - 0.5) * 0.4;
      const spd = 85 + Math.random() * 215;
      gb.active = true;
      gb.x = x;
      gb.y = y;
      gb.vx = Math.cos(ang) * spd;
      gb.vy = Math.sin(ang) * spd - 45;
      gb.size = 6 + Math.random() * 6;
      gb.rot = Math.random() * Math.PI * 2;
      gb.vRot = (Math.random() - 0.5) * 11;
      gb.color = colors[spawned % colors.length];
      gb.shape = shapes[spawned % shapes.length];
      gb.maxLife = 0.58 + Math.random() * 0.22;
      gb.life = gb.maxLife;
      spawned += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // BAUHAUS CANVAS RENDERER
  // ---------------------------------------------------------------------------
  private render(): void {
    const ctx = this.ctx;
    const p = this.palette;
    const W = this.width;
    const H = this.height;
    const w = this.weather;
    const ceilY = this.getCeilingY();

    ctx.save();

    // Decaying camera shake on heavy word bursts
    if (this.shakeAmp > 0.1) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeAmp;
      const sy = (Math.random() - 0.5) * 2 * this.shakeAmp;
      ctx.translate(sx, sy);
    }

    // 1. Archival Paper Canvas
    ctx.fillStyle = p.paper;
    ctx.fillRect(-16, -16, W + 32, H + 32);

    // 2. Subtle Bauhaus Architectural Grid Lines
    ctx.save();
    ctx.strokeStyle = p.ink;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ceilY);
    ctx.lineTo(W, ceilY);
    ctx.moveTo(W * 0.25, 0);
    ctx.lineTo(W * 0.25, H);
    ctx.moveTo(W * 0.75, 0);
    ctx.lineTo(W * 0.75, H);
    ctx.stroke();
    ctx.restore();

    // 3. Weather-Specific Geometric Motifs
    if (w === 'sun') {
      ctx.save();
      const sunX = W * 0.85;
      const sunY = ceilY - 12;
      ctx.fillStyle = p.yellow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = p.yellow;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(sunX - 42, sunY + 42);
      ctx.lineTo(sunX - 180, sunY + 180);
      ctx.moveTo(sunX - 14, sunY + 56);
      ctx.lineTo(sunX - 96, sunY + 210);
      ctx.stroke();
      ctx.restore();
    } else if (w === 'snow') {
      // Crisp Bauhaus stacking floor shelf
      ctx.save();
      ctx.fillStyle = p.blue;
      ctx.fillRect(0, H - 16, W, 16);
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, H - 16);
      ctx.lineTo(W, H - 16);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Weather Particles
    ctx.save();
    if (w === 'rain') {
      ctx.strokeStyle = p.blue;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'square';
      for (const pt of this.weatherParticles) {
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x, pt.y + pt.len);
        ctx.stroke();
      }
    } else if (w === 'snow') {
      ctx.strokeStyle = p.ink;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = 2;
      for (const pt of this.weatherParticles) {
        const r = pt.r + 1.4;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - r);
        ctx.lineTo(pt.x, pt.y + r);
        ctx.moveTo(pt.x - r * 0.86, pt.y - r * 0.5);
        ctx.lineTo(pt.x + r * 0.86, pt.y + r * 0.5);
        ctx.moveTo(pt.x + r * 0.86, pt.y - r * 0.5);
        ctx.lineTo(pt.x - r * 0.86, pt.y + r * 0.5);
        ctx.stroke();
      }
    } else if (w === 'wind') {
      ctx.strokeStyle = p.red;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2.6;
      ctx.setLineDash([8, 6]);
      const mag = Math.max(40, Math.hypot(this.windVec.x, this.windVec.y));
      const ux = this.windVec.x / mag;
      const uy = this.windVec.y / mag;
      const len = Math.min(60, 22 + mag * 0.1);
      for (const pt of this.weatherParticles) {
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x + ux * len, pt.y + uy * len);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (w === 'sun') {
      ctx.fillStyle = p.yellow;
      ctx.strokeStyle = p.ink;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      for (const pt of this.weatherParticles) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r + 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();

    // 5. Three Interactive Faceted Bauhaus Clouds
    for (const c of this.clouds) {
      const sc = 1 + c.pulse * 0.14;
      ctx.save();
      ctx.translate(c.x, c.y);

      // Expanding geometric ripple ring on cloud tap
      if (c.ripple > 0) {
        ctx.save();
        ctx.strokeStyle = w === 'wind' ? p.red : w === 'sun' ? p.yellow : p.blue;
        ctx.globalAlpha = c.ripple * 0.7;
        ctx.lineWidth = 3;
        const rad = c.rx * (1.05 + (1 - c.ripple) * 0.65);
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.scale(sc, sc);

      // Core black Bauhaus circle behind cloud
      ctx.fillStyle = p.ink;
      ctx.beginPath();
      ctx.arc(c.rx * 0.25, -c.ry * 0.18, c.ry * 0.72, 0, Math.PI * 2);
      ctx.fill();

      // Weather accent circle inside emblem
      ctx.fillStyle = w === 'sun' ? p.yellow : w === 'wind' ? p.red : w === 'snow' ? p.paper : p.red;
      ctx.beginPath();
      ctx.arc(c.rx * 0.45, -c.ry * 0.36, c.ry * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Faceted cobalt polygon cloud
      const w2 = c.rx;
      const h2 = c.ry;
      ctx.fillStyle = w === 'snow' ? p.paper : w === 'wind' ? p.red : w === 'sun' ? p.yellow : p.blue;
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-w2 * 0.9, h2 * 0.45);
      ctx.lineTo(-w2 * 0.62, -h2 * 0.15);
      ctx.lineTo(-w2 * 0.32, -h2 * 0.15);
      ctx.lineTo(-w2 * 0.15, -h2 * 0.65);
      ctx.lineTo(w2 * 0.25, -h2 * 0.65);
      ctx.lineTo(w2 * 0.42, -h2 * 0.15);
      ctx.lineTo(w2 * 0.76, -h2 * 0.15);
      ctx.lineTo(w2 * 0.92, h2 * 0.28);
      ctx.lineTo(w2 * 0.75, h2 * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Internal triangulation lines
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-w2 * 0.62, -h2 * 0.15);
      ctx.lineTo(-w2 * 0.3, h2 * 0.45);
      ctx.lineTo(-w2 * 0.15, -h2 * 0.65);
      ctx.lineTo(w2 * 0.22, h2 * 0.45);
      ctx.lineTo(w2 * 0.25, -h2 * 0.65);
      ctx.stroke();

      ctx.restore();
    }

    // 6. Physics-Aligned Word Brackets (tappable 2× bonus captures!)
    for (const candidate of this.alignedWords) {
      const tiles = candidate.tileIds
        .map((id) => this.letters.find((l) => l.id === id))
        .filter((l): l is LetterTile => Boolean(l));
      if (tiles.length < this.settings.minWordLen) continue;

      const minX = Math.min(...tiles.map((t) => t.x - t.size * 0.5)) - 6;
      const maxX = Math.max(...tiles.map((t) => t.x + t.size * 0.5)) + 6;
      const minY = Math.min(...tiles.map((t) => t.y - t.size * 0.5)) - 6;
      const maxY = Math.max(...tiles.map((t) => t.y + t.size * 0.5)) + 6;

      ctx.save();
      ctx.strokeStyle = p.red;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.setLineDash([]);

      // Small tappable capture tag above the aligned row
      const label = `TAP · ${candidate.word} 2×`;
      ctx.font = "800 10px 'Outfit', sans-serif";
      const tw = ctx.measureText(label).width + 14;
      const bx = Math.max(8, Math.min(W - tw - 8, (minX + maxX) * 0.5 - tw * 0.5));
      const by = Math.max(ceilY + 4, minY - 22);

      ctx.fillStyle = p.ink;
      ctx.fillRect(bx + 2, by + 2, tw, 18);
      ctx.fillStyle = p.red;
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, tw, 18);
      ctx.strokeRect(bx, by, tw, 18);

      ctx.fillStyle = '#F4F1DE';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + tw * 0.5, by + 9.5);
      ctx.restore();
    }

    // 7. Active Word Selection Chain Line
    const chosen = this.getSelectedLetters();
    if (chosen.length > 1) {
      const clustered = this.isSelectionPhysicallyClustered(chosen);
      ctx.save();
      ctx.strokeStyle = clustered ? p.blue : p.red;
      ctx.lineWidth = 4.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      chosen.forEach((l, i) => {
        if (i === 0) ctx.moveTo(l.x, l.y);
        else ctx.lineTo(l.x, l.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 8. Bauhaus Square Letter Tiles
    for (const tile of this.letters) {
      const selIdx = this.selectedIds.indexOf(tile.id);
      const isSelected = selIdx !== -1;
      const isAligned = tile.alignedWordGroup !== -1;

      ctx.save();
      ctx.translate(tile.x, tile.y);
      const selBoost = isSelected ? 1.09 : 1;
      ctx.scale(tile.scaleX * selBoost, tile.scaleY * selBoost);

      const half = tile.size * 0.5;

      // Hard offset Bauhaus ink shadow
      ctx.fillStyle = p.ink;
      ctx.fillRect(-half + 4, -half + 4, tile.size, tile.size);

      // Tile body
      ctx.fillStyle = isSelected ? p.yellow : isAligned ? p.card : p.paper;
      ctx.strokeStyle = isAligned && !isSelected ? p.red : p.ink;
      ctx.lineWidth = 3;
      ctx.fillRect(-half, -half, tile.size, tile.size);
      ctx.strokeRect(-half, -half, tile.size, tile.size);

      // Geometric bold letter
      ctx.fillStyle = isSelected
        ? p.ink
        : tile.accent === 'blue'
          ? p.blue
          : tile.accent === 'yellow'
            ? p.red
            : p.ink;
      ctx.font = `900 ${Math.round(tile.size * 0.52)}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.char, 0, 1);

      // High-value subtle point indicator in bottom-right corner
      if (tile.pts > 1) {
        ctx.fillStyle = p.ink;
        ctx.globalAlpha = 0.65;
        ctx.font = "700 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(tile.pts), half - 4, half - 3);
        ctx.globalAlpha = 1;
      }

      // Selection order square badge
      if (isSelected) {
        ctx.fillStyle = p.red;
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 2;
        ctx.fillRect(-half, -half, 16, 16);
        ctx.strokeRect(-half, -half, 16, 16);
        ctx.fillStyle = '#F4F1DE';
        ctx.font = "800 10px 'Outfit', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(selIdx + 1), -half + 8, -half + 8.5);
      }

      ctx.restore();
    }

    // 9. Wind Swipe Vector Arrow
    if (this.isSwipingWind) {
      const sx = this.swipeStart.x;
      const sy = this.swipeStart.y;
      const cx = this.swipeCurr.x;
      const cy = this.swipeCurr.y;
      if (Math.hypot(cx - sx, cy - sy) > 10) {
        ctx.save();
        ctx.strokeStyle = p.ink;
        ctx.fillStyle = p.red;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        const ang = Math.atan2(cy - sy, cx - sx);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 16 * Math.cos(ang - 0.48), cy - 16 * Math.sin(ang - 0.48));
        ctx.lineTo(cx - 16 * Math.cos(ang + 0.48), cy - 16 * Math.sin(ang + 0.48));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // 10. Pooled Geometric Particle Bursts
    for (const gb of this.burstPool) {
      if (!gb.active) continue;
      ctx.save();
      ctx.translate(gb.x, gb.y);
      ctx.rotate(gb.rot);
      ctx.globalAlpha = Math.max(0, gb.life / gb.maxLife);
      ctx.fillStyle = gb.color;
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2;

      if (gb.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, gb.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (gb.shape === 'square') {
        ctx.fillRect(-gb.size * 0.5, -gb.size * 0.5, gb.size, gb.size);
        ctx.strokeRect(-gb.size * 0.5, -gb.size * 0.5, gb.size, gb.size);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -gb.size * 0.72);
        ctx.lineTo(gb.size * 0.65, gb.size * 0.55);
        ctx.lineTo(-gb.size * 0.65, gb.size * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 11. Floating Bauhaus Score Stamps
    for (const fp of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (fp.life / fp.maxLife) * 1.8);
      ctx.font = "900 14px 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = Math.max(ctx.measureText(fp.text).width + 22, fp.subtext ? 114 : 74);
      const bh = fp.subtext ? 40 : 28;

      ctx.fillStyle = p.ink;
      ctx.fillRect(fp.x - tw * 0.5 + 3, fp.y - bh * 0.5 + 3, tw, bh);

      const bg = fp.accent === 'red' ? p.red : fp.accent === 'blue' ? p.blue : p.yellow;
      const fg = fp.accent === 'yellow' ? p.ink : '#F4F1DE';

      ctx.fillStyle = bg;
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2.5;
      ctx.fillRect(fp.x - tw * 0.5, fp.y - bh * 0.5, tw, bh);
      ctx.strokeRect(fp.x - tw * 0.5, fp.y - bh * 0.5, tw, bh);

      ctx.fillStyle = fg;
      ctx.fillText(fp.text, fp.x, fp.subtext ? fp.y - 6 : fp.y + 1);

      if (fp.subtext) {
        ctx.font = "800 9px 'Outfit', sans-serif";
        ctx.fillText(fp.subtext, fp.x, fp.y + 10);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // POINTER INTERACTION (MOBILE TOUCH + DESKTOP MOUSE)
  // ---------------------------------------------------------------------------
  private getCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private hitCloud(x: number, y: number): CloudEntity | undefined {
    return this.clouds.find((c) => {
      const dx = (x - c.x) / (c.rx * 1.2);
      const dy = (y - c.y) / (c.ry * 1.45);
      return dx * dx + dy * dy <= 1;
    });
  }

  private hitAlignedBanner(x: number, y: number): AlignedWordCandidate | undefined {
    const ceilY = this.getCeilingY();
    for (const candidate of this.alignedWords) {
      const tiles = candidate.tileIds
        .map((id) => this.letters.find((l) => l.id === id))
        .filter((l): l is LetterTile => Boolean(l));
      if (tiles.length < this.settings.minWordLen) continue;
      const minX = Math.min(...tiles.map((t) => t.x - t.size * 0.5)) - 10;
      const maxX = Math.max(...tiles.map((t) => t.x + t.size * 0.5)) + 10;
      const minY = Math.min(...tiles.map((t) => t.y - t.size * 0.5)) - 6;
      const by = Math.max(ceilY + 4, minY - 26);
      if (x >= minX && x <= maxX && y >= by - 4 && y <= by + 24) {
        return candidate;
      }
    }
    return undefined;
  }

  private hitTile(x: number, y: number): LetterTile | null {
    for (let i = this.letters.length - 1; i >= 0; i--) {
      const tile = this.letters[i];
      const pad = Math.max(27, tile.size * 0.62);
      if (Math.abs(x - tile.x) <= pad && Math.abs(y - tile.y) <= pad) {
        return tile;
      }
    }
    return null;
  }

  private toggleTileSelection(tile: LetterTile, fromDrag: boolean): void {
    const idx = this.selectedIds.indexOf(tile.id);
    if (idx !== -1) {
      // During drag: backtrack cleanly if returning to the previous tile
      if (fromDrag) {
        if (this.selectedIds.length >= 2 && idx === this.selectedIds.length - 2) {
          this.selectedIds.pop();
          audioEngine.playTileDeselect();
          this.emitHud();
        }
        return;
      }
      if (idx === this.selectedIds.length - 1) {
        this.selectedIds.pop();
        audioEngine.playTileDeselect();
      } else {
        this.selectedIds = this.selectedIds.slice(0, idx + 1);
        audioEngine.playTileDeselect();
      }
      this.emitHud();
      return;
    }

    if (this.selectedIds.length >= 8) {
      this.callbacks.onToast('Maximum 8 letters', 900);
      return;
    }

    this.selectedIds.push(tile.id);
    tile.scaleX = 1.2;
    tile.scaleY = 0.85;
    audioEngine.playTileSelect(this.selectedIds.length);
    this.emitHud();

    if (this.settings.autoSubmit) {
      const word = this.getSelectedLetters().map((l) => l.char).join('');
      if (word.length >= 4 && isValidEnglishWord(word, this.settings.minWordLen)) {
        this.submitWord();
      }
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    audioEngine.unlock();
    if (this.paused || this.roundFinished) return;

    this.activePointerId = e.pointerId;
    const { x, y } = this.getCanvasPoint(e);
    this.swipeStart = { x, y };
    this.swipeCurr = { x, y };

    // 1. Tap a cloud to switch weather
    const cloud = this.hitCloud(x, y);
    if (cloud) {
      cloud.pulse = 1;
      cloud.ripple = 1;
      this.cycleWeather();
      return;
    }

    // 2. Tap a glowing physics-aligned capture banner for instant 2× capture
    const aligned = this.hitAlignedBanner(x, y);
    if (aligned) {
      this.submitWord(aligned.tileIds, true);
      return;
    }

    // 3. Tap or start drag-chain on a letter tile
    const tile = this.hitTile(x, y);
    if (tile) {
      this.isDraggingLetters = true;
      this.toggleTileSelection(tile, false);
      return;
    }

    // 4. Swipe open sky to steer the wind
    this.isSwipingWind = true;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.paused || this.roundFinished) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    const { x, y } = this.getCanvasPoint(e);
    this.swipeCurr = { x, y };

    if (this.isDraggingLetters) {
      const tile = this.hitTile(x, y);
      if (tile) {
        this.toggleTileSelection(tile, true);
      }
      return;
    }

    if (this.isSwipingWind) {
      const dx = x - this.swipeStart.x;
      const dy = y - this.swipeStart.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) {
        if (this.weather !== 'wind') {
          this.setWeather('wind');
        }
        const clamped = Math.min(220, dist);
        const strength = (clamped / 220) * 355;
        this.windVec.x = (dx / dist) * strength;
        this.windVec.y = (dy / dist) * strength;
        audioEngine.setWindIntensity(clamped / 220, true);
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.isDraggingLetters = false;
    if (this.isSwipingWind) {
      this.isSwipingWind = false;
      this.syncWindAudio();
    }
  };

  private bindPointerEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  private unbindPointerEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  // ---------------------------------------------------------------------------
  // HELPERS & SNAPSHOTS
  // ---------------------------------------------------------------------------
  private syncWindAudio(): void {
    const mag = Math.hypot(this.windVec.x, this.windVec.y);
    audioEngine.setWindIntensity(mag / 355, this.weather === 'wind' && !this.paused && !this.roundFinished);
  }

  private getSelectedLetters(): LetterTile[] {
    return this.selectedIds
      .map((id) => this.letters.find((l) => l.id === id))
      .filter((l): l is LetterTile => Boolean(l));
  }

  private finishRound(): void {
    this.roundFinished = true;
    this.paused = true;
    audioEngine.setWindIntensity(0, false);

    let bestWord = '';
    for (const w of this.wordsFound) {
      if (w.length > bestWord.length) bestWord = w;
    }

    this.callbacks.onRoundComplete({
      mode: this.mode,
      score: this.score,
      isNewBest: false,
      wordsFound: [...this.wordsFound],
      bestWord,
      bestCombo: this.bestCombo,
      physicsBonuses: this.physicsBonuses,
      dailyTargetWord: this.mode === 'daily' ? this.dailyTargetWord : undefined,
      dailyTargetFound: this.mode === 'daily' ? this.dailyTargetFound : undefined,
      levelReached: this.level,
    });
  }

  private emitHud(): void {
    this.selectedIds = this.selectedIds.filter((id) => this.letters.some((l) => l.id === id));
    const chosen = this.getSelectedLetters();
    const currentWord = chosen.map((l) => l.char).join('');
    const isCurrentWordValid =
      currentWord.length >= this.settings.minWordLen &&
      isValidEnglishWord(currentWord, this.settings.minWordLen);

    this.callbacks.onHudUpdate({
      score: this.score,
      wordsCount: this.wordsFound.length,
      combo: this.combo,
      comboProgress: this.combo > 1 ? Math.max(0, this.comboTimer / this.comboMaxTime) : 0,
      level: this.level,
      levelWords: this.levelWords,
      levelGoal: this.levelGoal,
      dailyTimer: this.dailyTimer,
      dailyTargetWord: this.dailyTargetWord,
      dailyTargetFound: this.dailyTargetFound,
      weather: this.weather,
      selectedTiles: chosen.map((l) => ({ id: l.id, char: l.char, pts: l.pts })),
      currentWord,
      isCurrentWordValid,
      physicsClusterReady: isCurrentWordValid && this.isSelectionPhysicallyClustered(chosen),
      alignedWordsCount: this.alignedWords.length,
    });
  }
}
