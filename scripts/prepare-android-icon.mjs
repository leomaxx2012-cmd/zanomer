import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Keep the monogram inside the circular and rounded launcher masks.
const resources = 'android/app/src/main/res';
await mkdir(join(resources, 'drawable'), { recursive: true });
await writeFile(join(resources, 'drawable/zanomer_launcher_foreground.xml'), `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@mipmap/ic_launcher_foreground"
    android:inset="20%" />
`);
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  const path = join(resources, 'mipmap-anydpi-v26', name);
  const xml = await readFile(path, 'utf8');
  if (!xml.includes('@mipmap/ic_launcher_foreground')) throw new Error(`Unexpected foreground in ${path}`);
  await writeFile(path, xml.replaceAll('@mipmap/ic_launcher_foreground', '@drawable/zanomer_launcher_foreground'));
}
console.log('Launcher monogram protected with 20% insets.');
