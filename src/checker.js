async function checkEndpoint(check) {
  const retries = check.retries ?? 0;
  let lastResult = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const result = await runSingleAttempt(check, attempt);
    lastResult = result;

    if (result.healthy) {
      return result;
    }
  }

  return lastResult;
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
      headers: {
        "User-Agent": "api-status-pulse",
      },
    });

    const latencyMs = Date.now() - start;
    clearTimeout(timeout);

    const expectedStatuses = check.expectedStatus ?? [200];
    const statusOk = expectedStatuses.includes(response.status);
    const latencyOk =
      typeof check.maxLatencyMs === "number"
        ? latencyMs <= check.maxLatencyMs
        : true;

    const healthy = statusOk && latencyOk;

    return {
      name: check.name,
      url: check.url,
      method: check.method ?? "GET",
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      maxLatencyMs: check.maxLatencyMs ?? null,
      attempt,
      healthy,
      reason: getReason(statusOk, latencyOk, response.status, latencyMs, check),
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
      latencyMs: null,
      maxLatencyMs: check.maxLatencyMs ?? null,
      attempt,
      healthy: false,
      reason: error.name === "AbortError" ? "Request timed out" : error.message,
      checkedAt: new Date().toISOString(),
    };
  }
}

function getReason(statusOk, latencyOk, status, latencyMs, check) {
  if (!statusOk) {
    return `Unexpected status code: ${status}`;
  }

  if (!latencyOk) {
    return `Latency ${latencyMs}ms exceeded limit of ${check.maxLatencyMs}ms`;
  }

  return "Healthy";
}

module.exports = {
  checkEndpoint,
  runSingleAttempt,
  getReason,
};