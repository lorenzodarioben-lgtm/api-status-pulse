const { spawnSync } = require("node:child_process");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("--help prints CLI usage", () => {
  const result = spawnSync(process.execPath, ["index.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /API Status Pulse/);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--config <file>/);
  assert.match(result.stdout, /--fail-on-unhealthy/);
});

test("--version prints package version", () => {
  const result = spawnSync(process.execPath, ["index.js", "--version"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});