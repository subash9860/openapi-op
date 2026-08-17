# Swagger/OpenAPI rules for backend authors

`openapi-op` reads `openapi.json` and generates `lib/endpoints.ts` + `lib/schema.ts`
verbatim from it — every method name, request type, and response type is only
as good as the spec. These rules are derived from [`generator.mjs`](../generator.mjs).
Follow them when writing Swagger decorators (NestJS `@nestjs/swagger` examples
below; the same rules apply to any framework that emits OpenAPI).

## 1. Every 2xx response needs a schema

The generator reads `responses[status].content["application/json"].schema`.
No `content` → the generated type is `void`, even if your handler actually
returns a body.

```ts
// BAD — response type resolves to void
@Post("login")
login() {}

// GOOD
@Post("login")
@ApiOkResponse({ type: LoginResponseDto })
login(): LoginResponseDto {}
```

Use `@ApiCreatedResponse` for 201, `@ApiOkResponse` for 200. Only skip this
for genuinely empty responses (204).

## 2. Every operation needs a `summary`

Method names come from `summary`. No summary → the generated key falls back
to `` `${verb} ${group}` `` (camelCased), e.g. `auth.post`, `auth.postPost` —
that is what routes with no `summary` produce.

```ts
// BAD — generates auth.post
@Post("refresh")
refresh() {}

// GOOD — generates auth.refreshToken (or auth.refresh, see naming rule below)
@Post("refresh")
@ApiOperation({ summary: "Refresh access token" })
refresh() {}
```

## 3. Naming: trailing word == group name gets dropped

The group is the first path segment (`/api/v1/members/*` → `members`). If the
*last word* of `summary` singularizes to the group name, it's dropped —
`"List Members"` in group `members` → `members.list`, not `members.listMembers`.
Anything else keeps its full trailing word — `"Change Role"` → `members.changeRole`.

Write summaries as `Verb [+ Noun]`, and only end the summary with the group's
own noun when you're fine with it being stripped. If two summaries collide
after stripping, the generator prepends the verb automatically — no action
needed, but distinct summaries avoid relying on that fallback.

## 4. Use named DTOs ($ref), not inline/anonymous shapes

`schema.ts` type lookups (`Schema<"MemberOut">`) and the docs table both key
off `$ref` names. An inline object type still works but shows up unnamed in
`docs/api.md` and can't be referenced via `Schema<...>`.

```ts
// BAD — anonymous, unreadable in docs/api.md
@ApiOkResponse({ schema: { type: "object", properties: { id: { type: "string" } } } })

// GOOD
@ApiOkResponse({ type: MemberOutDto })
```

## 5. Pagination DTO naming: `Paginated_X_`

A response schema named `Paginated_X_` (openapi-typescript's naming for a
generic `Paginated<X>`) gets an extra `.itemsXxx` sibling generated that
unwraps `.items` automatically. Name your paginated envelope DTOs to match
this pattern if you want the sibling helper; anything else is still callable,
just without the unwrapped shortcut.

## 6. Only routes under `--prefix` are generated

Routes outside the configured prefix (e.g. `/healthz`) are skipped by the
client generator entirely — call those with the untyped `api()` escape hatch.
Keep all typed, client-facing routes under the prefix.

## 7. Declare query/path params explicitly

`@ApiQuery` / `@ApiParam` (or NestJS's automatic inference from route params +
DTOs) populate `parameters.query` / `parameters.path` in the spec — these
become the `query` / `params` fields in the generated `op()` call signature.
An undeclared param won't type-check on the client even if the route accepts it.

## Checklist before shipping a new endpoint

- [ ] `@ApiOperation({ summary: "..." })` present, phrased as `Verb [Noun]`
- [ ] Every 2xx response has `@ApiOkResponse`/`@ApiCreatedResponse` with a named DTO `type`
- [ ] Request/response DTOs are classes with `@ApiProperty()`, not inline types
- [ ] Query/path params declared via `@ApiQuery`/`@ApiParam` or inferred from typed DTO/route params
- [ ] Paginated responses named `Paginated_X_` if the `.items` sibling is wanted
- [ ] Run `npm run codegen` after changes, check `docs/api.md` diff and `lib/endpoints.ts` diff for the expected method name/types
