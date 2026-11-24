import type { GameSettings, PaletteId, PlayerStats } from './types';
import { getTodayKey } from './dictionary';

const SETTINGS_KEY = 'word_weather_settings_v1';
const STATS_KEY = 'word_weather_stats_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.45,
  sfxVolume: 0.75,
  minWordLen: 3,
  autoSubmit: false,
  hapticsEnabled: true,
};

export const DEFAULT_STATS: PlayerStats = {
  highScore: 0,
  dailyBestScore: 0,
  totalWords: 0,
  bestCombo: 1,
  longestWord: '',
  physicsBonuses: 0,
  dailyCompletedDate: null,
  dailyStreak: 0,
  equippedPalette: 'classic1923',
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      minWordLen: parsed.minWordLen === 4 ? 4 : 3,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw) as Partial<PlayerStats>;
    return {
      ...DEFAULT_STATS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveStats(stats: PlayerStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

export function recordRoundStats(
  current: PlayerStats,
  params: {
    mode: 'classic' | 'daily';
    score: number;
    wordsFound: string[];
    bestCombo: number;
    physicsBonuses: number;
    dailyCompleted: boolean;
  },
): { nextStats: PlayerStats; isNewBest: boolean } {
  const prevBest = params.mode === 'daily' ? current.dailyBestScore : current.highScore;
  const isNewBest = params.score > prevBest && params.score > 0;

  let longestWord = current.longestWord;
  for (const w of params.wordsFound) {
    if (w.length > longestWord.length) longestWord = w;
  }

  let dailyCompletedDate = current.dailyCompletedDate;
  let dailyStreak = current.dailyStreak;
  if (params.mode === 'daily' && params.dailyCompleted) {
    const today = getTodayKey();
    if (dailyCompletedDate !== today) {
      dailyCompletedDate = today;
      dailyStreak += 1;
    }
  }

  const nextStats: PlayerStats = {
    ...current,
    highScore: params.mode === 'classic' ? Math.max(current.highScore, params.score) : current.highScore,
    dailyBestScore: params.mode === 'daily' ? Math.max(current.dailyBestScore, params.score) : current.dailyBestScore,
    totalWords: current.totalWords + params.wordsFound.length,
    bestCombo: Math.max(current.bestCombo, params.bestCombo),
    longestWord,
    physicsBonuses: current.physicsBonuses + params.physicsBonuses,
    dailyCompletedDate,
    dailyStreak,
  };

  saveStats(nextStats);
  return { nextStats, isNewBest };
}

export function updateEquippedPalette(current: PlayerStats, paletteId: PaletteId): PlayerStats {
  const next = { ...current, equippedPalette: paletteId };
  saveStats(next);
  return next;
}
