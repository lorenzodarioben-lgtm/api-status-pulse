const test = require("node:test");
const assert = require("node:assert/strict");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadChecks, validateCheck, filterEnabledChecks, filterChecksByTags } = require("../src/config");

const validCheck = {
  name: "Example API",
  url: "https://example.com/health",
  method: "GET",
  expectedStatus: [200],
  timeoutMs: 1000,
  maxLatencyMs: 500,
  retries: 0,
};

test("allows optional request headers", () => {
  assert.doesNotThrow(() => {
    validateCheck({
      ...validCheck,
      headers: { Authorization: "Bearer test-token", Accept: "application/json" },
    });
  });
});

test("rejects malformed request headers", () => {
  assert.throws(
    () => validateCheck({ ...validCheck, headers: ["Authorization: token"] }),
    /headers as an object of string values/,
  );

  assert.throws(
    () => validateCheck({ ...validCheck, headers: { Authorization: 42 } }),
    /invalid headers entry/,
  );
});

test("allows string request bodies only for POST checks", () => {
  assert.doesNotThrow(() => {
    validateCheck({
      ...validCheck,
      method: "POST",
      body: JSON.stringify({ probe: true }),
    });
  });

  assert.throws(
    () => validateCheck({ ...validCheck, body: "not allowed for GET" }),
    /cannot define body for GET requests/,
  );

  assert.throws(
    () => validateCheck({ ...validCheck, method: "POST", body: { probe: true } }),
    /must define body as a string/,
  );
});

test("validates optional latency warning ratios", () => {
  assert.doesNotThrow(() => {
    validateCheck({ ...validCheck, warningLatencyRatio: 0.65 });
  });

  assert.throws(
    () => validateCheck({ ...validCheck, warningLatencyRatio: 0 }),
    /warningLatencyRatio between 0/,
  );
});

test("allows expected response headers", () => {
  assert.doesNotThrow(() => {
    validateCheck({ ...validCheck, expectedHeaders: { "x-service-state": "ready" } });
  });

  assert.throws(
    () => validateCheck({ ...validCheck, expectedHeaders: { "x-service-state": false } }),
    /invalid expectedHeaders entry/,
  );
});

test("validates bounded retry delay settings", () => {
  assert.doesNotThrow(() => {
    validateCheck({
      ...validCheck,
      retries: 2,
      retryDelayMs: 250,
      retryBackoffMultiplier: 2,
    });
  });

  assert.throws(
    () => validateCheck({ ...validCheck, retryDelayMs: -1 }),
    /retryDelayMs between 0 and 60000/,
  );
});

test("rejects malformed, credentialed, and fragment URLs", () => {
  assert.throws(
    () => validateCheck({ ...validCheck, url: "https://" }),
    /valid HTTPS URL/,
  );

  assert.throws(
    () => validateCheck({ ...validCheck, url: "https://user:secret@example.com" }),
    /must not include credentials/,
  );

  assert.throws(
    () => validateCheck({ ...validCheck, url: "https://example.com/health#section" }),
    /must not include a fragment/,
  );
});

test("requires finite integer timing and retry values", () => {
  assert.throws(() => validateCheck({ ...validCheck, timeoutMs: 1.5 }), /positive timeoutMs/);
  assert.throws(() => validateCheck({ ...validCheck, maxLatencyMs: Infinity }), /positive maxLatencyMs/);
  assert.throws(() => validateCheck({ ...validCheck, retries: 0.5 }), /retries as zero or more/);
});

test("adds the source path to invalid JSON errors", () => {
  const configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "api-status-pulse-")), "checks.json");
  fs.writeFileSync(configPath, "{");

  assert.throws(() => loadChecks(configPath), new RegExp(`invalid JSON: ${configPath.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`));
});

test("supports explicitly disabled checks", () => {
  assert.doesNotThrow(() => validateCheck({ ...validCheck, enabled: false }));
  assert.throws(() => validateCheck({ ...validCheck, enabled: "false" }), /enabled as a boolean/);

  assert.deepEqual(
    filterEnabledChecks([{ ...validCheck }, { ...validCheck, name: "Disabled", enabled: false }]).map((check) => check.name),
    ["Example API"],
  );
});

test("validates tags and filters checks by any requested tag", () => {
  assert.doesNotThrow(() => validateCheck({ ...validCheck, tags: ["production", "payments"] }));
  assert.throws(() => validateCheck({ ...validCheck, tags: ["production", "production"] }), /must not repeat tags/);

  const checks = [
    { ...validCheck, tags: ["production", "payments"] },
    { ...validCheck, name: "Search", tags: ["production", "search"] },
  ];

  assert.deepEqual(filterChecksByTags(checks, ["payments", "staging"]).map((check) => check.name), ["Example API"]);
});

test("validates explicit redirect behavior", () => {
  assert.doesNotThrow(() => validateCheck({ ...validCheck, redirect: "manual" }));
  assert.throws(() => validateCheck({ ...validCheck, redirect: "sometimes" }), /redirect as follow, manual, or error/);
});

test("validates retryable HTTP statuses", () => {
  assert.doesNotThrow(() => validateCheck({ ...validCheck, retryOnStatus: [429, 503] }));
  assert.throws(() => validateCheck({ ...validCheck, retryOnStatus: [] }), /retryOnStatus as a non-empty array/);
  assert.throws(() => validateCheck({ ...validCheck, retryOnStatus: [700] }), /invalid retryOnStatus HTTP status code/);
});
