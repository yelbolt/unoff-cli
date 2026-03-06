import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

// Mock inquirer before importing the commands
vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}))

import inquirer from 'inquirer'
import { addSpecs } from '../src/commands/add.js'
import { removeSpecs } from '../src/commands/remove.js'

const mockPrompt = vi.mocked(inquirer.prompt as (...args: unknown[]) => Promise<unknown>)

// Sentinel error to distinguish process.exit calls from real errors
class ProcessExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`)
  }
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unoff-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
    throw new ProcessExitError(code ?? 0)
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.remove(tmpDir)
})

describe('addSpecs()', () => {
  it('creates the spec file with correct frontmatter and content', async () => {
    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ specName: 'my-feature' })

    await addSpecs()

    const filePath = path.join(tmpDir, 'specs', 'my-feature.md')
    expect(fs.existsSync(filePath)).toBe(true)

    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('name: my-feature')
    expect(content).toContain('description:')
    expect(content).toContain('# My Feature')
  })

  it('creates nested folder if it does not exist', async () => {
    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'deep/nested/specs' })
      .mockResolvedValueOnce({ specName: 'test-spec' })

    await addSpecs()

    const filePath = path.join(tmpDir, 'deep', 'nested', 'specs', 'test-spec.md')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('calls process.exit(1) if spec file already exists', async () => {
    const specsPath = path.join(tmpDir, 'specs')
    await fs.ensureDir(specsPath)
    await fs.writeFile(path.join(specsPath, 'existing.md'), '# existing')

    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ specName: 'existing' })

    await expect(addSpecs()).rejects.toThrow(ProcessExitError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('removeSpecs()', () => {
  it('removes the specs folder when confirmed', async () => {
    const specsPath = path.join(tmpDir, 'specs')
    await fs.ensureDir(specsPath)
    await fs.writeFile(path.join(specsPath, 'a.md'), '# a')

    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ confirm: true })

    await removeSpecs()

    expect(fs.existsSync(specsPath)).toBe(false)
  })

  it('does not remove the folder when cancelled', async () => {
    const specsPath = path.join(tmpDir, 'specs')
    await fs.ensureDir(specsPath)

    mockPrompt
      .mockResolvedValueOnce({ specsDir: 'specs' })
      .mockResolvedValueOnce({ confirm: false })

    await expect(removeSpecs()).rejects.toThrow(ProcessExitError)
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(fs.existsSync(specsPath)).toBe(true)
  })

  it('calls process.exit(1) if folder does not exist', async () => {
    mockPrompt.mockResolvedValueOnce({ specsDir: 'nonexistent' })

    await expect(removeSpecs()).rejects.toThrow(ProcessExitError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
