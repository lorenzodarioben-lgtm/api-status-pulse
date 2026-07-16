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
