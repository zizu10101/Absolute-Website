const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for header to load
    await page.waitForSelector('header', { timeout: 5000 });
    console.log('✓ Header loaded');
    
    // Find NATIONAL TEAMS menu item
    const nationalTeamsLink = await page.locator('nav a:has-text("NATIONAL TEAMS")');
    console.log('✓ Found NATIONAL TEAMS link');
    
    // Hover over NATIONAL TEAMS to show mega menu
    await nationalTeamsLink.hover();
    await page.waitForTimeout(500);
    
    // Wait for mega menu to appear
    await page.waitForSelector('[class*="absolute"][class*="top-full"]', { timeout: 5000 });
    console.log('✓ Mega menu appeared');
    
    // Check if EUROPE heading is visible and get its link
    const europeHeading = await page.locator('text=EUROPE').first();
    const isEurope = await europeHeading.isVisible();
    console.log(`✓ EUROPE heading visible: ${isEurope}`);
    
    // Check if EUROPE is a Link (within an <a> tag)
    const europeLink = await page.locator('a:has-text("EUROPE")');
    const europeCount = await europeLink.count();
    console.log(`✓ EUROPE as Link elements found: ${europeCount}`);
    
    if (europeCount > 0) {
      const href = await europeLink.first().getAttribute('href');
      console.log(`✓ EUROPE link href: ${href}`);
      
      // Try clicking EUROPE
      await europeLink.first().click();
      await page.waitForTimeout(1000);
      
      const currentUrl = page.url();
      console.log(`✓ After clicking EUROPE, URL: ${currentUrl}`);
      
      if (currentUrl.includes('/category/national-teams') && currentUrl.includes('region=europe')) {
        console.log('✅ SUCCESS: EUROPE is clickable and navigates to correct path!');
      } else {
        console.log('❌ FAILED: URL does not match expected path');
      }
    } else {
      console.log('❌ FAILED: EUROPE is not rendered as a Link');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    // Take a screenshot for verification
    await page.screenshot({ path: 'C:\Users\ziad\AppData\Local\Temp\claude\C--Users-ziad-absolute-website\9575b018-0072-4b34-ad82-a8759b5aee44\scratchpad\nav-test.png' });
    console.log('📸 Screenshot saved');
    await browser.close();
  }
})();
