// Bounded local credential read. Stdout is intended only for command substitution.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const allowedServices = new Set(['com.bangju.dagym-sync', 'com.bangju.worklog-sync']);
const [service, account] = process.argv.slice(2);
if (!allowedServices.has(service) || !account) process.exit(2);
try {
  // Use the identical unique service selector for metadata and password retrieval.
  // Check its account first; never return another account's credential.
  const query = ['find-generic-password', '-s', service];
  const metadata = await execute('/usr/bin/security', query, { timeout: 5000 });
  const storedAccount = metadata.stdout.match(/"acct"<blob>="([^"]+)"/)?.[1];
  if (storedAccount !== account) process.exit(2);
  const result = await execute('/usr/bin/security', [...query, '-w'], { timeout: 15000 });
  if (!result.stdout.trim()) process.exit(2);
  process.stdout.write(result.stdout.replace(/\r?\n$/, ''));
} catch {
  // A locked keychain or approval dialog must never hang the whole scheduled job.
  process.exitCode = 2;
}
