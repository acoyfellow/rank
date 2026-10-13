export const rankConfig = {
  site: 'https://coey.dev',
  host: 'coey.dev',
  siteRepo: '../coey.dev',
  pageGroups: {
    prompts: '/prompts/',
    blog: '/blog/',
    projects: '/projects',
  },
  targetQueries: [
    'build backwards agent prompt',
    'agent prompt library',
    'ralph loop prompt',
    'effect-ts agent prompt',
    'cloudflare agent experiments',
  ],
  minWindowDays: 14,
} as const
