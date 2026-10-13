import { AsyncData } from 'foldkit'
import { Command, given, message, model, story } from 'foldkit/story'
import { expect, test } from 'vitest'

import {
  FetchSnapshot,
  Message,
  type Model,
  SnapshotAsyncData,
  init,
  update,
} from './main'
import type { Snapshot } from './snapshot'

const loading: Model = { snapshot: SnapshotAsyncData.Loading() }

const snapshot: Snapshot = {
  site: 'coey.dev',
  generatedAt: '2026-10-13T12:00:00Z',
  window: { from: '2026-10-06', to: '2026-10-13' },
  sources: [
    {
      id: 'pages',
      label: 'Human page requests by path',
      product: 'GraphQL Analytics',
      fetchedAt: '2026-10-13T12:00:00Z',
      total: 120,
      rows: [{ key: '/prompts/grill-me', count: 120 }],
    },
  ],
  experiments: [],
}

test('a fetched snapshot becomes the loaded dashboard', () => {
  story(
    update,
    given(loading),
    message(Message.SucceededFetchSnapshot({ snapshot })),
    model(next => {
      expect(AsyncData.isSuccess(next.snapshot)).toBe(true)
    }),
  )
})

test('a failed fetch shows the reason', () => {
  story(
    update,
    given(loading),
    message(Message.FailedFetchSnapshot({ error: 'The data endpoint did not answer.' })),
    model(next => {
      expect(next.snapshot).toEqual(
        SnapshotAsyncData.Failure({ error: 'The data endpoint did not answer.' }),
      )
    }),
    Command.expectNone(),
  )
})

test('the page starts loading and asks for the snapshot once', () => {
  const start = init()
  expect(start.model.snapshot).toEqual(SnapshotAsyncData.Loading())
  expect(start.commands?.map(command => command.name)).toEqual([FetchSnapshot.name])
})
