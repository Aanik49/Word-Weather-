import { useCallback, useEffect, useState } from 'react';
import { BauhausModal } from './components/BauhausModal';
import { GameplayScreen } from './components/GameplayScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { SplashScreen } from './components/SplashScreen';
import { audioEngine } from './game/audioEngine';
import { applyPaletteToDocument, PALETTES, WEATHER_ORDER } from './game/palettes';
import {
  loadSettings,
  loadStats,
  recordRoundStats,
  saveSettings,
  updateEquippedPalette,
} from './game/storage';
import type {
  GameMode,
  GameSettings,
  ModalType,
  PaletteId,
  PlayerStats,
  RoundSummaryData,
  ScreenState,
  WeatherType,
} from './game/types';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('SPLASH');
  const [mode, setMode] = useState<GameMode>('classic');
  const [weather, setWeather] = useState<WeatherType>('rain');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [stats, setStats] = useState<PlayerStats>(() => loadStats());

  const palette = PALETTES[stats.equippedPalette] ?? PALETTES.classic1923;

  // Apply Bauhaus palette tokens to document root
  useEffect(() => {
    applyPaletteToDocument(palette);
  }, [palette]);

  // Sync audio engine settings & context
  useEffect(() => {
    audioEngine.applySettings(settings);
  }, [settings]);

  useEffect(() => {
    audioEngine.setContextState(weather, screen === 'PLAYING');
  }, [weather, screen]);

  // Lobby keyboard shortcuts (Enter/Space to start, 1-4 to preview weather)
  useEffect(() => {
    if (screen !== 'LOBBY' || activeModal !== null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        audioEngine.unlock();
        audioEngine.playMarimbaNote(659.25, 0.14);
        setMode('classic');
        setScreen('PLAYING');
      } else if (e.key === '1') {
        handleSelectWeather('rain');
      } else if (e.key === '2') {
        handleSelectWeather('snow');
      } else if (e.key === '3') {
        handleSelectWeather('wind');
      } else if (e.key === '4') {
        handleSelectWeather('sun');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeModal]);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleToggleAudioQuick = useCallback(() => {
    setSettings((prev) => {
      const currentlyMuted = !prev.musicEnabled && !prev.sfxEnabled;
      const next: GameSettings = currentlyMuted
        ? { ...prev, musicEnabled: true, sfxEnabled: true }
        : { ...prev, musicEnabled: false, sfxEnabled: false };
      saveSettings(next);
      audioEngine.applySettings(next);
      if (currentlyMuted) {
        audioEngine.unlock();
        audioEngine.playMarimbaNote(523.25, 0.12);
      }
      return next;
    });
  }, []);

  const handleSelectWeather = useCallback((nextWeather: WeatherType) => {
    setWeather(nextWeather);
    audioEngine.playWeatherSwitch(nextWeather);
  }, []);

  const handleCycleWeather = useCallback(() => {
    setWeather((prev) => {
      const idx = WEATHER_ORDER.indexOf(prev);
      const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
      audioEngine.playWeatherSwitch(next);
      return next;
    });
  }, []);

  const handleStartGame = useCallback((nextMode: GameMode) => {
    audioEngine.unlock();
    audioEngine.playMarimbaNote(659.25, 0.14);
    setMode(nextMode);
    setActiveModal(null);
    setScreen('PLAYING');
  }, []);

  const handleExitToLobby = useCallback(() => {
    setActiveModal(null);
    setScreen('LOBBY');
  }, []);

  const handleSelectPalette = useCallback((paletteId: PaletteId) => {
    setStats((prev) => updateEquippedPalette(prev, paletteId));
  }, []);

  const handleRecordRound = useCallback(
    (rawSummary: RoundSummaryData): RoundSummaryData => {
      let isNewBest = false;
      setStats((prev) => {
        const res = recordRoundStats(prev, {
          mode: rawSummary.mode,
          score: rawSummary.score,
          wordsFound: rawSummary.wordsFound,
          bestCombo: rawSummary.bestCombo,
          physicsBonuses: rawSummary.physicsBonuses,
          dailyCompleted: rawSummary.mode === 'daily' && Boolean(rawSummary.dailyTargetFound),
        });
        isNewBest = res.isNewBest;
        return res.nextStats;
      });
      return { ...rawSummary, isNewBest };
    },
    [],
  );

  return (
    <div
      className="paper-grain relative w-full h-full overflow-hidden"
      style={{ backgroundColor: palette.paper, color: palette.ink }}
    >
      {screen === 'SPLASH' && (
        <SplashScreen
          palette={palette}
          onFinish={() => setScreen('LOBBY')}
        />
      )}

      {screen === 'LOBBY' && (
        <LobbyScreen
          palette={palette}
          weather={weather}
          stats={stats}
          onSelectWeather={handleSelectWeather}
          onCycleWeather={handleCycleWeather}
          onStartGame={handleStartGame}
          onOpenModal={setActiveModal}
        />
      )}

      {screen === 'PLAYING' && (
        <GameplayScreen
          mode={mode}
          initialWeather={weather}
          palette={palette}
          settings={settings}
          onWeatherChange={setWeather}
          onExitToLobby={handleExitToLobby}
          onOpenSettings={() => setActiveModal('settings')}
          onToggleAudioQuick={handleToggleAudioQuick}
          onRecordRound={handleRecordRound}
        />
      )}

      <BauhausModal
        modal={activeModal}
        palette={palette}
        settings={settings}
        stats={stats}
        onClose={() => setActiveModal(null)}
        onUpdateSettings={handleUpdateSettings}
        onSelectPalette={handleSelectPalette}
        onReplaySplash={() => setScreen('SPLASH')}
      />
    </div>
  );
}
