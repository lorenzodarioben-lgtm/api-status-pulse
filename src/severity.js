function getSeverity({ healthy, statusOk, latencyOk, latencyMs, maxLatencyMs }) {
  if (!healthy || !statusOk || !latencyOk) {
    return "CRITICAL";
  }

  if (
    typeof latencyMs === "number" &&
    typeof maxLatencyMs === "number" &&
    latencyMs >= maxLatencyMs * 0.8
  ) {
    return "WARNING";
  }

  return "OK";
}

module.exports = {
  getSeverity,
};