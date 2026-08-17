// Runs from npm's `version` lifecycle: package.json is already bumped, the
// release commit is not made yet, so the prepended section lands in it.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

let range = "";
try { range = `${sh("git describe --tags --abbrev=0")}..HEAD`; } catch {}

const commits = sh(`git log ${range} --no-merges --pretty=format:%s`)
  .split("\n")
  .filter((s) => s && !/^chore: release v/.test(s))
  .map((s) => `- ${s}`)
  .join("\n");

const date = new Date().toISOString().slice(0, 10);
const entry = `## ${version} — ${date}\n\n${commits || "- no user-facing changes"}\n\n`;

const file = "CHANGELOG.md";
const old = readFileSync(file, "utf8");
const [head, ...rest] = old.split(/\n(?=## )/);
writeFileSync(file, `${head.trimEnd()}\n\n${entry}${rest.join("\n")}`);
