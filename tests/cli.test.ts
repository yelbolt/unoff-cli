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

describe('unoff sync', () => {
  it('exposes specs and skills as subcommands', () => {
    const result = runCLI(['sync', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('specs')
    expect(result.stdout).toContain('skills')
  })

  it('takes an optional specs directory', () => {
    const result = runCLI(['sync', 'specs', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[dir]')
  })

  it('is listed in the top-level help', () => {
    const result = runCLI(['--help'])
    expect(result.stdout).toContain('sync')
  })
})

describe('unoff specs sync (deprecated)', () => {
  it('still resolves, so existing scripts keep working', () => {
    const result = runCLI(['specs', 'sync', '--help'])
    expect(result.status).toBe(0)
  })

  it('is hidden from the top-level help', () => {
    const result = runCLI(['--help'])
    expect(result.stdout).not.toMatch(/^\s+specs\b/m)
  })
})
