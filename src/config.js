const fs = require("fs");

function loadChecks(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  let checks;

  try {
    checks = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Config file contains invalid JSON: ${filePath}`);
  }

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
  if (!check.name || typeof check.name !== "string" || check.name.trim() !== check.name) {
    throw new Error("Each check must have a non-empty name.");
  }

  if (!check.url || typeof check.url !== "string") {
    throw new Error(`Check "${check.name}" must have a URL.`);
  }

  validateUrl(check.url, check.name);

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

  if (check.expectedBodyIncludes !== undefined && (!check.expectedBodyIncludes || typeof check.expectedBodyIncludes !== "string")) {
    throw new Error(`Check "${check.name}" must define expectedBodyIncludes as a non-empty string.`);
  }

  if (
    check.maxResponseBodyBytes !== undefined &&
    (!Number.isInteger(check.maxResponseBodyBytes) ||
      check.maxResponseBodyBytes <= 0 ||
      check.maxResponseBodyBytes > 1048576)
  ) {
    throw new Error(`Check "${check.name}" must define maxResponseBodyBytes between 1 and 1048576.`);
  }

  if (check.enabled !== undefined && typeof check.enabled !== "boolean") {
    throw new Error(`Check "${check.name}" must define enabled as a boolean.`);
  }

  validateTags(check.tags, check.name);

  if (check.redirect !== undefined && !["follow", "manual", "error"].includes(check.redirect)) {
    throw new Error(`Check "${check.name}" must define redirect as follow, manual, or error.`);
  }

  if (!Array.isArray(check.expectedStatus) || check.expectedStatus.length === 0) {
    throw new Error(`Check "${check.name}" must define expectedStatus as a non-empty array.`);
  }

  validateHeaders(check.headers, "headers", check.name);
  validateHeaders(check.expectedHeaders, "expectedHeaders", check.name);

  validateStatusCodes(check.expectedStatus, "expectedStatus", check.name);

  if (check.retryOnStatus !== undefined) {
    if (!Array.isArray(check.retryOnStatus) || check.retryOnStatus.length === 0) {
      throw new Error(`Check "${check.name}" must define retryOnStatus as a non-empty array.`);
    }

    validateStatusCodes(check.retryOnStatus, "retryOnStatus", check.name);
  }

  if (!Number.isInteger(check.timeoutMs) || check.timeoutMs <= 0) {
    throw new Error(`Check "${check.name}" must define a positive timeoutMs value.`);
  }

  if (!Number.isInteger(check.maxLatencyMs) || check.maxLatencyMs <= 0) {
    throw new Error(`Check "${check.name}" must define a positive maxLatencyMs value.`);
  }

  if (
    check.warningLatencyRatio !== undefined &&
    (!Number.isFinite(check.warningLatencyRatio) ||
      check.warningLatencyRatio <= 0 ||
      check.warningLatencyRatio > 1)
  ) {
    throw new Error(`Check "${check.name}" must define warningLatencyRatio between 0 (exclusive) and 1.`);
  }

  if (!Number.isInteger(check.retries) || check.retries < 0) {
    throw new Error(`Check "${check.name}" must define retries as zero or more.`);
  }

  if (
    check.retryDelayMs !== undefined &&
    (!Number.isInteger(check.retryDelayMs) || check.retryDelayMs < 0 || check.retryDelayMs > 60000)
  ) {
    throw new Error(`Check "${check.name}" must define retryDelayMs between 0 and 60000 milliseconds.`);
  }

  if (
    check.retryBackoffMultiplier !== undefined &&
    (!Number.isFinite(check.retryBackoffMultiplier) ||
      check.retryBackoffMultiplier < 1 ||
      check.retryBackoffMultiplier > 10)
  ) {
    throw new Error(`Check "${check.name}" must define retryBackoffMultiplier between 1 and 10.`);
  }
}

function validateUrl(value, checkName) {
  let url;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`Check "${checkName}" must define a valid HTTPS URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`Check "${checkName}" must use an HTTPS URL.`);
  }

  if (url.username || url.password) {
    throw new Error(`Check "${checkName}" URL must not include credentials.`);
  }

  if (url.hash) {
    throw new Error(`Check "${checkName}" URL must not include a fragment.`);
  }
}

function validateStatusCodes(statuses, fieldName, checkName) {
  for (const status of statuses) {
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error(`Check "${checkName}" has an invalid ${fieldName} HTTP status code.`);
    }
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

    try {
      new Headers([[headerName, headerValue]]);
    } catch (error) {
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

function isCheckEnabled(check) {
  return check.enabled !== false;
}

function filterEnabledChecks(checks) {
  return checks.filter(isCheckEnabled);
}

function validateTags(tags, checkName) {
  if (tags === undefined) {
    return;
  }

  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim() !== tag)) {
    throw new Error(`Check "${checkName}" must define tags as an array of non-empty strings.`);
  }

  if (new Set(tags).size !== tags.length) {
    throw new Error(`Check "${checkName}" must not repeat tags.`);
  }
}

function filterChecksByTags(checks, tags = []) {
  if (tags.length === 0) {
    return checks;
  }

  return checks.filter((check) => check.tags?.some((tag) => tags.includes(tag)));
}

function filterChecksByNames(checks, names = []) {
  if (names.length === 0) {
    return checks;
  }

  return checks.filter((check) => names.includes(check.name));
}

module.exports = {
  loadChecks,
  validateChecks,
  validateCheck,
  validateUrl,
  validateStatusCodes,
  validateHeaders,
  isCheckEnabled,
  filterEnabledChecks,
  validateTags,
  filterChecksByTags,
  filterChecksByNames,
};
