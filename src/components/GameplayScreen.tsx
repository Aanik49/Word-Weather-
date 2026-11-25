import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Delete, Pause, Play, RotateCcw, Settings, Share2, Volume2, VolumeX, Wind } from 'lucide-react';
import { audioEngine } from '../game/audioEngine';
import { buildDailyShareText, shareOrCopyDailyResult } from '../game/dailyShare';
import { getDailyTargetWord } from '../game/dictionary';
import { getWeatherColors, PALETTES, WEATHER_META, WEATHER_ORDER } from '../game/palettes';
import { WordWeatherEngine } from '../game/physicsEngine';
import type {
  BauhausPalette,
  GameMode,
  GameSettings,
  HudSnapshot,
  PaletteId,
  PlayPhase,
  RoundSummaryData,
  WeatherType,
} from '../game/types';
import { WeatherGlyph } from './GameIcon';

interface GameplayScreenProps {
  mode: GameMode;
  initialWeather: WeatherType;
  palette: BauhausPalette;
  settings: GameSettings;
  onWeatherChange: (weather: WeatherType) => void;
  onExitToLobby: () => void;
  onOpenSettings: () => void;
  onSelectPalette: (id: PaletteId) => void;
  onToggleAudioQuick: () => void;
  onRecordRound: (summary: RoundSummaryData) => RoundSummaryData;
}

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  wordsCount: 0,
  combo: 1,
  comboProgress: 0,
  level: 1,
  levelWords: 0,
  levelGoal: 3,
  dailyTimer: 90,
  dailyTargetWord: getDailyTargetWord(),
  dailyTargetFound: false,
  weather: 'rain',
  selectedTiles: [],
  currentWord: '',
  isCurrentWordValid: false,
  physicsClusterReady: false,
  alignedWordsCount: 0,
};

export function GameplayScreen({
  mode,
  initialWeather,
  palette,
  settings,
  onWeatherChange,
  onExitToLobby,
  onOpenSettings,
  onSelectPalette,
  onToggleAudioQuick,
  onRecordRound,
}: GameplayScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WordWeatherEngine | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<PlayPhase>('ACTIVE');
  const [hud, setHud] = useState<HudSnapshot>({ ...INITIAL_HUD, weather: initialWeather });
  const [toast, setToast] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);
  const [shakeTray, setShakeTray] = useState(false);
  const [summary, setSummary] = useState<RoundSummaryData | null>(null);
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'shared'>('idle');

  const onWeatherChangeRef = useRef(onWeatherChange);
  onWeatherChangeRef.current = onWeatherChange;
  const onRecordRoundRef = useRef(onRecordRound);
  onRecordRoundRef.current = onRecordRound;

  const isMuted = !settings.musicEnabled && !settings.sfxEnabled;

  const showToast = (msg: string, ms = 1600) => {
    setToast(msg);
    setToastVisible(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, ms);
  };

  // Mount isolated 60fps WordWeatherEngine once per game session
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new WordWeatherEngine(canvas, palette, settings, initialWeather, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
        onWeatherChangeRef.current(snapshot.weather);
      },
      onToast: (msg, ms) => showToast(msg, ms),
      onInvalidShake: () => {
        setShakeTray(false);
        requestAnimationFrame(() => setShakeTray(true));
      },
      onRoundComplete: (rawSummary) => {
        const recorded = onRecordRoundRef.current(rawSummary);
        setSummary(recorded);
        setPhase('ROUND_SUMMARY');
      },
    });

    engineRef.current = engine;
    engine.start(mode, initialWeather);
    showToast(
      mode === 'zen'
        ? 'Zen Mode · Untimed calm weather · Take your time'
        : 'Tap clouds to change weather · Swipe sky for wind',
      2400,
    );

    const onResize = () => engine.resize();
    const onBlur = () => {
      // Clear active pointer drags cleanly on window blur
      engine.setPaused(true);
      setPhase((prev) => (prev === 'ACTIVE' ? 'PAUSED' : prev));
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onBlur);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Keep engine synced with live palette & settings updates
  useEffect(() => {
    engineRef.current?.setPalette(palette);
  }, [palette]);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
  }, [settings]);

  // Keyboard shortcuts during active gameplay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.key === 'Escape') {
        if (phase === 'ACTIVE') {
          engine.setPaused(true);
          setPhase('PAUSED');
        } else if (phase === 'PAUSED') {
          engine.setPaused(false);
          setPhase('ACTIVE');
        }
        return;
      }

      if (phase !== 'ACTIVE') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        engine.submitWord();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        engine.popLastSelected();
      } else if (e.key === '1') {
        engine.setWeather('rain');
      } else if (e.key === '2') {
        engine.setWeather('snow');
      } else if (e.key === '3') {
        engine.setWeather('wind');
      } else if (e.key === '4') {
        engine.setWeather('sun');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase]);

  const handlePauseToggle = () => {
    const engine = engineRef.current;
    if (!engine) return;
    audioEngine.playUiClick();
    if (phase === 'ACTIVE') {
      engine.setPaused(true);
      setPhase('PAUSED');
    } else if (phase === 'PAUSED') {
      engine.setPaused(false);
      setPhase('ACTIVE');
    }
  };

  const handleRestart = () => {
    const engine = engineRef.current;
    if (!engine) return;
    audioEngine.playUiClick();
    setSummary(null);
    setShareFeedback('idle');
    setPhase('ACTIVE');
    engine.start(mode, hud.weather);
    showToast(
      mode === 'daily'
        ? `Daily Challenge · Find ${getDailyTargetWord()}`
        : mode === 'zen'
          ? 'Zen Mode · Calm weather refreshed'
          : 'New session started',
      1800,
    );
  };

  const handleShareDaily = async (preferNativeShare: boolean) => {
    if (!summary) return;
    audioEngine.playUiClick();
    const text = buildDailyShareText(summary);
    const result = await shareOrCopyDailyResult(text, preferNativeShare);
    if (result === 'copied' || result === 'shared') {
      setShareFeedback(result);
      window.setTimeout(() => setShareFeedback('idle'), 2200);
    }
  };

  return (
    <section
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: palette.paper,
        color: palette.ink,
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {/* COMPACT LOW-OCCLUSION TOP BAUHAUS HUD */}
      <header
        className="w-full border-b-[3px] px-2.5 sm:px-5 py-1.5 sm:py-2 shrink-0 z-20"
        style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Pause Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePauseToggle}
              aria-label="Pause game"
              className="bauhaus-btn w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: palette.paper, color: palette.ink }}
            >
              <Pause className="w-5 h-5" strokeWidth={2.7} />
            </button>
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="font-display font-black text-xs uppercase tracking-wider">
                {mode === 'daily' ? 'Daily Cloud' : mode === 'zen' ? 'Zen Mode' : `Level ${hud.level}`}
              </span>
              {mode === 'daily' ? (
                <span
                  className="text-[11px] font-bold"
                  style={{ color: hud.dailyTargetFound ? palette.blue : palette.ink }}
                >
                  Target · {hud.dailyTargetWord}
                  {hud.dailyTargetFound ? ' ✓' : ''}
                </span>
              ) : mode === 'zen' ? (
                <span className="text-[11px] font-semibold opacity-75">
                  Calm Physics · Untimed
                </span>
              ) : (
                <span className="text-[11px] font-semibold opacity-75">
                  Combo {hud.combo}×
                </span>
              )}
            </div>
          </div>

          {/* Center: Clean Bauhaus Tabular Readout Strip */}
          <div
            className="flex items-center border-[3px]"
            style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
          >
            <div className="px-2.5 sm:px-4 py-0.5 border-r-[3px] text-center" style={{ borderColor: palette.ink }}>
              <div className="text-[9px] font-bold opacity-70 uppercase tracking-wider">Score</div>
              <div className="font-mono-num font-bold text-sm sm:text-base leading-tight">
                {hud.score.toLocaleString()}
              </div>
            </div>

            <div className="px-2.5 sm:px-4 py-0.5 border-r-[3px] text-center" style={{ borderColor: palette.ink }}>
              <div className="text-[9px] font-bold opacity-70 uppercase tracking-wider">Words</div>
              <div className="font-mono-num font-bold text-sm sm:text-base leading-tight">
                {hud.wordsCount}
              </div>
            </div>

            <div className="px-2.5 sm:px-4 py-0.5 text-center min-w-[54px]">
              <div className="text-[9px] font-bold opacity-70 uppercase tracking-wider">
                {mode === 'daily' ? 'Time' : mode === 'zen' ? 'Pace' : 'Goal'}
              </div>
              <div
                className="font-mono-num font-bold text-sm sm:text-base leading-tight"
                style={{
                  color: mode === 'daily' && hud.dailyTimer <= 15 ? palette.red : palette.ink,
                }}
              >
                {mode === 'daily'
                  ? `${Math.max(0, Math.ceil(hud.dailyTimer))}s`
                  : mode === 'zen'
                    ? '∞'
                    : `${hud.levelWords}/${hud.levelGoal}`}
              </div>
            </div>
          </div>

          {/* Right: Quick Sound Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                audioEngine.unlock();
                onToggleAudioQuick();
              }}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="bauhaus-btn w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center cursor-pointer"
              style={{
                backgroundColor: isMuted ? palette.paper : palette.yellow,
                color: palette.ink,
              }}
            >
              {isMuted ? <VolumeX className="w-5 h-5" strokeWidth={2.6} /> : <Volume2 className="w-5 h-5" strokeWidth={2.6} />}
            </button>
          </div>
        </div>
      </header>

      {/* FULL-BLEED ISOLATED PHYSICS SKY CANVAS */}
      <main className="relative flex-1 w-full min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-full touch-none"
          aria-label="Word Weather sky playfield"
        />

        {/* Non-blocking Toast Banner */}
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20 max-w-[92%]">
          <div
            className={`border-[3px] px-3 py-1 text-[11px] sm:text-xs font-display font-extrabold tracking-wide transition-opacity duration-200 whitespace-nowrap truncate ${
              toastVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              borderColor: palette.ink,
              backgroundColor: palette.yellow,
              color: palette.ink,
              boxShadow: `3px 3px 0px ${palette.ink}`,
            }}
          >
            {toast}
          </div>
        </div>
      </main>

      {/* THUMB-FRIENDLY MOBILE BOTTOM CONTROL DOCK */}
      <footer
        className="w-full border-t-[3px] px-2.5 sm:px-5 py-2 shrink-0 z-20"
        style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {/* Word Builder Tray — Full-width 8-slot visibility + Action bar */}
          <div
            className={`w-full border-[3px] p-1.5 flex flex-col gap-1.5 ${
              shakeTray ? 'shake-error' : ''
            }`}
            style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
          >
            {/* Row 1: All 8 input letter slots visible at once with zero clipping */}
            <div className="w-full grid grid-cols-8 gap-1" aria-label="Entered letters">
              {Array.from({ length: 8 }).map((_, idx) => {
                const tile = hud.selectedTiles[idx];
                if (tile) {
                  return (
                    <button
                      key={`${tile.id}-${idx}`}
                      type="button"
                      onClick={() => engineRef.current?.removeSelectedAt(idx)}
                      aria-label={`Remove letter ${tile.char} at slot ${idx + 1}`}
                      className="stamp-pop relative h-9 sm:h-10 border-[2.5px] font-display font-black text-sm sm:text-base flex items-center justify-center cursor-pointer min-w-0"
                      style={{
                        borderColor: palette.ink,
                        backgroundColor: hud.isCurrentWordValid ? palette.yellow : palette.card,
                        color: palette.ink,
                      }}
                    >
                      <span className="leading-none">{tile.char}</span>
                      <span
                        className="absolute top-0 left-0 px-[3px] py-[1px] text-[8px] font-mono-num font-bold leading-none"
                        style={{ backgroundColor: palette.ink, color: palette.paper }}
                      >
                        {idx + 1}
                      </span>
                    </button>
                  );
                }
                return (
                  <div
                    key={`slot-${idx}`}
                    aria-hidden="true"
                    className="h-9 sm:h-10 border-[2px] border-dashed flex items-center justify-center text-[10px] font-mono-num opacity-25 min-w-0"
                    style={{ borderColor: palette.ink }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>

            {/* Row 2: Clear · Undo Last · Breeze · Submit */}
            <div className="w-full flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => engineRef.current?.clearSelection()}
                disabled={hud.selectedTiles.length === 0}
                className="bauhaus-press h-10 px-2.5 sm:px-3.5 border-[2.5px] font-display font-extrabold text-xs uppercase shrink-0 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.popLastSelected()}
                disabled={hud.selectedTiles.length === 0}
                aria-label="Remove last letter"
                title="Remove last letter"
                className="bauhaus-press h-10 w-10 sm:w-11 border-[2.5px] flex items-center justify-center shrink-0 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
              >
                <Delete className="w-4 h-4" strokeWidth={2.6} />
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.triggerBreezeShuffle()}
                title="Fresh breeze of letters"
                aria-label="Shuffle sky letters with breeze"
                className="bauhaus-press h-10 px-2.5 sm:px-3 border-[2.5px] font-display font-extrabold text-xs uppercase shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                style={{ borderColor: palette.ink, backgroundColor: palette.yellow, color: palette.ink }}
              >
                <Wind className="w-4 h-4 shrink-0" strokeWidth={2.6} />
                <span className="hidden sm:inline">Breeze</span>
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.submitWord()}
                disabled={!hud.isCurrentWordValid}
                className="bauhaus-press flex-1 h-10 px-3 border-[2.5px] font-display font-black text-xs sm:text-sm uppercase disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap truncate"
                style={{
                  borderColor: palette.ink,
                  backgroundColor: hud.physicsClusterReady ? palette.blue : palette.red,
                  color: '#F4F1DE',
                }}
              >
                {hud.selectedTiles.length === 0
                  ? hud.alignedWordsCount > 0
                    ? 'Tap Aligned Word · 2×'
                    : `Select ${settings.minWordLen}–8 Letters`
                  : hud.physicsClusterReady
                    ? `Submit ${hud.currentWord} · 1.5×`
                    : hud.isCurrentWordValid
                      ? `Submit ${hud.currentWord}`
                      : `${hud.currentWord} (${hud.selectedTiles.length}/8)`}
              </button>
            </div>
          </div>

          {/* 4-Column Bauhaus Weather Strip (48px mobile thumb target) */}
          <div className="w-full grid grid-cols-4 border-[3px]" style={{ borderColor: palette.ink }}>
            {WEATHER_ORDER.map((w, idx) => {
              const active = hud.weather === w;
              const colors = active
                ? getWeatherColors(w, palette)
                : { bg: palette.paper, fg: palette.ink };
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    audioEngine.unlock();
                    engineRef.current?.setWeather(w);
                  }}
                  className={`bauhaus-press h-12 px-1.5 flex items-center justify-center gap-1.5 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer ${
                    idx < 3 ? 'border-r-[3px]' : ''
                  }`}
                  style={{
                    borderColor: palette.ink,
                    backgroundColor: colors.bg,
                    color: colors.fg,
                  }}
                >
                  <WeatherGlyph weather={w} className="w-5 h-5 shrink-0" />
                  <span className="whitespace-nowrap">{WEATHER_META[w].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      {/* PAUSE MODAL */}
      {phase === 'PAUSED' && (
        <div
          className="fixed inset-0 z-40 bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Game paused"
        >
          <div
            className="stamp-pop w-full max-w-sm border-[3px] p-5 space-y-4"
            style={{
              borderColor: palette.ink,
              backgroundColor: palette.paper,
              boxShadow: `8px 8px 0px ${palette.ink}`,
            }}
          >
            <div className="border-b-[3px] pb-3 flex items-center justify-between" style={{ borderColor: palette.ink }}>
              <h2 className="font-display font-black text-xl uppercase tracking-wide">Paused</h2>
              <span className="font-mono-num text-sm font-bold">
                {hud.score.toLocaleString()} pts
              </span>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handlePauseToggle}
                className="bauhaus-btn w-full h-12 flex items-center justify-center gap-2 font-display font-black text-sm uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: palette.red, color: '#F4F1DE' }}
              >
                <Play className="w-4 h-4" strokeWidth={3} />
                <span>Resume</span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="bauhaus-btn w-full h-11 flex items-center justify-center gap-2 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: palette.yellow, color: palette.ink }}
              >
                <RotateCcw className="w-4 h-4" strokeWidth={2.6} />
                <span>Restart</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick();
                  onOpenSettings();
                }}
                className="bauhaus-btn w-full h-11 flex items-center justify-center gap-2 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: palette.paper, color: palette.ink }}
              >
                <Settings className="w-4 h-4" strokeWidth={2.6} />
                <span>Audio & Settings</span>
              </button>

              {hud.wordsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    engineRef.current?.finishRoundEarly();
                  }}
                  className="bauhaus-btn w-full h-11 flex items-center justify-center font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                  style={{ backgroundColor: palette.blue, color: '#F4F1DE' }}
                >
                  Finish & Save Score
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  audioEngine.playTileDeselect();
                  onExitToLobby();
                }}
                className="bauhaus-press w-full h-11 border-[2.5px] flex items-center justify-center font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                style={{ borderColor: palette.ink, backgroundColor: palette.paper, color: palette.ink }}
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROUND SUMMARY / DAILY COMPLETE MODAL */}
      {phase === 'ROUND_SUMMARY' && summary && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Round summary"
        >
          <div
            className="stamp-pop w-full max-w-md max-h-[88dvh] overflow-y-auto no-scrollbar border-[3px] p-5 space-y-3.5"
            style={{
              borderColor: palette.ink,
              backgroundColor: palette.paper,
              boxShadow: `8px 8px 0px ${palette.ink}`,
            }}
          >
            <div className="border-b-[3px] pb-3 flex items-center justify-between" style={{ borderColor: palette.ink }}>
              <div>
                <h2 className="font-display font-black text-xl uppercase tracking-wide">
                  {summary.mode === 'daily'
                    ? 'Daily Complete'
                    : summary.mode === 'zen'
                      ? 'Zen Session'
                      : 'Session Summary'}
                </h2>
                <div className="text-xs font-semibold opacity-75">
                  {summary.mode === 'zen'
                    ? 'Untimed Calm Play'
                    : summary.isNewBest
                      ? 'New Personal Best'
                      : `Level ${summary.levelReached}`}
                </div>
              </div>
              <div
                className="px-3 py-1.5 border-[3px] font-mono-num font-bold text-lg"
                style={{ borderColor: palette.ink, backgroundColor: palette.yellow, color: palette.ink }}
              >
                {summary.score.toLocaleString()}
              </div>
            </div>

            {/* Newly Unlocked Bauhaus Theme Banner */}
            {summary.newlyUnlockedPalettes && summary.newlyUnlockedPalettes.length > 0 && (
              <div className="space-y-2">
                {summary.newlyUnlockedPalettes.map((pid) => {
                  const unlockedPal = PALETTES[pid];
                  const isEquipped = palette.id === pid;
                  return (
                    <div
                      key={pid}
                      className="border-[3px] px-3 py-2.5 flex items-center justify-between gap-2"
                      style={{
                        borderColor: unlockedPal.ink,
                        backgroundColor: unlockedPal.paper,
                        color: unlockedPal.ink,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-display font-black uppercase tracking-wider opacity-75">
                          Theme Unlocked
                        </div>
                        <div className="font-display font-black text-sm uppercase truncate">
                          {unlockedPal.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-3.5 h-3.5 border border-black" style={{ backgroundColor: unlockedPal.red }} />
                        <span className="w-3.5 h-3.5 border border-black" style={{ backgroundColor: unlockedPal.blue }} />
                        <span className="w-3.5 h-3.5 border border-black" style={{ backgroundColor: unlockedPal.yellow }} />
                        <button
                          type="button"
                          onClick={() => {
                            audioEngine.playWordVictory(3, false);
                            onSelectPalette(pid);
                          }}
                          className="bauhaus-press ml-1 px-2.5 py-1 border-2 font-display font-black text-[10px] uppercase cursor-pointer whitespace-nowrap"
                          style={{
                            borderColor: unlockedPal.ink,
                            backgroundColor: isEquipped ? unlockedPal.ink : unlockedPal.yellow,
                            color: isEquipped ? unlockedPal.paper : unlockedPal.ink,
                          }}
                        >
                          {isEquipped ? 'Active' : 'Equip'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shareable Bauhaus Daily Result Card */}
            {summary.mode === 'daily' && (
              <div
                className="border-[3px] p-3.5 space-y-2.5"
                style={{ borderColor: palette.ink, backgroundColor: palette.card }}
              >
                <div className="flex items-center justify-between text-[11px] font-display font-black uppercase tracking-wider">
                  <span>Word Weather · Daily</span>
                  <span className="font-mono-num opacity-75">{summary.dailyDate}</span>
                </div>

                {/* Geometric Weather Flow Blocks */}
                <div className="flex items-center gap-1 flex-wrap" aria-label="Weather sequence blocks">
                  {(summary.weatherSequence.length > 0 ? summary.weatherSequence.slice(0, 12) : (['rain'] as WeatherType[])).map(
                    (w, idx) => {
                      const colors = getWeatherColors(w, palette);
                      return (
                        <span
                          key={`${w}-${idx}`}
                          title={WEATHER_META[w].label}
                          className="w-5 h-5 border-2 inline-block"
                          style={{ backgroundColor: colors.bg, borderColor: palette.ink }}
                        />
                      );
                    },
                  )}
                </div>

                <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                  <span>
                    Target: {summary.dailyTargetWord}{' '}
                    <strong style={{ color: summary.dailyTargetFound ? palette.blue : palette.red }}>
                      {summary.dailyTargetFound ? '✓ Found' : '✕ Missed'}
                    </strong>
                  </span>
                  <span className="font-mono-num">Shifts: {summary.weatherShifts}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleShareDaily(false)}
                    className="bauhaus-btn h-10 px-2.5 flex items-center justify-center gap-1.5 font-display font-black text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    style={{ backgroundColor: palette.yellow, color: palette.ink }}
                  >
                    {shareFeedback === 'copied' ? (
                      <>
                        <Check className="w-4 h-4" strokeWidth={3} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" strokeWidth={2.6} />
                        <span>Copy Card</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareDaily(true)}
                    className="bauhaus-btn h-10 px-2.5 flex items-center justify-center gap-1.5 font-display font-black text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    style={{ backgroundColor: palette.blue, color: '#F4F1DE' }}
                  >
                    {shareFeedback === 'shared' ? (
                      <>
                        <Check className="w-4 h-4" strokeWidth={3} />
                        <span>Shared</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" strokeWidth={2.6} />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="border-[3px] p-2.5" style={{ borderColor: palette.ink }}>
                <div className="text-[10px] font-bold opacity-70 uppercase">Words</div>
                <div className="font-mono-num font-bold text-xl" style={{ color: palette.blue }}>
                  {summary.wordsFound.length}
                </div>
              </div>
              <div className="border-[3px] p-2.5" style={{ borderColor: palette.ink }}>
                <div className="text-[10px] font-bold opacity-70 uppercase">Best Word</div>
                <div className="font-display font-black text-base truncate mt-0.5" style={{ color: palette.red }}>
                  {summary.bestWord || '—'}
                </div>
              </div>
              <div className="border-[3px] p-2.5" style={{ borderColor: palette.ink }}>
                <div className="text-[10px] font-bold opacity-70 uppercase">Physics</div>
                <div className="font-mono-num font-bold text-xl">{summary.physicsBonuses}×</div>
              </div>
            </div>

            {summary.wordsFound.length > 0 && (
              <div
                className="border-[2.5px] p-2.5 max-h-24 overflow-y-auto no-scrollbar text-xs font-semibold"
                style={{ borderColor: palette.ink, backgroundColor: palette.card }}
              >
                {summary.wordsFound.join(' · ')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleRestart}
                className="bauhaus-btn h-12 font-display font-black text-sm uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: palette.red, color: '#F4F1DE' }}
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playTileDeselect();
                  onExitToLobby();
                }}
                className="bauhaus-btn h-12 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: palette.paper, color: palette.ink }}
              >
                Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
