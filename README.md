# openapi-op

A typed backend client generated from an OpenAPI spec. One `op()` per
operation; the request body, query, path params and response type are read out
of the spec's own types, so a backend rename lands as a compile error instead
of a 422 at runtime.

No runtime validation, no generated fetch soup, no class-per-tag. The whole
runtime is one `createClient()`.

```bash
npm i openapi-op
```

## Generate

```bash
npx openapi-op http://localhost:8000/openapi.json --out lib --prefix /api/v1
```

Writes, every run:

| file | what |
| --- | --- |
| `lib/schema.ts` | `openapi-typescript` output, verbatim |
| `lib/endpoints.ts` | the callable client, grouped by the first path segment |
| `docs/api.md` | every path, verb, request and response (`--no-docs` to skip) |

Written **once**, then yours: `lib/api.ts` (where the base URL and the auth
header come from) and `lib/api-types.ts` (the helpers bound to your spec).

Add it to `package.json`:

```json
"scripts": {
  "codegen": "openapi-op ${API_URL:-http://localhost:8000}/openapi.json --out lib --prefix /api/v1"
}
```

## Call

```ts
import { auth, members } from "@/lib/endpoints";

const { access_token } = await auth.login({ body: { email, password } });
const { items } = await members.list({ query: { limit: 20 } });
const rows = await members.listItems();              // paginated -> .items sibling
await members.changeRole({ params: { user_id }, body: { role: "admin" } });
```

`params` is required when the path has `{...}`, `body` when the operation takes
one, and neither appears in the signature when the route has neither.

## Configure

`lib/api.ts`, scaffolded on first run:

```ts
import { createClient } from "openapi-op";
import type { paths } from "./schema";

export { ApiError } from "openapi-op";

export const { api, op } = createClient<paths>({
  baseUrl: () => process.env.API_ORIGIN ?? "http://localhost:8000",
  prefix: "/api/v1",
  headers: async () => ({ authorization: `Bearer ${await token()}` }),
});
```

`baseUrl` and `headers` are functions, and may be async, because on a server
the origin and the token are usually per-request (a Host header, a session
cookie) rather than known at import time.

| option | |
| --- | --- |
| `baseUrl` | origin, without the prefix. `string` or `() => string \| Promise<string>` |
| `prefix` | the path prefix spec keys carry that `baseUrl` does not — `/api/v1` |
| `headers` | per-request headers; where the `Authorization` comes from |
| `parseError` | defaults to reading `{ error: { code, message } }` |

### Next.js

```ts
export const { api, op } = createClient<paths>({
  baseUrl: async () => process.env.API_ORIGIN ?? `https://${(await headers()).get("host")}`,
  prefix: "/api/v1",
  headers: async () => {
    const token = (await cookies()).get("session")?.value;
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});
```

Put `import "server-only"` at the top of that file and the token never has a
path to a browser bundle.

## Errors

Every non-2xx throws `ApiError` with `status`, `code`, `message` and the raw
`body`. 204 resolves to `undefined`.

```ts
try {
  await members.invite({ body: { email } });
} catch (err) {
  if (err instanceof ApiError && err.status === 409) return { taken: true };
  throw err;
}
```

## Types

`lib/api-types.ts` binds the generic helpers to your spec:

```ts
type Body = Req<"/api/v1/auth/login", "post">;   // Credentials
type Out  = Res<"/api/v1/auth/login", "post">;   // Token
type Q    = Query<"/api/v1/members", "get">;     // { limit?, offset? }
type Role = Schema<"RoleOut">;
```

## Conventions it assumes

Generated names come from the spec, so they are only as good as it is:

- **Groups** are the first path segment after the prefix — `/api/v1/members/*`
  becomes `export const members`.
- **Method names** come from `summary`, minus the group word: `List Members` in
  `members` is `members.list`, but `Change Role` stays `changeRole`. A
  collision keeps its verb.
- **Pagination**: a response named `Paginated_X_` also gets a `…Items` sibling
  returning the rows.
- Routes outside `--prefix` (`/healthz`) are skipped — call those with `api()`.

`api(path, init)` is the untyped escape hatch for anything the spec does not
describe.

## Escape hatch

```ts
const tenant = await api<Tenant>("/tenant");
```

MIT.
