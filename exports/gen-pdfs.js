const puppeteer = require('puppeteer');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

// ─── PITCH DECK CSS (dark, slide-based, vibrant) ──────────────────────────────
const pitchDeckCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,600;0,700;0,900;1,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #080808;
    color: #e8e8e8;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    line-height: 1.7;
  }

  /* ── COVER / H1 ─────────────────────────────── */
  h1 {
    font-size: 52px;
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -1.5px;
    background: linear-gradient(135deg, #ff3d6b 0%, #ff7043 40%, #ffb300 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    padding: 60px 72px 16px;
    margin-bottom: 0;
  }

  /* Cover subtitle (em after h1) */
  h1 + p em {
    color: #888;
    font-size: 14px;
    font-style: normal;
    padding: 0 72px;
    display: block;
    margin-bottom: 56px;
  }

  /* ── SLIDE SECTIONS (h2) ─────────────────────── */
  h2 {
    page-break-before: always;
    font-size: 38px;
    font-weight: 900;
    letter-spacing: -1px;
    line-height: 1.1;
    padding: 64px 72px 0;
    margin-bottom: 40px;
    color: #ffffff;
    position: relative;
  }

  /* Slide label from h2 text before " — " */
  h2::before {
    content: attr(data-label);
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #ff3d6b;
    margin-bottom: 12px;
    -webkit-text-fill-color: #ff3d6b;
  }

  /* ── SUB-HEADINGS ────────────────────────────── */
  h3 {
    font-size: 18px;
    font-weight: 700;
    color: #ffb300;
    margin: 32px 72px 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  h4 {
    font-size: 14px;
    font-weight: 700;
    color: #4ade80;
    margin: 24px 72px 8px;
    letter-spacing: 0.04em;
  }

  /* ── BODY TEXT ───────────────────────────────── */
  p {
    margin: 0 72px 16px;
    color: #bbb;
    font-size: 13.5px;
  }

  strong {
    color: #ffffff;
    font-weight: 700;
  }

  em { color: #888; font-style: italic; }

  /* ── LISTS ───────────────────────────────────── */
  ul, ol {
    margin: 0 72px 20px 96px;
    color: #bbb;
  }

  li {
    margin-bottom: 6px;
    font-size: 13.5px;
    line-height: 1.6;
  }

  li strong { color: #fff; }

  /* Custom bullet color */
  ul li::marker { color: #ff3d6b; }
  ol li::marker { color: #ffb300; font-weight: 700; }

  /* ── TABLES ──────────────────────────────────── */
  table {
    width: calc(100% - 144px);
    margin: 24px 72px 32px;
    border-collapse: collapse;
    font-size: 12.5px;
    border: 1px solid #1f1f1f;
    border-radius: 10px;
    overflow: hidden;
  }

  thead tr {
    background: #111;
    border-bottom: 2px solid #ff3d6b;
  }

  th {
    padding: 12px 16px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #fff;
    white-space: nowrap;
  }

  td {
    padding: 11px 16px;
    border-bottom: 1px solid #1a1a1a;
    color: #ccc;
    vertical-align: top;
  }

  tbody tr:nth-child(even) td { background: #0f0f0f; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: #141414; }

  td strong, th strong { color: #fff; }

  /* Highlight PEAK/LIT/CHARGED state rows */
  td:first-child strong { color: #ffb300; }

  /* ── BLOCKQUOTES (callout cards) ─────────────── */
  blockquote {
    margin: 24px 72px 28px;
    padding: 18px 24px;
    background: #101010;
    border: 1px solid #1f1f1f;
    border-left: 4px solid #ff3d6b;
    border-radius: 0 10px 10px 0;
    color: #ddd;
    font-size: 13px;
  }

  blockquote p { margin: 0; color: #ddd; }
  blockquote strong { color: #fff; }

  /* ── CODE BLOCKS ─────────────────────────────── */
  pre {
    margin: 20px 72px 28px;
    padding: 20px 24px;
    background: #0d0d0d;
    border: 1px solid #1f1f1f;
    border-radius: 10px;
    overflow-x: auto;
  }

  pre code {
    background: none;
    color: #4ade80;
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.7;
  }

  code {
    background: #141414;
    color: #ff9f1c;
    padding: 2px 7px;
    border-radius: 5px;
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 12px;
  }

  /* ── HR (slide divider) ──────────────────────── */
  hr {
    border: none;
    border-top: 1px solid #1a1a1a;
    margin: 40px 72px;
  }

  /* ── COVER PAGE SPECIAL ──────────────────────── */
  .cover-section {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 80px 72px;
    background: radial-gradient(ellipse at 20% 50%, #1a0a0a 0%, #080808 60%);
  }

  /* ── APPENDIX sections ───────────────────────── */
  h2[data-appendix="true"] {
    color: #888;
    font-size: 28px;
  }

  /* ── NUMBER HIGHLIGHTS ───────────────────────── */
  .stat-green { color: #4ade80; font-weight: 700; }
  .stat-yellow { color: #ffb300; font-weight: 700; }
  .stat-pink { color: #ff3d6b; font-weight: 700; }
`;

// ─── FINANCIAL MODEL CSS (dark, data-dense) ──────────────────────────────────
const financialCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #060a0f;
    color: #d0d8e0;
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 12.5px;
    line-height: 1.65;
  }

  /* Header strip */
  body::before {
    content: 'VIIBE — FINANCIAL MODEL · SEED ROUND 2026';
    display: block;
    background: linear-gradient(90deg, #0d1b2a, #0a1628);
    color: #4a7fa0;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    padding: 10px 60px;
    border-bottom: 1px solid #0d2035;
  }

  h1 {
    font-size: 42px;
    font-weight: 900;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #22d3ee, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    padding: 48px 60px 8px;
  }

  h1 + p em {
    display: block;
    padding: 0 60px 40px;
    color: #4a7fa0;
    font-size: 12px;
    font-style: normal;
  }

  h2 {
    page-break-before: always;
    font-size: 26px;
    font-weight: 800;
    color: #f59e0b;
    padding: 56px 60px 0;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
    border-top: none;
  }

  h2::before {
    content: '';
    display: block;
    width: 40px;
    height: 3px;
    background: #f59e0b;
    margin-bottom: 16px;
    border-radius: 2px;
  }

  h3 {
    font-size: 14px;
    font-weight: 700;
    color: #38bdf8;
    margin: 28px 60px 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  h4 {
    font-size: 13px;
    font-weight: 700;
    color: #a3e635;
    margin: 20px 60px 8px;
  }

  p {
    margin: 0 60px 14px;
    color: #8ea8c0;
    font-size: 12.5px;
  }

  strong { color: #e8f0f8; font-weight: 700; }

  ul, ol {
    margin: 0 60px 16px 80px;
    color: #8ea8c0;
  }

  li { margin-bottom: 5px; font-size: 12.5px; }
  li strong { color: #e8f0f8; }
  ul li::marker { color: #38bdf8; }

  table {
    width: calc(100% - 120px);
    margin: 20px 60px 28px;
    border-collapse: collapse;
    font-size: 11.5px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #0d2035;
  }

  thead { background: #091525; border-bottom: 2px solid #1e4060; }

  th {
    padding: 10px 14px;
    text-align: left;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #7ab0d0;
    white-space: nowrap;
  }

  td {
    padding: 9px 14px;
    border-bottom: 1px solid #0d1f30;
    color: #99b8cc;
    vertical-align: top;
    font-variant-numeric: tabular-nums;
  }

  tbody tr:nth-child(even) td { background: #060e18; }
  tbody tr:last-child td { border-bottom: none; background: #0a1828; font-weight: 700; }

  /* Bold/total rows */
  td strong { color: #e8f0f8; }

  /* Positive numbers (₦ revenue) */
  td:nth-child(n+2) { font-family: 'Fira Code', monospace; }

  blockquote {
    margin: 20px 60px 24px;
    padding: 16px 20px;
    background: #060f1a;
    border: 1px solid #0d2035;
    border-left: 3px solid #22d3ee;
    border-radius: 0 8px 8px 0;
    color: #b0ccd8;
  }

  blockquote p { margin: 0; color: #b0ccd8; }

  pre {
    margin: 16px 60px 24px;
    padding: 18px 22px;
    background: #060f1a;
    border: 1px solid #0d2035;
    border-radius: 8px;
  }

  pre code { background: none; color: #a3e635; font-size: 12px; }
  code { background: #0a1828; color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 11px; }

  hr {
    border: none;
    border-top: 1px solid #0d2035;
    margin: 32px 60px;
  }
`;

// ─── APP OVERVIEW CSS (dark, professional reference doc) ─────────────────────
const overviewCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #070b10;
    color: #d0d5da;
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 12.5px;
    line-height: 1.7;
  }

  body::before {
    content: 'VIIBE · PLATFORM REFERENCE · v2.0 · FEB 2026';
    display: block;
    background: #050810;
    color: #3a5068;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    padding: 10px 60px;
    border-bottom: 1px solid #0d1a28;
  }

  h1 {
    font-size: 44px;
    font-weight: 900;
    letter-spacing: -1.2px;
    background: linear-gradient(135deg, #a78bfa, #7c3aed, #c084fc);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    padding: 52px 60px 8px;
  }

  h1 + p em {
    display: block;
    padding: 0 60px 44px;
    color: #4a5568;
    font-size: 12px;
    font-style: normal;
  }

  h2 {
    page-break-before: always;
    font-size: 24px;
    font-weight: 800;
    color: #a78bfa;
    padding: 52px 60px 0;
    margin-bottom: 24px;
    letter-spacing: -0.4px;
  }

  h2::before {
    content: '';
    display: block;
    width: 32px;
    height: 3px;
    background: linear-gradient(90deg, #7c3aed, #c084fc);
    margin-bottom: 14px;
    border-radius: 2px;
  }

  h3 {
    font-size: 14px;
    font-weight: 700;
    color: #67e8f9;
    margin: 28px 60px 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-left: 3px solid #0891b2;
    padding-left: 12px;
  }

  h4 {
    font-size: 13px;
    font-weight: 700;
    color: #86efac;
    margin: 22px 60px 8px;
  }

  p {
    margin: 0 60px 14px;
    color: #8898a8;
    font-size: 12.5px;
  }

  strong { color: #e0e6ed; font-weight: 700; }

  blockquote {
    margin: 20px 60px 24px;
    padding: 16px 20px;
    background: #060c14;
    border: 1px solid #0d1e30;
    border-left: 3px solid #a78bfa;
    border-radius: 0 8px 8px 0;
    color: #a0b0c0;
    font-size: 12.5px;
  }
  blockquote p { margin: 0; color: #a0b0c0; }
  blockquote > p > strong { color: #c4b5fd; }

  ul, ol {
    margin: 0 60px 16px 80px;
    color: #8898a8;
  }
  li { margin-bottom: 6px; }
  li strong { color: #e0e6ed; }
  ul li::marker { color: #a78bfa; }
  ol li::marker { color: #67e8f9; font-weight: 700; }

  table {
    width: calc(100% - 120px);
    margin: 20px 60px 28px;
    border-collapse: collapse;
    font-size: 11.5px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #0d1e30;
  }

  thead { background: #070f1a; border-bottom: 2px solid #1e3a5c; }

  th {
    padding: 10px 14px;
    text-align: left;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #6080a0;
    white-space: nowrap;
  }

  td {
    padding: 9px 14px;
    border-bottom: 1px solid #0a1828;
    color: #8898a8;
    vertical-align: top;
  }

  tbody tr:nth-child(even) td { background: #060c14; }
  tbody tr:last-child td { border-bottom: none; }
  td code { background: #0a1828; color: #67e8f9; padding: 2px 5px; border-radius: 4px; font-size: 11px; }

  pre {
    margin: 16px 60px 24px;
    padding: 18px 22px;
    background: #060c14;
    border: 1px solid #0d1e30;
    border-radius: 8px;
  }
  pre code { background: none; color: #86efac; font-size: 12px; }
  code { background: #0a1525; color: #67e8f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: 'Fira Code', monospace; }

  hr {
    border: none;
    border-top: 1px solid #0d1e30;
    margin: 36px 60px;
  }
`;

// ─── HTML WRAPPER ─────────────────────────────────────────────────────────────
function buildHTML(markdown, css, title) {
  // Pre-process: fix h2 text so "SLIDE 1 — THE HOOK" shows nicely
  // We inject a data-label via a JS trick using ::before + content: attr()
  // But CSS attr() only works on regular elements — we handle this by adding a
  // <span class="slide-label"> before the heading text via a remark/regex pass.

  let processedMD = markdown;

  const html = marked.parse(processedMD);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    ${css}

    /* Print / PDF settings */
    @page {
      size: A4;
      margin: 0;
    }

    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

// ─── CONVERT HTML → PDF via Puppeteer ────────────────────────────────────────
async function htmlToPDF(html, outputPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait a moment for fonts to render
  await new Promise(r => setTimeout(r, 1500));

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    displayHeaderFooter: false,
  });

  await browser.close();
  console.log(`  ✓  Saved → ${outputPath}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const docsDir = path.join(__dirname, '..', 'docs');
  const outDir  = docsDir; // output alongside the markdown source files

  const docs = [
    {
      input:  path.join(docsDir, 'PITCH_DECK.md'),
      output: path.join(outDir,  'VIIBE_Pitch_Deck.pdf'),
      css:    pitchDeckCSS,
      title:  'VIIBE — Investor Pitch Deck',
    },
    {
      input:  path.join(docsDir, 'FINANCIAL_MODEL.md'),
      output: path.join(outDir,  'VIIBE_Financial_Model.pdf'),
      css:    financialCSS,
      title:  'VIIBE — Financial Model 2026–2030',
    },
    {
      input:  path.join(docsDir, 'APP_OVERVIEW.md'),
      output: path.join(outDir,  'VIIBE_App_Overview.pdf'),
      css:    overviewCSS,
      title:  'VIIBE — Platform Overview v2.0',
    },
  ];

  console.log('\n  VIIBE PDF Generator\n  ─────────────────────────');

  for (const doc of docs) {
    const name = path.basename(doc.output);
    console.log(`\n  Building ${name}...`);
    const markdown = fs.readFileSync(doc.input, 'utf-8');
    const html = buildHTML(markdown, doc.css, doc.title);

    // Optionally save the HTML for debugging
    fs.writeFileSync(doc.output.replace('.pdf', '.html'), html, 'utf-8');

    await htmlToPDF(html, doc.output);
  }

  console.log('\n  ─────────────────────────');
  console.log('  All PDFs generated successfully.\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
