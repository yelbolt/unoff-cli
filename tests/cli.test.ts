import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.resolve(__dirname, '../dist/cli.js')

function runCLI(args: string[]) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

describe('unoff add worker <name>', () => {
  it('exits with code 1 and reports an unknown worker', () => {
    const result = runCLI(['add', 'worker', 'nonexistent-worker'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Unknown worker')
  })

  it('lists available workers in error output', () => {
    const result = runCLI(['add', 'worker', 'bad-name'])
    expect(result.stderr).toMatch(/announcement|auth|cors/)
  })
})

describe('unoff remove worker <name>', () => {
  it('exits with code 1 and reports an unknown worker', () => {
    const result = runCLI(['remove', 'worker', 'nonexistent-worker'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Unknown worker')
  })
})
