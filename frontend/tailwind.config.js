/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0f172a',       // slate-900 core background
          deep: '#020617',     // slate-955 extra deep canvas
          teal: '#0ea5e9',     // primary corporate teal
          emerald: '#10b981',  // high health score emerald-500
          rose: '#f43f5e',     // data anomalies/errors rose-500
          accent: '#3b82f6',   // interactive elements blue-500
          border: 'rgba(255, 255, 255, 0.08)' // glassy card thin border
        }
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        glow: '0 0 20px rgba(14, 165, 233, 0.15)'
      },
      backdropBlur: {
        glass: '16px'
      }
    },
  },
  plugins: [],
}
