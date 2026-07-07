const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadChecks } = require("../src/config");

const exampleFiles = [
  "examples/basic.checks.json",
  "examples/strict.checks.json",
];

test("example config files exist", () => {
  for (const file of exampleFiles) {
    assert.ok(fs.existsSync(file), `${file} should exist`);
  }
});

test("example config files are valid", () => {
  for (const file of exampleFiles) {
    const checks = loadChecks(file);

    assert.ok(Array.isArray(checks));
    assert.ok(checks.length > 0);
  }
});
