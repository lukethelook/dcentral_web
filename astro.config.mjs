// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import vercel from '@astrojs/vercel';

// Public pages stay static/prerendered (fast, JS-light). Keystatic's admin UI
// (/keystatic) + its API route run on-demand via the Vercel adapter, so content
// can be edited from anywhere in the browser. Edits commit to GitHub → Vercel
// rebuilds automatically.
export default defineConfig({
  site: 'https://www.dcentral.at',
  output: 'static',
  adapter: vercel(),
  integrations: [react(), keystatic()],
  vite: {
    plugins: [tailwindcss()],
  },
});
