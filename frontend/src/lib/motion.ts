/**
 * Shared Framer Motion variants & helpers.
 * Import these instead of defining one-off variants per component.
 */
import { useReducedMotion as _useReducedMotion } from "framer-motion";

export { _useReducedMotion as useReducedMotion };

// ── Page / section entrance ───────────────────────────────────────────────────

export const fadeInUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

// ── Stagger container ─────────────────────────────────────────────────────────

export const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// ── Card / item entrance ──────────────────────────────────────────────────────

export const cardEntrance = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.3, ease: "backOut" as const },
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
    transition: { type: "spring", stiffness: 400, damping: 20 },
  },
};

// ── Pulse tap (button press feedback) ────────────────────────────────────────

export const tapScale = { scale: 0.96 };

// ── Viewport-triggered entrance helper ───────────────────────────────────────
// Usage: <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} />
