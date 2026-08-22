#!/usr/bin/env node
// One command, one spec, four files:
//
//   <out>/schema.ts      — openapi-typescript, verbatim
//   <out>/endpoints.ts   — the callable client
//   <out>/operations.ts  — a named request/response type per operation
//   <docs>               — the readable map (skip with --no-docs)
//
// plus <out>/api.ts and <out>/api-types.ts scaffolded on first run only —
// those two are yours to edit, the three above are not.
//
// Usage: openapi-op <spec-url-or-file> [--out lib] [--docs docs/api.md]
//                   [--prefix /api/v1] [--client ./api] [--no-docs]

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import {
  renderDocs,
  renderEndpoints,
  renderOperations,
  endpoints,
  operations,
} from "../generator.mjs";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

// Positional: the one argument that is neither a flag nor a flag's value.
const VALUED = ["--out", "--docs", "--prefix", "--client"];
const spec = argv.find(
  (a, i) => !a.startsWith("--") && !VALUED.includes(argv[i - 1]),
);
if (!spec) {
  console.error("usage: openapi-op <spec-url-or-file> [--out lib] [--prefix /api/v1]");
  process.exit(1);
}

const out = flag("out", "lib");
const docs = argv.includes("--no-docs") ? null : flag("docs", "docs/api.md");
const prefix = flag("prefix", "");
const client = flag("client", "./api");

const isUrl = /^https?:/.test(spec);
const raw = isUrl
  ? await fetch(spec).then((r) => {
      if (!r.ok) throw new Error(`${spec} -> ${r.status}`);
      return r.text();
    })
  : await readFile(spec, "utf8");
const doc = JSON.parse(raw);

await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, "schema.ts"),
  astToString(await openapiTS(isUrl ? new URL(spec) : doc)),
);
await writeFile(path.join(out, "endpoints.ts"), renderEndpoints(doc, { prefix, client }));
await writeFile(path.join(out, "operations.ts"), renderOperations(doc));
if (docs) {
  await mkdir(path.dirname(docs), { recursive: true });
  await writeFile(docs, renderDocs(doc, { prefix }));
}

// --- scaffolds: written once, then left alone ---

const scaffold = async (file, contents) => {
  const target = path.join(out, file);
  if (existsSync(target)) return false;
  await writeFile(target, contents);
  return true;
};

const written = [];
if (
  await scaffold(
    "api.ts",
    `// Yours to edit — openapi-op writes this once and never again.
//
// \`baseUrl\` and \`headers\` are functions so they can be resolved per request
// (a Host header, a session cookie) rather than once at import time.

import { createClient } from "openapi-op";
import type { paths } from "./schema";

export { ApiError } from "openapi-op";

export const { api, op } = createClient<paths>({
  baseUrl: () => process.env.API_ORIGIN ?? "http://localhost:8000",
  prefix: "${prefix}",
  // headers: async () => ({ authorization: \`Bearer \${await token()}\` }),
});
`,
  )
) written.push("api.ts");

if (
  await scaffold(
    "api-types.ts",
    `// Yours to edit — openapi-op writes this once and never again.
// Binds the generic helpers to *this* project's spec, so call sites read
// \`Req<"/api/v1/auth/login", "post">\` and not the three-parameter form.
//
// A plain data shape (\`CourseOut\`, \`Token\`) has its own named export in the
// generated \`operations.ts\` — import it from there, not off \`components\`.

import type { paths } from "./schema";
import type * as t from "openapi-op";

export type ApiPath = keyof paths;
export type ApiMethod<P extends ApiPath> = t.ApiMethod<paths, P>;
export type Req<P extends ApiPath, M extends ApiMethod<P>> = t.Req<paths, P, M>;
export type Res<P extends ApiPath, M extends ApiMethod<P>> = t.Res<paths, P, M>;
export type Query<P extends ApiPath, M extends ApiMethod<P>> = t.Query<paths, P, M>;
export type Params<P extends ApiPath, M extends ApiMethod<P>> = t.Params<paths, P, M>;
`,
  )
) written.push("api-types.ts");

console.log(`${out}/schema.ts — ${operations(doc).length} operations`);
console.log(`${out}/endpoints.ts — ${[...endpoints(doc, { prefix }).keys()].join(", ")}`);
console.log(`${out}/operations.ts — named request/response types`);
if (docs) console.log(docs);
if (written.length) console.log(`scaffolded ${written.join(", ")} (edit freely)`);
