# Contributing

Thanks for helping out. This is a small package — you can read the whole thing
in an afternoon — so don't be put off by the length of this file.

Everything here assumes you've contributed to few or no open source projects
before. If you've done this a hundred times, skip to
[Commit messages](#commit-messages), which is the one part of this repo that
isn't standard.

## The short version

1. Find or open an issue. Say you'd like to work on it.
2. Fork the repo, clone your fork, make a branch.
3. Make the change. Run `npm test`.
4. Commit using [Conventional Commits](#commit-messages) — the prefix decides
   the released version number.
5. Push to your fork, open a pull request.
6. Respond to review comments. Once merged, it publishes to npm automatically.

The rest of this file is those steps in detail.

---

## Before you write code

**Every change starts with an issue.** It's a couple of minutes and it saves
you from building something that gets turned down.

- **Found a bug?** [Open an issue](https://github.com/subash9860/openapi-op/issues/new).
  Include what you expected, what happened instead, and the smallest example
  that shows it. A snippet of the OpenAPI spec that triggers it is gold.
- **Want a new feature?** Open an issue describing the problem you're hitting,
  not just the solution you have in mind. Often there's already a way to do it,
  or a smaller change that solves the same thing.
- **Want to work on an existing issue?** Comment on it saying so, and wait for
  a reply before starting. That's just to make sure two people don't build the
  same thing, and that the approach is agreed before you spend an evening on
  it. It's normal to keep asking questions in the issue while you work.

Small, obvious fixes — a typo, a broken link, a wrong code sample — can skip
straight to a PR. No issue needed.

## Setting up

Node 18 or newer (CI runs 24).

**1. Fork the repo.** Click "Fork" on
[the GitHub page](https://github.com/subash9860/openapi-op). That gives you
your own copy to push to, since you won't have write access to this one.

**2. Clone your fork and install:**

```bash
git clone https://github.com/YOUR-USERNAME/openapi-op.git
cd openapi-op
npm ci
npm test
```

If `npm test` passes, you're set up correctly.

**3. Add the original repo as a second remote**, so you can pull in changes
other people make while you work:

```bash
git remote add upstream https://github.com/subash9860/openapi-op.git
```

Now `origin` is your fork (you push there) and `upstream` is this repo (you
pull from there).

## Branch naming

Branch off an up-to-date `main`, never off another feature branch:

```bash
git checkout main
git pull upstream main
git checkout -b fix/cookie-credentials
```

Name branches `<type>/<short-description>`, using the same types as commits:

```
feat/custom-fetcher
fix/cookie-credentials
docs/contributing-guide
refactor/drop-endpoint-cache
test/args-optional-query
```

Rules:

- **lowercase, words separated by hyphens** — `fix/cookie-credentials`, not
  `fix/Cookie_Credentials`
- **describe the change, not the file** — `fix/cookie-credentials` beats
  `fix/index-ts`
- **keep it short** — three or four words is plenty
- **one branch per issue.** If you find a second unrelated bug while working,
  branch again from `main` for it. Two unrelated fixes in one PR are harder to
  review and can't be reverted separately.
- **you may prefix the issue number** if you find it helpful:
  `fix/12-cookie-credentials`. Optional.

Never commit directly to `main`. It makes everything afterwards harder.

## Commit messages

This repo follows [Conventional Commits](https://www.conventionalcommits.org/).
That isn't decoration — **the release automation parses your commit message to
pick the next version number**, and copies it into the changelog verbatim. See
[Releases](#releases) for what that means in practice.

### Format

```
<type>(<scope>): <subject>

<body — optional, wrapped at 72 characters>

<footer — optional>
```

Real examples from this repo:

```
fix: an operation type that shadows a component schema keeps its verb
```

```
feat(client): let callers supply their own fetcher

The runtime called the global fetch directly, so an app could not send
credentials or route requests through its own client. Adds an optional
`fetcher` to ClientConfig, defaulting to fetch.

Closes #2
```

### Types

| type | what it's for | version bump |
| --- | --- | --- |
| `feat` | a new feature or option users can use | **minor** |
| `fix` | a bug fix | patch |
| `docs` | documentation only | patch |
| `refactor` | restructuring with no behavior change | patch |
| `perf` | a performance improvement | patch |
| `test` | adding or fixing tests only | patch |
| `build` | build setup, dependencies, packaging | patch |
| `ci` | GitHub Actions and other CI config | patch |
| `chore` | anything else — housekeeping | patch |

### Scope (optional)

The part of the codebase you touched, in parentheses. For this repo that's
usually `client`, `types`, `generator`, `cli`, or `docs`:

```
feat(client): add a credentials option
fix(generator): keep the verb on a shadowed operation name
```

Leave it out if the change spans several areas.

### Breaking changes

Add `!` after the type, and explain the break in the footer. This bumps the
**major** version, so use it only when existing users' code stops working:

```
feat(client)!: rename op() to operation()

BREAKING CHANGE: every generated call site must be regenerated. Run
`npx openapi-op` again after upgrading.
```

### Subject line rules

- **Imperative mood** — "add", not "added" or "adds". Read it as completing the
  sentence *"If applied, this commit will…"*
- **Lowercase after the colon**, and **no full stop at the end**
- **Aim for 50 characters, hard limit 72.** Longer gets truncated in most git
  tools — and in our changelog
- **Say what changed, in user-facing terms.** `fix: cookies now sent on
  cross-origin requests` beats `fix: bug` or `fix: update index.ts`

### Body and footer

The body is optional, and worth writing when *why* isn't obvious from the
subject. Explain the reason and the context, not the mechanics — the diff
already shows those.

Footers:

- `Closes #12` — links the PR to an issue and closes it on merge
- `BREAKING CHANGE: …` — required prose for a `!` commit

### Number of commits

Don't worry about it while you work — commit as often as you like. Before the
PR is ready, tidy the history so each commit is one coherent change with a
message that matches. Most PRs here end up as a single commit. If you're not
comfortable rebasing, say so in the PR and it can be squashed on merge instead.

## Making the change

See [What's where](#whats-where) for the layout, then write the code.

Run the tests before you commit:

```bash
npm test
```

If work lands on `main` while you're going, pull it into your branch so your PR
doesn't conflict:

```bash
git pull upstream main
```

## Opening the pull request

```bash
git push origin fix/cookie-credentials
```

GitHub prints a link to open the PR — or go to your fork and click "Compare &
pull request".

In the PR:

- **Title it like a commit message** — same Conventional Commits format. If the
  PR gets squashed on merge, the title becomes the commit, and therefore the
  changelog line.
- **Link the issue** with `Closes #12` in the description.
- **Say what changed and why.** The reviewer knows the codebase, not what's in
  your head.
- **If you changed behavior, update `README.md` in the same PR.** Docs that
  arrive one PR later usually never arrive.

**Then what happens:** someone reads it and comments. Expect review comments —
they're normal, and not a sign you did it wrong. Push more commits to the same
branch to address them; the PR updates automatically. Don't force-push during
review unless asked, it makes review comments harder to follow.

## Releases

**Every push to `main` publishes a new version to npm automatically.** There's
no manual release step. `.github/workflows/release.yml` runs the tests, reads
the commit messages since the last tag, works out the version number, tags it,
and publishes.

That's why the commit format matters: a `feat:` merged to `main` ships a minor
version within minutes, and your subject line is what users read in the
changelog and release notes.

Don't edit `CHANGELOG.md` by hand — it's generated from commit messages.

---

## What's where

The package is two separate pieces of code in two different languages, and
knowing which one you're in saves confusion:

| path | what it is |
| --- | --- |
| `src/index.ts` | the runtime — `createClient`, `api()`, `op()`, `ApiError` |
| `src/types.ts` | the TypeScript helpers (`Req`, `Res`, `Args`…) that read your spec's types |
| `generator.mjs` | the code generator — turns an OpenAPI spec into `endpoints.ts` etc. |
| `bin/openapi-op.mjs` | the CLI, and the templates for the files it scaffolds |
| `test/` | tests (see below) |
| `docs/` | written by hand, for users |
| `dist/` | **build output — never edit, `npm run build` overwrites it** |
| `CHANGELOG.md` | **generated on release — never edit by hand** |

`src/` is TypeScript because it ships to users as types. The generator and CLI
are plain `.mjs` because they only ever run on Node, and shipping them unbuilt
keeps the package simple.

## Tests

```bash
npm test
```

There are two kinds, and they work differently:

- **`test/generator.test.mjs`** — normal unit tests. Imports functions from
  `generator.mjs`, feeds them a small fake OpenAPI spec, checks the output.
- **`test/types.test.mjs`** — runs the TypeScript compiler over
  `test/types.fixture.ts` and asserts it compiles. That fixture is full of
  `@ts-expect-error` comments, and each one is a real assertion: the test fails
  if a line that *should* be a type error stops being one. That's how we check
  that a required body stays required, an optional query stays optional, and so
  on.

If you touch `src/types.ts`, add a case to that fixture. Those helpers decide
what every call site downstream looks like, and nothing else would catch a
mistake in them.

Note that tests are `.mjs` files, so they can't import `src/*.ts` directly. A
test that needs the runtime should import from `../dist/index.js`, and the
project has to be built first.

## Trying the CLI

Point it at any OpenAPI spec — a URL or a local file — and write to a throwaway
directory:

```bash
node bin/openapi-op.mjs https://petstore3.swagger.io/api/v3/openapi.json \
  --out /tmp/try --prefix /api/v3
```

Then read what came out in `/tmp/try`. To test it as a real installed command,
use `npm link`.

## Style

There's no linter or formatter config — match the file you're in. Two things
are worth copying deliberately:

- **Comments explain *why*, not *what*.** The code already says what it does.
  Comments are for the non-obvious reasons: why a check is ordered that way,
  what breaks without it. `src/types.ts` is the house style.
- **Keep it small.** Preferring a few readable lines over a new abstraction is
  the whole design of this package. A PR that deletes code is very welcome.

## Questions

Open an issue. A question that turns out to be a documentation gap is a useful
bug report.

By contributing, you agree your work is licensed under the MIT license, same as
the rest of the project.
