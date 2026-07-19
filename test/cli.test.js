const { spawnSync } = require("node:child_process");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const { getOptionValue, getOptionValues, getOutputDirectory, getOutputFormat, getTags, buildRunPlan } = require("../src/cli");

test("--help prints CLI usage", () => {
  const result = spawnSync(process.execPath, ["index.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /API Status Pulse/);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--config <file>/);
  assert.match(result.stdout, /--concurrency <count>/);
  assert.match(result.stdout, /--tag <tag>/);
  assert.match(result.stdout, /--dry-run/);
  assert.match(result.stdout, /--output-dir <directory>/);
  assert.match(result.stdout, /--no-report/);
  assert.match(result.stdout, /--format <text\|json>/);
  assert.match(result.stdout, /--fail-on-unhealthy/);
});

test("--version prints package version", () => {
  const result = spawnSync(process.execPath, ["index.js", "--version"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});

test("validates machine-readable output formats", () => {
  assert.equal(getOutputFormat([]), "text");
  assert.equal(getOutputFormat(["--format", "json"]), "json");
  assert.throws(() => getOutputFormat(["--format", "yaml"]), /text or json/);
});

test("parses report output options and rejects missing values", () => {
  assert.equal(getOutputDirectory(["--output-dir", "artifacts"]), "artifacts");
  assert.equal(getOptionValue([], "--config"), undefined);
  assert.throws(() => getOptionValue(["--config"], "--config"), /requires a value/);
});

test("parses repeatable tag filters without allowing duplicated single options", () => {
  assert.deepEqual(getTags(["--tag", "production", "--tag", "payments"]), ["production", "payments"]);
  assert.deepEqual(getOptionValues(["--tag", "production"], "--tag"), ["production"]);
  assert.throws(() => getOptionValue(["--config", "a.json", "--config", "b.json"], "--config"), /can only be provided once/);
});

test("builds a request-free execution plan", () => {
  const plan = buildRunPlan(
    [{ name: "Status", method: "GET", url: "https://example.com/status", tags: ["production"] }],
    { configFile: "checks.json", tags: ["production"], concurrency: undefined },
  );

  assert.equal(plan.selectedCount, 1);
  assert.equal(plan.concurrency, 1);
  assert.deepEqual(plan.checks[0], {
    name: "Status",
    method: "GET",
    url: "https://example.com/status",
    tags: ["production"],
  });
});
