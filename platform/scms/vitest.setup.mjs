import { execSync } from 'child_process';

export default async function () {
  execSync('bun run test:db:reset', { stdio: 'inherit' });
}
