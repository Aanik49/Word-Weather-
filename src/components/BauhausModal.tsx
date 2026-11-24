import { X } from 'lucide-react';
import { audioEngine } from '../game/audioEngine';
import { PALETTES, WEATHER_META, WEATHER_ORDER } from '../game/palettes';
import type {
  BauhausPalette,
  GameSettings,
  ModalType,
  PaletteId,
  PlayerStats,
} from '../game/types';
import { WeatherGlyph } from './GameIcon';

interface BauhausModalProps {
  modal: ModalType;
  palette: BauhausPalette;
  settings: GameSettings;
  stats: PlayerStats;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onSelectPalette: (id: PaletteId) => void;
  onReplaySplash: () => void;
}

export function BauhausModal({
  modal,
  palette,
  settings,
  stats,
  onClose,
  onUpdateSettings,
  onSelectPalette,
  onReplaySplash,
}: BauhausModalProps) {
  if (!modal) return null;

  const heading =
    modal === 'settings'
      ? 'Settings'
      : modal === 'profile'
        ? 'Player Profile'
        : modal === 'store'
          ? 'Palette Store'
          : 'How to Play';

  const rank =
    stats.totalWords >= 60
      ? 'Bauhaus Master'
      : stats.totalWords >= 20
        ? 'Weimar Architect'
        : stats.totalWords >= 5
          ? 'Studio Designer'
          : 'Apprentice';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          audioEngine.playTileDeselect();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <div
        className="stamp-pop w-full max-w-md max-h-[86dvh] flex flex-col border-[3px]"
        style={{
          borderColor: palette.ink,
          backgroundColor: palette.paper,
          color: palette.ink,
          boxShadow: `8px 8px 0px ${palette.ink}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b-[3px] shrink-0"
          style={{ borderColor: palette.ink }}
        >
          <h2 className="font-display font-black text-xl tracking-wide uppercase">{heading}</h2>
          <button
            type="button"
            onClick={() => {
              audioEngine.playTileDeselect();
              onClose();
            }}
            aria-label="Close modal"
            className="bauhaus-btn w-10 h-10 flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: palette.red, color: '#F4F1DE' }}
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-3.5 overflow-y-auto no-scrollbar text-sm">
          {modal === 'settings' && (
            <>
              {/* Music Toggle + Volume */}
              <div className="border-[3px] p-3.5 space-y-2.5" style={{ borderColor: palette.ink }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-extrabold text-sm">Ambient Music</div>
                    <div className="text-xs opacity-75">Weather-Reactive</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.unlock();
                      onUpdateSettings({ musicEnabled: !settings.musicEnabled });
                    }}
                    className="bauhaus-btn min-w-[76px] h-10 px-3 font-display font-extrabold text-xs uppercase cursor-pointer"
                    style={{
                      backgroundColor: settings.musicEnabled ? palette.yellow : palette.paper,
                      color: palette.ink,
                    }}
                  >
                    {settings.musicEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                {settings.musicEnabled && (
                  <label className="flex items-center gap-3 text-xs font-semibold">
                    <span className="w-16 opacity-75">Volume</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={settings.musicVolume}
                      onChange={(e) => onUpdateSettings({ musicVolume: Number(e.target.value) })}
                      className="flex-1 accent-[#18181B] cursor-pointer"
                    />
                    <span className="font-mono-num w-9 text-right">
                      {Math.round(settings.musicVolume * 100)}%
                    </span>
                  </label>
                )}
              </div>

              {/* Sound Effects Toggle + Volume */}
              <div className="border-[3px] p-3.5 space-y-2.5" style={{ borderColor: palette.ink }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-extrabold text-sm">Sound Effects</div>
                    <div className="text-xs opacity-75">Tile chimes, snow stacks, and wind sweeps</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.unlock();
                      onUpdateSettings({ sfxEnabled: !settings.sfxEnabled });
                    }}
                    className="bauhaus-btn min-w-[76px] h-10 px-3 font-display font-extrabold text-xs uppercase cursor-pointer"
                    style={{
                      backgroundColor: settings.sfxEnabled ? palette.yellow : palette.paper,
                      color: palette.ink,
                    }}
                  >
                    {settings.sfxEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                {settings.sfxEnabled && (
                  <label className="flex items-center gap-3 text-xs font-semibold">
                    <span className="w-16 opacity-75">Volume</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={settings.sfxVolume}
                      onChange={(e) => onUpdateSettings({ sfxVolume: Number(e.target.value) })}
                      className="flex-1 accent-[#18181B] cursor-pointer"
                    />
                    <span className="font-mono-num w-9 text-right">
                      {Math.round(settings.sfxVolume * 100)}%
                    </span>
                  </label>
                )}
              </div>

              {/* Min Word Length */}
              <div
                className="border-[3px] p-3.5 flex items-center justify-between gap-3"
                style={{ borderColor: palette.ink }}
              >
                <div>
                  <div className="font-display font-extrabold text-sm">Minimum Word Length</div>
                  <div className="text-xs opacity-75">3 letters for casual · 4 letters for challenge</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    onUpdateSettings({ minWordLen: settings.minWordLen === 3 ? 4 : 3 });
                  }}
                  className="bauhaus-btn h-10 px-3.5 font-display font-extrabold text-xs uppercase whitespace-nowrap shrink-0 cursor-pointer"
                  style={{ backgroundColor: palette.blue, color: '#F4F1DE' }}
                >
                  {settings.minWordLen} Letters
                </button>
              </div>

              {/* Auto-Submit & Haptics */}
              <div
                className="border-[3px] p-3.5 flex items-center justify-between gap-3"
                style={{ borderColor: palette.ink }}
              >
                <div>
                  <div className="font-display font-extrabold text-sm">Auto-Submit 4+ Words</div>
                  <div className="text-xs opacity-75">Score valid 4+ letter chains immediately</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    onUpdateSettings({ autoSubmit: !settings.autoSubmit });
                  }}
                  className="bauhaus-btn min-w-[84px] h-10 px-3 font-display font-extrabold text-xs uppercase whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: settings.autoSubmit ? palette.yellow : palette.paper,
                    color: palette.ink,
                  }}
                >
                  {settings.autoSubmit ? 'Auto' : 'Manual'}
                </button>
              </div>

              <div
                className="border-[3px] p-3.5 flex items-center justify-between gap-3"
                style={{ borderColor: palette.ink }}
              >
                <div>
                  <div className="font-display font-extrabold text-sm">Touch Haptics</div>
                  <div className="text-xs opacity-75">Subtle vibration feedback on mobile</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    onUpdateSettings({ hapticsEnabled: !settings.hapticsEnabled });
                  }}
                  className="bauhaus-btn min-w-[76px] h-10 px-3 font-display font-extrabold text-xs uppercase cursor-pointer"
                  style={{
                    backgroundColor: settings.hapticsEnabled ? palette.yellow : palette.paper,
                    color: palette.ink,
                  }}
                >
                  {settings.hapticsEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </>
          )}

          {modal === 'profile' && (
            <>
              <div
                className="border-[3px] p-4 flex items-center gap-4"
                style={{ borderColor: palette.ink, backgroundColor: palette.card }}
              >
                <div
                  className="w-14 h-14 rounded-full border-[3px] flex items-center justify-center font-display font-black text-2xl shrink-0"
                  style={{ borderColor: palette.ink, backgroundColor: palette.yellow, color: palette.ink }}
                >
                  W
                </div>
                <div className="min-w-0">
                  <div className="font-display font-black text-lg uppercase truncate">{rank}</div>
                  <div className="text-xs font-semibold opacity-75">
                    High Score · <span className="font-mono-num font-bold">{stats.highScore.toLocaleString()}</span> pts
                  </div>
                  <div className="text-xs font-semibold opacity-75">
                    Daily Best · <span className="font-mono-num font-bold">{stats.dailyBestScore.toLocaleString()}</span> pts · Streak {stats.dailyStreak}d
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="border-[3px] p-3" style={{ borderColor: palette.ink }}>
                  <div className="text-xs font-semibold opacity-75">Words Crafted</div>
                  <div className="font-mono-num font-bold text-2xl mt-0.5" style={{ color: palette.blue }}>
                    {stats.totalWords}
                  </div>
                </div>
                <div className="border-[3px] p-3" style={{ borderColor: palette.ink }}>
                  <div className="text-xs font-semibold opacity-75">Best Combo</div>
                  <div className="font-mono-num font-bold text-2xl mt-0.5" style={{ color: palette.red }}>
                    {stats.bestCombo}×
                  </div>
                </div>
                <div className="border-[3px] p-3" style={{ borderColor: palette.ink }}>
                  <div className="text-xs font-semibold opacity-75">Physics Bonuses</div>
                  <div className="font-mono-num font-bold text-2xl mt-0.5" style={{ color: palette.ink }}>
                    {stats.physicsBonuses}
                  </div>
                </div>
                <div className="border-[3px] p-3" style={{ borderColor: palette.ink }}>
                  <div className="text-xs font-semibold opacity-75">Longest Word</div>
                  <div className="font-display font-black text-xl mt-0.5 truncate" style={{ color: palette.blue }}>
                    {stats.longestWord || '—'}
                  </div>
                </div>
              </div>
            </>
          )}

          {modal === 'store' && (
            <>
              <p className="text-xs font-semibold opacity-80">
                Equip an archival Bauhaus studio palette across the lobby, sky arena, and icon:
              </p>
              <div className="space-y-3">
                {Object.values(PALETTES).map((item) => {
                  const active = item.id === palette.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        audioEngine.unlock();
                        audioEngine.playWordVictory(3, false);
                        onSelectPalette(item.id);
                      }}
                      className="bauhaus-btn w-full p-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                      style={{
                        backgroundColor: item.paper,
                        color: item.ink,
                        borderColor: item.ink,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-display font-black text-sm uppercase">{item.name}</div>
                        <div className="text-xs opacity-80 leading-snug mt-0.5">{item.desc}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-4 h-4 border-2 border-black" style={{ backgroundColor: item.red }} />
                        <span className="w-4 h-4 border-2 border-black" style={{ backgroundColor: item.blue }} />
                        <span className="w-4 h-4 border-2 border-black" style={{ backgroundColor: item.yellow }} />
                        <span
                          className="ml-1.5 px-2.5 py-1 text-[11px] font-display font-black uppercase border-2 border-black whitespace-nowrap"
                          style={{
                            backgroundColor: active ? item.ink : 'transparent',
                            color: active ? item.paper : item.ink,
                          }}
                        >
                          {active ? 'Active' : 'Use'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {modal === 'guide' && (
            <>
              <div className="space-y-2.5">
                {WEATHER_ORDER.map((w) => (
                  <div
                    key={w}
                    className="border-[3px] p-3 flex items-start gap-3"
                    style={{ borderColor: palette.ink, backgroundColor: palette.card }}
                  >
                    <div
                      className="w-10 h-10 border-[2.5px] flex items-center justify-center shrink-0"
                      style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
                    >
                      <WeatherGlyph weather={w} className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-display font-black text-sm uppercase">
                        {WEATHER_META[w].label} · Key {WEATHER_META[w].keyHint}
                      </div>
                      <p className="text-xs opacity-80 leading-relaxed mt-0.5">
                        {WEATHER_META[w].physicsDesc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="border-[3px] p-3.5 text-xs space-y-1.5 leading-relaxed"
                style={{ borderColor: palette.ink, backgroundColor: palette.yellow, color: palette.ink }}
              >
                <div className="font-display font-black uppercase">Physics Word Bonuses</div>
                <p className="font-medium">
                  Stack tiles in Snow or herd them with Wind. Physically aligned horizontal words glow for an instant <strong>2× Tap Capture</strong>, and closely clustered tiles earn a <strong>1.5× Cluster Bonus</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick();
                  onClose();
                  onReplaySplash();
                }}
                className="bauhaus-btn w-full h-11 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: palette.paper, color: palette.ink }}
              >
                Replay Intro Splash
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
