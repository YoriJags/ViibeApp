// Screenshot the organiser screen with realistic data, for design review.
// Usage: node shot-organiser.js <port> <outdir>   (serve backend/static on <port>)
const puppeteer = require('puppeteer');
const path = require('path');

const port = process.argv[2] || '8766';
const out = process.argv[3] || '.';
const now = Date.now();
const start = new Date(now - 90 * 60000);
const curve = Array.from({ length: 22 }, (_, i) => ({
  at: new Date(start.getTime() - 120 * 60000 + i * 600000).toISOString(),
  count: [0, 1, 0, 2, 3, 5, 8, 12, 15, 18, 22, 19, 16, 14, 11, 9, 7, 6, 4, 3, 2, 1][i],
}));
const DATA = {
  event: { name: 'Lagos Festival Test', event: { phase: 'live', entry: 'ticketed',
    starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 6 * 3600000).toISOString() } },
  present_now: 184,
  flow: { arrivals: 31, departures: 6, direction: 'filling', window_minutes: 30 },
  arrival_curve: curve,
  gate: { consensus: 'slow', readings: 7, breakdown: { clear: 2, slow: 4, blocked: 1 }, window_minutes: 30 },
  energy: { label: 'WARMING', score: 58, source: 'scouts' },
  attendees_are_told: { advice: 'go_soon', headline: "The gate is slow but moving and it's filling up.", detail: 'The room is building.' },
  updated_at: new Date(now).toISOString(),
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/organiser/events/')) {
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(DATA) });
    } else req.continue();
  });
  await page.goto(`http://localhost:${port}/organiser.html?key=sample`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(out, 'organiser-mobile.png'), fullPage: true });
  await browser.close();
  console.log('done');
})();
