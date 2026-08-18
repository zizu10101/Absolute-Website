import { chromium } from './node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Login
await page.goto('http://localhost:3000/pos');
await page.waitForLoadState('networkidle');
for (const digit of ['2','0','2','4']) {
  await page.locator('button').filter({ hasText: new RegExp(`^${digit}$`) }).first().click();
  await page.waitForTimeout(80);
}
await page.locator('button').filter({ hasText: 'OK' }).click();
await page.waitForTimeout(3000);

// Add product
const searchBox = page.locator('input[placeholder="Search products..."]');
await searchBox.click();
await searchBox.fill('Ball');
await page.waitForTimeout(1000);

const productBtns = page.locator('button.rounded').filter({ hasText: /\$\d+/ });
for (let i = 0; i < 30; i++) {
  const btn = productBtns.nth(i);
  const text = await btn.innerText();
  if (!text.includes('SOLD OUT') && text.includes('in stock')) {
    await btn.click(); await page.waitForTimeout(800); break;
  }
}

const sizeModal = page.locator('text=Select Size');
if (await sizeModal.isVisible().catch(() => false)) {
  const enabledSizes = page.locator('button:not([disabled])').filter({ hasText: /Size \d/ });
  await enabledSizes.first().click();
  await page.waitForTimeout(800);
}

// Apply override $35
await page.locator('button').filter({ hasText: /Override Price/ }).click();
await page.waitForTimeout(300);
await page.locator('input[placeholder="0.00"]').fill('35');
await page.locator('button').filter({ hasText: /^Apply$/ }).last().click();
await page.waitForTimeout(500);

await page.screenshot({ path: './verify-s5a-with-override.png' });

// Find & click checkout
const checkoutBtn = page.locator('text=CHECKOUT (1)');
const rect = await checkoutBtn.boundingBox();
console.log('Checkout button bounds:', rect);
await page.mouse.click(rect.x + rect.width/2, rect.y + rect.height/2);
await page.waitForTimeout(1200);
await page.screenshot({ path: './verify-s5-checkout.png' });

const checkoutText = await page.locator('body').innerText();
const has35 = checkoutText.includes('$35.00');
const hasOverride = checkoutText.toLowerCase().includes('overridden');
console.log('STEP 5 ✅ Checkout $35.00:', has35);
console.log('STEP 5 ✅ Override note in checkout:', hasOverride);

// Show context
const idx35 = checkoutText.indexOf('35.00');
if (idx35 > -1) console.log('Context around $35:', checkoutText.substring(idx35-50, idx35+100));

await browser.close();
