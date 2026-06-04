import { test, expect } from '@playwright/test';

test.describe('Marauder UI - Command Builder', () => {
  test('should show command builder interface', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Commands tab
    await page.click('text=Commands');
    
    // Check if command builder is visible
    await expect(page.locator('text=Command Builder')).toBeVisible();
    
    // Check if command categories are visible
    await expect(page.locator('text=WiFi Commands')).toBeVisible();
    await expect(page.locator('text=BLE Commands')).toBeVisible();
    await expect(page.locator('text=System Commands')).toBeVisible();
  });

  test('should allow command selection and building', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Commands tab
    await page.click('text=Commands');
    
    // Click on WiFi Commands
    await page.click('text=WiFi Commands');
    
    // Select a WiFi command
    await page.click('text=Scan WiFi Networks');
    
    // Check if command parameters appear
    await expect(page.locator('text=Scan Parameters')).toBeVisible();
    
    // Fill in scan parameters
    await page.fill('input[placeholder="Scan duration (seconds)"]', '30');
    
    // Check if build button is enabled
    await expect(page.locator('text=Build Command')).toBeVisible();
  });

  test('should build and execute command', async ({ page }) => {
    // Mock command execution
    await page.route('**/serial/command', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.goto('/');
    
    // Navigate to Commands tab
    await page.click('text=Commands');
    
    // Click on WiFi Commands
    await page.click('text=WiFi Commands');
    
    // Select a WiFi command
    await page.click('text=Scan WiFi Networks');
    
    // Fill in scan parameters
    await page.fill('input[placeholder="Scan duration (seconds)"]', '30');
    
    // Build the command
    await page.click('text=Build Command');
    
    // Check if built command is displayed
    await expect(page.locator('text=Built Command')).toBeVisible();
    
    // Execute the command
    await page.click('text=Execute');
    
    // Check if command was sent successfully
    await expect(page.locator('text=Command sent successfully')).toBeVisible();
  });

  test('should show command history', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Commands tab
    await page.click('text=Commands');
    
    // Check if command history is visible
    await expect(page.locator('text=Command History')).toBeVisible();
    
    // Check if history is empty initially
    await expect(page.locator('text=No commands executed yet')).toBeVisible();
  });

  test('should allow clearing command history', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Commands tab
    await page.click('text=Commands');
    
    // Execute a command first
    await page.click('text=WiFi Commands');
    await page.click('text=Scan WiFi Networks');
    await page.fill('input[placeholder="Scan duration (seconds)"]', '30');
    await page.click('text=Build Command');
    await page.click('text=Execute');
    
    // Check if command appears in history
    await expect(page.locator('text=Scan WiFi Networks')).toBeVisible();
    
    // Clear history
    await page.click('text=Clear History');
    
    // Check if history is cleared
    await expect(page.locator('text=No commands executed yet')).toBeVisible();
  });
});

test.describe('Marauder UI - Error Handling', () => {
  test('should show error message for invalid commands', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Commands tab
    await page.click('text=Commands');
    
    // Try to execute a command without building
    await page.click('text=WiFi Commands');
    await page.click('text=Scan WiFi Networks');
    
    // Try to execute without building
    await page.click('text=Execute');
    
    // Check if error message is shown
    await expect(page.locator('text=Please build a command first')).toBeVisible();
  });

  test('should handle serial connection errors gracefully', async ({ page }) => {
    // Mock connection error
    await page.route('**/serial/command', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Serial port not connected' })
      });
    });
    
    await page.goto('/');
    
    // Navigate to Commands tab
    await page.click('text=Commands');
    
    // Execute a command
    await page.click('text=WiFi Commands');
    await page.click('text=Scan WiFi Networks');
    await page.fill('input[placeholder="Scan duration (seconds)"]', '30');
    await page.click('text=Build Command');
    await page.click('text=Execute');
    
    // Check if error message is shown
    await expect(page.locator('text=Serial port not connected')).toBeVisible();
  });
});