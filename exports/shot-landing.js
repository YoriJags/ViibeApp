// Screenshot the landing page in its real states, for design review.
// Usage: node shot-landing.js <port> <outdir>
// The page's /api calls are intercepted so each state can be seen on purpose:
//   none  - what production returns today (demo only, no real scouts)
//   live  - a real reading, to see how the page looks when the city is lit
const puppeteer = require('puppeteer');
const path = require('path');

const port = process.argv[2] || '8765';
const out = process.argv[3] || '.';

const STATES = {
  none: { city: 'lagos', energy_score: 48.4, energy_label: 'WARMING', energy_source: 'demo', active_scouts: 0, live_venues: 10 },
  live: { city: 'lagos', energy_score: 74, energy_label: 'LIT', energy_source: 'scouts', active_scouts: 23, live_venues: 9 },
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const [state, payload] of Object.entries(STATES)) {
    for (const [vp, size] of Object.entries({ desktop: [1440, 900], mobile: [390, 844] })) {
      const page = await browser.newPage();
      await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: 1 });
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.url().includes('/api/city-energy/')) {
          req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        } else req.continue();
      });
      await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 3500)); // let the field ease to its cap
      await page.screenshot({ path: path.join(out, `${state}-${vp}-hero.png`) });
      if (state === 'none' && vp === 'desktop') {
        await page.screenshot({ path: path.join(out, `full-desktop.png`), fullPage: true });
      }
      if (state === 'none' && vp === 'mobile') {
        await page.screenshot({ path: path.join(out, `full-mobile.png`), fullPage: true });
      }
      await page.close();
    }
  }
  await browser.close();
  console.log('done');
})();
