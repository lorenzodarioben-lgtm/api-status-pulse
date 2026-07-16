const fs = require("fs");

function loadChecks(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const checks = JSON.parse(raw);

  if (!Array.isArray(checks)) {
    throw new Error("Config file must contain an array of checks.");
  }

  validateChecks(checks);

  return checks;
}

function validateChecks(checks) {
  for (const check of checks) {
    validateCheck(check);
  }

  validateUniqueValues(checks, "name");
  validateUniqueValues(checks, "url");
}

function validateCheck(check) {
  if (!check.name || typeof check.name !== "string") {
    throw new Error("Each check must have a non-empty name.");
  }

  if (!check.url || typeof check.url !== "string") {
    throw new Error(`Check "${check.name}" must have a URL.`);
  }

  if (!check.url.startsWith("https://")) {
    throw new Error(`Check "${check.name}" must use an HTTPS URL.`);
  }

  if (!check.method || typeof check.method !== "string") {
    throw new Error(`Check "${check.name}" must define an HTTP method.`);
  }

  if (!check.method || !["GET", "POST", "HEAD"].includes(check.method)) {
    throw new Error(`Check "${check.name}" uses an unsupported HTTP method.`);
  }

  if (check.body !== undefined && typeof check.body !== "string") {
    throw new Error(`Check "${check.name}" must define body as a string.`);
  }

  if (check.body !== undefined && ["GET", "HEAD"].includes(check.method)) {
    throw new Error(`Check "${check.name}" cannot define body for ${check.method} requests.`);
  }

  if (!Array.isArray(check.expectedStatus) || check.expectedStatus.length === 0) {
    throw new Error(`Check "${check.name}" must define expectedStatus as a non-empty array.`);
  }

  validateHeaders(check.headers, "headers", check.name);

  for (const status of check.expectedStatus) {
    if (typeof status !== "number" || status < 100 || status > 599) {
      throw new Error(`Check "${check.name}" has an invalid HTTP status code.`);
    }
  }

  if (typeof check.timeoutMs !== "number" || check.timeoutMs <= 0) {
    throw new Error(`Check "${check.name}" must define a positive timeoutMs value.`);
  }

  if (typeof check.maxLatencyMs !== "number" || check.maxLatencyMs <= 0) {
    throw new Error(`Check "${check.name}" must define a positive maxLatencyMs value.`);
  }

  if (
    check.warningLatencyRatio !== undefined &&
    (typeof check.warningLatencyRatio !== "number" ||
      check.warningLatencyRatio <= 0 ||
      check.warningLatencyRatio > 1)
  ) {
    throw new Error(`Check "${check.name}" must define warningLatencyRatio between 0 (exclusive) and 1.`);
  }

  if (typeof check.retries !== "number" || check.retries < 0) {
    throw new Error(`Check "${check.name}" must define retries as zero or more.`);
  }
}

function validateHeaders(headers, fieldName, checkName) {
  if (headers === undefined) {
    return;
  }

  if (!headers || Array.isArray(headers) || typeof headers !== "object") {
    throw new Error(`Check "${checkName}" must define ${fieldName} as an object of string values.`);
  }

  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (!headerName.trim() || typeof headerValue !== "string") {
      throw new Error(`Check "${checkName}" has an invalid ${fieldName} entry.`);
    }
  }
}

function validateUniqueValues(checks, fieldName) {
  const values = checks.map((check) => check[fieldName]);
  const uniqueValues = new Set(values);

  if (uniqueValues.size !== values.length) {
    throw new Error(`Each check must have a unique ${fieldName}.`);
  }
}

module.exports = {
  loadChecks,
  validateChecks,
  validateCheck,
  validateHeaders,
};
