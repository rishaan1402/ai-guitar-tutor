/**
 * Shared Framer Motion variants & helpers.
 * Import these instead of defining one-off variants per component.
 */
import { useReducedMotion as _useReducedMotion } from "framer-motion";

export { _useReducedMotion as useReducedMotion };

// ── Tokens (mirror globals.css --dur-* / --ease-*) ───────────────────────────

/** Durations in seconds. */
export const DUR = { instant: 0.09, fast: 0.18, base: 0.32, slow: 0.64, story: 1.1 } as const;
export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOutSine: [0.37, 0, 0.63, 1] as [number, number, number, number],
  inQuart: [0.5, 0, 0.75, 0] as [number, number, number, number],
};
/** Feedback elements (score ring, verdict chip): settles without a bouncy overshoot. */
export const SPRING_FEEDBACK = { type: "spring" as const, stiffness: 300, damping: 26, mass: 1 };

// ── Page / section entrance ───────────────────────────────────────────────────

export const fadeInUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.outExpo } },
};

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE.outExpo } },
};

// ── Stagger container ─────────────────────────────────────────────────────────

export const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

// ── Card / item entrance ──────────────────────────────────────────────────────

export const cardEntrance = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: DUR.base, ease: EASE.outExpo },
  },
};

// ── Slide-in from right (drawer/sheet) ───────────────────────────────────────

export const slideInRight = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.2 } },
};

// ── Scale pop (score ring, badges) ───────────────────────────────────────────

export const scalePop = {
  hidden:  { opacity: 0, scale: 0.7 },
  visible: {
    opacity: 1, scale: 1,
    transition: SPRING_FEEDBACK,
  },
};

// ── Pulse tap (button press feedback) ────────────────────────────────────────

export const tapScale = { scale: 0.96 };

// ── Viewport-triggered entrance helper ───────────────────────────────────────
// Usage: <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} />
