/**
 * The single timeline dataset every timeline on the website renders.
 * Same data, different presentation — that is the library's whole pitch,
 * so the site must not duplicate this per variant.
 *
 * The content walks through the modern AI industry's defining moments,
 * from ImageNet to today's agents; the `examples/` pages carry the same
 * ten entries in their hardcoded markup.
 *
 * `icon` is inline SVG markup (Lucide paths, ISC-licensed) placed inside
 * the date link; the library's stylesheet pins it to the medallion disc.
 * Only the `list` / `list-alternating` variants render it.
 */
export interface TimelineEntry {
  year: string;
  title: string;
  text: string;
  image: string;
  alt: string;
  icon: string;
}

export const TIMELINE: TimelineEntry[] = [
  {
    year: '2010',
    title: 'ImageNet arrives',
    text: 'The ImageNet challenge put a million labelled photos online, and neural networks finally had enough data to start winning.',
    image: 'https://picsum.photos/seed/timelinr-1/480/320',
    alt: 'ImageNet arrives',
    icon: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  },
  {
    year: '2012',
    title: 'The AlexNet moment',
    text: 'A deep network trained on gaming GPUs won the ImageNet challenge by a wide margin, and the deep learning boom began almost overnight.',
    image: 'https://picsum.photos/seed/timelinr-2/480/320',
    alt: 'The AlexNet moment',
    icon: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  },
  {
    year: '2014',
    title: 'Machines learn to imagine',
    text: 'Generative adversarial networks pitted two models against each other, producing faces and pictures that nobody had programmed.',
    image: 'https://picsum.photos/seed/timelinr-3/480/320',
    alt: 'Machines learn to imagine',
    icon: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  },
  {
    year: '2016',
    title: 'AlphaGo defeats Lee Sedol',
    text: 'DeepMind’s AlphaGo beat the world Go champion 4–1 in Seoul, mastering a game long thought too intuitive for machines.',
    image: 'https://picsum.photos/seed/timelinr-4/480/320',
    alt: 'AlphaGo defeats Lee Sedol',
    icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  },
  {
    year: '2017',
    title: 'The transformer arrives',
    text: 'The paper “Attention Is All You Need” introduced the transformer, the architecture every large language model still builds on.',
    image: 'https://picsum.photos/seed/timelinr-5/480/320',
    alt: 'The transformer arrives',
    icon: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  },
  {
    year: '2020',
    title: 'Scale changes everything',
    text: 'GPT-3 reached 175 billion parameters and wrote passable prose, while AlphaFold predicted protein structures with near-laboratory accuracy.',
    image: 'https://picsum.photos/seed/timelinr-6/480/320',
    alt: 'Scale changes everything',
    icon: '<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
  },
  {
    year: '2022',
    title: 'ChatGPT goes mainstream',
    text: 'A free research preview reached a million users in five days and put generative AI in front of the general public for the first time.',
    image: 'https://picsum.photos/seed/timelinr-7/480/320',
    alt: 'ChatGPT goes mainstream',
    icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  },
  {
    year: '2023',
    title: 'Frontier models, open weights',
    text: 'GPT-4 went multimodal, Meta released Llama 2 for anyone to download, and EU lawmakers agreed the world’s first comprehensive AI act.',
    image: 'https://picsum.photos/seed/timelinr-8/480/320',
    alt: 'Frontier models, open weights',
    icon: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  },
  {
    year: '2024',
    title: 'Reasoning earns recognition',
    text: 'Models learned to think step by step before answering, and the Nobel committee honoured neural-network pioneers in physics and chemistry.',
    image: 'https://picsum.photos/seed/timelinr-9/480/320',
    alt: 'Reasoning earns recognition',
    icon: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>',
  },
  {
    year: '2026',
    title: 'Agents become coworkers',
    text: 'AI systems now plan, browse and execute multi-step work on their own, and the debate has shifted from what models know to what they should be allowed to do.',
    image: 'https://picsum.photos/seed/timelinr-10/480/320',
    alt: 'Agents become coworkers',
    icon: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  },
];

export type TimelineVariant = 'rail' | 'stack' | 'tabs' | 'list' | 'list-alternating';
