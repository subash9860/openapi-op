# Changelog

## 3.0.0 — 2026-08-22

- feat!: group operations by spec tag, not path segment

## 2.0.0 — 2026-08-22

- fix: pin typescript back to 5.x
- docs: add a 1.x upgrade note, and fix a comment the prefix split left stale
- docs: state the runtime and module format up front
- fix: don't import `components` when the spec declares no schemas
- docs: document the call's fetch options and the non-JSON response
- test: cover the runtime client
- feat!: op() sends the spec path verbatim, api() the path it was given
- feat: pass fetch options through a generated call
- fix: group the generated docs by the same rule the client uses
- fix: a non-JSON 2xx no longer throws a SyntaxError
- fix: stop dropping headers passed as a Headers instance
- fix: send an array query param as a repeated key
- ci: typecheck before the release bump, not after it
- ci: keep dependabot off typescript majors
- chore: bump typescript from 5.9.3 to 7.0.2 in the npm group

## 1.0.3 — 2026-08-21

- ci: bump the actions group with 2 updates
- ci: add pull request testing, issue and PR templates, dependabot
- docs: add contributing guide and license

## 1.0.2 — 2026-08-21

- fix: an operation type that shadows a component schema keeps its verb

## 1.0.1 — 2026-08-18

- chore: update docs

## 1.0.0 — 2026-08-18

- feat!: generate a named request/response type per operation

## 0.2.17 — 2026-08-18

- fix: call args show their shape and honor optional body/query

## 0.2.16 — 2026-08-17

- ci: tolerate GitHub API blips on release notes

## 0.2.15 — 2026-08-17

- ci: drop OIDC diagnostics

## 0.2.14 — 2026-08-17

- no user-facing changes

## 0.2.13 — 2026-08-17

- ci: verbose publish for OIDC diagnosis

## 0.2.12 — 2026-08-17

- ci: debug OIDC env

## 0.2.11 — 2026-08-17

- no user-facing changes

## 0.2.10 — 2026-08-17

- no user-facing changes

## 0.2.9 — 2026-08-17

- ci: publish via trusted publisher (OIDC)

## 0.2.8 — 2026-08-17

- no user-facing changes

## 0.2.7 — 2026-08-17

- ci: publish with NPM_TOKEN

## 0.2.6 — 2026-08-17

- ci: publish via npm trusted publishing (OIDC)

## 0.2.5 — 2026-08-17

- ci: rebase onto main before bumping so reruns don't collide

## 0.2.4 — 2026-08-17

- ci: make release rerun idempotent

## 0.2.3 — 2026-08-17

- ci: publish with NPM_TOKEN

## 0.2.2 — 2026-08-17

- fix: github ci

## 0.2.1 — 2026-08-17

- ci: pin actions v5, fix bin path

## 0.2.0 — 2026-08-17

- ci: auto version, changelog, npm publish on push to main
- feat: initial release of openapi-op

## 0.1.0

- Initial release: `createClient()`, `openapi-op` generator CLI, `docs/api.md` output.
