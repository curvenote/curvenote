import { generateSciPyJson } from './generate-scipy';

async function main() {
  await generateSciPyJson();
  console.log('Generated SciPy JSON with 100 works');
}

main().catch(console.error);
