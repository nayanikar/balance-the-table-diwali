import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, '..');

const mock = spawn('node', ['scripts/mock-api.mjs'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

const site = spawn('python3', ['-m', 'http.server', '3456'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

function shutdown() {
  mock.kill('SIGTERM');
  site.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Dev: site http://127.0.0.1:3456/index.html  mock http://127.0.0.1:8787/exec');
