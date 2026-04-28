import { test as base } from '@playwright/test';

import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { StatusDashboard } from './page-objects/StatusDashboard';
import { installE2ENetworkControls } from './support/networkControls';

type TFixtures = {
  connectPage: ConnectPage;
  demoPage: DemoPage;
  statusDashboard: StatusDashboard;
};

export const test = base.extend<TFixtures>({
  connectPage: async ({ page, context }, use) => {
    await context.addInitScript(installE2ENetworkControls);
    await context.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });

    await page.goto('/');

    const demoPage = new DemoPage(page);

    await demoPage.waitForLoaderToBeHidden();

    const connectPage = new ConnectPage(page);

    await use(connectPage);
    await connectPage.disconnect();
  },

  statusDashboard: async ({ page }, use) => {
    const dashboard = new StatusDashboard(page);

    await use(dashboard);
  },

  demoPage: async ({ page }, use) => {
    await page.goto('/');

    const demoPage = new DemoPage(page);

    await demoPage.waitForLoaderToBeHidden();

    await use(demoPage);
  },
});

export { expect } from '@playwright/test';
