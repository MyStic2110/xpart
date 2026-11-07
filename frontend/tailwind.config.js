/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
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
        accentUI: {
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
        charcoal: {
          950: "#0a0b0d",
          900: "#121316",
          800: "#1a1c20",
          700: "#26292e",
          600: "#34373d",
        },
        slate: {
          400: "#9298a3",
          300: "#b3b8c2",
          200: "#d4d7dd",
          100: "#e8eaed",
          50: "#f5f6f7",
        },
        accent: {
          600: "#2952e3",
          500: "#3b66f5",
          400: "#5e80f7",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,11,13,0.04), 0 8px 24px rgba(10,11,13,0.06)",
        elevated: "0 4px 12px rgba(10,11,13,0.08), 0 16px 40px rgba(10,11,13,0.10)",
      },
      borderRadius: {
        xl2: "1rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease-out",
        slideUp: "slideUp 0.45s ease-out",
      },
    },
  },
  plugins: [],
};
