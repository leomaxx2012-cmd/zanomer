import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = 'https://zanomerom.ru';
const dist = process.argv[2] ?? 'dist';
const pages = JSON.parse(await readFile(new URL('../lib/seo-pages.json', import.meta.url), 'utf8'));
const escape = (value) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const pagePath = (page) => `/nomera/${page.slug}/`;
const link = (page) => `<a href="${pagePath(page)}">${escape(page.title)}</a>`;

for (const page of pages) {
  const canonical = origin + pagePath(page);
  const title = escape(page.title + ' — ЗаНомером');
  const description = escape(page.description);
  const directory = join(dist, 'nomera', page.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'index.html'), `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.ico">
<style>
:root { color-scheme: dark; font: 17px/1.6 system-ui,sans-serif; background: #151723; color: #f4f3fa; }
body { margin: 0; } main, header, footer { max-width: 48rem; margin: auto; padding: 1rem 1.25rem; }
a { color: #d5c8ff; } h1 { line-height: 1.2; font-size: clamp(2rem,5vw,3rem); }
.cta { display: inline-block; padding: .6rem 1rem; background: #513c93; border-radius: .5rem; color: white; }
</style>
</head>
<body>
<header><a href="/">ЗаНомером</a></header>
<main>
<h1>${escape(page.title)}</h1>
<p>${description}</p>
<p><a class="cta" href="${escape(page.catalog)}">${escape(page.cta)}</a></p>
<h2>${page.slug === 'prodat' ? 'Как подать объявление' : 'Как искать в каталоге'}</h2>
${page.paragraphs.map(text => `<p>${escape(text)}</p>`).join('\n')}
<nav aria-label="Другие подборки"><h2>Другие разделы</h2><ul>
${pages.filter(other => other !== page).map(other => `<li>${link(other)}</li>`).join('\n')}
</ul></nav>
</main>
<footer>ЗаНомером · каталог объявлений</footer>
</body>
</html>
`);
}

const sitemapPath = join(dist, 'sitemap.xml');
const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const entries = pages.map(page => `  <url><loc>${origin}${pagePath(page)}</loc></url>`).join('\n');
await writeFile(sitemapPath, sitemap.replace('</urlset>', entries + '\n</urlset>'));
