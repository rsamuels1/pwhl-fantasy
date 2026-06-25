import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.context().addCookies([{
  name: 'pwhl_user_email',
  value: 'commish@dev.local',
  domain: 'localhost',
  path: '/',
}]);

await page.goto('http://localhost:3000/create-league', { waitUntil: 'networkidle' });

// Capture URL and page title before click
console.log('URL before click:', page.url());

const buildBtn = page.getByRole('button', { name: /build my league/i });
console.log('Button count:', await buildBtn.count());

await buildBtn.click();

// Wait for navigation OR new content
try {
  await page.waitForSelector('text=Name your league', { timeout: 3000 });
  console.log('Step 1 appeared ✅');
} catch {
  // Check what's actually on screen
  const url = page.url();
  const body = await page.textContent('body');
  console.log('URL after click:', url);
  console.log('Page still shows Welcome?', body.includes('Welcome, Founding GM'));
  console.log('Page shows Step 1?', body.includes('Name your league'));
  console.log('Page shows dashboard?', body.includes('Your Franchises') || body.includes('dashboard'));
}

await page.screenshot({ path: '/tmp/after-click.png' });

if (errors.length) console.log('Console errors:', errors);

await browser.close();
