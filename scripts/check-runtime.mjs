import { checkRuntimeGraph } from './runtime-manifest.mjs';
try {
  const files = await checkRuntimeGraph();
  console.log(`Runtime graph verified: ${files.length} files`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
