import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The production build is served from a GitHub Pages project path
// (https://<user>.github.io/chronos-calendar/), so assets need that base.
// Dev keeps "/" for a clean localhost experience.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/chronos-calendar/' : '/',
  plugins: [react()],
}))
