import { execSync } from 'node:child_process';

try {
  const output = execSync('lsof -ti tcp:4000', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();

  if (!output) {
    process.exit(0);
  }

  const pids = output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');

  if (pids) {
    execSync(`kill ${pids}`, { stdio: 'ignore' });
  }
} catch {
  process.exit(0);
}
