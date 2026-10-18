#!/usr/bin/env node

/**
 * ProjectMind CLI Launcher
 * Cross-platform entry point resolving ESM module paths on Windows, Linux, and macOS.
 */
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Register custom ESM resolver for directory and extensionless imports
try {
  register(new URL('./resolver.js', import.meta.url));
} catch (err) {
  // If register fails (e.g. older runtime), continue with default Node resolution
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function launch() {
  const distPath = resolve(__dirname, '../dist/cli/cli.js');

  if (!existsSync(distPath)) {
    console.error('ProjectMind CLI Error: Compiled distribution output not found at:');
    console.error(`  ${distPath}`);
    console.error('Please build the project first using: npm run build');
    process.exit(1);
  }

  try {
    const cliUrl = pathToFileURL(distPath).href;
    const cli = await import(cliUrl);

    if (typeof cli.runCLI === 'function') {
      const exitCode = await cli.runCLI(process.argv.slice(2));
      if (typeof exitCode === 'number' && exitCode !== 0) {
        process.exit(exitCode);
      }
    } else if (typeof cli.main === 'function') {
      await cli.main();
    } else {
      console.error('ProjectMind CLI Error: Entry point did not export runCLI or main.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to launch ProjectMind CLI:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

launch().catch((err) => {
  console.error('ProjectMind CLI Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
