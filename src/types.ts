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

// Present only when the route has one — a route with no body takes no `body`
// argument, and a route with `{user_id}` cannot be called without it.
type Slot<K extends string, T> = [T] extends [never] ? unknown : { [k in K]: T };

export type Args<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Slot<"params", Params<Paths, P, M>> &
  Slot<"body", Req<Paths, P, M>> & { query?: Query<Paths, P, M> };

// `{}` satisfies a call with nothing required, so `auth.me()` stays argument-free.
export type Call<Paths, P extends keyof Paths, M extends ApiMethod<Paths, P>> =
  Record<string, never> extends Args<Paths, P, M>
    ? [args?: Args<Paths, P, M>]
    : [args: Args<Paths, P, M>];
