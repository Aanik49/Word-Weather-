import type { RoundSummaryData, WeatherType } from './types';

const WEATHER_GLYPH_BLOCK: Record<WeatherType, string> = {
  rain: '🟦',
  snow: '⬛',
  wind: '🟥',
  sun: '🟨',
};

/** Formats a spoiler-free Bauhaus geometric text card for sharing Daily Challenge results */
export function buildDailyShareText(summary: RoundSummaryData): string {
  const dateLabel = summary.dailyDate ?? new Date().toISOString().slice(0, 10);
  const sequence =
    summary.weatherSequence.length > 0 ? summary.weatherSequence : (['rain'] as WeatherType[]);

  // Cap visible strip to 12 geometric Bauhaus blocks for clean mobile wrapping
  const trimmedSeq = sequence.slice(0, 12);
  const weatherBlocks = trimmedSeq.map((w) => WEATHER_GLYPH_BLOCK[w]).join('');
  const targetMark = summary.dailyTargetFound ? '✓ Found' : '✕ Missed';

  const lines = [
    `WORD WEATHER · DAILY`,
    `${dateLabel}`,
    weatherBlocks,
    `Score: ${summary.score.toLocaleString()} · Words: ${summary.wordsFound.length}`,
    `Target: ${targetMark} · Weather Shifts: ${summary.weatherShifts}`,
  ];

  if (summary.physicsBonuses > 0) {
    lines.push(`Physics Bonuses: ${summary.physicsBonuses}× · Best Combo: ${summary.bestCombo}×`);
  }

  return lines.join('\n');
}

/** Copies the result card text to clipboard (with fallback for Android WebView), or invokes native Share Sheet */
export async function shareOrCopyDailyResult(
  text: string,
  preferNativeShare = false,
): Promise<'shared' | 'copied' | 'failed'> {
  if (preferNativeShare && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: 'Word Weather · Daily Result',
        text,
      });
      return 'shared';
    } catch {
      // User canceled or share unsupported; fall back to clipboard copy
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Fall through to legacy textarea copy
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
