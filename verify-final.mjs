import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

await ctx.addCookies([{
  name: 'pwhl_user_email',
  value: 'commish@dev.local',
  domain: 'localhost',
  path: '/',
}]);

// ── Test 1: BetaWelcomeStep shows with expansion copy ──
await page.goto('http://localhost:3000/create-league', { waitUntil: 'networkidle' });
const welcomeText = await page.textContent('body');
console.log('=== BetaWelcomeStep ===');
console.log('Shows welcome screen:', welcomeText.includes('Welcome, Founding GM'));
console.log('Has "expansion draft":', welcomeText.includes('expansion draft'));
console.log('Has "Draft from all 12 teams":', welcomeText.includes('Draft from all 12 teams'));
console.log('Has Detroit, Hamilton, Las Vegas, San Jose:', 
  welcomeText.includes('Detroit') && welcomeText.includes('Hamilton') && welcomeText.includes('Las Vegas') && welcomeText.includes('San Jose'));

await page.screenshot({ path: '/tmp/step0.png' });

// ── Click "Build my league →" and wait for step 1 ──
const buildBtn = page.getByRole('button', { name: /build my league/i });
console.log('\nBuild button count:', await buildBtn.count());

if (await buildBtn.count() > 0) {
  await buildBtn.click();
  try {
    await page.waitForSelector('text=Name your league', { timeout: 4000 });
    console.log('Advanced to step 1 ✅');
    await page.screenshot({ path: '/tmp/step1.png' });
  } catch {
    const afterText = await page.textContent('body');
    console.log('Step 1 did NOT appear ❌');
    console.log('Page shows:', afterText.substring(0, 200));
  }
} else {
  console.log('Build button not found — isBetaMode may be false ❌');
}

// ── Probe: What's a replay league link ──
await page.goto('http://localhost:3000/create-league', { waitUntil: 'networkidle' });
const replayLink = page.getByRole('link', { name: /replay league/i });
console.log('\nReplay link present:', await replayLink.count() > 0);

await browser.close();

if (errors.length) console.log('\nConsole errors:', errors.slice(0, 3));
