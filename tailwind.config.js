/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0F172A",
        card: "#1E293B",
        accent: "#2563EB",
        accentHover: "#1D4ED8",
        statusGreen: "#22C55E",
        statusYellow: "#FACC15",
        statusOrange: "#FB923C",
        statusRed: "#EF4444",
        secondaryText: "#94A3B8",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
        glowRed: "0 0 20px rgba(239, 68, 68, 0.5)",
        glowBlue: "0 0 20px rgba(37, 99, 235, 0.5)",
        glowGreen: "0 0 20px rgba(34, 197, 94, 0.5)",
      },
      animation: {
        pulseFast: "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
