import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}))

import inquirer from 'inquirer'
import {
  SKILLS_PATH,
  SKILLS_REPO,
  SKILLS_SUBMODULE_PATH,
  extractSubmodulePath,
  isNestedSkillsPath,
  linkSkill,
  skillLinkPaths,
  unlinkSkills,
} from '../src/commands/add.js'
import { SKILL_NAME } from '../src/commands/config.js'

const mockPrompt = vi.mocked(
  inquirer.prompt as (...args: unknown[]) => Promise<unknown>
)

let tmpDir: string

async function seedSubmodule(at = SKILLS_SUBMODULE_PATH) {
  const root = path.join(tmpDir, at)
  await fs.ensureDir(path.join(root, SKILL_NAME))
  await fs.writeFile(
    path.join(root, SKILL_NAME, 'SKILL.md'),
    '---\nname: unoff-create-plugin\n---\n'
  )
  await fs.ensureDir(path.join(root, 'agents'))
  await fs.writeFile(path.join(root, 'README.md'), '# unoff-skills\n')
  return at
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unoff-skills-test-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.remove(tmpDir)
})

describe('SKILLS_SUBMODULE_PATH', () => {
  it('sits outside every assistant skills directory', () => {
    expect(isNestedSkillsPath(SKILLS_SUBMODULE_PATH)).toBe(false)
  })

  it('is not the path the assistants read the skill from', () => {
    expect(SKILLS_SUBMODULE_PATH).not.toBe(SKILLS_PATH)
  })
})

describe('isNestedSkillsPath()', () => {
  it('flags a checkout named after the skill — the old, broken layout', () => {
    expect(isNestedSkillsPath('.claude/skills/unoff-create-plugin')).toBe(true)
    expect(isNestedSkillsPath('.agents/skills/unoff-create-plugin')).toBe(true)
  })

  it('accepts a checkout outside the skills directories', () => {
    expect(isNestedSkillsPath('.unoff/skills')).toBe(false)
    expect(isNestedSkillsPath('vendor/unoff-skills')).toBe(false)
  })
})

describe('extractSubmodulePath()', () => {
  it('reads the checkout path for a repo URL', () => {
    const gitmodules = `[submodule ".unoff/skills"]
\tpath = .unoff/skills
\turl = ${SKILLS_REPO}
`
    expect(extractSubmodulePath(gitmodules, SKILLS_REPO)).toBe('.unoff/skills')
  })

  it('reads the path even when git kept the old section name after a move', () => {
    const gitmodules = `[submodule ".claude/skills/unoff-create-plugin"]
\tpath = .unoff/skills
\turl = ${SKILLS_REPO}
`
    expect(extractSubmodulePath(gitmodules, SKILLS_REPO)).toBe('.unoff/skills')
  })

  it('returns null when the repo is not registered', () => {
    expect(extractSubmodulePath('', SKILLS_REPO)).toBeNull()
  })
})

describe('skillLinkPaths()', () => {
  it('covers the canonical path and every assistant skills directory', () => {
    const paths = skillLinkPaths({
      assistants: ['claude', 'codex'],
      skillsPath: SKILLS_PATH,
    })
    expect(paths).toContain(path.join('.claude', 'skills', SKILL_NAME))
    expect(paths).toContain(path.join('.agents', 'skills', SKILL_NAME))
  })

  it('deduplicates when the canonical path is also an assistant directory', () => {
    const paths = skillLinkPaths({
      assistants: ['claude'],
      skillsPath: SKILLS_PATH,
    })
    expect(paths).toEqual([path.join('.claude', 'skills', SKILL_NAME)])
  })

  it('skips assistants that read no skills directory', () => {
    const paths = skillLinkPaths({
      assistants: ['cursor', 'copilot'],
      skillsPath: SKILLS_PATH,
    })
    expect(paths).toEqual([SKILLS_PATH])
  })
})

describe('linkSkill()', () => {
  it('puts SKILL.md exactly where the assistant looks, not one level deeper', async () => {
    const at = await seedSubmodule()
    const outcome = await linkSkill(tmpDir, at, SKILLS_PATH)

    expect(outcome).toBe('linked')
    expect(fs.existsSync(path.join(tmpDir, SKILLS_PATH, 'SKILL.md'))).toBe(true)
    expect(
      fs.existsSync(path.join(tmpDir, SKILLS_PATH, SKILL_NAME, 'SKILL.md'))
    ).toBe(false)
  })

  it('links relatively, so the repo stays portable', async () => {
    const at = await seedSubmodule()
    await linkSkill(tmpDir, at, SKILLS_PATH)

    const target = await fs.readlink(path.join(tmpDir, SKILLS_PATH))
    expect(path.isAbsolute(target)).toBe(false)
    expect(target).toBe(
      path.join('..', '..', SKILLS_SUBMODULE_PATH, SKILL_NAME)
    )
  })

  it('exposes the skill, never the repo root', async () => {
    const at = await seedSubmodule()
    await linkSkill(tmpDir, at, SKILLS_PATH)

    const entries = await fs.readdir(path.join(tmpDir, SKILLS_PATH))
    expect(entries).toContain('SKILL.md')
    expect(entries).not.toContain('README.md')
    expect(entries).not.toContain('agents')
  })

  it('is idempotent — relinking replaces the previous link', async () => {
    const at = await seedSubmodule()
    await linkSkill(tmpDir, at, SKILLS_PATH)
    const outcome = await linkSkill(tmpDir, at, SKILLS_PATH)

    expect(outcome).toBe('linked')
    expect(mockPrompt).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(tmpDir, SKILLS_PATH, 'SKILL.md'))).toBe(true)
  })

  it('skips when the submodule is registered but not cloned', async () => {
    const outcome = await linkSkill(tmpDir, SKILLS_SUBMODULE_PATH, SKILLS_PATH)
    expect(outcome).toBe('skipped')
  })

  it('asks before replacing a real directory, and leaves it alone on refusal', async () => {
    const at = await seedSubmodule()
    const existing = path.join(tmpDir, SKILLS_PATH)
    await fs.ensureDir(existing)
    await fs.writeFile(path.join(existing, 'SKILL.md'), 'hand-written\n')

    mockPrompt.mockResolvedValueOnce({ overwrite: false })
    const outcome = await linkSkill(tmpDir, at, SKILLS_PATH)

    expect(outcome).toBe('skipped')
    expect(await fs.readFile(path.join(existing, 'SKILL.md'), 'utf-8')).toBe(
      'hand-written\n'
    )
  })

  it('replaces a real directory once confirmed', async () => {
    const at = await seedSubmodule()
    await fs.ensureDir(path.join(tmpDir, SKILLS_PATH))
    await fs.writeFile(path.join(tmpDir, SKILLS_PATH, 'stale.md'), 'old\n')

    mockPrompt.mockResolvedValueOnce({ overwrite: true })
    const outcome = await linkSkill(tmpDir, at, SKILLS_PATH)

    expect(outcome).toBe('linked')
    expect(fs.existsSync(path.join(tmpDir, SKILLS_PATH, 'stale.md'))).toBe(
      false
    )
  })
})

describe('unlinkSkills()', () => {
  it('removes the links it created', async () => {
    const at = await seedSubmodule()
    const links = skillLinkPaths({
      assistants: ['claude', 'codex'],
      skillsPath: SKILLS_PATH,
    })
    for (const link of links) await linkSkill(tmpDir, at, link)

    const removed = await unlinkSkills(tmpDir, links)

    expect(removed.sort()).toEqual(links.sort())
    for (const link of links) {
      expect(fs.existsSync(path.join(tmpDir, link))).toBe(false)
    }
  })

  it('leaves the submodule itself in place', async () => {
    const at = await seedSubmodule()
    await linkSkill(tmpDir, at, SKILLS_PATH)
    await unlinkSkills(tmpDir, [SKILLS_PATH])

    expect(fs.existsSync(path.join(tmpDir, at, SKILL_NAME, 'SKILL.md'))).toBe(
      true
    )
  })

  it('never deletes a real directory it did not create', async () => {
    const own = path.join(tmpDir, SKILLS_PATH)
    await fs.ensureDir(own)
    await fs.writeFile(path.join(own, 'SKILL.md'), 'hand-written\n')

    const removed = await unlinkSkills(tmpDir, [SKILLS_PATH])

    expect(removed).toEqual([])
    expect(fs.existsSync(path.join(own, 'SKILL.md'))).toBe(true)
  })
})
