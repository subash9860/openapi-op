// Call shapes, asserted by tsc — see types.test.mjs. Every `@ts-expect-error`
// is an assertion in both directions: tsc fails if the line stops erroring
// just as loudly as if a clean line starts.
//
// The `paths` below is hand-written to match what openapi-typescript emits,
// down to the `?: never` filler — that filler is what the helpers read.
import type { ApiMethod, Args, Call, Res, ArgsOf, ReqOf, ResOf } from "../src/types";

interface paths {
  "/none": {
    get: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: { 200: { content: { "application/json": string } } };
    };
  };
  "/body": {
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody: { content: { "application/json": { name: string } } };
      responses: { 201: { content: { "application/json": string } } };
    };
  };
  "/upload/{id}": {
    patch: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      // `requestBody?:` — the route accepts a body but does not require one.
      requestBody?: { content: { "multipart/form-data": { file: string } } };
      responses: { 200: { content: { "application/json": string } } };
    };
  };
  "/list": {
    get: {
      parameters: { query?: { limit?: number }; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: { 200: { content: { "application/json": string } } };
    };
  };
  "/search": {
    get: {
      parameters: { query: { q: string }; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: { 200: { content: { "application/json": string } } };
    };
  };
}

// Same signature `op()` hands back.
declare function call<P extends keyof paths, M extends ApiMethod<paths, P>>(
  p: P,
  m: M,
): (...args: Call<paths, P, M>) => Promise<Res<paths, P, M>>;

const none = call("/none", "get");
const body = call("/body", "post");
const upload = call("/upload/{id}", "patch");
const list = call("/list", "get");
const search = call("/search", "get");

// Nothing required — no argument at all.
none();
// @ts-expect-error the route takes no body
none({ body: {} });

// A required body is required, and typed.
body({ body: { name: "n" } });
// @ts-expect-error missing the whole argument
body();
// @ts-expect-error missing `body`
body({});
// @ts-expect-error `name` is a string
body({ body: { name: 1 } });

// A path param is required; an optional body is not.
upload({ params: { id: "1" } });
upload({ params: { id: "1" }, body: new FormData() });
// @ts-expect-error missing `params`
upload({});

// An all-optional query keeps the argument itself optional.
list();
list({ query: { limit: 10 } });
// @ts-expect-error `nope` is not a query param
list({ query: { nope: 1 } });

// A required query is required.
search({ query: { q: "x" } });
// @ts-expect-error missing `query`
search({});

// The tooltip shape: `Args` resolves to an object, not back to its own name.
const shape: Args<paths, "/body", "post"> = { body: { name: "n" } };

// Read off the endpoint instead of off a schema name. `ReqOf` has to survive
// the three body shapes — required, optional, absent — because a signature
// written against the wrong one is exactly what these replace.
const req: ReqOf<typeof body> = { name: "n" };
const reqOptional: ReqOf<typeof upload> = undefined;
// @ts-expect-error `/none` has no body to name
const reqAbsent: ReqOf<typeof none> = {};
const res: ResOf<typeof body> = "a string";
// @ts-expect-error the route resolves to a string
const resWrong: ResOf<typeof body> = 1;
const argsOf: ArgsOf<typeof search> = { query: { q: "x" } };

export { none, body, upload, list, search, shape, req, reqOptional, reqAbsent, res, resWrong, argsOf };
