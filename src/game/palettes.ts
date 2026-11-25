import type { BauhausPalette, PaletteId, PlayerStats, WeatherType } from './types';

export const PALETTES: Record<PaletteId, BauhausPalette> = {
  classic1923: {
    id: 'classic1923',
    name: 'Classic 1923',
    desc: 'Original Weimar archival paper, vermilion, cobalt, and cadmium yellow.',
    paper: '#F4F1DE',
    card: '#FAF8EE',
    ink: '#18181B',
    red: '#E03C31',
    blue: '#2B5B84',
    yellow: '#F4B942',
  },
  dessauNight: {
    id: 'dessauNight',
    name: 'Dessau Night',
    desc: 'Architectural cool slate paper with crisp electric Bauhaus primaries.',
    paper: '#E6E9EF',
    card: '#F3F5F9',
    ink: '#111827',
    red: '#DC2626',
    blue: '#1D4ED8',
    yellow: '#F59E0B',
    unlockRule: {
      requiredWords: 5,
      requiredScore: 500,
      requirementText: 'Craft 5 words or score 500 pts',
    },
  },
  weimarTeal: {
    id: 'weimarTeal',
    name: 'Weimar Teal',
    desc: 'Cool gallery cream paired with studio teal, terracotta, and saffron.',
    paper: '#EFF4F1',
    card: '#F8FBF9',
    ink: '#14211D',
    red: '#D95338',
    blue: '#1E6B7B',
    yellow: '#E9B44C',
    unlockRule: {
      requiredWords: 15,
      requiredScore: 1500,
      requirementText: 'Craft 15 words or score 1,500 pts',
    },
  },
  primaryRed: {
    id: 'primaryRed',
    name: 'Primary Crimson',
    desc: 'Warm exhibition parchment with deep crimson, Prussian blue, and ochre.',
    paper: '#F7EFE2',
    card: '#FDF8F0',
    ink: '#1C1917',
    red: '#BE123C',
    blue: '#1E40AF',
    yellow: '#EAB308',
    unlockRule: {
      requiredWords: 30,
      requiredScore: 3000,
      allowDailyComplete: true,
      requirementText: 'Craft 30 words, score 3,000 pts, or complete Daily',
    },
  },
};

export const PALETTE_ORDER: PaletteId[] = [
  'classic1923',
  'dessauNight',
  'weimarTeal',
  'primaryRed',
];

export function isPaletteUnlocked(paletteId: PaletteId, stats: PlayerStats): boolean {
  if (paletteId === 'classic1923') return true;
  if (stats.unlockedPalettes?.includes(paletteId)) return true;

  const rule = PALETTES[paletteId]?.unlockRule;
  if (!rule) return true;

  const bestScore = Math.max(stats.highScore, stats.dailyBestScore);
  if (stats.totalWords >= rule.requiredWords) return true;
  if (bestScore >= rule.requiredScore) return true;
  if (rule.allowDailyComplete && stats.dailyStreak > 0) return true;
  return false;
}

export function getPaletteUnlockProgress(
  paletteId: PaletteId,
  stats: PlayerStats,
): { unlocked: boolean; progressPct: number; progressText: string } {
  const unlocked = isPaletteUnlocked(paletteId, stats);
  const rule = PALETTES[paletteId]?.unlockRule;
  if (unlocked || !rule) {
    return { unlocked: true, progressPct: 100, progressText: 'Unlocked' };
  }

  const bestScore = Math.max(stats.highScore, stats.dailyBestScore);
  const wordPct = Math.min(100, Math.round((stats.totalWords / rule.requiredWords) * 100));
  const scorePct = Math.min(100, Math.round((bestScore / rule.requiredScore) * 100));
  const progressPct = Math.max(wordPct, scorePct);

  const progressText =
    wordPct >= scorePct
      ? `${Math.min(stats.totalWords, rule.requiredWords)}/${rule.requiredWords} words · or ${rule.requiredScore.toLocaleString()} pts`
      : `${Math.min(bestScore, rule.requiredScore).toLocaleString()}/${rule.requiredScore.toLocaleString()} pts · or ${rule.requiredWords} words`;

  return { unlocked: false, progressPct, progressText };
}

export function computeUnlockedPaletteIds(stats: PlayerStats): PaletteId[] {
  return PALETTE_ORDER.filter((id) => isPaletteUnlocked(id, stats));
}

export const WEATHER_ORDER: WeatherType[] = ['rain', 'snow', 'wind', 'sun'];

export interface WeatherMeta {
  id: WeatherType;
  label: string;
  keyHint: string;
  physicsDesc: string;
  shortHint: string;
}

export const WEATHER_META: Record<WeatherType, WeatherMeta> = {
  rain: {
    id: 'rain',
    label: 'Rain',
    keyHint: '1',
    physicsDesc: 'Letters fall briskly with gravity and cycle fresh tiles from clouds.',
    shortHint: 'Rain · Gravity fall',
  },
  snow: {
    id: 'snow',
    label: 'Snow',
    keyHint: '2',
    physicsDesc: 'Letters drift gently and stack solidly into rows and columns.',
    shortHint: 'Snow · Gentle stacking',
  },
  wind: {
    id: 'wind',
    label: 'Wind',
    keyHint: '3',
    physicsDesc: 'Swipe anywhere across the sky to steer letters sideways into clusters.',
    shortHint: 'Wind · Swipe to steer',
  },
  sun: {
    id: 'sun',
    label: 'Sun',
    keyHint: '4',
    physicsDesc: 'Warm golden thermals lift sunken letters smoothly back upward.',
    shortHint: 'Sun · Thermal lift',
  },
};

export function getWeatherColors(weather: WeatherType, palette: BauhausPalette): { bg: string; fg: string } {
  switch (weather) {
    case 'rain':
      return { bg: palette.blue, fg: '#F4F1DE' };
    case 'snow':
      return { bg: palette.ink, fg: palette.paper };
    case 'wind':
      return { bg: palette.red, fg: '#F4F1DE' };
    case 'sun':
      return { bg: palette.yellow, fg: palette.ink };
  }
}

export function applyPaletteToDocument(palette: BauhausPalette): void {
  const root = document.documentElement;
  root.style.setProperty('--bg-paper', palette.paper);
  root.style.setProperty('--bg-card', palette.card);
  root.style.setProperty('--ink', palette.ink);
  root.style.setProperty('--red', palette.red);
  root.style.setProperty('--blue', palette.blue);
  root.style.setProperty('--yellow', palette.yellow);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', palette.paper);
  }
}
