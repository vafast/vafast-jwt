import { describe, expect, it } from 'vitest'
import { jwt } from '../dist/index.mjs'

describe('package entry', () => {
  it('exports jwt factory from built dist entry', () => {
    expect(typeof jwt).toBe('function')

    const middleware = jwt({
      name: 'jwt',
      secret: 'entry-test-secret',
    })

    expect(typeof middleware).toBe('function')
  })
})
