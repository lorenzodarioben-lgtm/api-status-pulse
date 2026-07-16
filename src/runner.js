function getConcurrency(value, checkCount) {
  if (value === undefined) {
    return Math.max(checkCount, 1);
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Concurrency must be a positive integer.");
  }

  return Math.min(value, Math.max(checkCount, 1));
}

async function runChecks(checks, checkEndpoint, concurrency) {
  const results = new Array(checks.length);
  const workerCount = getConcurrency(concurrency, checks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < checks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await checkEndpoint(checks[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

module.exports = {
  getConcurrency,
  runChecks,
};
