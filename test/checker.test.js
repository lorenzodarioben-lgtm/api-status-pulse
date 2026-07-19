const test = require("node:test");
const assert = require("node:assert/strict");

const { getExpectedHeaderChecks, getRetryDelay, readResponseBody, shouldRetryResult, isExpectedStatus, getErrorType, getNetworkErrorType, getNetworkErrorCode } = require("../src/checker");

test("evaluates configured response header expectations", () => {
  const checks = getExpectedHeaderChecks(
    new Headers({ "content-type": "application/json", "x-service-state": "ready" }),
    { "content-type": "application/json", "x-service-state": "ready" },
  );

  assert.deepEqual(checks, [
    {
      name: "content-type",
      expectedValue: "application/json",
      actualValue: "application/json",
      matches: true,
    },
    {
      name: "x-service-state",
      expectedValue: "ready",
      actualValue: "ready",
      matches: true,
    },
  ]);
});

test("calculates exponential retry delays", () => {
  const check = { retryDelayMs: 100, retryBackoffMultiplier: 2 };

  assert.equal(getRetryDelay(check, 1), 100);
  assert.equal(getRetryDelay(check, 2), 200);
  assert.equal(getRetryDelay(check, 3), 400);
});

test("retries only configured HTTP statuses while retaining network retries", () => {
  assert.equal(shouldRetryResult({ healthy: false, status: 503 }, { retryOnStatus: [429, 503] }), true);
  assert.equal(shouldRetryResult({ healthy: false, status: 404 }, { retryOnStatus: [429, 503] }), false);
  assert.equal(shouldRetryResult({ healthy: false, status: "ERROR" }, { retryOnStatus: [429, 503] }), true);
  assert.equal(shouldRetryResult({ healthy: false, status: 404 }, {}), true);
});

test("matches exact HTTP statuses or whole status classes", () => {
  assert.equal(isExpectedStatus(201, [200], [2]), true);
  assert.equal(isExpectedStatus(204, [200], [2]), true);
  assert.equal(isExpectedStatus(404, [200], [2]), false);
});

test("classifies endpoint and network failure causes", () => {
  assert.equal(getErrorType(false, true, true), "unexpected_status");
  assert.equal(getErrorType(true, false, true), "latency_threshold");
  assert.equal(getErrorType(true, true, false), "response_header");
  assert.equal(getErrorType(true, true, true, { matches: false, tooLarge: false }), "response_body");
  assert.equal(getErrorType(true, true, true), null);
  assert.equal(getNetworkErrorType({ name: "AbortError" }), "timeout");
  assert.equal(getNetworkErrorType(new Error("offline")), "network");
  assert.equal(getNetworkErrorType(new Error("redirect mode rejected the response")), "redirect");
  assert.equal(getNetworkErrorType({ name: "TypeError", cause: { code: "ENOTFOUND" } }), "dns");
  assert.equal(getNetworkErrorType({ name: "TypeError", cause: { code: "ECONNREFUSED" } }), "connection");
  assert.equal(getNetworkErrorType({ name: "TypeError", cause: { code: "CERT_HAS_EXPIRED" } }), "tls");
  assert.equal(getNetworkErrorCode({ cause: { code: "ENOTFOUND" } }), "ENOTFOUND");
});

test("stops reading inspected response bodies at the configured byte limit", async () => {
  const response = new Response("abcdefgh", { headers: { "content-length": "8" } });
  const result = await readResponseBody(response, 4);

  assert.deepEqual(result, { text: "", sizeBytes: 8, tooLarge: true });
});
