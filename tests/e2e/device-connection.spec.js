import { test, expect } from '@playwright/test';

test.describe('Marauder UI - Device Connection', () => {
  test('should show connection button when device is not connected', async ({ page }) => {
    await page.goto('/');
    
    // Check if connect button is visible
    await expect(page.locator('text=Connect Device')).toBeVisible();
    
    // Check if device status shows disconnected
    await expect(page.locator('text=Device Disconnected')).toBeVisible();
  });

  test('should show serial port selection when clicking connect', async ({ page }) => {
    // Mock the serial port selection dialog
    await page.route('**/serial/port/list', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ portId: 'COM3', portName: 'COM3' }])
      });
    });
    
    await page.goto('/');
    
    // Click connect button
    await page.click('text=Connect Device');
    
    // Check if serial port selection appears
    await expect(page.locator('text=Select Serial Port')).toBeVisible();
    
    // Check if COM3 port is listed
    await expect(page.locator('text=COM3')).toBeVisible();
  });

  test('should handle connection error gracefully', async ({ page }) => {
    // Mock a connection error
    await page.route('**/serial/connect', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Connection failed' })
      });
    });
    
    await page.goto('/');
    
    // Click connect button
    await page.click('text=Connect Device');
    
    // Select a port (mock the selection)
    await page.click('text=COM3');
    
    // Check if error message is shown
    await expect(page.locator('text=Connection failed')).toBeVisible();
  });
});

test.describe('Marauder UI - Terminal Output', () => {
  test('should show terminal output when connected', async ({ page }) => {
    // Mock successful connection and serial data
    await page.route('**/serial/port/list', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ portId: 'COM3', portName: 'COM3' }])
      });
    });
    
    await page.route('**/serial/connect', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.route('**/serial/data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'Test line\n' })
      });
    });
    
    await page.goto('/');
    
    // Connect to device
    await page.click('text=Connect Device');
    await page.click('text=COM3');
    
    // Wait for terminal to show data
    await expect(page.locator('text=Test line')).toBeVisible();
    
    // Check if line count is updated
    await expect(page.locator('text=1 lines')).toBeVisible();
  });

  test('should allow pausing terminal output', async ({ page }) => {
    // Mock successful connection and serial data
    await page.route('**/serial/port/list', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ portId: 'COM3', portName: 'COM3' }])
      });
    });
    
    await page.route('**/serial/connect', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.route('**/serial/data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'Test line\n' })
      });
    });
    
    await page.goto('/');
    
    // Connect to device
    await page.click('text=Connect Device');
    await page.click('text=COM3');
    
    // Wait for initial data
    await expect(page.locator('text=Test line')).toBeVisible();
    
    // Click pause button
    await page.click('text=⏸ Pause');
    
    // Check if pause button changed to resume
    await expect(page.locator('text=▶ Resume')).toBeVisible();
  });

  test('should allow clearing terminal output', async ({ page }) => {
    // Mock successful connection and serial data
    await page.route('**/serial/port/list', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ portId: 'COM3', portName: 'COM3' }])
      });
    });
    
    await page.route('**/serial/connect', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    await page.route('**/serial/data', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'Test line\n' })
      });
    });
    
    await page.goto('/');
    
    // Connect to device
    await page.click('text=Connect Device');
    await page.click('text=COM3');
    
    // Wait for initial data
    await expect(page.locator('text=Test line')).toBeVisible();
    
    // Click clear button
    await page.click('text=Clear');
    
    // Check if terminal is empty
    await expect(page.locator('text=Waiting for data...')).toBeVisible();
  });
});