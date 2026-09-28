// Renders the 3D connector models into WebP sprite sheets for the page.
// Usage: node render.mjs            (all types)
//        node render.mjs SH GH      (selected types)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'img');
const types = process.argv.slice(2).filter(a => !a.startsWith('--')).length ? process.argv.slice(2).filter(a => !a.startsWith('--')) : ['SH', 'GH', 'PB', 'XH'];
const onlyHeaders = process.argv.includes('--headers');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };

const server = http.createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = pn.startsWith('/models/') ? path.join(here, '..', pn) : path.join(here, pn);
  if ( !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[page error]', e.message));
await page.goto(`http://localhost:${port}/render.html`);
await page.waitForFunction('window.ready === true', { timeout: 60000 });
const kicad = fs.existsSync(path.join(here, '..', 'models', 'kicad')) ? fs.readdirSync(path.join(here, '..', 'models', 'kicad')).filter(f => f.endsWith('.step')) : [];
await page.evaluate(list => { window.KICAD = list; }, kicad);
// the user's XH 5-pin STL, re-tiled for every pin count
if (fs.existsSync(path.join(here, '..', 'models', 'stl', 'XH-5.stl'))) await page.evaluate(() => { window.USE_XH_STL = true; });

const metaFile = path.join(out, 'sprites.json');
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
fs.mkdirSync(out, { recursive: true });

for (const t of types) {
  const jobs = [['renderPlugs', 'up', null, `plug-${t}-up`], ['renderPlugs', 'down', null, `plug-${t}-down`],
                ['renderHeaders', 'H', null, `hdr-${t}-H`], ['renderHeaders', 'V', null, `hdr-${t}-V`]];
  // extra mounting variants: XH also in SMD, PicoBlade also in THT
  const extra = { XH: 'SMD', PB: 'THT' }[t];
  if (extra) jobs.push(['renderHeaders', 'H', extra, `hdr-${t}-H-${extra}`], ['renderHeaders', 'V', extra, `hdr-${t}-V-${extra}`]);
  for (const [fn, v, variant, name] of jobs.filter(j => !onlyHeaders || j[0] === 'renderHeaders')) {
    const t0 = Date.now();
    const r = await page.evaluate((fn, t, v, variant) => window[fn](t, v, variant), fn, t, v, variant);
    fs.writeFileSync(path.join(out, name + '.webp'), Buffer.from(r.url.split(',')[1], 'base64'));
    delete r.url;
    r.v = Date.now().toString(36);   // cache-buster for the page
    meta[name] = r;
    console.log(`${name}.webp  ${r.W}x${r.H}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${r.cells.filter(c => c.src === 'kicad').length ? 'kicad: ' + r.cells.filter(c => c.src === 'kicad').map(c => c.n).join(',') : ''}`);
  }
}
fs.writeFileSync(metaFile, JSON.stringify(meta));

// inline the sprite metadata into the page so it also works from file://
const pageFile = path.join(here, '..', 'index.html');
const html = fs.readFileSync(pageFile, 'utf8');
const re = /\/\*SPRITES\*\/[\s\S]*?\/\*END\*\//;
if (re.test(html)) fs.writeFileSync(pageFile, html.replace(re, `/*SPRITES*/${JSON.stringify(meta)}/*END*/`));

await browser.close();
server.close();
