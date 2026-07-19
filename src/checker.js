const { getSeverity } = require("./severity");

async function checkEndpoint(check) {
  const retries = check.retries ?? 0;
  let lastResult = null;
  const attempts = [];

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const result = await runSingleAttempt(check, attempt);
    lastResult = result;
    attempts.push(toAttemptSummary(result));

    if (result.healthy) {
      return { ...result, attempts };
    }

    if (attempt <= retries) {
      await sleep(getRetryDelay(check, attempt));
    }
  }

  return { ...lastResult, attempts };
}

async function runSingleAttempt(check, attempt) {
  const controller = new AbortController();
  const timeoutMs = check.timeoutMs ?? 5000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();

  try {
    const response = await fetch(check.url, {
      method: check.method ?? "GET",
      signal: controller.signal,
      headers: buildRequestHeaders(check.headers),
      body: check.body,
      redirect: check.redirect ?? "follow",
    });

    const latencyMs = Date.now() - start;
    clearTimeout(timeout);

    const expectedStatuses = check.expectedStatus ?? [200];
    const statusOk = expectedStatuses.includes(response.status);
    const headerChecks = getExpectedHeaderChecks(response.headers, check.expectedHeaders);
    const headersOk = headerChecks.every((header) => header.matches);
    const latencyOk =
      typeof check.maxLatencyMs === "number"
        ? latencyMs <= check.maxLatencyMs
        : true;

    const healthy = statusOk && latencyOk && headersOk;
    const errorType = getErrorType(statusOk, latencyOk, headersOk);
    const severity = getSeverity({
      healthy,
      statusOk,
      latencyOk,
      latencyMs,
      maxLatencyMs: check.maxLatencyMs,
      warningLatencyRatio: check.warningLatencyRatio,
    });

    return {
      name: check.name,
      url: check.url,
      method: check.method ?? "GET",
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url,
      redirected: response.redirected,
      latencyMs,
      maxLatencyMs: check.maxLatencyMs ?? null,
      warningLatencyRatio: check.warningLatencyRatio ?? 0.8,
      attempt,
      healthy,
      severity,
      reason: getReason(statusOk, latencyOk, headersOk, response.status, latencyMs, check, headerChecks),
      errorType,
      headerChecks,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    clearTimeout(timeout);

    return {
      name: check.name,
      url: check.url,
      method: check.method ?? "GET",
      status: "ERROR",
      statusText: error.name === "AbortError" ? "Timeout" : "Request failed",
      finalUrl: null,
      redirected: false,
      latencyMs: null,
      maxLatencyMs: check.maxLatencyMs ?? null,
      warningLatencyRatio: check.warningLatencyRatio ?? 0.8,
      attempt,
      healthy: false,
      severity: "CRITICAL",
      reason: error.name === "AbortError" ? "Request timed out" : error.message,
      errorType: getNetworkErrorType(error),
      headerChecks: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

function getErrorType(statusOk, latencyOk, headersOk) {
  if (!statusOk) {
    return "unexpected_status";
  }

  if (!latencyOk) {
    return "latency_threshold";
  }

  if (!headersOk) {
    return "response_header";
  }

  return null;
}

function getNetworkErrorType(error) {
  if (error.name === "AbortError") {
    return "timeout";
  }

  return error.message.toLowerCase().includes("redirect") ? "redirect" : "network";
}

function toAttemptSummary(result) {
  return {
    attempt: result.attempt,
    status: result.status,
    statusText: result.statusText,
    latencyMs: result.latencyMs,
    healthy: result.healthy,
    severity: result.severity,
    reason: result.reason,
    errorType: result.errorType,
    checkedAt: result.checkedAt,
  };
}

function getRetryDelay(check, failedAttempts) {
  const initialDelay = check.retryDelayMs ?? 0;
  const multiplier = check.retryBackoffMultiplier ?? 1;

  return Math.round(initialDelay * multiplier ** (failedAttempts - 1));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildRequestHeaders(headers = {}) {
  const requestHeaders = new Headers({ "User-Agent": "api-status-pulse" });

  for (const [name, value] of Object.entries(headers)) {
    requestHeaders.set(name, value);
  }

  return requestHeaders;
}

function getExpectedHeaderChecks(responseHeaders, expectedHeaders = {}) {
  return Object.entries(expectedHeaders).map(([name, expectedValue]) => {
    const actualValue = responseHeaders.get(name);

    return {
      name,
      expectedValue,
      actualValue,
      matches: actualValue === expectedValue,
    };
  });
}

function getReason(statusOk, latencyOk, headersOk, status, latencyMs, check, headerChecks = []) {
  if (!statusOk) {
    return `Unexpected status code: ${status}`;
  }

  if (!latencyOk) {
    return `Latency ${latencyMs}ms exceeded limit of ${check.maxLatencyMs}ms`;
  }

  if (!headersOk) {
    const failedHeader = headerChecks.find((header) => !header.matches);
    return `Unexpected response header ${failedHeader.name}: ${failedHeader.actualValue ?? "missing"}`;
  }

  return "Healthy";
}

module.exports = {
  checkEndpoint,
  runSingleAttempt,
  getReason,
  buildRequestHeaders,
  getExpectedHeaderChecks,
  getRetryDelay,
  getErrorType,
  getNetworkErrorType,
  toAttemptSummary,
};
