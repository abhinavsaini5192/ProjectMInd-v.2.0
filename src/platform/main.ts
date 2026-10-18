#!/usr/bin/env node
import process from 'node:process';
import { DeploymentRunner } from './runner/DeploymentRunner.js';
import type { DeploymentRole } from './config/PlatformConfig.js';

export function parseRoleFromArgs(argv: string[]): DeploymentRole | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg.startsWith('--role=')) {
      return arg.split('=')[1] as DeploymentRole;
    }
    if (arg === '--role' && argv[i + 1]) {
      return argv[i + 1] as DeploymentRole;
    }
  }
  return undefined;
}

export async function main(): Promise<void> {
  try {
    const cliRole = parseRoleFromArgs(process.argv);
    const result = await DeploymentRunner.run({
      role: cliRole,
    });

    if (result.role === 'migration') {
      if (result.migrationResult?.success) {
        console.log(`[ProjectMind Migration] Successfully applied ${result.migrationResult.appliedCount} migrations. Current schema version: v${result.migrationResult.currentVersion}`);
        process.exit(0);
      } else {
        console.error(`[ProjectMind Migration] Migration failed: ${result.migrationResult?.error}`);
        process.exit(1);
      }
    }
  } catch (err: unknown) {
    console.error('[FATAL] Failed to launch ProjectMind Platform:', err);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('main.js') || process.argv[1]?.endsWith('main.ts')) {
  main().catch((err) => {
    console.error('[FATAL] Unhandled rejection during platform startup:', err);
    process.exit(1);
  });
}

