"use client";

import { createElement, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function useInView<T extends Element>(once = true) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) io.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return [ref, visible] as const;
}

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
}

/** Fades, de-blurs and lifts its children into place when scrolled into view. */
export function Reveal({ children, as = "div", delay = 0, className }: RevealProps) {
  const [ref, visible] = useInView<HTMLElement>();
  return createElement(
    as,
    {
      ref,
      className: cn("reveal", visible && "is-visible", className),
      style: { ["--reveal-delay" as string]: `${delay}ms` },
    },
    children,
  );
}

interface WordsProps {
  text: string;
  as?: ElementType;
  delay?: number;
  className?: string;
}

/** Headline whose words rise out of a mask one after another. */
export function RevealWords({ text, as = "h2", delay = 0, className }: WordsProps) {
  const [ref, visible] = useInView<HTMLElement>();
  const lines = text.split("\n");
  let index = 0;
  return createElement(
    as,
    {
      ref,
      className: cn("reveal-words", visible && "is-visible", className),
      style: { ["--reveal-delay" as string]: `${delay}ms` },
      "aria-label": text.replace(/\n/g, " "),
    },
    lines.map((line, li) => (
      <span key={li} className="block" aria-hidden>
        {line.split(" ").map((word, wi) => (
          <span key={wi} className="word">
            <span style={{ ["--i" as string]: index++ }}>{word}</span>
            {wi < line.split(" ").length - 1 ? " " : null}
          </span>
        ))}
      </span>
    )),
  );
}
