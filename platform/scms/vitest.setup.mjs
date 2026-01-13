import { execSync } from 'child_process';

export default async function () {
  execSync('npm run test:db:reset', { stdio: 'inherit' });
}
