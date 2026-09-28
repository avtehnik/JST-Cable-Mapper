// node debug.mjs out.png kind type n variant az el
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import puppeteer from 'puppeteer-core';
const here = path.dirname(fileURLToPath(import.meta.url));
const [outFile, ...jobs] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = pn.startsWith('/models/') ? path.join(here, '..', pn) : path.join(here, pn);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error(e.message));
await page.goto(`http://localhost:${server.address().port}/render.html`);
await page.waitForFunction('window.ready === true');
const urls = [];
for (const j of jobs) {
  const [k, t, n, v, az, el] = j.split(',');
  if (k === 'step') { const r = await page.evaluate((a) => window.debugStep(...a), [t, +n, +v]); console.log(t, JSON.stringify(r.box), r.colors.join(' ')); urls.push(r.url); }
  else urls.push(await page.evaluate((a) => window.debug(...a), [k, t, +n, v, +az, +el]));
}
// tile side by side on a grey background
const tiled = await page.evaluate(async (urls) => {
  const imgs = await Promise.all(urls.map(u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; })));
  const W = imgs.reduce((a, i) => a + i.width + 10, 0), H = Math.max(...imgs.map(i => i.height));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#8a9aa6'; x.fillRect(0, 0, W, H); let o = 0; for (const i of imgs) { x.drawImage(i, o, 0); o += i.width + 10; }
  return c.toDataURL('image/png');
}, urls);
fs.writeFileSync(outFile, Buffer.from(tiled.split(',')[1], 'base64'));
await browser.close(); server.close();
