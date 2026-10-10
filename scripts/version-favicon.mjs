import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const version = createHash('sha256').update(await readFile(path.join(root, 'favicon.ico'))).digest('hex').slice(0, 12);
async function update(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await update(file);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      await writeFile(file, html.replace(/href="([^"?]*favicon\.ico)(?:\?[^"<>]*)?"/g, `href="$1?v=${version}"`));
    }
  }
}
await update(root);
console.log(`Favicon version: ${version}`);
