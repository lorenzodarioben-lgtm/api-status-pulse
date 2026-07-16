const { spawnSync } = require("node:child_process");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const { getOptionValue, getOutputDirectory } = require("../src/cli");

test("--help prints CLI usage", () => {
  const result = spawnSync(process.execPath, ["index.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /API Status Pulse/);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--config <file>/);
  assert.match(result.stdout, /--concurrency <count>/);
  assert.match(result.stdout, /--output-dir <directory>/);
  assert.match(result.stdout, /--no-report/);
  assert.match(result.stdout, /--fail-on-unhealthy/);
});

test("--version prints package version", () => {
  const result = spawnSync(process.execPath, ["index.js", "--version"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});

test("parses report output options and rejects missing values", () => {
  assert.equal(getOutputDirectory(["--output-dir", "artifacts"]), "artifacts");
  assert.equal(getOptionValue([], "--config"), undefined);
  assert.throws(() => getOptionValue(["--config"], "--config"), /requires a value/);
});
