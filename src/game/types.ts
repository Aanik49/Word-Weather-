export type ScreenState = 'SPLASH' | 'LOBBY' | 'PLAYING';

export type PlayPhase = 'ACTIVE' | 'PAUSED' | 'ROUND_SUMMARY';

export type GameMode = 'classic' | 'daily' | 'zen';

export type WeatherType = 'rain' | 'snow' | 'wind' | 'sun';

export type PaletteId = 'classic1923' | 'dessauNight' | 'primaryRed' | 'weimarTeal';

export type ModalType = 'settings' | 'profile' | 'store' | 'guide' | null;

export interface PaletteUnlockRule {
  requiredWords: number;
  requiredScore: number;
  allowDailyComplete?: boolean;
  requirementText: string;
}

export interface BauhausPalette {
  id: PaletteId;
  name: string;
  desc: string;
  paper: string;
  card: string;
  ink: string;
  red: string;
  blue: string;
  yellow: string;
  unlockRule?: PaletteUnlockRule;
}

export interface GameSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  minWordLen: 3 | 4;
  autoSubmit: boolean;
  hapticsEnabled: boolean;
}

export interface PlayerStats {
  highScore: number;
  dailyBestScore: number;
  totalWords: number;
  bestCombo: number;
  longestWord: string;
  physicsBonuses: number;
  dailyCompletedDate: string | null;
  dailyStreak: number;
  equippedPalette: PaletteId;
  unlockedPalettes: PaletteId[];
}

export interface LetterTile {
  id: number;
  char: string;
  pts: number;
  accent: 'paper' | 'blue' | 'yellow';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  scaleX: number;
  scaleY: number;
  grounded: boolean;
  /** Highlight index when part of a live physics-aligned word */
  alignedWordGroup: number;
  spawnAnim: number;
}

export interface CloudEntity {
  id: number;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  rx: number;
  ry: number;
  phase: number;
  pulse: number;
  ripple: number;
}

export interface WeatherParticle {
  x: number;
  y: number;
  len: number;
  r: number;
  speed: number;
  phase: number;
}

export interface GeometricBurst {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vRot: number;
  color: string;
  shape: 'triangle' | 'circle' | 'square';
  life: number;
  maxLife: number;
}

export interface FloatingPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  accent: 'yellow' | 'red' | 'blue';
  life: number;
  maxLife: number;
}

export interface AlignedWordCandidate {
  word: string;
  tileIds: number[];
  centerX: number;
  centerY: number;
}

export interface SelectedTrayTile {
  id: number;
  char: string;
  pts: number;
}

export interface HudSnapshot {
  score: number;
  wordsCount: number;
  combo: number;
  comboProgress: number; // 0..1
  level: number;
  levelWords: number;
  levelGoal: number;
  dailyTimer: number;
  dailyTargetWord: string;
  dailyTargetFound: boolean;
  weather: WeatherType;
  selectedTiles: SelectedTrayTile[];
  currentWord: string;
  isCurrentWordValid: boolean;
  physicsClusterReady: boolean;
  alignedWordsCount: number;
}

export interface RoundSummaryData {
  mode: GameMode;
  score: number;
  isNewBest: boolean;
  wordsFound: string[];
  bestWord: string;
  bestCombo: number;
  physicsBonuses: number;
  weatherShifts: number;
  weatherSequence: WeatherType[];
  dailyDate?: string;
  dailyTargetWord?: string;
  dailyTargetFound?: boolean;
  levelReached: number;
  newlyUnlockedPalettes?: PaletteId[];
}
