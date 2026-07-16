const test = require("node:test");
const assert = require("node:assert/strict");

const { validateCheck } = require("../src/config");

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
