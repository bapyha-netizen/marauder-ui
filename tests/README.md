# End-to-End Testing

This project uses Playwright for end-to-end testing to ensure the Marauder UI works correctly across different browsers and devices.

## Test Structure

- `tests/e2e/` - End-to-end test files
- `playwright.config.js` - Playwright configuration
- `vitest.config.js` - Unit test configuration

## Running Tests

### Install Playwright
```bash
npm install
npx playwright install
```

### Run E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui

# Run tests headed (with browser visible)
npm run test:e2e -- --headed

# Run tests for specific browser
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit
```

### Run Unit Tests
```bash
# Run all tests (unit + E2E)
npm test

# Run unit tests only
npm run test

# Run unit tests in watch mode
npm run test:watch
```

## Test Coverage

### Current E2E Tests
1. **Basic Navigation** (`basic-navigation.spec.js`)
   - Application loading
   - Tab switching
   - Basic accessibility checks

2. **Device Connection** (`device-connection.spec.js`)
   - Connection button visibility
   - Serial port selection
   - Connection error handling
   - Terminal output functionality

3. **Command Builder** (`command-builder.spec.js`)
   - Command builder interface
   - Command selection and building
   - Command execution
   - Command history
   - Error handling

### Test Environment
- Tests run against a local development server on port 3008
- Mocked API responses for predictable testing
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile device viewport testing

## Adding New Tests

### E2E Test Example
```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    
    // Test steps here
    await page.click('text=Button');
    await expect(page.locator('text=Result')).toBeVisible();
  });
});
```

### Best Practices
1. **Use meaningful test descriptions** - Describe what the test is verifying
2. **Test both success and error cases** - Ensure robust error handling
3. **Use proper selectors** - Use text, role, or test-id selectors when possible
4. **Mock API calls** - Use Playwright's route() to mock API responses
5. **Add accessibility checks** - Ensure the UI is accessible
6. **Test across browsers** - Verify compatibility with different browsers

## Continuous Integration

The E2E tests are configured to run in CI/CD environments with:
- Automatic browser installation
- Parallel test execution
- Retry on flaky tests
- HTML report generation

## Debugging

### Debugging Failed Tests
1. Run tests with UI mode to see what's happening:
   ```bash
   npm run test:e2e:ui
   ```

2. Run tests headed to see the browser:
   ```bash
   npm run test:e2e -- --headed --debug
   ```

3. Use Playwright's trace viewer:
   ```bash
   npm run test:e2e -- --trace on
   ```

### Common Issues
- **Port 3008 in use** - Make sure the dev server isn't already running
- **Missing dependencies** - Run `npm install` and `npx playwright install`
- **Flaky tests** - Add proper waits and use Playwright's auto-waiting features