"use client";

import type { DisplayOptions } from "@/lib/chordpro";

interface Props {
  options: DisplayOptions;
  onChange: (next: DisplayOptions) => void;
  /** Key after transposing, for the readout. */
  displayKey: string | null;
  scrolling: boolean;
  onToggleScroll: () => void;
  scrollSpeed: number;
  onScrollSpeed: (speed: number) => void;
  fontSize: number;
  onFontSize: (size: number) => void;
}

const btn =
  "h-8 min-w-8 px-2 rounded-lg border border-white/10 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-40";
const toggle = (on: boolean) =>
  `h-8 px-3 rounded-lg border text-sm transition-colors ${
    on ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-gray-300 hover:bg-white/5"
  }`;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-gray-500 mr-0.5">{label}</span>
      {children}
    </div>
  );
}

export default function SheetToolbar({
  options,
  onChange,
  displayKey,
  scrolling,
  onToggleScroll,
  scrollSpeed,
  onScrollSpeed,
  fontSize,
  onFontSize,
}: Props) {
  const set = (patch: Partial<DisplayOptions>) => onChange({ ...options, ...patch });
  const t = options.transpose;

  return (
    // One swipeable row on phones so the sticky bar doesn't eat the screen
    <div className="flex flex-nowrap sm:flex-wrap items-center gap-x-5 gap-y-2 overflow-x-auto sm:overflow-visible [scrollbar-width:none] [&>*]:shrink-0">
      <Group label="Transpose">
        <button type="button" className={btn} onClick={() => set({ transpose: t - 1 })} aria-label="Transpose down">
          −
        </button>
        <span className="w-16 text-center text-sm text-white tabular-nums" aria-live="polite">
          {t > 0 ? `+${t}` : t}
          {displayKey && <span className="text-gray-400"> · {displayKey}</span>}
        </span>
        <button type="button" className={btn} onClick={() => set({ transpose: t + 1 })} aria-label="Transpose up">
          +
        </button>
        {t !== 0 && (
          <button type="button" className="text-xs text-gray-500 hover:text-gray-300" onClick={() => set({ transpose: 0 })}>
            reset
          </button>
        )}
      </Group>

      <Group label="Capo">
        <select
          value={options.capo}
          onChange={(e) => set({ capo: Number(e.target.value) })}
          className="h-8 rounded-lg border border-white/10 bg-transparent text-sm text-gray-200 px-2"
          aria-label="Capo fret"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i} className="bg-gray-900">
              {i === 0 ? "No capo" : `Capo ${i}`}
            </option>
          ))}
        </select>
      </Group>

      <div className="flex items-center gap-1.5">
        <button type="button" className={toggle(options.simplify)} onClick={() => set({ simplify: !options.simplify })} aria-pressed={options.simplify}>
          Simplify
        </button>
        <button type="button" className={toggle(options.flats)} onClick={() => set({ flats: !options.flats })} aria-pressed={options.flats}>
          ♭ Flats
        </button>
      </div>

      <Group label="Scroll">
        <button type="button" className={toggle(scrolling)} onClick={onToggleScroll} aria-pressed={scrolling}>
          {scrolling ? "❚❚ Pause" : "▶ Auto"}
        </button>
        <input
          type="range"
          min={1}
          max={10}
          value={scrollSpeed}
          onChange={(e) => onScrollSpeed(Number(e.target.value))}
          className="w-20 accent-violet-500"
          aria-label="Autoscroll speed"
        />
      </Group>

      <Group label="Text">
        <button type="button" className={btn} onClick={() => onFontSize(fontSize - 1)} disabled={fontSize <= 12} aria-label="Smaller text">
          A−
        </button>
        <button type="button" className={btn} onClick={() => onFontSize(fontSize + 1)} disabled={fontSize >= 26} aria-label="Larger text">
          A+
        </button>
      </Group>
    </div>
  );
}
