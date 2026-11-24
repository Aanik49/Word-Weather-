import type { BauhausPalette, WeatherType } from '../game/types';

interface GameIconProps {
  palette: BauhausPalette;
  className?: string;
}

/** Bespoke Bauhaus Minimalist App Icon (matches /public/icon.svg with live palette colors) */
export function BauhausGameIcon({ palette, className = 'w-24 h-24' }: GameIconProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-label="Word Weather Game Icon"
      role="img"
    >
      <rect width="512" height="512" rx="92" fill={palette.paper} />
      <rect x="18" y="18" width="476" height="476" rx="76" stroke={palette.ink} strokeWidth="20" />

      {/* Subtle architectural crosshair */}
      <line x1="18" y1="364" x2="494" y2="364" stroke={palette.ink} strokeWidth="10" strokeOpacity="0.16" />
      <line x1="340" y1="18" x2="340" y2="494" stroke={palette.ink} strokeWidth="10" strokeOpacity="0.16" />

      {/* Core Ink Circle */}
      <circle cx="268" cy="244" r="150" fill={palette.ink} />

      {/* Yellow Sun Rays */}
      <g stroke={palette.yellow} strokeWidth="14" strokeLinecap="square">
        <line x1="340" y1="76" x2="340" y2="108" />
        <line x1="428" y1="164" x2="460" y2="164" />
        <line x1="402" y1="102" x2="424" y2="80" />
        <line x1="278" y1="102" x2="256" y2="80" />
      </g>
      <line x1="366" y1="194" x2="444" y2="272" stroke={palette.yellow} strokeWidth="18" strokeLinecap="square" />

      {/* Vermilion Sun Disk */}
      <circle cx="340" cy="164" r="46" fill={palette.red} stroke={palette.ink} strokeWidth="8" />

      {/* Wind Dashed Streaks */}
      <g stroke={palette.paper} strokeWidth="8" strokeDasharray="16 12" strokeLinecap="square">
        <line x1="234" y1="352" x2="352" y2="234" />
        <line x1="264" y1="368" x2="376" y2="256" />
      </g>

      {/* Faceted Cobalt Cloud */}
      <polygon
        points="66,272 104,218 144,218 164,174 220,174 244,218 290,218 310,252 286,282 82,282"
        fill={palette.blue}
        stroke={palette.ink}
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <polyline
        points="104,218 148,282 164,174 210,282 220,174 258,282 244,218"
        fill="none"
        stroke={palette.ink}
        strokeWidth="7"
        strokeLinejoin="round"
      />

      {/* Falling Rain Lines */}
      <g stroke={palette.blue} strokeWidth="10" strokeLinecap="square">
        <line x1="104" y1="306" x2="104" y2="394" />
        <line x1="138" y1="306" x2="138" y2="424" />
        <line x1="172" y1="306" x2="172" y2="378" />
        <line x1="206" y1="306" x2="206" y2="412" />
      </g>

      {/* Signature Bauhaus Letter Tile 'W' */}
      <rect x="268" y="316" width="128" height="128" fill={palette.ink} />
      <rect x="256" y="304" width="128" height="128" fill={palette.yellow} stroke={palette.ink} strokeWidth="10" />
      <path
        d="M284 336 L300 400 L320 356 L340 400 L356 336"
        stroke={palette.ink}
        strokeWidth="14"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

interface WeatherGlyphProps {
  weather: WeatherType;
  className?: string;
}

/** Crisp geometric SVG glyph for each weather physics mode */
export function WeatherGlyph({ weather, className = 'w-6 h-6' }: WeatherGlyphProps) {
  if (weather === 'rain') {
    return (
      <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M8 18H24C26.8 18 29 15.8 29 13C29 10.4 27.1 8.3 24.6 8C23.6 5.1 20.9 3 17.7 3C13.8 3 10.6 6 10.2 9.8C7.4 10.2 5.3 12.6 5.3 15.5C5.3 16.9 6.5 18 8 18Z"
          stroke="currentColor"
          strokeWidth="2.3"
        />
        <line x1="11" y1="22" x2="11" y2="27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
        <line x1="16" y1="23" x2="16" y2="29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
        <line x1="21" y1="22" x2="21" y2="27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
      </svg>
    );
  }
  if (weather === 'snow') {
    return (
      <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <polygon points="16,4 26,10 26,22 16,28 6,22 6,10" stroke="currentColor" strokeWidth="2.2" />
        <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="1.9" />
        <line x1="6" y1="10" x2="26" y2="22" stroke="currentColor" strokeWidth="1.9" />
        <line x1="26" y1="10" x2="6" y2="22" stroke="currentColor" strokeWidth="1.9" />
      </svg>
    );
  }
  if (weather === 'wind') {
    return (
      <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <line x1="6" y1="24" x2="24" y2="8" stroke="currentColor" strokeWidth="2.7" strokeLinecap="square" />
        <polyline points="14,8 24,8 24,18" stroke="currentColor" strokeWidth="2.7" strokeLinecap="square" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="2.3" />
      <path
        d="M16 3V7M16 25V29M3 16H7M25 16H29M6.8 6.8L9.6 9.6M22.4 22.4L25.2 25.2M25.2 6.8L22.4 9.6M9.6 22.4L6.8 25.2"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="square"
      />
    </svg>
  );
}

interface BauhausEmblemProps {
  weather: WeatherType;
  palette: BauhausPalette;
  onCycle: () => void;
}

/** Interactive Bauhaus Poster Weather Emblem for the Lobby Centerpiece */
export function BauhausEmblem({ weather, palette, onCycle }: BauhausEmblemProps) {
  return (
    <button
      type="button"
      onClick={onCycle}
      title="Tap emblem to preview weather"
      aria-label={`Weather emblem showing ${weather}. Tap to cycle weather.`}
      className="bauhaus-press group relative w-52 h-52 sm:w-64 sm:h-64 flex items-center justify-center cursor-pointer focus-visible:outline-none"
    >
      <svg className="w-full h-full overflow-visible" viewBox="0 0 260 240">
        {/* Core Black Bauhaus Circle */}
        <circle cx="132" cy="120" r="88" fill={palette.ink} />

        {/* Sun Rays & Geometric Sun Disk (Upper Right) */}
        <g
          className="transition-transform duration-200"
          style={{
            transformOrigin: '174px 76px',
            transform: weather === 'sun' ? 'scale(1.09)' : 'scale(0.97)',
          }}
        >
          <g className="spin-rays" style={{ transformOrigin: '174px 76px' }}>
            <line x1="174" y1="24" x2="174" y2="38" stroke={palette.yellow} strokeWidth="6" />
            <line x1="174" y1="114" x2="174" y2="128" stroke={palette.yellow} strokeWidth="6" />
            <line x1="122" y1="76" x2="136" y2="76" stroke={palette.yellow} strokeWidth="6" />
            <line x1="212" y1="76" x2="226" y2="76" stroke={palette.yellow} strokeWidth="6" />
            <line x1="137" y1="39" x2="147" y2="49" stroke={palette.yellow} strokeWidth="6" />
            <line x1="201" y1="103" x2="211" y2="113" stroke={palette.yellow} strokeWidth="6" />
            <line x1="211" y1="39" x2="201" y2="49" stroke={palette.yellow} strokeWidth="6" />
            <line x1="147" y1="103" x2="137" y2="113" stroke={palette.yellow} strokeWidth="6" />
          </g>
          <line x1="194" y1="96" x2="232" y2="134" stroke={palette.yellow} strokeWidth="8" />
          <circle cx="174" cy="76" r="24" fill={palette.red} />
        </g>

        {/* Diagonal Dashed Wind Streaks */}
        <g
          className="transition-opacity duration-200"
          style={{ opacity: weather === 'wind' ? 1 : 0.45 }}
        >
          <line
            x1="116"
            y1="184"
            x2="178"
            y2="122"
            stroke={palette.paper}
            strokeWidth="3.2"
            strokeDasharray="7 5"
            className="animate-dash"
          />
          <line
            x1="130"
            y1="194"
            x2="192"
            y2="132"
            stroke={palette.paper}
            strokeWidth="3.2"
            strokeDasharray="7 5"
            className="animate-dash"
          />
          <line
            x1="146"
            y1="198"
            x2="202"
            y2="142"
            stroke={palette.paper}
            strokeWidth="3.2"
            strokeDasharray="7 5"
            className="animate-dash"
          />
        </g>

        {/* Faceted Cobalt Cloud + Always-Fixed Vertical Blue Straight Lines */}
        <g>
          <polygon
            points="34,132 54,104 72,104 82,82 108,82 120,104 142,104 152,122 140,136 42,136"
            fill={palette.blue}
            stroke={palette.ink}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <polyline
            points="54,104 74,136 82,82 104,136 108,82 126,136 120,104"
            fill="none"
            stroke={palette.ink}
            strokeWidth="2"
          />
          <line x1="54" y1="104" x2="120" y2="104" stroke={palette.ink} strokeWidth="2" />

          {/* Vertical Blue Straight Lines — Permanently Fixed */}
          <g stroke={palette.blue} strokeWidth="3.2" strokeLinecap="square">
            <line x1="52" y1="142" x2="52" y2="188" />
            <line x1="64" y1="142" x2="64" y2="202" />
            <line x1="76" y1="142" x2="76" y2="192" />
            <line x1="88" y1="142" x2="88" y2="208" />
            <line x1="100" y1="142" x2="100" y2="196" />
            <line x1="112" y1="142" x2="112" y2="204" />
            <line x1="124" y1="142" x2="124" y2="186" />
          </g>
        </g>
      </svg>
    </button>
  );
}
