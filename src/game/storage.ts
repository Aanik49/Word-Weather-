import type { GameMode, GameSettings, PaletteId, PlayerStats } from './types';
import { getTodayKey } from './dictionary';
import { computeUnlockedPaletteIds } from './palettes';

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
  unlockedPalettes: ['classic1923'],
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
    const merged: PlayerStats = {
      ...DEFAULT_STATS,
      ...parsed,
      unlockedPalettes: Array.isArray(parsed.unlockedPalettes)
        ? Array.from(new Set<PaletteId>(['classic1923', ...parsed.unlockedPalettes]))
        : ['classic1923'],
    };
    merged.unlockedPalettes = computeUnlockedPaletteIds(merged);
    if (!merged.unlockedPalettes.includes(merged.equippedPalette)) {
      merged.equippedPalette = 'classic1923';
    }
    return merged;
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
    mode: GameMode;
    score: number;
    wordsFound: string[];
    bestCombo: number;
    physicsBonuses: number;
    dailyCompleted: boolean;
  },
): { nextStats: PlayerStats; isNewBest: boolean; newlyUnlockedPalettes: PaletteId[] } {
  const prevUnlocked = new Set<PaletteId>(computeUnlockedPaletteIds(current));
  const prevBest =
    params.mode === 'daily'
      ? current.dailyBestScore
      : params.mode === 'classic'
        ? current.highScore
        : Infinity;
  const isNewBest = params.mode !== 'zen' && params.score > prevBest && params.score > 0;

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

  const candidateStats: PlayerStats = {
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

  const nextUnlocked = computeUnlockedPaletteIds(candidateStats);
  const newlyUnlockedPalettes = nextUnlocked.filter((id) => !prevUnlocked.has(id));
  const nextStats: PlayerStats = {
    ...candidateStats,
    unlockedPalettes: nextUnlocked,
  };

  saveStats(nextStats);
  return { nextStats, isNewBest, newlyUnlockedPalettes };
}

export function updateEquippedPalette(current: PlayerStats, paletteId: PaletteId): PlayerStats {
  const unlocked = computeUnlockedPaletteIds(current);
  if (!unlocked.includes(paletteId)) return current;
  const next: PlayerStats = { ...current, equippedPalette: paletteId, unlockedPalettes: unlocked };
  saveStats(next);
  return next;
}
