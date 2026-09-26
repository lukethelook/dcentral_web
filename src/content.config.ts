import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// "Arbeiten" — case studies as JSON data (managed by Keystatic at /keystatic,
// or edit the .json files directly). Swap `cover` for a real image path when
// material lands; the placeholder visual is replaced automatically.
const cases = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    discipline: z.enum(['Foto', 'Film & Aerial', 'Web', 'KI']),
    year: z.number(),
    summary: z.string(),
    body: z.string().optional(),
    tags: z.array(z.string()).default([]),
    hue: z.number().default(200),
    format: z.enum(['portrait', 'landscape', 'square']).default('portrait'),
    cover: z.string().optional(),
    previews: z.array(z.string()).default([]),
    previewDummy: z.boolean().default(true),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { cases };
