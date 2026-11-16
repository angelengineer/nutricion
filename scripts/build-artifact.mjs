// Inline the Vite build into a single page body for a claude.ai Artifact.
// The Artifact host adds <!doctype>, <html>, <head> and <body> itself, so we emit only
// <title>, metas, font link, <style>, the root node and the script.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)]
  .map((m) => readFileSync(join(dist, m[1]), 'utf8')).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g)]
  .map((m) => readFileSync(join(dist, m[1]), 'utf8')).join('\n');
if (!css || !js) throw new Error('Could not find built CSS/JS in dist/index.html');

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<link rel="stylesheet"[^>]*href="\.\/assets[^>]*>\s*/g, '')
  .replace(/<script[\s\S]*?<\/script>\s*/g, '')
  .trim();

const safeJs = js.replace(/<\/script/gi, '<\\/script');
const out = `${head}
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;
writeFileSync(join(dist, 'nutricion.html'), out);
console.log(`dist/nutricion.html  ${(out.length / 1024).toFixed(1)} kB`);
