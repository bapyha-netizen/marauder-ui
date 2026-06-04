import { test as base } from '@playwright/test';

/**
 * Extend the Playwright test fixture with custom utilities
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Set up common page configurations
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Mock common API calls
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          connected: false, 
          device: null,
          status: 'disconnected'
        })
      });
    });
    
    await page.route('**/api/serial/ports', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
    
    // Use the page
    await use(page);
  },
});

export { expect } from '@playwright/test';