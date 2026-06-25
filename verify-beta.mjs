import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.context().addCookies([{
  name: 'pwhl_user_email',
  value: 'commish@dev.local',
  domain: 'localhost',
  path: '/',
}]);

// --- 1. BetaWelcomeStep on /create-league ---
await page.goto('http://localhost:3000/create-league', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/beta-welcome.png' });
const welcomeText = await page.textContent('body');
console.log('Has "expansion draft":', welcomeText.includes('expansion draft'));
console.log('Has "Detroit":', welcomeText.includes('Detroit'));
console.log('Has "Hamilton":', welcomeText.includes('Hamilton'));
console.log('Has "Las Vegas":', welcomeText.includes('Las Vegas'));
console.log('Has "San Jose":', welcomeText.includes('San Jose'));
console.log('Has "12 teams":', welcomeText.includes('12 teams'));
console.log('Has "Build my league":', welcomeText.includes('Build my league'));

// Click through to step 1
const buildBtn = page.getByRole('button', { name: /build my league/i });
if (await buildBtn.count() > 0) {
  await buildBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/wizard-step1.png' });
  const step1Text = await page.textContent('body');
  console.log('After click, "Name your league":', step1Text.includes('Name your league'));
  console.log('After click, "Step 1 of":', step1Text.includes('Step 1 of'));
} else {
  console.log('BUILD BUTTON NOT FOUND - BetaWelcomeStep may not be showing');
}

await browser.close();
