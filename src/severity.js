function getSeverity({
  healthy,
  statusOk,
  latencyOk,
  latencyMs,
  maxLatencyMs,
  warningLatencyRatio = 0.8,
}) {
  if (!healthy || !statusOk || !latencyOk) {
    return "CRITICAL";
  }

  if (
    typeof latencyMs === "number" &&
    typeof maxLatencyMs === "number" &&
    latencyMs >= maxLatencyMs * warningLatencyRatio
  ) {
    return "WARNING";
  }

  return "OK";
}

module.exports = {
  getSeverity,
};
