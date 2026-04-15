import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const skillsRoot = path.join(ROOT, 'skills')
const requiredContentSkillReferences = [
  '../_shared/content-authoring-rules.md',
  '../_shared/content-authoring-playbook.md',
  '../_shared/content-module-reference.md'
]

function parseFrontmatter(markdown, file) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  assert(match, `${file} is missing YAML frontmatter.`)

  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf(':')
    assert(separatorIndex > 0, `${file} has an invalid frontmatter line: ${trimmed}`)
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    data[key] = value
  }
  return data
}

function parseSimpleYaml(yamlText) {
  const data = {}
  for (const line of yamlText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf(':')
    if (separatorIndex <= 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    data[key] = value
  }
  return data
}

function extractMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1].trim())
}

async function assertFileExists(filePath, message) {
  const fileStat = await stat(filePath).catch(() => null)
  assert(fileStat?.isFile(), message)
}

const skillEntries = await readdir(skillsRoot, { withFileTypes: true })
const skillDirs = skillEntries
  .filter(entry => entry.isDirectory() && entry.name !== '_shared')
  .map(entry => entry.name)
  .sort()

assert(skillDirs.length > 0, 'No local skills were found.')

for (const dirName of skillDirs) {
  const skillPath = path.join(skillsRoot, dirName)
  const skillFile = path.join(skillPath, 'SKILL.md')
  const agentFile = path.join(skillPath, 'agents', 'openai.yaml')

  assert((await stat(skillFile)).isFile(), `${skillFile} is missing.`)
  assert((await stat(agentFile)).isFile(), `${agentFile} is missing.`)

  const skillMarkdown = await readFile(skillFile, 'utf8')
  const frontmatter = parseFrontmatter(skillMarkdown, skillFile)
  assert.equal(frontmatter.name, dirName, `${skillFile} frontmatter name must match the folder name.`)
  assert.equal(typeof frontmatter.description, 'string', `${skillFile} must include a description.`)
  assert.ok(frontmatter.description.trim().length > 0, `${skillFile} description must not be empty.`)
  assert(skillMarkdown.includes('## Scope'), `${skillFile} must define a Scope section.`)
  assert(
    skillMarkdown.includes('## Few-Shot') || skillMarkdown.includes('## Workflow'),
    `${skillFile} must define a Few-Shot or Workflow section.`
  )

  const links = extractMarkdownLinks(skillMarkdown)
  for (const link of links) {
    if (!link || /^(https?:|mailto:|#)/u.test(link)) continue
    const normalizedLink = link.split('#')[0]
    if (!normalizedLink) continue
    await assertFileExists(
      path.resolve(path.dirname(skillFile), normalizedLink),
      `${skillFile} references a missing file: ${link}`
    )
  }

  if (dirName !== 'discussion-to-blog') {
    for (const requiredLink of requiredContentSkillReferences) {
      assert(
        skillMarkdown.includes(`](${requiredLink})`),
        `${skillFile} must reference ${requiredLink}.`
      )
    }
  } else {
    assert(
      skillMarkdown.includes('](./references/blog-authoring-reference.md)'),
      `${skillFile} must reference ./references/blog-authoring-reference.md.`
    )
  }

  const agentYaml = parseSimpleYaml(await readFile(agentFile, 'utf8'))
  assert.equal(agentYaml.version, '1', `${agentFile} must declare version 1.`)
  for (const key of ['display_name', 'short_description', 'default_prompt']) {
    assert.equal(typeof agentYaml[key], 'string', `${agentFile} must define ${key}.`)
    assert.ok(agentYaml[key].trim().length > 0, `${agentFile} ${key} must not be empty.`)
  }
  if (dirName === 'discussion-to-blog') {
    assert(
      /blog-publisher/u.test(agentYaml.default_prompt),
      `${agentFile} default_prompt must mention blog-publisher.`
    )
  } else {
    assert(
      /content-admin/u.test(agentYaml.default_prompt),
      `${agentFile} default_prompt must mention content-admin.`
    )
    assert(
      /verify/u.test(agentYaml.default_prompt),
      `${agentFile} default_prompt should mention verification.`
    )
  }
}

console.log(`Validated ${skillDirs.length} local skills.`)
