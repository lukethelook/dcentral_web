// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';

// Visual gallery editor (/cms/galerien): drag & drop galleries, uploads, homepage
// photo order. Locally it writes the files; online it commits through GitHub with
// the Keystatic login (src/cms/api.ts). Same JSON files as Keystatic.
const galleryEditor = {
  name: 'dcentral-gallery-editor',
  hooks: {
    'astro:config:setup': ({ injectRoute, updateConfig }) => {
      // the branch this deployment was built from = the branch the editor commits to
      updateConfig({ vite: { define: { __CMS_BRANCH__: JSON.stringify(process.env.CMS_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || '') } } });
      injectRoute({ pattern: '/cms/galerien', entrypoint: './src/cms/galerien.astro', prerender: false });
      injectRoute({ pattern: '/api/cms/[action]', entrypoint: './src/cms/api.ts', prerender: false });
    },
  },
};

// Public pages stay static/prerendered (fast, JS-light). Keystatic's admin UI
// (/keystatic), the gallery editor and their API routes run on-demand, so content
// can be edited from anywhere in the browser. Edits commit to GitHub → the host
// rebuilds automatically. Hosting: Hostinger Node.js app (standalone server,
// `npm start`); on Vercel (preview deployments) the Vercel adapter is used.
export default defineConfig({
  site: 'https://www.dcentral.at',
  output: 'static',
  adapter: process.env.VERCEL ? vercel() : node({ mode: 'standalone' }),
  server: { host: true },
  // Hinter dem Hostinger-Proxy läuft Node intern auf einem eigenen Port. Ohne diese
  // Liste vertraut Astro (ab v7) den X-Forwarded-*-Headern nicht und baut URLs wie
  // https://www.dcentral.at:4321 – das bricht u. a. den Keystatic-GitHub-Login
  // (redirect_uri). Nur diese Domains dürfen Host/Proto/Port der Request-URL setzen.
  security: {
    allowedDomains: [
      { hostname: 'www.dcentral.at', protocol: 'https' },
      { hostname: 'dcentral.at', protocol: 'https' },
    ],
  },
  integrations: [
    react(),
    keystatic(),
    galleryEditor,
    sitemap({ filter: (page) => !page.includes('/keystatic') && !page.includes('/api/') && !page.includes('/cms/') }),
  ],
});
