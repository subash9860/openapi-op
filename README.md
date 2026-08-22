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
| `lib/operations.ts` | `LoginRequest` / `LoginResponse`, one pair per operation |
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

`params` is required when the path has `{...}`, `body` and `query` when the
spec marks them required (a `requestBody?:` or an all-optional query stays
optional), and a key the route has no use for is absent from the signature
entirely. The argument type resolves to an object literal rather than to its
own alias, so hovering a call lists the fields it wants.

## Configure

`lib/api.ts`, scaffolded on first run:

```ts
import { createClient } from "openapi-op";
import type { paths } from "./schema";

export { ApiError } from "openapi-op";

export const { api, op } = createClient<paths>({
  baseUrl: () => process.env.API_ORIGIN ?? "http://localhost:8000",
  headers: async () => ({ authorization: `Bearer ${await token()}` }),
});
```

`baseUrl` and `headers` are functions, and may be async, because on a server
the origin and the token are usually per-request (a Host header, a session
cookie) rather than known at import time.

| option | |
| --- | --- |
| `baseUrl` | the origin the spec's paths hang off. `string` or `() => string \| Promise<string>` |
| `headers` | per-request headers; where the `Authorization` comes from |
| `parseError` | defaults to reading `{ error: { code, message } }` |

A generated call sends the spec key verbatim — `op("/api/v1/members", "get")`
requests `${baseUrl}/api/v1/members` — so `baseUrl` carries no path of its
own, and `api()` appends whatever path you hand it, unchanged.

### Next.js

```ts
export const { api, op } = createClient<paths>({
  baseUrl: async () => process.env.API_ORIGIN ?? `https://${(await headers()).get("host")}`,
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
```

A plain data shape — a component prop, a value just held or passed along,
with no call site of its own — gets its own named export in the generated
`operations.ts`, one per component schema:

```ts
import type { RoleOut } from "@/lib/operations";
```

Where a wrapper has to restate a route's types — a Server Action most of all —
name the route's own type out of the generated `operations.ts` instead:

```ts
import type { RegisterRequest, RegisterResponse } from "@/lib/operations";

export async function signupAction(
  body: RegisterRequest,
): Promise<Result<RegisterResponse>> {
  return run(() => auth.register({ body }));
}
```

The names come from the spec's `summary`, the same string that becomes the
method name — `Login` is `LoginRequest` / `LoginResponse`, `Change Role` is
`ChangeRoleRequest`. A route with no body has no `…Request`, and a collision
keeps its verb (`PostPingResponse`). Every operation gets a pair, including
the ones outside `--prefix` that you reach with `api()`.

Naming the schema by hand is the thing to avoid: reaching for the component
schema's own name (`Register`) where a route's `…Request`/`…Response` was
meant is a second, independent claim about the same route, and structural
typing lets a wrong one through — it annotates a `Credentials` body without
complaint, because the extra field is optional and TypeScript sees a subtype.
A generated name cannot drift; a rename in the spec is a compile error rather
than a 422.

### Off the endpoint

`ReqOf` / `ResOf` / `ArgsOf` read the same types off an endpoint function, for
code that is generic over one and has no single name to import:

```ts
const wrap = <F extends typeof auth.login>(f: F) => (body: ReqOf<F>) => f({ body });
```

A plain data shape a component holds (`CourseOut[]`) still imports its named
type from `operations.ts` — there is no endpoint there to read from, so no
`Req`/`Res` applies, only the schema's own name.

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

Writing the spec on the backend? See
[docs/spec-authoring.md](docs/spec-authoring.md) — the Swagger/OpenAPI rules
that decide what the generated names and types come out as.

## Escape hatch

```ts
const health = await api<{ status: string }>("/healthz");
```

The path goes out exactly as written — that is how a route outside `--prefix`,
or one the spec never mentions at all, stays reachable.

## Contributing

Bug reports and pull requests welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for the setup, how the tests work, and the
commit message format (it picks the released version number).

## License

[MIT](LICENSE) © Subash KC
