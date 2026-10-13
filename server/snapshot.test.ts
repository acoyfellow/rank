import { expect, test } from 'vitest'

import { bucket, isPage, toSource } from './snapshot'

test('counts under 5 are hidden', () => {
  expect([0, 1, 4, 5, 120].map(bucket)).toEqual([0, 0, 0, 5, 120])
})

test('scanner, asset and platform paths are not pages', () => {
  const noise = ['/.env', '/.env.local', '/cdn-cgi/rum', '/_app/x.js', '/rss.xml', '/wp-login.php']
  expect(noise.filter(isPage)).toEqual([])
  expect(['/', '/prompts/grill-me', '/blog/terraloop'].every(isPage)).toBe(true)
})

test('a source merges duplicate keys and drops rows that round to zero', () => {
  const source = toSource(
    'pages',
    'Pages',
    'GraphQL Analytics',
    [
      ['/a', 3],
      ['/a', 3],
      ['/b', 2],
    ],
    '2026-10-13T00:00:00Z',
  )
  expect(source.rows).toEqual([{ key: '/a', count: 6 }])
  expect(source.total).toBe(6)
})
