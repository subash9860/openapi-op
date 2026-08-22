// The runtime half of the package. Everything here is what a wrong URL, a
// dropped header or a swallowed query param looks like from a call site —
// none of it is visible to the type tests, and all of it is silent in
// production when it breaks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, createClient } from "../dist/index.js";

// Records the one request the client makes and answers with `response`.
function stub(response = {}) {
  const seen = {};
  globalThis.fetch = async (url, init) => {
    seen.url = url;
    seen.init = init;
    seen.headers = Object.fromEntries(init.headers);
    const { status = 200, type = "application/json", body = {} } = response;
    return {
      ok: status < 400,
      status,
      statusText: response.statusText ?? "",
      headers: new Headers(type ? { "content-type": type } : {}),
      json: async () => {
        if (type && !type.includes("json")) throw new SyntaxError("not json");
        return body;
      },
    };
  };
  return seen;
}

const client = (config = {}) => createClient({ baseUrl: "http://api", ...config });

test("op sends the spec path verbatim, with params encoded", async () => {
  const seen = stub();
  await client().op("/api/v1/members/{user_id}", "get")({ params: { user_id: "a b/c" } });
  assert.equal(seen.url, "http://api/api/v1/members/a%20b%2Fc");
  assert.equal(seen.init.method, "GET");
});

test("api sends the path it was given, so a route off the spec is reachable", async () => {
  const seen = stub();
  await client().api("/healthz");
  assert.equal(seen.url, "http://api/healthz");
});

test("an array query param is a repeated key; undefined and null are dropped", async () => {
  const seen = stub();
  await client().op("/items", "get")({
    query: { tags: ["a", "b"], limit: 2, skip: undefined, flag: null },
  });
  assert.equal(seen.url, "http://api/items?tags=a&tags=b&limit=2");
});

test("headers merge in every HeadersInit form, call over client over default", async () => {
  const seen = stub();
  const c = client({ headers: () => ({ authorization: "Bearer t", "x-app": "1" }) });
  await c.api("/x", { headers: new Headers({ "x-app": "2" }) });
  assert.deepEqual(seen.headers, {
    "content-type": "application/json",
    authorization: "Bearer t",
    "x-app": "2",
  });
});

test("FormData goes out without a content-type, so fetch can set the boundary", async () => {
  const seen = stub();
  const form = new FormData();
  form.set("file", "x");
  await client().op("/upload", "post")({ body: form });
  assert.equal(seen.headers["content-type"], undefined);
  assert.equal(seen.init.body, form);
});

test("a JSON body is serialized; a 204 resolves to undefined", async () => {
  const seen = stub({ status: 204, type: null });
  assert.equal(await client().op("/items", "post")({ body: { a: 1 } }), undefined);
  assert.equal(seen.init.body, '{"a":1}');
});

test("a non-JSON 2xx resolves to undefined instead of throwing a SyntaxError", async () => {
  stub({ status: 200, type: "text/csv" });
  assert.equal(await client().op("/export", "get")(), undefined);
});

test("fetch options ride along, but cannot rewrite the verb or the body", async () => {
  const seen = stub();
  const signal = AbortSignal.timeout(50);
  await client().op("/items", "post")(
    { body: { a: 1 } },
    { signal, method: "DELETE", body: "hijacked", cache: "no-store" },
  );
  assert.equal(seen.init.signal, signal);
  assert.equal(seen.init.cache, "no-store");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.body, '{"a":1}');
});

test("a non-2xx throws ApiError carrying the parsed error and the raw body", async () => {
  const body = { error: { code: "taken", message: "already a member" } };
  stub({ status: 409, body });
  await assert.rejects(client().op("/members", "post")({ body: {} }), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 409);
    assert.equal(err.code, "taken");
    assert.equal(err.message, "already a member");
    assert.deepEqual(err.body, body);
    return true;
  });
});

test("an error body that is not the expected shape falls back to statusText", async () => {
  stub({ status: 500, type: "text/html", statusText: "Internal Server Error" });
  await assert.rejects(client().api("/x"), (err) => {
    assert.equal(err.code, "unknown");
    assert.equal(err.message, "Internal Server Error");
    assert.equal(err.body, null);
    return true;
  });
});
