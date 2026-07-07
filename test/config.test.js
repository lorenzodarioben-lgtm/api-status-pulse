const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const checks = JSON.parse(fs.readFileSync("checks.json", "utf8"));

test("checks.json contains at least one endpoint check", () => {
  assert.ok(Array.isArray(checks));
  assert.ok(checks.length > 0);
});

test("each check has required fields", () => {
  for (const check of checks) {
    assert.equal(typeof check.name, "string");
    assert.ok(check.name.length > 0);

    assert.equal(typeof check.url, "string");
    assert.ok(check.url.startsWith("https://"));

    assert.equal(typeof check.method, "string");
    assert.ok(["GET", "POST", "HEAD"].includes(check.method));

    assert.ok(Array.isArray(check.expectedStatus));
    assert.ok(check.expectedStatus.length > 0);

    assert.equal(typeof check.timeoutMs, "number");
    assert.ok(check.timeoutMs > 0);

    assert.equal(typeof check.maxLatencyMs, "number");
    assert.ok(check.maxLatencyMs > 0);

    assert.equal(typeof check.retries, "number");
    assert.ok(check.retries >= 0);
  }
});

test("expected HTTP status codes are valid", () => {
  for (const check of checks) {
    for (const status of check.expectedStatus) {
      assert.equal(typeof status, "number");
      assert.ok(status >= 100);
      assert.ok(status <= 599);
    }
  }
});

test("endpoint names are unique", () => {
  const names = checks.map((check) => check.name);
  const uniqueNames = new Set(names);

  assert.equal(uniqueNames.size, names.length);
});

test("endpoint URLs are unique", () => {
  const urls = checks.map((check) => check.url);
  const uniqueUrls = new Set(urls);

  assert.equal(uniqueUrls.size, urls.length);
});