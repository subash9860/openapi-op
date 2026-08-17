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
  /**
   * Path prefix the spec keys carry that `baseUrl` does not — `/api/v1`.
   * Stripped off the spec key and added back on the wire, so a hand-written
   * `api("/tenant")` and a generated `op("/api/v1/tenant", "get")` hit the
   * same URL.
   */
  prefix?: string;
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
  const prefix = config.prefix ?? "";
  const parseError = config.parseError ?? defaultParseError;

  /** Escape hatch: any path, no types. Everything else goes through `op`. */
  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const [base, extra] = await Promise.all([
      typeof config.baseUrl === "function" ? config.baseUrl() : config.baseUrl,
      config.headers?.() ?? {},
    ]);

    // `FormData` needs no content-type: fetch sets `multipart/form-data` with
    // the boundary itself, and a hardcoded json header here would break it.
    const isFormData = init?.body instanceof FormData;

    const res = await fetch(`${base}${prefix}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "content-type": "application/json" }),
        ...extra,
        ...init?.headers,
      },
    });

    if (!res.ok) throw parseError(res.status, await res.json().catch(() => null), res);
    return res.status === 204 ? (undefined as T) : res.json();
  }

  /**
   * Give it a spec key and a verb and it reads the body, the query, the path
   * params and the response type out of `paths`. The calls themselves are
   * generated — see the `openapi-op` CLI — so a backend rename lands as a
   * compile error rather than a 422 at runtime.
   */
  function op<P extends keyof Paths & string, M extends ApiMethod<Paths, P>>(path: P, method: M) {
    return (...[args]: Call<Paths, P, M>): Promise<Res<Paths, P, M>> => {
      const a = args as
        | { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown }
        | undefined;

      const url = (prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path).replace(
        /\{(\w+)\}/g,
        (_, key: string) => encodeURIComponent(a!.params![key]),
      );

      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(a?.query ?? {})) {
        if (value !== undefined) qs.set(key, String(value));
      }

      return api<Res<Paths, P, M>>(`${url}${qs.size ? `?${qs}` : ""}`, {
        method: String(method).toUpperCase(),
        ...(a?.body === undefined
          ? {}
          : { body: a.body instanceof FormData ? a.body : JSON.stringify(a.body) }),
      });
    };
  }

  return { api, op };
}
