// Type helpers over an openapi-typescript `paths` interface.
//
// Same shapes as a hand-rolled api-types.ts, except `Paths` is a parameter
// instead of an import — that is the only reason this is a package.
//
//   type Body = Req<paths, "/api/v1/auth/login", "post">;
//   type Out  = Res<paths, "/api/v1/auth/login", "post">;

export type Schema<Components, K extends keyof SchemasOf<Components>> = SchemasOf<Components>[K];

type SchemasOf<C> = C extends { schemas: infer S } ? S : never;

// Verbs the route defines. openapi-typescript spells the rest `get?: never`,
// which reads back as `undefined` — the tuple wrapper is what keeps `never`
// from matching everything.
export type ApiMethod<Paths, P extends keyof Paths> = {
  [M in keyof Paths[P]]: [Paths[P][M]] extends [undefined] ? never : M;
}[Exclude<keyof Paths[P], "parameters">];

type Op<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> = Paths[P][M];

type Json<R> = R extends { content: { "application/json": infer T } } ? T : void;

// The 2xx the route actually returns — 204 has no body and lands on `void`.
type SuccessOf<R> = Json<R[Extract<keyof R, 200 | 201 | 202 | 204>]>;

// openapi-typescript always emits a `requestBody` key — routes with none spell
// it `requestBody?: never`, not omit it — so indexing (rather than an
// `extends { requestBody: ... }` structural check) is what actually tells
// "no body" apart from "optional body".
type Body<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Op<Paths, P, M> extends { requestBody?: infer RB } ? NonNullable<RB> : never;

type IsNever<T> = [T] extends [never] ? true : false;
type JsonOf<B> = B extends { content: { "application/json": infer T } } ? T : never;
type MultipartOf<B> = B extends { content: { "multipart/form-data": unknown } } ? true : false;

// Multipart routes (file uploads) take a real `FormData` on the wire — the
// generated `Body_*` type mistypes the file field as `string` because OpenAPI
// has no way to say "browser File" for a `format: binary` field.
export type Req<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  IsNever<Body<Paths, P, M>> extends true
    ? never
    : JsonOf<Body<Paths, P, M>> extends never
      ? MultipartOf<Body<Paths, P, M>> extends true
        ? FormData
        : never
      : JsonOf<Body<Paths, P, M>>;

export type Res<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Op<Paths, P, M> extends { responses: infer R } ? SuccessOf<R> : never;

export type Query<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Op<Paths, P, M> extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;

export type Params<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Op<Paths, P, M> extends { parameters: { path?: infer T } } ? NonNullable<T> : never;

// The `?` the spec put on the key, carried to the call site: a body or a query
// the route makes optional may be left out, one it requires may not.
//
// Read as key-requiredness and not as `undefined extends …` because `infer`
// against an optional property drops the `undefined` that would have said so.
type OptionalBody<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Op<Paths, P, M> extends { requestBody: unknown } ? false : true;

type OptionalQuery<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Op<Paths, P, M> extends { parameters: { query: unknown } } ? false : true;

// Present only when the route has one — a route with no body takes no `body`
// argument, and a route with `{user_id}` cannot be called without it.
type Slot<K extends string, T, Opt extends boolean = false> = [T] extends [never]
  ? unknown
  : Opt extends true
    ? { [k in K]?: T }
    : { [k in K]: T };

// An intersection prints back as its own alias — a tooltip on a call shows
// `Args<paths, "/api/v1/auth/login", "post">`, a name and not a shape. Mapping
// it once resolves it, so the editor lists the fields the route actually wants.
//
// Three absent slots intersect to `unknown`, which would accept any object at
// all — `Record<string, never>` is the same "nothing to pass" with the door
// shut, so `me({ body })` is still a typo and not a silently dropped argument.
type Simplify<T> = unknown extends T
  ? Record<string, never>
  : { [K in keyof T]: T[K] } & {};

export type Args<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> = Simplify<
  Slot<"params", Params<Paths, P, M>> &
    Slot<"body", Req<Paths, P, M>, OptionalBody<Paths, P, M>> &
    Slot<"query", Query<Paths, P, M>, OptionalQuery<Paths, P, M>>
>;

// A route with nothing required takes the argument optionally, so `auth.me()`
// stays argument-free.
//
// The second argument is the fetch call itself — an `AbortSignal`, a Next.js
// `next: { revalidate }`, a one-off header. It is not spec-derived and never
// required, so it sits beside the arguments the route describes rather than
// inside them.
export type Call<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Record<string, never> extends Args<Paths, P, M>
    ? [args?: Args<Paths, P, M>, init?: RequestInit]
    : [args: Args<Paths, P, M>, init?: RequestInit];

// Everything above is keyed by a spec path. These are keyed by the endpoint
// itself — `ReqOf<typeof auth.login>` where a hand-written signature would say
// `Schema<"Credentials">`.
//
// The difference is what happens when the two disagree. A schema name is a
// second, independent claim about the same route, and structural typing lets a
// wrong one through: `Schema<"Register">` annotates a `Credentials` body
// without complaint, because the extra field is optional and TypeScript sees a
// subtype. Read off the function, the annotation *is* the route — the call
// site already imports it, a spec rename lands as an error here, and there is
// nothing left to keep in sync by hand.
type Endpoint = (...args: never[]) => Promise<unknown>;

/** Everything the call takes — `params`, `body` and `query`, as the route has them. */
export type ArgsOf<F extends Endpoint> = NonNullable<Parameters<F>[0]>;

/** Its body alone — `never` for a route that takes none. */
export type ReqOf<F extends Endpoint> = ArgsOf<F>[Extract<"body", keyof ArgsOf<F>>];

/** What it resolves to — the response, already awaited, and `void` on a 204. */
export type ResOf<F extends Endpoint> = Awaited<ReturnType<F>>;
