import { useEffect, useState } from 'react';
import { audioEngine } from '../game/audioEngine';
import type { BauhausPalette } from '../game/types';
import { BauhausGameIcon } from './GameIcon';

interface SplashScreenProps {
  palette: BauhausPalette;
  onFinish: () => void;
}

export function SplashScreen({ palette, onFinish }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);

  const dismiss = () => {
    if (exiting) return;
    audioEngine.unlock();
    setExiting(true);
    window.setTimeout(onFinish, 220);
  };

  useEffect(() => {
    const autoTimer = window.setTimeout(() => {
      setExiting(true);
      window.setTimeout(onFinish, 220);
    }, 1850);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(autoTimer);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      onClick={dismiss}
      role="button"
      tabIndex={0}
      aria-label="Word Weather splash screen. Tap anywhere to enter lobby."
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between px-6 py-10 cursor-pointer transition-opacity duration-200 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundColor: palette.paper,
        color: palette.ink,
        paddingTop: 'max(2.5rem, var(--safe-top))',
        paddingBottom: 'max(2.5rem, var(--safe-bottom))',
      }}
    >
      {/* Top Bauhaus Primary Composition Rule */}
      <div className="w-full max-w-md flex items-center gap-0 border-[3px]" style={{ borderColor: palette.ink }}>
        <div className="h-3 flex-1" style={{ backgroundColor: palette.red }} />
        <div className="h-3 flex-1 border-x-[3px]" style={{ backgroundColor: palette.yellow, borderColor: palette.ink }} />
        <div className="h-3 flex-1" style={{ backgroundColor: palette.blue }} />
      </div>

      {/* Center Kinetic Icon + Stacked Title Lockup */}
      <div className="flex flex-col items-center text-center gap-5 splash-in">
        <div
          className="p-2 border-[3px]"
          style={{
            borderColor: palette.ink,
            backgroundColor: palette.paper,
            boxShadow: `8px 8px 0px ${palette.ink}`,
          }}
        >
          <BauhausGameIcon palette={palette} className="w-28 h-28 sm:w-36 sm:h-36" />
        </div>

        <div className="leading-[0.9] select-none">
          <h1 className="font-display font-black tracking-tight text-4xl sm:text-6xl uppercase">
            Word
          </h1>
          <div
            className="font-display font-black tracking-tight text-4xl sm:text-6xl uppercase"
            style={{ color: palette.blue }}
          >
            Weather
          </div>
        </div>

        <p className="text-xs sm:text-sm font-semibold tracking-wide opacity-75">
          Physics Word Puzzle · Tap Clouds · Steer Wind
        </p>

        {/* Crisp Bauhaus Loading Bar */}
        <div
          className="w-48 h-3 border-[3px] overflow-hidden"
          style={{ borderColor: palette.ink, backgroundColor: palette.paper }}
        >
          <div className="w-full h-full splash-progress" style={{ backgroundColor: palette.red }} />
        </div>
      </div>

      {/* Bottom Tap Hint */}
      <div className="text-xs font-bold tracking-wider opacity-65">
        Tap anywhere to continue
      </div>
    </section>
  );
}
