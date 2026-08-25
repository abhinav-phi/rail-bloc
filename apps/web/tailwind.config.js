/** Tailwind theme maps Design.md §2 tokens 1:1. CommonJS for guaranteed loader compat. */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0B111E",
        "bg-surface": "#151E2E",
        "border-subtle": "#2D3748",
        "text-primary": "#F8FAFC",
        "text-secondary": "#94A3B8",
        "accent-civil": "#F59E0B",
        "accent-trd": "#0EA5E9",
        "accent-sig": "#10B981",
        "status-active": "#059669",
        "status-blocked": "#DC2626",
        "status-caution": "#D97706",
        "status-stale": "#6B7280",
        "status-provisional": "#8B5CF6",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
