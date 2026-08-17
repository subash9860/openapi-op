import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEndpoints, endpoints } from "../generator.mjs";

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
