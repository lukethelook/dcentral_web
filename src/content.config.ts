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
        vimeo: z.string().nullable().optional(), // Vimeo ID → cinema stage with click-to-load player
        youtube: z.string().nullable().optional(), // YouTube ID (loaded via youtube-nocookie on click)
        loop: z.string().nullable().optional(), // muted background film for the cinema stage
        vimeoLabel: z.string().nullable().optional(),
        slides: z.array(z.string().nullable()).optional(),
        poster: z.string().nullable().optional(),
      })
      .optional(),
    // Case gallery (Elastic Gallery on the project page): photos picked from the
    // library (ids) and/or images uploaded directly to the case.
    galleryTitle: z.string().nullable().optional(),
    galleryPhotos: z.array(z.string().nullable()).default([]),
    gallery: z.array(z.object({ image: z.string().nullable(), title: z.string().nullable().optional(), alt: z.string().nullable().optional() })).default([]),
    demo: z.enum(['', 'soundscape', 'network', 'atom']).nullable().optional(), // '' = Keystatic "Keine"
    status: z.enum(['', 'live', 'study']).nullable().optional(), // study = greyed note instead of a live link
    statusLabel: z.string().nullable().optional(),
    clientLabel: z.string().nullable().optional(), // e.g. „Auftrag: Quantiflux" on the case page
    scope: z.array(z.string()).default([]), // full scope, shown as „Umfang"
    shown: z.array(z.object({ place: z.string(), year: z.string() })).default([]), // exhibitions
    stackTitle: z.string().nullable().optional(),
    panoramaTitle: z.string().nullable().optional(),
    panoramas: z.array(z.object({ image: z.string().nullable(), title: z.string() })).default([]),
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

// Photography library: shown on /fotografie and (featured) in the homepage module.
const photos = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/photos' }),
  schema: z.object({
    image: z.string(),
    title: z.string().nullable().optional(), // short title shown in galleries (fallback: alt)
    thumb: z.string().nullable().optional(),
    alt: z.string(),
    series: z.string().default('Fotografie'),
    project: z.string().nullable().optional(), // case id, links the photo to its project
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { cases, photos };
