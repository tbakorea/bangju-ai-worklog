// Bounded local credential read. Stdout is intended only for command substitution.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const allowedServices = new Set(['com.bangju.dagym-sync', 'com.bangju.worklog-sync']);
const [service, account] = process.argv.slice(2);
if (!allowedServices.has(service) || !account) process.exit(2);
try {
  const result = await execute('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w'], { timeout: 5000 });
  if (!result.stdout.trim()) process.exit(2);
  process.stdout.write(result.stdout.replace(/\r?\n$/, ''));
} catch {
  // A locked keychain or approval dialog must never hang the whole scheduled job.
  process.exitCode = 2;
}
