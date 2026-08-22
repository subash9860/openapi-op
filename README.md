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

ESM only, Node 18+. TypeScript 5.x, alongside `openapi-typescript`.

## Generate

```bash
npx openapi-op http://localhost:8000/openapi.json --out lib --prefix /api/v1
```

Writes, every run:

| file | what |
| --- | --- |
| `lib/schema.ts` | `openapi-typescript` output, verbatim |
| `lib/endpoints.ts` | the callable client, grouped by the spec's tags |
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

A second, optional argument is the fetch call itself — anything a
`RequestInit` carries:

```ts
await members.list({ query: { limit: 20 } }, { next: { revalidate: 60 } });
await auth.me(undefined, { signal: AbortSignal.timeout(2000) });
```

The verb and the body come from the spec and stay that way; an init that
names them is ignored.

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
`body` — including the ones whose body is not JSON, which land on
`res.statusText` and a `code` of `"unknown"`.

A 204 resolves to `undefined`, and so does any 2xx the server labels as
something other than JSON: a CSV or a PDF route is typed `void` by `Res`,
because its spec response has no `application/json` to read. Fetch those
directly when you want the bytes.

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

- **Groups** are the operation's first `tag` — `tags: ["members"]` becomes
  `export const members`, and a namespaced tag is still one identifier
  (`courses:admin` → `coursesAdmin`). The tag beats the URL on purpose: `List
  Permissions` belongs with `roles` though it lives at `/permissions`, and
  `/admin/courses` is `courses:admin` rather than sharing one `admin` bucket
  with every other admin route. Two verbs on one path may be tagged apart.
  Untagged, the first path segment after the prefix stands in — so a spec that
  never tags groups exactly as before.
- **Method names** come from `summary`, minus whatever the group already says:
  `List Members` in `members` is `members.list`, and `Admin List Courses` in
  `courses:admin` is `coursesAdmin.list`. Only whole words, only off either
  end, and never the last one standing — so `Change Role` stays `changeRole`
  and `Checkout` in `checkout` stays `checkout.checkout`. A collision keeps its
  verb.
- **Pagination**: a response named `Paginated_X_` also gets a `…Items` sibling
  returning the rows.
- Routes outside `--prefix` (`/healthz`) are skipped — call those with `api()`.
  That is all `--prefix` does now: it decides what the typed client covers, not
  what anything is called.

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

## Upgrading from 2.x

Groups come from the spec's tags now, so a tagged spec regroups on the next
`npm run codegen`. Nothing about the runtime changed — the calls are the same
calls, reached through a different object.

```diff
-import { admin } from "@/lib/endpoints";
-await admin.createCourse({ body });
+import { coursesAdmin } from "@/lib/endpoints";
+await coursesAdmin.create({ body });
```

Regenerate, then let `tsc` list the call sites: every one is a renamed import
or a renamed method, and there is no silent change — a group that moved cannot
still resolve. An untagged spec is unaffected, and so is `--prefix`, which now
only decides which routes the typed client covers.

## Upgrading from 1.x

`createClient()` no longer takes `prefix`, and `api()` no longer adds one.

```diff
 export const { api, op } = createClient<paths>({
   baseUrl: () => process.env.API_ORIGIN ?? "http://localhost:8000",
-  prefix: "/api/v1",
 });
```

Generated calls are unaffected — `op()` sends the spec key, which already
carries the prefix. What changes is `api()`: it now sends the path you give
it, verbatim. Pass the whole path there.

```diff
-await api<Tenant>("/tenant");        // was /api/v1/tenant
+await api<Tenant>("/api/v1/tenant");
+await api<Health>("/healthz");       // now reachable at all
```

Regenerating does not touch `lib/api.ts` — it is scaffolded once — so that
one edit is by hand. TypeScript flags the leftover `prefix` for you.

## Contributing

Bug reports and pull requests welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for the setup, how the tests work, and the
commit message format (it picks the released version number).

## License

[MIT](LICENSE) © Subash KC
