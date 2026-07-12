import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';

function findPlaywrightChromium(): string | undefined {
  const root = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (!existsSync(root)) return undefined;

  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    const candidate = path.join(root, entry, 'chrome-win64', 'chrome.exe');
    if (existsSync(candidate)) return candidate;
    const macCandidate = path.join(root, entry, 'chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (existsSync(macCandidate)) return macCandidate;
    const linuxCandidate = path.join(root, entry, 'chrome-linux64', 'chrome');
    if (existsSync(linuxCandidate)) return linuxCandidate;
  }
  return undefined;
}

function resolveExecutablePath(): string | undefined {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (configured && existsSync(configured)) return configured;
  return findPlaywrightChromium();
}

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  const executablePath = resolveExecutablePath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
