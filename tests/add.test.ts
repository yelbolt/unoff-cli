import { describe, it, expect } from 'vitest'
import {
  WORKERS,
  WORKER_SCRIPTS,
  SKILLS_REPO,
  toTitleCase,
} from '../src/commands/add.js'

// Re-import SPEC_TEMPLATE by reading it indirectly through the module
// (it's not exported — we test its output via addSpecs integration tests)

describe('WORKERS', () => {
  it('has exactly 3 entries', () => {
    expect(Object.keys(WORKERS)).toHaveLength(3)
  })

  it('has the expected keys', () => {
    expect(WORKERS).toHaveProperty('announcement')
    expect(WORKERS).toHaveProperty('auth')
    expect(WORKERS).toHaveProperty('cors')
  })

  it('maps to the correct GitHub URLs', () => {
    expect(WORKERS['announcement']).toBe(
      'https://github.com/a-ng-d/announcements-yelbolt-worker'
    )
    expect(WORKERS['auth']).toBe(
      'https://github.com/a-ng-d/auth-yelbolt-worker'
    )
    expect(WORKERS['cors']).toBe(
      'https://github.com/a-ng-d/cors-yelbolt-worker'
    )
  })
})

describe('WORKER_SCRIPTS', () => {
  it('has the same keys as WORKERS', () => {
    expect(Object.keys(WORKER_SCRIPTS).sort()).toEqual(
      Object.keys(WORKERS).sort()
    )
  })

  it('announcement has start:announcements on port 8888', () => {
    expect(WORKER_SCRIPTS['announcement']).toHaveProperty('start:announcements')
    expect(WORKER_SCRIPTS['announcement']['start:announcements']).toContain(
      '8888'
    )
  })

  it('auth has start:token on port 8787', () => {
    expect(WORKER_SCRIPTS['auth']).toHaveProperty('start:token')
    expect(WORKER_SCRIPTS['auth']['start:token']).toContain('8787')
  })

  it('cors has start:cors on port 8989', () => {
    expect(WORKER_SCRIPTS['cors']).toHaveProperty('start:cors')
    expect(WORKER_SCRIPTS['cors']['start:cors']).toContain('8989')
  })
})

describe('SKILLS_REPO', () => {
  it('points to yelbolt/unoff-skills', () => {
    expect(SKILLS_REPO).toBe('https://github.com/yelbolt/unoff-skills')
  })
})

describe('toTitleCase', () => {
  it('converts a single kebab-case word', () => {
    expect(toTitleCase('spec')).toBe('Spec')
  })

  it('converts a multi-word kebab-case string', () => {
    expect(toTitleCase('my-spec')).toBe('My Spec')
    expect(toTitleCase('hello-world')).toBe('Hello World')
  })

  it('handles multiple hyphens', () => {
    expect(toTitleCase('a-b-c')).toBe('A B C')
  })
})
