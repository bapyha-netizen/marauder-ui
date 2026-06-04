import { test, expect } from '@playwright/test';

test.describe('Marauder UI - Basic Navigation', () => {
  test('should load the application and show main dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Check if the main app container is present
    await expect(page.locator('#app')).toBeVisible();
    
    // Check if the title is correct
    await expect(page).toHaveTitle(/ESP32 Marauder UI/);
    
    // Check if dashboard is visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show navigation tabs', async ({ page }) => {
    await page.goto('/');
    
    // Check if main navigation tabs are present
    const tabs = ['Dashboard', 'AP Explorer', 'BLE Explorer', 'Serial Monitor', 'Commands'];
    for (const tab of tabs) {
      await expect(page.locator(`text=${tab}`)).toBeVisible();
    }
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/');
    
    // Click on AP Explorer tab
    await page.click('text=AP Explorer');
    
    // Check if AP Explorer content is visible
    await expect(page.locator('text=AP Explorer')).toBeVisible();
    
    // Click on BLE Explorer tab
    await page.click('text=BLE Explorer');
    
    // Check if BLE Explorer content is visible
    await expect(page.locator('text=BLE Explorer')).toBeVisible();
  });
});

test.describe('Marauder UI - Dashboard', () => {
  test('should show dashboard components', async ({ page }) => {
    await page.goto('/');
    
    // Check if live output panel is visible
    await expect(page.locator('text=Live Output')).toBeVisible();
    
    // Check if device status is visible
    await expect(page.locator('text=Device Status')).toBeVisible();
    
    // Check if quick actions are visible
    await expect(page.locator('text=Quick Actions')).toBeVisible();
  });

  test('should show empty state when no device connected', async ({ page }) => {
    await page.goto('/');
    
    // Check if waiting for message is visible
    await expect(page.locator('text=Waiting for data...')).toBeVisible();
    
    // Check if device status shows disconnected
    await expect(page.locator('text=Device Disconnected')).toBeVisible();
  });
});

test.describe('Marauder UI - Accessibility', () => {
  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/');
    
    // Check if main app has proper role
    await expect(page.locator('#app')).toHaveAttribute('role', 'application');
    
    // Check if navigation has proper role
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    
    // Check if live output has proper aria-live attribute
    await expect(page.locator('[aria-live="polite"]')).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Press Tab key to navigate through interactive elements
    await page.keyboard.press('Tab');
    
    // Check that focus is on the first interactive element
    const firstTabbable = page.locator('button, a, input, select, textarea').first();
    await expect(firstTabbable).toBeFocused();
  });
});