const test = require("node:test");
const assert = require("node:assert/strict");

const { getConcurrency, runChecks } = require("../src/runner");

test("bounds concurrency to the number of checks", () => {
  assert.equal(getConcurrency(undefined, 3), 3);
  assert.equal(getConcurrency(8, 3), 3);
  assert.equal(getConcurrency(2, 3), 2);
  assert.throws(() => getConcurrency(0, 3), /positive integer/);
});

test("runs checks up to the configured concurrency and preserves order", async () => {
  let active = 0;
  let maxActive = 0;

  const results = await runChecks(["one", "two", "three"], async (check) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return check.toUpperCase();
  }, 2);

  assert.equal(maxActive, 2);
  assert.deepEqual(results, ["ONE", "TWO", "THREE"]);
});
