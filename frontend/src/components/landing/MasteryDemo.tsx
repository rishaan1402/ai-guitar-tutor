/** Mastery explained in one picture: three clean days, then spaced re-checks. */
const DAYS = ["Mon", "Tue", "Thu"];
const RECHECKS = [3, 7, 14, 30, 60];

export default function MasteryDemo() {
  return (
    <div className="rounded-[28px] border border-cream/10 bg-ink-900/70 p-6 sm:p-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="label-mono text-cream/50">Clean days</p>
          <ol className="mt-4 flex items-end gap-4">
            {DAYS.map((d, i) => (
              <li key={d} className="flex flex-col items-center gap-2">
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-full border-2 font-display text-xl ${
                    i < 2 ? "border-sage-300 bg-sage-400/15 text-sage-200" : "border-amber-400 bg-amber-400/15 text-amber-200 os-hotspot"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="label-mono text-cream/50">{d}</span>
              </li>
            ))}
            <li className="pb-6 text-cream/40" aria-hidden="true">→</li>
            <li className="flex flex-col items-center gap-2">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff0c4,#e3b55a_40%,#8a6424)] text-ink-950 shadow-[0_0_30px_rgba(227,181,90,0.45)]">
                ★
              </span>
              <span className="label-mono text-amber-300">Mastered</span>
            </li>
          </ol>
          <p className="mt-5 text-cream/70">
            One lucky strum isn&apos;t mastery. A chord goes up on your wall after clean takes on three different days.
          </p>
        </div>
        <div>
          <p className="label-mono text-cream/50">Then it comes back to check</p>
          <div className="relative mt-6">
            <div className="absolute left-0 right-0 top-3 h-px bg-cream/15" />
            <ol className="relative flex justify-between">
              {RECHECKS.map((d) => (
                <li key={d} className="flex flex-col items-center gap-2">
                  <span className="h-6 w-6 rounded-full border border-amber-400/70 bg-ink-950" />
                  <span className="label-mono text-cream/60">+{d}d</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-5 text-cream/70">
            Quick re-checks at growing intervals keep it in your hands. Miss one and it drops back for a single clean
            day — no starting over.
          </p>
        </div>
      </div>
    </div>
  );
}
