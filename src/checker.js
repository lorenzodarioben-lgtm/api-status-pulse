const { getSeverity } = require("./severity");

const DEFAULT_MAX_RESPONSE_BODY_BYTES = 65536;

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

    if (attempt <= retries && shouldRetryResult(result, check)) {
      await sleep(getRetryDelay(check, attempt));
    } else {
      break;
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

    const expectedStatuses = check.expectedStatus ?? [200];
    const statusOk = expectedStatuses.includes(response.status);
    const headerChecks = getExpectedHeaderChecks(response.headers, check.expectedHeaders);
    const headersOk = headerChecks.every((header) => header.matches);
    const bodyCheck = await getBodyCheck(response, check.expectedBodyIncludes, check.maxResponseBodyBytes);
    const bodyOk = bodyCheck?.matches ?? true;
    const latencyMs = Date.now() - start;
    clearTimeout(timeout);
    const latencyOk =
      typeof check.maxLatencyMs === "number"
        ? latencyMs <= check.maxLatencyMs
        : true;

    const healthy = statusOk && latencyOk && headersOk && bodyOk;
    const errorType = getErrorType(statusOk, latencyOk, headersOk, bodyCheck);
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
      reason: getReason(statusOk, latencyOk, headersOk, bodyOk, response.status, latencyMs, check, headerChecks, bodyCheck),
      errorType,
      headerChecks,
      bodyCheck,
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
      bodyCheck: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

function shouldRetryResult(result, check) {
  if (result.healthy || check.retryOnStatus === undefined) {
    return !result.healthy;
  }

  return typeof result.status !== "number" || check.retryOnStatus.includes(result.status);
}

async function getBodyCheck(response, expectedBodyIncludes, maxResponseBodyBytes = DEFAULT_MAX_RESPONSE_BODY_BYTES) {
  if (expectedBodyIncludes === undefined) {
    return null;
  }

  const body = await readResponseBody(response, maxResponseBodyBytes);

  return {
    expectedBodyIncludes,
    maxResponseBodyBytes,
    sizeBytes: body.sizeBytes,
    tooLarge: body.tooLarge,
    matches: !body.tooLarge && body.text.includes(expectedBodyIncludes),
  };
}

async function readResponseBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isInteger(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    return { text: "", sizeBytes: declaredLength, tooLarge: true };
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return { text: "", sizeBytes: 0, tooLarge: false };
  }

  const chunks = [];
  let sizeBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      sizeBytes += value.byteLength;

      if (sizeBytes > maxBytes) {
        await reader.cancel();
        return { text: "", sizeBytes, tooLarge: true };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(sizeBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { text: new TextDecoder().decode(bytes), sizeBytes, tooLarge: false };
}

function getErrorType(statusOk, latencyOk, headersOk, bodyCheck = null) {
  if (!statusOk) {
    return "unexpected_status";
  }

  if (!latencyOk) {
    return "latency_threshold";
  }

  if (!headersOk) {
    return "response_header";
  }

  if (bodyCheck && !bodyCheck.matches) {
    return bodyCheck.tooLarge ? "response_body_too_large" : "response_body";
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
    bodyCheck: result.bodyCheck,
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

function getReason(statusOk, latencyOk, headersOk, bodyOk, status, latencyMs, check, headerChecks = [], bodyCheck = null) {
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

  if (!bodyOk) {
    if (bodyCheck.tooLarge) {
      return `Response body exceeded limit of ${bodyCheck.maxResponseBodyBytes} bytes`;
    }

    return `Response body did not include: ${bodyCheck.expectedBodyIncludes}`;
  }

  return "Healthy";
}

module.exports = {
  checkEndpoint,
  runSingleAttempt,
  getReason,
  buildRequestHeaders,
  getExpectedHeaderChecks,
  getBodyCheck,
  readResponseBody,
  getRetryDelay,
  shouldRetryResult,
  getErrorType,
  getNetworkErrorType,
  toAttemptSummary,
  DEFAULT_MAX_RESPONSE_BODY_BYTES,
};
