import type { ApiMethod, Call, Res } from "./types";

export type * from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ClientConfig {
  /**
   * Where the API lives. A function, and an async one, because a server
   * runtime often derives the origin per request (a Host header, a tenant)
   * rather than reading it once at import time.
   */
  baseUrl: string | (() => string | Promise<string>);
  /** Per-request headers — where an Authorization token comes from. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Default reads `{ error: { code, message } }`. */
  parseError?: (status: number, body: unknown, res: Response) => ApiError;
}

const defaultParseError = (status: number, body: unknown, res: Response) => {
  const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
  return new ApiError(status, err?.code ?? "unknown", err?.message ?? res.statusText, body);
};

export function createClient<Paths>(config: ClientConfig) {
  const parseError = config.parseError ?? defaultParseError;

  /**
   * Escape hatch: any path, no types, appended to `baseUrl` exactly as given.
   * That is what makes a route the spec does not describe — `/healthz`, a
   * webhook, anything outside the generated client — reachable at all.
   */
  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const [base, extra] = await Promise.all([
      typeof config.baseUrl === "function" ? config.baseUrl() : config.baseUrl,
      config.headers?.() ?? {},
    ]);

    // `FormData` needs no content-type: fetch sets `multipart/form-data` with
    // the boundary itself, and a hardcoded json header here would break it.
    const isFormData = init?.body instanceof FormData;

    // Built through `Headers` rather than object spread: `init.headers` is a
    // `HeadersInit`, and spreading a `Headers` instance — or the entry-array
    // form — yields `{}`, so the caller's headers went out missing with
    // nothing to show for it. Precedence is unchanged: content-type, then the
    // client's `headers()`, then whatever the call passed.
    const headers = new Headers(isFormData ? undefined : { "content-type": "application/json" });
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

    const res = await fetch(`${base}${path}`, { ...init, headers });

    if (!res.ok) throw parseError(res.status, await res.json().catch(() => null), res);

    // 204, and anything the server labelled as not JSON. A CSV or a PDF route
    // typed `void` by `Res` still ran `res.json()`, which threw a raw
    // SyntaxError straight past the caller's `ApiError` handling. A response
    // with no content-type at all is still read as JSON — that is what the
    // spec said the route returns.
    const type = res.headers.get("content-type");
    return res.status === 204 || (type && !type.includes("json"))
      ? (undefined as T)
      : res.json();
  }

  /**
   * Give it a spec key and a verb and it reads the body, the query, the path
   * params and the response type out of `paths`. The calls themselves are
   * generated — see the `openapi-op` CLI — so a backend rename lands as a
   * compile error rather than a 422 at runtime.
   */
  function op<P extends keyof Paths & string, M extends ApiMethod<Paths, P>>(path: P, method: M) {
    return (...[args, init]: Call<Paths, P, M>): Promise<Res<Paths, P, M>> => {
      const a = args as
        | { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown }
        | undefined;

      // The spec key is the path, prefix and all — `baseUrl` is the origin it
      // hangs off. Nothing is stripped, so what the generated call sends is
      // what the spec says, character for character.
      const url = path.replace(
        /\{(\w+)\}/g,
        (_, key: string) => encodeURIComponent(a!.params![key]),
      );

      // An array is a repeated key and not `a,b`: `?tags=a&tags=b` is what a
      // `List[str]` on the other end reads back, and `String(["a","b"])` is a
      // single value the server takes literally. `null` is dropped like
      // `undefined` — an omitted optional, not the four characters "null".
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(a?.query ?? {})) {
        for (const v of Array.isArray(value) ? value : [value]) {
          if (v !== undefined && v !== null) qs.append(key, String(v));
        }
      }

      return api<Res<Paths, P, M>>(`${url}${qs.size ? `?${qs}` : ""}`, {
        ...init,
        method: String(method).toUpperCase(),
        ...(a?.body === undefined
          ? {}
          : { body: a.body instanceof FormData ? a.body : JSON.stringify(a.body) }),
      });
    };
  }

  return { api, op };
}
