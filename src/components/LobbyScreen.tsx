import { audioEngine } from '../game/audioEngine';
import { getDailyTargetWord } from '../game/dictionary';
import { getWeatherColors, WEATHER_META, WEATHER_ORDER } from '../game/palettes';
import type {
  BauhausPalette,
  GameMode,
  ModalType,
  PlayerStats,
  WeatherType,
} from '../game/types';
import { BauhausEmblem, WeatherGlyph } from './GameIcon';

interface LobbyScreenProps {
  palette: BauhausPalette;
  weather: WeatherType;
  stats: PlayerStats;
  onSelectWeather: (weather: WeatherType) => void;
  onCycleWeather: () => void;
  onStartGame: (mode: GameMode) => void;
  onOpenModal: (modal: ModalType) => void;
}

/** Weather-reactive Bauhaus geometric poster background for the Lobby */
function LobbyWeatherBackdrop({
  weather,
  palette,
}: {
  weather: WeatherType;
  palette: BauhausPalette;
}) {
  const tintByWeather: Record<WeatherType, string> = {
    rain: 'rgba(43, 91, 132, 0.10)',
    snow: 'rgba(255, 255, 255, 0.48)',
    wind: 'rgba(224, 60, 49, 0.08)',
    sun: 'rgba(244, 185, 66, 0.16)',
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: tintByWeather[weather] }}
    >
      {/* Subtle Bauhaus Structural Poster Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]" preserveAspectRatio="none">
        <line x1="12%" y1="0" x2="12%" y2="100%" stroke={palette.ink} strokeWidth="2" />
        <line x1="88%" y1="0" x2="88%" y2="100%" stroke={palette.ink} strokeWidth="2" />
        <line x1="0" y1="22%" x2="100%" y2="22%" stroke={palette.ink} strokeWidth="2" />
        <line x1="0" y1="78%" x2="100%" y2="78%" stroke={palette.ink} strokeWidth="2" />
      </svg>

      {/* RAIN: Vertical Bauhaus falling rain lines + cobalt corner block */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          weather === 'rain' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute -top-8 -left-8 w-36 h-36 sm:w-52 sm:h-52 border-r-[3px] border-b-[3px] opacity-20"
          style={{ backgroundColor: palette.blue, borderColor: palette.ink }}
        />
        <div
          className="absolute -bottom-6 -right-6 w-40 h-24 sm:w-56 sm:h-32 border-t-[3px] border-l-[3px] opacity-15"
          style={{ backgroundColor: palette.blue, borderColor: palette.ink }}
        />
        <svg className="absolute -inset-y-10 inset-x-0 w-full h-[calc(100%+80px)] lobby-rain-drift opacity-25">
          <defs>
            <pattern id="bauhaus-rain-pat" width="64" height="64" patternUnits="userSpaceOnUse">
              <line x1="16" y1="6" x2="16" y2="28" stroke={palette.blue} strokeWidth="3" strokeLinecap="square" />
              <line x1="48" y1="30" x2="48" y2="56" stroke={palette.blue} strokeWidth="3" strokeLinecap="square" />
              <circle cx="32" cy="18" r="2.2" fill={palette.blue} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bauhaus-rain-pat)" />
        </svg>
      </div>

      {/* SNOW: Geometric Bauhaus crystal stars + architectural snow-stack plinth */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          weather === 'snow' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute bottom-0 inset-x-0 h-5 border-t-[3px] opacity-25"
          style={{ backgroundColor: palette.blue, borderColor: palette.ink }}
        />
        <div
          className="absolute top-12 right-6 w-20 h-20 sm:w-28 sm:h-28 rotate-45 border-[3px] opacity-15"
          style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
        />
        <svg className="absolute -inset-y-8 -inset-x-4 w-[calc(100%+32px)] h-[calc(100%+64px)] lobby-snow-drift opacity-25">
          <defs>
            <pattern id="bauhaus-snow-pat" width="88" height="88" patternUnits="userSpaceOnUse">
              <g stroke={palette.ink} strokeWidth="2">
                <path d="M22 14v16M15 18l14 8M29 18l-14 8" />
                <polygon points="66,54 72,58 72,66 66,70 60,66 60,58" fill="none" />
              </g>
              <circle cx="66" cy="20" r="2.5" fill={palette.blue} />
              <circle cx="24" cy="68" r="2.5" fill={palette.ink} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bauhaus-snow-pat)" />
        </svg>
      </div>

      {/* WIND: Diagonal sweeping Bauhaus streamlines + vermilion chevron band */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          weather === 'wind' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 400 800" preserveAspectRatio="none">
          <polygon points="0,560 400,340 400,420 0,640" fill={palette.red} />
          <polygon points="0,190 400,20 400,56 0,226" fill={palette.ink} />
        </svg>
        <svg className="absolute -inset-12 w-[calc(100%+96px)] h-[calc(100%+96px)] lobby-wind-sweep opacity-30">
          <defs>
            <pattern id="bauhaus-wind-pat" width="88" height="88" patternUnits="userSpaceOnUse">
              <line
                x1="8"
                y1="80"
                x2="76"
                y2="12"
                stroke={palette.red}
                strokeWidth="3"
                strokeDasharray="10 8"
                strokeLinecap="square"
              />
              <polyline
                points="60,12 76,12 76,28"
                fill="none"
                stroke={palette.red}
                strokeWidth="2.6"
                strokeLinecap="square"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bauhaus-wind-pat)" />
        </svg>
      </div>

      {/* SUN: Warm Bauhaus concentric sunburst arcs + golden diagonal rays */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          weather === 'sun' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <svg
          className="absolute inset-0 w-full h-full lobby-sun-pulse"
          viewBox="0 0 480 800"
          preserveAspectRatio="xMaxYMin slice"
        >
          <circle cx="460" cy="40" r="240" fill={palette.yellow} fillOpacity="0.22" />
          <circle cx="460" cy="40" r="175" fill="none" stroke={palette.yellow} strokeWidth="6" strokeOpacity="0.55" />
          <circle cx="460" cy="40" r="112" fill={palette.red} fillOpacity="0.16" />
          <g stroke={palette.yellow} strokeWidth="8" strokeOpacity="0.32" strokeLinecap="square">
            <line x1="360" y1="150" x2="170" y2="340" />
            <line x1="410" y1="185" x2="290" y2="415" />
            <line x1="315" y1="95" x2="105" y2="195" />
          </g>
          <circle cx="44" cy="720" r="92" fill={palette.yellow} fillOpacity="0.2" stroke={palette.ink} strokeOpacity="0.12" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}

export function LobbyScreen({
  palette,
  weather,
  stats,
  onSelectWeather,
  onCycleWeather,
  onStartGame,
  onOpenModal,
}: LobbyScreenProps) {
  const dailyTarget = getDailyTargetWord();

  return (
    <section
      className="relative z-20 w-full h-full flex flex-col justify-between overflow-y-auto no-scrollbar px-4 sm:px-6"
      style={{
        backgroundColor: palette.paper,
        color: palette.ink,
        paddingTop: 'max(1rem, var(--safe-top))',
        paddingBottom: 'max(2.5rem, calc(var(--safe-bottom) + 1.75rem))',
      }}
    >
      {/* Dynamic Weather-Reactive Bauhaus Poster Background */}
      <LobbyWeatherBackdrop weather={weather} palette={palette} />

      <div className="relative z-10 flex-1 w-full max-w-lg mx-auto flex flex-col items-center justify-between gap-3 sm:gap-5 py-1">
        {/* 1. TOP GAME NAME LOCKUP (WORD WEATHER) */}
        <header className="w-full flex items-center justify-center gap-3 sm:gap-5 shrink-0 pt-0.5">
          <div className="flex-1 h-[3px]" style={{ backgroundColor: palette.ink }} />
          <div className="text-center leading-[0.9] select-none shrink-0">
            <h1 className="font-display font-black tracking-tight text-4xl sm:text-5xl uppercase">
              Word
            </h1>
            <div
              className="font-display font-black tracking-tight text-4xl sm:text-5xl uppercase"
              style={{ color: palette.blue }}
            >
              Weather
            </div>
          </div>
          <div className="flex-1 h-[3px]" style={{ backgroundColor: palette.ink }} />
        </header>

        {/* 2. ANIMATED BAUHAUS WEATHER EMBLEM ICON (Slightly Higher & Larger) */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-3 sm:-mt-4 gap-1.5 min-h-0">
          <BauhausEmblem
            weather={weather}
            palette={palette}
            onCycle={() => {
              audioEngine.unlock();
              onCycleWeather();
            }}
          />
          <div className="text-xs sm:text-sm font-bold opacity-80 text-center">
            {WEATHER_META[weather].shortHint}
          </div>
        </div>

        {/* 3. WEATHER SELECT SECTION + 4. BOTTOM ACTION BUTTONS (Elevated Higher) */}
        <div className="w-full flex flex-col items-center gap-3.5 sm:gap-4 shrink-0 mb-3 sm:mb-4">
          {/* Weather Select 4-Column Boxed Strip */}
          <div className="w-full flex flex-col items-center">
            <div className="text-[11px] font-display font-extrabold tracking-widest uppercase mb-1.5">
              Weather Select
            </div>
            <div
              className="w-full grid grid-cols-4 border-[3px]"
              style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
            >
              {WEATHER_ORDER.map((w, idx) => {
                const active = w === weather;
                const colors = active
                  ? getWeatherColors(w, palette)
                  : { bg: palette.paper, fg: palette.ink };
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      audioEngine.unlock();
                      onSelectWeather(w);
                    }}
                    className={`bauhaus-press min-h-[58px] py-2 px-1 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      idx < 3 ? 'border-r-[3px]' : ''
                    }`}
                    style={{
                      borderColor: palette.ink,
                      backgroundColor: colors.bg,
                      color: colors.fg,
                    }}
                  >
                    <WeatherGlyph weather={w} className="w-6 h-6" />
                    <span className="text-[10px] font-display font-extrabold tracking-wider uppercase whitespace-nowrap">
                      {WEATHER_META[w].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Buttons: PLAY (Red) · ZEN MODE (Yellow) · DAILY CHALLENGE (Blue) */}
          <div className="w-full grid grid-cols-3 gap-2.5 sm:gap-3.5 items-stretch">
            {/* PLAY */}
            <button
              type="button"
              onClick={() => {
                audioEngine.unlock();
                onStartGame('classic');
              }}
              className="bauhaus-btn min-h-[82px] sm:min-h-[88px] flex flex-col items-center justify-center px-2 py-2.5 text-center cursor-pointer"
              style={{
                backgroundColor: palette.red,
                color: '#F4F1DE',
                borderColor: palette.ink,
              }}
            >
              <span
                className="font-display font-black text-base sm:text-lg tracking-wide uppercase"
                style={{ textShadow: `2px 2px 0px ${palette.ink}` }}
              >
                Play
              </span>
              <span className="text-[10px] font-bold tracking-wide opacity-95 mt-0.5">
                {stats.highScore > 0 ? `Best · ${stats.highScore}` : 'Classic'}
              </span>
            </button>

            {/* ZEN MODE (Center Triad · Full Yellow) */}
            <button
              type="button"
              onClick={() => {
                audioEngine.unlock();
                onStartGame('zen');
              }}
              className="bauhaus-btn min-h-[82px] sm:min-h-[88px] flex flex-col items-center justify-center px-2 py-2.5 text-center cursor-pointer"
              style={{
                backgroundColor: palette.yellow,
                color: palette.ink,
                borderColor: palette.ink,
              }}
            >
              <span
                className="font-display font-black text-xs sm:text-sm leading-tight tracking-wide uppercase"
                style={{ textShadow: '1.5px 1.5px 0px rgba(244, 241, 222, 0.9)' }}
              >
                Zen
                <br />
                Mode
              </span>
              <span className="text-[10px] font-bold opacity-85 mt-1 whitespace-nowrap">
                Untimed · Calm
              </span>
            </button>

            {/* DAILY CHALLENGE */}
            <button
              type="button"
              onClick={() => {
                audioEngine.unlock();
                onStartGame('daily');
              }}
              className="bauhaus-btn min-h-[82px] sm:min-h-[88px] flex flex-col items-center justify-center px-2 py-2.5 text-center cursor-pointer"
              style={{
                backgroundColor: palette.blue,
                color: '#F4F1DE',
                borderColor: palette.ink,
              }}
            >
              <span
                className="font-display font-black text-xs sm:text-sm leading-tight tracking-wide uppercase"
                style={{ textShadow: `2px 2px 0px ${palette.ink}` }}
              >
                Daily
                <br />
                Challenge
              </span>
              <span className="text-[10px] font-bold opacity-90 mt-1">
                90s · {dailyTarget}
              </span>
            </button>
          </div>

          {/* SETTINGS (Full-width bar beneath game modes) */}
          <button
            type="button"
            onClick={() => {
              audioEngine.unlock();
              audioEngine.playUiClick();
              onOpenModal('settings');
            }}
            className="bauhaus-btn w-full h-12 px-4 flex items-center justify-between cursor-pointer"
            style={{
              backgroundColor: palette.card,
              color: palette.ink,
              borderColor: palette.ink,
            }}
          >
            <span className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 border-[2.5px] inline-block shrink-0"
                style={{ borderColor: palette.ink, backgroundColor: palette.yellow }}
              />
              <span
                className="font-display font-black text-xs sm:text-sm tracking-wider uppercase"
                style={{ textShadow: '1.5px 1.5px 0px rgba(244, 241, 222, 0.9)' }}
              >
                Settings
              </span>
            </span>
            <span className="text-[11px] font-bold opacity-75 whitespace-nowrap">
              Audio · Themes · Physics
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
