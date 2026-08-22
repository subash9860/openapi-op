import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEndpoints, renderOperations, endpoints, modelTypes } from "../generator.mjs";

const spec = {
  paths: {
    "/api/v1/members": {
      get: {
        summary: "List Members",
        responses: {
          200: {
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Paginated_MemberOut_" } },
            },
          },
        },
      },
      post: { summary: "Invite Member", responses: { 201: {} } },
    },
    "/api/v1/members/{user_id}": {
      patch: { summary: "Change Role", responses: { 200: {} } },
    },
    "/healthz": { get: { summary: "Healthz", responses: { 200: {} } } },
  },
};

test("group word is dropped, other nouns kept", () => {
  const rows = endpoints(spec, { prefix: "/api/v1" }).get("members");
  assert.deepEqual(
    rows.map((r) => r.key),
    ["list", "invite", "changeRole"],
  );
});

test("routes outside the prefix are left alone", () => {
  assert.equal(endpoints(spec, { prefix: "/api/v1" }).has("healthz"), false);
});

test("a Paginated response gets a rows-only sibling", () => {
  const src = renderEndpoints(spec, { prefix: "/api/v1" });
  assert.match(src, /const membersList = op\("\/api\/v1\/members", "get"\);/);
  assert.match(src, /listItems: async \(\.\.\.args/);
  assert.match(src, /import \{ op \} from "\.\/api";/);
});

test("a named request/response pair per operation, off the summary", () => {
  const src = renderOperations(spec);
  assert.match(src, /export type ListMembersResponse = Res<paths, "\/api\/v1\/members", "get">;/);
  assert.match(src, /export type ChangeRoleResponse = Res<paths, "\/api\/v1\/members\/\{user_id\}", "patch">;/);
  // No body on the route, so there is no request type to name.
  assert.doesNotMatch(src, /ListMembersRequest/);
  // Outside `--prefix` too: `api()` reaches those, and they still have types.
  assert.match(src, /export type HealthzResponse/);
});

test("two summaries that collide are kept apart by the verb", () => {
  const src = renderOperations({
    paths: {
      "/a": { get: { summary: "Ping", responses: { 200: {} } } },
      "/b": { post: { summary: "Ping", responses: { 200: {} } } },
    },
  });
  assert.match(src, /export type PingResponse = Res<paths, "\/a", "get">;/);
  assert.match(src, /export type PostPingResponse = Res<paths, "\/b", "post">;/);
});

test("an operation base that would shadow a component schema keeps its verb", () => {
  const src = renderOperations({
    paths: {
      "/api/v1/me/checkout": {
        post: { summary: "Checkout", requestBody: {}, responses: { 200: {} } },
      },
    },
    components: { schemas: { CheckoutRequest: {}, CheckoutResponse: {} } },
  });
  assert.match(src, /export type PostCheckoutRequest = Req<paths, "\/api\/v1\/me\/checkout", "post">;/);
  assert.match(src, /export type PostCheckoutResponse = Res<paths, "\/api\/v1\/me\/checkout", "post">;/);
  assert.match(src, /export type CheckoutRequest = components\["schemas"\]\["CheckoutRequest"\];/);
  assert.match(src, /export type CheckoutResponse = components\["schemas"\]\["CheckoutResponse"\];/);
});

test("one named type per component schema, alongside the operations", () => {
  const withSchemas = {
    ...spec,
    components: { schemas: { MemberOut: {}, CourseOut: {} } },
  };
  assert.deepEqual(modelTypes(withSchemas), ["CourseOut", "MemberOut"]);

  const src = renderOperations(withSchemas);
  assert.match(src, /export type CourseOut = components\["schemas"\]\["CourseOut"\];/);
  assert.match(src, /export type MemberOut = components\["schemas"\]\["MemberOut"\];/);
  assert.match(src, /import type \{ components, paths \} from "\.\/schema";/);
});

test("a spec with no component schemas does not import `components`", () => {
  const src = renderOperations({ paths: { "/ping": { get: { summary: "Ping", responses: { 200: {} } } } } });
  assert.match(src, /import type \{ paths \} from ".\/schema";/);
  assert.doesNotMatch(src, /components/);
});
