import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CapacityGrid } from './CapacityGrid'
import type { CapacityResponse } from './capacity'

const initial: CapacityResponse = {
  weeks: [{ start: '2025-12-29', end: '2026-01-04' }],
  people: [{ id: 1, name: 'Ana Ferreira', weeklyHours: 40, cells: [{ allocatedHours: 50 }] }],
}

// Minimal stand-ins for fetch Response — api.ts only touches ok/status/json/text.
const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
})
const textRes = (text: string, status: number) => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => text,
})

function renderGrid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CapacityGrid from="2025-12-29" to="2026-01-04" />
    </QueryClientProvider>,
  )
}

async function editTo(value: string) {
  const editButton = await screen.findByLabelText('Edit weekly hours for Ana Ferreira')
  fireEvent.click(editButton)
  const input = screen.getByLabelText('Weekly hours for Ana Ferreira')
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('CapacityGrid editing', () => {
  afterEach(() => vi.restoreAllMocks())

  it('rolls back to the old value and shows an error when the save fails', async () => {
    const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/capacity')) return Promise.resolve(jsonRes(initial))
      if (url.startsWith('/api/people/') && init?.method === 'PATCH') {
        // Delay so the optimistic value is observable before the rollback.
        return new Promise((resolve) => setTimeout(() => resolve(textRes('database is on fire', 500)), 150))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderGrid()
    await editTo('20')

    // Optimistic value appears immediately…
    await waitFor(() =>
      expect(screen.getByLabelText('Edit weekly hours for Ana Ferreira')).toHaveTextContent('20h'),
    )
    // …then the failed PATCH rolls it back and surfaces an error.
    await waitFor(() =>
      expect(screen.getByLabelText('Edit weekly hours for Ana Ferreira')).toHaveTextContent('40h'),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save')
    expect(fetchMock).toHaveBeenCalledWith('/api/people/1', expect.objectContaining({ method: 'PATCH' }))
  })

  it('keeps the new value and shows no error when the save succeeds', async () => {
    const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/capacity')) return Promise.resolve(jsonRes(initial))
      if (url.startsWith('/api/people/') && init?.method === 'PATCH') {
        return Promise.resolve(jsonRes({ id: 1, name: 'Ana Ferreira', weeklyHours: 20 }))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderGrid()
    await editTo('20')

    await waitFor(() =>
      expect(screen.getByLabelText('Edit weekly hours for Ana Ferreira')).toHaveTextContent('20h'),
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
