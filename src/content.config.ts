import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// "Arbeiten" — case studies as JSON data (managed by Keystatic at /keystatic,
// or edit the .json files directly). Swap `cover` for a real image path when
// material lands; the placeholder visual is replaced automatically.
const Discipline = z.enum(['Foto', 'Film & Aerial', 'Web', 'KI']);

const cases = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    discipline: Discipline,
    year: z.number(),
    summary: z.string(),
    body: z.string().optional(),
    tags: z.array(z.string()).default([]),
    hue: z.number().default(200),
    format: z.enum(['portrait', 'landscape', 'square']).default('portrait'),
    cover: z.string().optional(),
    previews: z.array(z.string()).default([]),
    previewDummy: z.boolean().default(true),
    // Optional case-study depth (real projects): shown on /arbeiten/[id] when present.
    also: z.array(Discipline).default([]),
    url: z.string().nullable().optional(),
    stack: z.array(z.string()).default([]),
    highlightsTitle: z.string().nullable().optional(),
    signal: z.string().nullable().optional(), // phrase in the title marked with the signal colour
    highlights: z.array(z.object({ t: z.string(), d: z.string() })).default([]),
    loopTitle: z.string().nullable().optional(),
    loop: z.array(z.object({ t: z.string(), d: z.string() })).default([]),
    showcase: z
      .object({
        desktop: z.string().nullable().optional(),
        mobile: z.string().nullable().optional(),
        label: z.string().nullable().optional(),
        phones: z.array(z.string().nullable()).optional(),
        video: z.string().nullable().optional(),
        poster: z.string().nullable().optional(),
      })
      .optional(),
    demo: z.enum(['', 'soundscape']).nullable().optional(), // '' = Keystatic "Keine"
    status: z.enum(['', 'live', 'study']).nullable().optional(), // study = greyed note instead of a live link
    statusLabel: z.string().nullable().optional(),
    coverTone: z.enum(['', 'light', 'dark']).nullable().optional(), // dark image → light card text
    outlookTitle: z.string().nullable().optional(),
    outlookIntro: z.string().nullable().optional(),
    outlook: z.array(z.object({ t: z.string(), d: z.string() })).default([]),
    screens: z
      .array(z.object({ image: z.string().nullable(), device: z.enum(['desktop', 'mobile', 'image', 'wide']), caption: z.string().nullable().optional() }))
      .default([]),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { cases };
