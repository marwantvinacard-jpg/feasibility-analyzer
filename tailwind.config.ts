import type { Config } from "tailwindcss";

/**
 * FeasibilityAI — "Ledger" design tokens.
 * Editorial-analyst system: warm paper light theme + warm-charcoal dark, a cobalt
 * brand accent (deliberately non-green so it never reads as a score), and the fixed
 * semantic score trio go/warn/stop (GO / conditional / NO-GO). Serif display +
 * monospace numerals. All colors are CSS variables (globals.css) so one token set
 * drives both themes.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-2": "rgb(var(--brand-2) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        go: "rgb(var(--go) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        stop: "rgb(var(--stop) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      borderRadius: {
        lg: "0.6rem",
        xl: "0.85rem",
        "2xl": "1.1rem",
      },
      boxShadow: {
        card: "0 1px 1px rgb(30 26 20 / 0.04), 0 6px 20px -12px rgb(30 26 20 / 0.18)",
        lift: "0 2px 4px rgb(30 26 20 / 0.05), 0 16px 40px -18px rgb(30 26 20 / 0.28)",
        focus: "0 0 0 3px rgb(var(--brand) / 0.28)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
