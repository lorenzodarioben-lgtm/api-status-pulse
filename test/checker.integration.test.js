const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const { checkEndpoint } = require("../src/checker");

let server;
let baseUrl;
let flakyRequestCount = 0;
let missingRequestCount = 0;

test.before(async () => {
  server = http.createServer((request, response) => {
    if (request.url === "/probe") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const isAuthorized = request.headers.authorization === "Bearer integration-token";
        const hasExpectedBody = body === JSON.stringify({ probe: true });
        response.writeHead(isAuthorized && hasExpectedBody ? 201 : 401, { "x-service-state": "ready" });
        response.end();
      });
      return;
    }

    if (request.url === "/flaky") {
      flakyRequestCount += 1;
      response.writeHead(flakyRequestCount === 1 ? 503 : 200);
      response.end();
      return;
    }

    if (request.url === "/slow") {
      setTimeout(() => {
        response.writeHead(200);
        response.end();
      }, 40);
      return;
    }

    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/final" });
      response.end();
      return;
    }

    if (request.url === "/final") {
      response.writeHead(200);
      response.end();
      return;
    }

    if (request.url === "/missing") {
      missingRequestCount += 1;
      response.writeHead(404);
      response.end();
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

test("runs an authenticated POST check and validates response headers", async () => {
  const result = await checkEndpoint({
    name: "Probe",
    url: `${baseUrl}/probe`,
    method: "POST",
    body: JSON.stringify({ probe: true }),
    headers: { Authorization: "Bearer integration-token" },
    expectedStatus: [201],
    expectedHeaders: { "x-service-state": "ready" },
    timeoutMs: 1000,
    maxLatencyMs: 1000,
    retries: 0,
  });

  assert.equal(result.healthy, true);
  assert.equal(result.status, 201);
  assert.equal(result.headerChecks[0].matches, true);
  assert.equal(result.attempts.length, 1);
});

test("retries an unhealthy endpoint and preserves attempt diagnostics", async () => {
  const result = await checkEndpoint({
    name: "Flaky",
    url: `${baseUrl}/flaky`,
    method: "GET",
    expectedStatus: [200],
    timeoutMs: 1000,
    maxLatencyMs: 1000,
    retries: 1,
    retryDelayMs: 0,
  });

  assert.equal(result.healthy, true);
  assert.equal(result.attempt, 2);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0].errorType, "unexpected_status");
});

test("classifies aborted requests as timeouts", async () => {
  const result = await checkEndpoint({
    name: "Slow",
    url: `${baseUrl}/slow`,
    method: "GET",
    expectedStatus: [200],
    timeoutMs: 5,
    maxLatencyMs: 1000,
    retries: 0,
  });

  assert.equal(result.healthy, false);
  assert.equal(result.errorType, "timeout");
  assert.equal(result.attempts.length, 1);
});

test("follows or exposes redirects according to check policy", async () => {
  const commonCheck = {
    name: "Redirect",
    url: `${baseUrl}/redirect`,
    method: "GET",
    expectedStatus: [200],
    timeoutMs: 1000,
    maxLatencyMs: 1000,
    retries: 0,
  };

  const followed = await checkEndpoint(commonCheck);
  const manual = await checkEndpoint({ ...commonCheck, redirect: "manual" });

  assert.equal(followed.healthy, true);
  assert.equal(followed.redirected, true);
  assert.match(followed.finalUrl, /\/final$/);
  assert.equal(manual.status, 302);
  assert.equal(manual.errorType, "unexpected_status");
});

test("does not retry non-retryable HTTP statuses", async () => {
  const result = await checkEndpoint({
    name: "Missing",
    url: `${baseUrl}/missing`,
    method: "GET",
    expectedStatus: [200],
    timeoutMs: 1000,
    maxLatencyMs: 1000,
    retries: 2,
    retryOnStatus: [503],
  });

  assert.equal(result.status, 404);
  assert.equal(result.attempts.length, 1);
  assert.equal(missingRequestCount, 1);
});
