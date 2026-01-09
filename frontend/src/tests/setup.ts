import { vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((msg) => {
    throw new Error(`Error found in console: ${msg}`)
  })

  vi.spyOn(console, 'warn').mockImplementation((msg) => {
    throw new Error(`Warning found in console: ${msg}`)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
