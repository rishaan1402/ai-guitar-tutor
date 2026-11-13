"use client";

import { useEffect, useState } from "react";

interface Props {
  chapters: { id: string; label: string }[];
}

/** Vertical chapter navigator on the right edge; the active chapter gets a ring. */
export default function ChapterDots({ chapters }: Props) {
  const [active, setActive] = useState(chapters[0]?.id);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    chapters.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [chapters]);

  return (
    <nav aria-label="Chapters" className="fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-5">
      {chapters.map((c) => {
        const on = c.id === active;
        return (
          <a
            key={c.id}
            href={`#${c.id}`}
            aria-label={c.label}
            aria-current={on ? "true" : undefined}
            className="group relative flex h-6 w-6 items-center justify-center"
          >
            <span
              className={`absolute inset-0 rounded-full border transition-all duration-500 ${
                on ? "border-cream/70 scale-100" : "border-transparent scale-50"
              }`}
            />
            <span className={`h-1.5 w-1.5 rounded-full transition-colors ${on ? "bg-cream" : "bg-cream/40 group-hover:bg-cream/80"}`} />
            <span className="pointer-events-none absolute right-9 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/0 transition-colors group-hover:text-cream/70">
              {c.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
