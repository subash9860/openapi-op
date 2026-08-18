import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The type helpers are the package — a wrong `Args` is a wrong call site
// everywhere downstream, and nothing else here would notice.
test("call shapes: required stays required, optional stays optional", () => {
  execFileSync(
    path.join(root, "node_modules/.bin/tsc"),
    ["--noEmit", "--strict", "--target", "ES2022", "--lib", "ES2022,DOM",
     "--module", "ESNext", "--moduleResolution", "bundler",
     "test/types.fixture.ts"],
    { cwd: root, stdio: "inherit" },
  );
});
