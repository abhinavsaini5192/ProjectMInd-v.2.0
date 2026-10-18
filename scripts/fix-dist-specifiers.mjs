import fs from 'node:fs';
import path from 'node:path';

/**
 * Traverses a directory recursively and collects all .js and .d.ts files.
 */
function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.d.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Rewrites relative import/export specifiers in built dist files so they conform
 * to standard Node.js ES Module resolution requirements without requiring custom loaders.
 */
export function fixDistSpecifiers(outDir = 'dist') {
  const files = walk(outDir);
  let modifiedCount = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileDir = path.dirname(filePath);
    let fileModified = false;

    // Matches import/export from relative specifiers and dynamic import()
    const regex = /((?:import|export)\s*(?:(?:(?!\bfrom\b)[^;])*?\bfrom\s*)?|import\s*\(\s*)['"](\.[^'"]+)['"]/g;

    const newContent = content.replace(regex, (match, prefix, specifier) => {
      // Skip if already has an extension
      if (
        specifier.endsWith('.js') ||
        specifier.endsWith('.json') ||
        specifier.endsWith('.mjs') ||
        specifier.endsWith('.node')
      ) {
        return match;
      }

      const resolved = path.resolve(fileDir, specifier);

      // Check if target + .js exists
      if (fs.existsSync(resolved + '.js') || fs.existsSync(resolved + '.d.ts')) {
        fileModified = true;
        return `${prefix}'${specifier}.js'`;
      }

      // Check if target directory with index.js exists
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        if (
          fs.existsSync(path.join(resolved, 'index.js')) ||
          fs.existsSync(path.join(resolved, 'index.d.ts'))
        ) {
          fileModified = true;
          return `${prefix}'${specifier}/index.js'`;
        }
      }

      // Check if target + .json exists
      if (fs.existsSync(resolved + '.json')) {
        fileModified = true;
        return `${prefix}'${specifier}.json'`;
      }

      return match;
    });

    if (fileModified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      modifiedCount++;
    }
  }

  return modifiedCount;
}

// Auto-run when executed directly
const targetDir = process.argv[2] || 'dist';
const count = fixDistSpecifiers(targetDir);
console.log(`[build] Successfully normalized ESM specifiers across ${count} files in ${targetDir}.`);
