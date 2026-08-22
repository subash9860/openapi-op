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

// The tag is the spec's own grouping, so it beats the URL: these four routes
// live under three different first segments and still belong together.
const tagged = {
  paths: {
    "/api/v1/permissions": {
      get: { tags: ["roles"], summary: "List Permissions", responses: { 200: {} } },
    },
    "/api/v1/roles": {
      get: { tags: ["roles"], summary: "List Roles", responses: { 200: {} } },
    },
    "/api/v1/admin/courses": {
      get: { tags: ["courses:admin"], summary: "Admin List Courses", responses: { 200: {} } },
      post: { tags: ["courses:admin"], summary: "Create Course", responses: { 201: {} } },
    },
    "/api/v1/admin/question-types": {
      get: {
        tags: ["question-types:admin"],
        summary: "List Question Types",
        responses: { 200: {} },
      },
    },
    "/api/v1/courses": {
      get: { tags: ["courses"], summary: "List Courses", responses: { 200: {} } },
    },
  },
};

test("the tag decides the group, not the path", () => {
  const groups = endpoints(tagged, { prefix: "/api/v1" });
  assert.deepEqual([...groups.keys()], [
    "roles",
    "courses:admin",
    "question-types:admin",
    "courses",
  ]);
  // `/permissions` is not its own group, and `/admin/*` is not one bucket.
  assert.deepEqual(groups.get("roles").map((r) => r.key), ["listPermissions", "list"]);
});

test("every word the group already says is dropped, from either end", () => {
  const groups = endpoints(tagged, { prefix: "/api/v1" });
  assert.deepEqual(groups.get("courses:admin").map((r) => r.key), ["list", "create"]);
  assert.deepEqual(groups.get("question-types:admin").map((r) => r.key), ["list"]);
  // A namespaced tag is still one identifier.
  assert.match(renderEndpoints(tagged, { prefix: "/api/v1" }), /export const coursesAdmin = \{/);
});

// Two verbs on one path can be tagged apart, so the group is read per
// operation. Grouping by path could not express this at all.
test("verbs on one path can land in different groups", () => {
  const groups = endpoints(
    {
      paths: {
        "/api/v1/courses": {
          get: { tags: ["courses"], summary: "List Courses", responses: { 200: {} } },
          post: { tags: ["courses:admin"], summary: "Create Course", responses: { 201: {} } },
        },
      },
    },
    { prefix: "/api/v1" },
  );
  assert.deepEqual(groups.get("courses").map((r) => r.key), ["list"]);
  assert.deepEqual(groups.get("courses:admin").map((r) => r.key), ["create"]);
});

test("a summary that is only its group keeps the word", () => {
  const groups = endpoints(
    {
      paths: {
        "/api/v1/me/checkout": {
          post: { tags: ["checkout"], summary: "Checkout", responses: { 200: {} } },
        },
      },
    },
    { prefix: "/api/v1" },
  );
  assert.deepEqual(groups.get("checkout").map((r) => r.key), ["checkout"]);
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
