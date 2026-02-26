import { spawn } from 'node:child_process';

const reporter = process.env.E2E_TEST_REPORTER || 'tap';
const minTests = Number.parseInt(process.env.E2E_MIN_TESTS ?? '1', 10);
const maxSkipped = Number.parseInt(process.env.E2E_MAX_SKIPPED ?? '2', 10);

if (!Number.isFinite(minTests) || minTests < 1) {
  console.error(`[e2e-gate] invalid E2E_MIN_TESTS=${process.env.E2E_MIN_TESTS ?? ''}`);
  process.exit(1);
}

if (!Number.isFinite(maxSkipped) || maxSkipped < 0) {
  console.error(`[e2e-gate] invalid E2E_MAX_SKIPPED=${process.env.E2E_MAX_SKIPPED ?? ''}`);
  process.exit(1);
}

const run = spawn('node', ['--test', `--test-reporter=${reporter}`, './scripts/e2e-api-smoke.test.mjs'], {
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

let combinedOutput = '';

run.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  combinedOutput += text;
  process.stdout.write(text);
});

run.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  combinedOutput += text;
  process.stderr.write(text);
});

run.on('error', (error) => {
  console.error(`[e2e-gate] failed to start smoke run: ${error.message}`);
  process.exit(1);
});

run.on('close', (code, signal) => {
  if (signal) {
    console.error(`[e2e-gate] smoke run terminated by signal: ${signal}`);
    process.exit(1);
  }

  const extractMetric = (name) => {
    const match = combinedOutput.match(new RegExp(`^# ${name} (\\d+)$`, 'm'));
    return match ? Number.parseInt(match[1], 10) : null;
  };

  const tests = extractMetric('tests');
  const passed = extractMetric('pass');
  const failed = extractMetric('fail');
  const skipped = extractMetric('skipped') ?? 0;

  if (tests === null || passed === null || failed === null) {
    console.error('[e2e-gate] unable to parse node:test summary metrics from output');
    process.exit(1);
  }

  console.log(
    `[e2e-gate] summary tests=${tests} pass=${passed} fail=${failed} skipped=${skipped} (limits: minTests=${minTests}, maxSkipped=${maxSkipped})`,
  );

  if ((code ?? 0) !== 0) {
    console.error(`[e2e-gate] smoke run exited with code ${code}`);
    process.exit(code ?? 1);
  }

  if (tests < minTests) {
    console.error(`[e2e-gate] expected at least ${minTests} tests, got ${tests}`);
    process.exit(1);
  }

  if (failed > 0) {
    console.error(`[e2e-gate] expected zero failures, got ${failed}`);
    process.exit(1);
  }

  if (skipped > maxSkipped) {
    console.error(`[e2e-gate] skipped tests ${skipped} exceed limit ${maxSkipped}`);
    process.exit(1);
  }
});