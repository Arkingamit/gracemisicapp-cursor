/**
 * Circuit breaker behavior test. Run: npx tsx scratch/test-circuit-breaker.ts
 *
 * Verifies:
 *  1. Slow dependency calls are cut off by the timeout.
 *  2. Circuit trips after N consecutive failures and fast-fails while open.
 *  3. While the "dependency" is degraded, unrelated work is not blocked.
 *  4. Bulkhead caps concurrent calls.
 *  5. Half-open probe after cool-down; success closes the circuit.
 */
import {
  CircuitBreaker,
  CircuitOpenError,
  BreakerBusyError,
  BreakerTimeoutError,
} from '../src/server/circuitBreaker';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

async function main() {
  const breaker = new CircuitBreaker('test-dep', {
    timeoutMs: 200,
    maxConcurrent: 3,
    failureThreshold: 3,
    openMs: 500,
  });

  // 1. Timeout cuts off a hung dependency
  console.log('1) timeout');
  const t0 = Date.now();
  const err1 = await breaker.exec(() => sleep(5000)).catch((e) => e);
  assert(err1 instanceof BreakerTimeoutError, 'hung call rejected with timeout error');
  assert(Date.now() - t0 < 1000, `caller freed in ${Date.now() - t0}ms, not 5s`);

  // 2. Trips after threshold, then fast-fails
  console.log('2) trip + fast-fail');
  for (let i = 0; i < 2; i++) {
    await breaker.exec(() => Promise.reject(new Error('boom'))).catch(() => {});
  }
  assert(breaker.getState() === 'open', 'circuit open after 3 consecutive failures');
  const t1 = Date.now();
  const err2 = await breaker.exec(() => sleep(5000)).catch((e) => e);
  assert(err2 instanceof CircuitOpenError, 'open circuit fails fast');
  assert(Date.now() - t1 < 50, `fast-fail took ${Date.now() - t1}ms (no waiting)`);

  // 3. Unrelated work is not dragged down while the dependency is degraded
  console.log('3) isolation');
  const t2 = Date.now();
  const [unrelated, depResult] = await Promise.all([
    (async () => {
      await sleep(10); // simulates a normal DB-backed request
      return 'ok';
    })(),
    breaker.exec(() => sleep(5000)).catch((e) => e),
  ]);
  assert(unrelated === 'ok' && Date.now() - t2 < 200, 'unrelated request completed instantly');
  assert(depResult instanceof CircuitOpenError, 'degraded dependency isolated behind breaker');

  // 4. Bulkhead: max 3 concurrent, 4th rejected immediately
  console.log('4) bulkhead');
  const healthy = new CircuitBreaker('bulkhead-dep', {
    timeoutMs: 2000,
    maxConcurrent: 3,
    failureThreshold: 3,
    openMs: 500,
  });
  const inFlight = [1, 2, 3].map(() => healthy.exec(() => sleep(300)));
  await sleep(20);
  const err4 = await healthy.exec(() => sleep(300)).catch((e) => e);
  assert(err4 instanceof BreakerBusyError, '4th concurrent call rejected (limit 3)');
  await Promise.all(inFlight);
  const ok4 = await healthy.exec(async () => 'through');
  assert(ok4 === 'through', 'calls admitted again once slots free up');

  // 5. Recovery: half-open probe after cool-down, success closes circuit
  console.log('5) recovery');
  assert(breaker.getState() === 'open', 'still open before cool-down');
  await sleep(600); // > openMs
  const probe = await breaker.exec(async () => 'recovered').catch((e) => e);
  assert(probe === 'recovered', 'half-open probe allowed through after cool-down');
  assert(breaker.getState() === 'closed', 'successful probe closes the circuit');
  const ok5 = await breaker.exec(async () => 'normal');
  assert(ok5 === 'normal', 'normal traffic resumes after recovery');

  // 5b. Failed probe re-opens
  for (let i = 0; i < 3; i++) {
    await breaker.exec(() => Promise.reject(new Error('boom'))).catch(() => {});
  }
  await sleep(600);
  await breaker.exec(() => Promise.reject(new Error('still down'))).catch(() => {});
  assert(breaker.getState() === 'open', 'failed half-open probe re-opens circuit');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
