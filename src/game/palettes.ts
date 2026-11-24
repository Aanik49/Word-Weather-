import type { BauhausPalette, PaletteId, WeatherType } from './types';

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
    name: 'Dessau Slate',
    desc: 'High-contrast architectural paper with bold Bauhaus primaries.',
    paper: '#E8EBF0',
    card: '#F4F6F9',
    ink: '#111827',
    red: '#DC2626',
    blue: '#1D4ED8',
    yellow: '#F59E0B',
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
  },
};

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
