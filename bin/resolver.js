import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Custom ESM resolver hook for Node.js.
 * Enables directory imports (e.g. ./errors -> ./errors/index.js)
 * and extensionless relative imports (e.g. ./model -> ./model.js).
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (
        err.code === 'ERR_MODULE_NOT_FOUND' ||
        err.code === 'ERR_UNSUPPORTED_DIR_IMPORT'
      ) {
        let parentDir;
        try {
          const parentPath = fileURLToPath(context.parentURL);
          parentDir = path.dirname(parentPath);
        } catch {
          return nextResolve(specifier, context);
        }

        const candidateBase = path.resolve(parentDir, specifier);

        // 1. Candidate + .js
        if (fs.existsSync(candidateBase + '.js')) {
          return {
            url: pathToFileURL(candidateBase + '.js').href,
            shortCircuit: true,
          };
        }

        // 2. Candidate directory -> index.js
        try {
          if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isDirectory()) {
            const indexJs = path.join(candidateBase, 'index.js');
            if (fs.existsSync(indexJs)) {
              return {
                url: pathToFileURL(indexJs).href,
                shortCircuit: true,
              };
            }
          }
        } catch {
          // ignore fs errors and continue
        }

        // 3. Candidate + .json
        if (fs.existsSync(candidateBase + '.json')) {
          return {
            url: pathToFileURL(candidateBase + '.json').href,
            shortCircuit: true,
          };
        }
      }
      throw err;
    }
  }

  return nextResolve(specifier, context);
}
