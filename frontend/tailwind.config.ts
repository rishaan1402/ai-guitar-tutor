import type { Config } from "tailwindcss";

/**
 * "Stage Lights": every colour is a theme variable ("R G B" channels set in
 * globals.css for the dark default and the light theme), so one switch
 * recolours the whole app and Tailwind's /opacity modifiers still work.
 * The old names stay (amber = the accent, sage = success, amp = live/error)
 * so existing utilities follow the new palette.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (name: string) => Object.fromEntries(STEPS.map((k) => [k, v(`${name}-${k}`)]));

const ACCENT = scale("acc"); // magenta spotlight
const OK = scale("ok"); // cyan: you nailed it
const LIVE = scale("live"); // red: live, errors
const NEUTRAL = scale("neu"); // violet-grey
const VIOLET = scale("vio"); // second spotlight
const INK = { 950: v("ink-950"), 900: v("ink-900"), 800: v("ink-800"), 700: v("ink-700"), 600: v("ink-600") };

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── shadcn colour system ──────────────────────────────────────────
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // ── App-specific palette ────────────────────────────────────────
        // "Night stage": the legacy purple/violet scales now resolve to warm
        // amber stage light and cyan to sage, so every existing utility
        // (text-purple-300, bg-cyan-500/20, ...) picks up the redesign.
        // Legacy palette names resolve into the studio palette so older
        // components can't drift off-brand.
        // "white" is the main text colour: near-white on Stage Lights, ink by day
        white: v("text"),
        gray: NEUTRAL,
        emerald: OK,
        green: OK,
        blue: OK,
        red: LIVE,
        yellow: ACCENT,
        orange: ACCENT,
        purple: VIOLET,
        violet: VIOLET,
        amber: ACCENT,
        cyan: OK,
        sage: OK,
        cream: {
          DEFAULT: v("text"),
          muted: v("text-muted"),
          dim: v("text-dim"),
        },
        // backgrounds, darkest to lightest (inverted in the light theme)
        moss: INK,
        ink: INK,
        amp: LIVE,
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Arial Black", "var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // ── Border radius (matches --radius CSS var) ──────────────────────
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // ── Typography scale ──────────────────────────────────────────────
      // short: landscape phones (the app is landscape, so height is the tight side)
      screens: {
        short: { raw: "(max-height: 500px)" },
      },
      fontSize: {
        display: ["clamp(2rem, 8vmin, 6rem)", { lineHeight: "0.92", fontWeight: "700", letterSpacing: "-0.015em" }],
        h1:      ["clamp(1.75rem, 6vmin, 3.75rem)", { lineHeight: "0.95", fontWeight: "700", letterSpacing: "-0.01em" }],
        h2:      ["clamp(1.4rem, 4.2vmin, 2.5rem)", { lineHeight: "1", fontWeight: "700", letterSpacing: "-0.005em" }],
        h3:      ["1.25rem", { lineHeight: "1.2", fontWeight: "600" }],
        body:    ["1rem", { lineHeight: "1.55" }],
        meta:    ["0.75rem", { lineHeight: "1.3", letterSpacing: "0.16em", fontWeight: "600" }],
        caption: ["0.75rem", { lineHeight: "1.4" }],
        eyebrow: ["0.6875rem", { lineHeight: "1", fontWeight: "600", letterSpacing: "0.22em" }],
      },
      // ── Motion tokens (globals.css --dur-* / --ease-*) ────────────────
      transitionDuration: {
        instant: "90ms",
        fast: "180ms",
        base: "320ms",
        slow: "640ms",
        story: "1100ms",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-sine": "cubic-bezier(0.37, 0, 0.63, 1)",
        "in-quart": "cubic-bezier(0.5, 0, 0.75, 0)",
      },
      // ── Spacing extras ────────────────────────────────────────────────
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "30": "7.5rem",
      },
      // ── Shadows / glows ───────────────────────────────────────────────
      boxShadow: {
        glass:       "0 4px 30px rgba(0,0,0,0.1)",
        "glow-sm":   "0 0 12px rgb(var(--acc-400) / 0.35)",
        "glow-md":   "0 0 28px rgb(var(--acc-400) / 0.45)",
        "glow-cyan": "0 0 20px rgb(var(--ok-400) / 0.4)",
        "glow-green":"0 0 15px rgb(var(--ok-400) / 0.35)",
        "glow-red":  "0 0 20px rgb(var(--live-400) / 0.45)",
        "glow-violet": "0 0 24px rgb(var(--vio-400) / 0.45)",
      },
      backdropBlur: {
        glass: "16px",
      },
      // ── Keyframes ─────────────────────────────────────────────────────
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
        "slide-out-right": {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "slide-in-right":  "slide-in-right 0.3s ease-out",
        "slide-out-right": "slide-out-right 0.3s ease-in",
      },
    },
  },
  plugins: [],
};

export default config;
