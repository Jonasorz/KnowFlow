import { spawn } from 'node:child_process';

const webPort = process.env.WEB_PORT || '5173';

console.log('');
console.log(`KnowFlow is starting. Open http://localhost:${webPort} after the services are ready.`);
console.log('');

const child = spawn('pnpm', ['turbo', 'start:docker'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
