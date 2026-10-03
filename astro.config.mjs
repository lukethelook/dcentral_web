// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// Visual gallery editor (/cms/galerien): drag & drop galleries, uploads, homepage
// photo order. Locally it writes the files; online it commits through GitHub with
// the Keystatic login (src/cms/api.ts). Same JSON files as Keystatic.
const galleryEditor = {
  name: 'dcentral-gallery-editor',
  hooks: {
    'astro:config:setup': ({ injectRoute, updateConfig }) => {
      // the branch this deployment was built from = the branch the editor commits to
      updateConfig({ vite: { define: { __CMS_BRANCH__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF || '') } } });
      injectRoute({ pattern: '/cms/galerien', entrypoint: './src/cms/galerien.astro', prerender: false });
      injectRoute({ pattern: '/api/cms/[action]', entrypoint: './src/cms/api.ts', prerender: false });
    },
  },
};

// Public pages stay static/prerendered (fast, JS-light). Keystatic's admin UI
// (/keystatic) + its API route run on-demand via the Vercel adapter, so content
// can be edited from anywhere in the browser. Edits commit to GitHub → Vercel
// rebuilds automatically.
export default defineConfig({
  site: 'https://www.dcentral.at',
  output: 'static',
  adapter: vercel(),
  integrations: [
    react(),
    keystatic(),
    galleryEditor,
    sitemap({ filter: (page) => !page.includes('/keystatic') && !page.includes('/api/') && !page.includes('/cms/') }),
  ],
});
