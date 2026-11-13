import type { Config } from "tailwindcss";

const AMBER = {
  50: "#fdf7ec",
  100: "#faecd0",
  200: "#f4d69f",
  300: "#efc27a",
  400: "#e8a54b",
  500: "#d98b2b",
  600: "#b86e1f",
  700: "#93531c",
  800: "#78431d",
  900: "#63381b",
  950: "#381c0b",
};

const SAGE = {
  50: "#f2f7f3",
  100: "#dfece2",
  200: "#c0d9c6",
  300: "#a3c6ab",
  400: "#86b092",
  500: "#6a9576",
  600: "#527a5e",
  700: "#41614b",
  800: "#344d3d",
  900: "#2a3e32",
  950: "#15211a",
};

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
        purple: AMBER,
        violet: AMBER,
        amber: AMBER,
        cyan: SAGE,
        sage: SAGE,
        cream: {
          DEFAULT: "#f3ead8",
          muted: "#cbbfa8",
          dim: "#8f8574",
        },
        moss: {
          950: "#060807",
          900: "#0a0e0c",
          800: "#101814",
          700: "#18241d",
          600: "#22322a",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
      },
      // ── Border radius (matches --radius CSS var) ──────────────────────
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // ── Typography scale ──────────────────────────────────────────────
      fontSize: {
        display: ["clamp(2.75rem, 7vw, 6rem)", { lineHeight: "0.92", fontWeight: "700", letterSpacing: "-0.015em" }],
        h1:      ["clamp(2.25rem, 4.5vw, 3.75rem)", { lineHeight: "0.95", fontWeight: "700", letterSpacing: "-0.01em" }],
        h2:      ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1", fontWeight: "700", letterSpacing: "-0.005em" }],
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
        "glow-sm":   "0 0 12px rgba(232,165,75,0.28)",
        "glow-md":   "0 0 28px rgba(232,165,75,0.35)",
        "glow-cyan": "0 0 20px rgba(134,176,146,0.35)",
        "glow-green":"0 0 15px rgba(34,197,94,0.3)",
        "glow-red":  "0 0 20px rgba(239,68,68,0.4)",
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
