#!/usr/bin/env node
// Release flow for a protected main branch (changes reach main only via PR).
//
//   node scripts/release.mjs patch|minor|major
//     lint → test → build → bump version on a release/vX.Y.Z branch → push → open PR
//
//   node scripts/release.mjs tag
//     after the release PR is merged: tag the current origin/main as vX.Y.Z and push the tag

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const BUMPS = ['patch', 'minor', 'major']

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' })
}

function out(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim()
}

function fail(message) {
  console.error(`release: ${message}`)
  process.exit(1)
}

function readVersion() {
  return JSON.parse(readFileSync('package.json', 'utf8')).version
}

function ensureCleanMainInSync() {
  if (out('git', ['branch', '--show-current']) !== 'main') fail('switch to main first')
  if (out('git', ['status', '--porcelain'])) fail('working tree is not clean')
  run('git', ['pull', '--ff-only', 'origin', 'main'])
}

function tagExists(tag) {
  const local = out('git', ['tag', '--list', tag])
  const remote = out('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`])
  return Boolean(local || remote)
}

function startRelease(bump) {
  ensureCleanMainInSync()

  run('npm', ['run', 'lint'])
  run('npm', ['test'])
  run('npm', ['run', 'build'])

  run('npm', ['version', bump, '--no-git-tag-version'])
  const tag = `v${readVersion()}`
  if (tagExists(tag)) fail(`tag ${tag} already exists`)

  const branch = `release/${tag}`
  const title = `chore(release): ${tag}`
  run('git', ['switch', '-c', branch])
  run('git', ['commit', '-m', title, '--', 'package.json', 'package-lock.json'])
  run('git', ['push', '-u', 'origin', branch])
  run('gh', ['pr', 'create', '--base', 'main', '--head', branch, '--title', title,
    '--body', `Bump version to ${tag}. After merging, run \`npm run release:tag\`.`])
  run('git', ['switch', 'main'])

  console.log(`\nRelease PR for ${tag} is open. Merge it, then run: npm run release:tag`)
}

function tagRelease() {
  ensureCleanMainInSync()

  const tag = `v${readVersion()}`
  if (tagExists(tag)) fail(`tag ${tag} already exists — was the release PR merged and pulled?`)

  run('git', ['tag', '-a', tag, '-m', tag.slice(1)])
  run('git', ['push', 'origin', tag])
  // The local release branch may already be gone (e.g. `gh pr merge --delete-branch`).
  if (out('git', ['branch', '--list', `release/${tag}`])) {
    run('git', ['branch', '--delete', '--force', `release/${tag}`])
  }

  console.log(`\nTagged ${tag}.`)
}

const command = process.argv[2]
if (BUMPS.includes(command)) startRelease(command)
else if (command === 'tag') tagRelease()
else fail(`usage: node scripts/release.mjs <${BUMPS.join('|')}|tag>`)
