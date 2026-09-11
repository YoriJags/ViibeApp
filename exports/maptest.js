const puppeteer = require('puppeteer');
const { pathToFileURL } = require('url');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 420, height: 780 });
  await p.goto(pathToFileURL(process.argv[2]).href, { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready === true', { timeout: 45000 }).catch(() => {});
  console.log(JSON.stringify(await p.evaluate(() => ({ errors: window.__errors || [] }))));
  await p.screenshot({ path: process.argv[3] });
  await b.close();
})();
