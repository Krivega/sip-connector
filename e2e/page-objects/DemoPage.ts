import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

type TVisibility = 'visible' | 'hidden';

type TCallSettingsExpectations = {
  fieldIds: readonly string[];
  buttons: readonly { name: string; visibility: TVisibility }[];
  autoRedialChecked: boolean;
};

export class DemoPage {
  private readonly page: Page;

  public constructor(page: Page) {
    this.page = page;
  }

  public async expectTitle() {
    await expect(this.page).toHaveTitle(/Demo sip-connector call v/);
  }

  public async expectCallSettings(expected: TCallSettingsExpectations) {
    await expect(this.page.getByRole('heading', { name: 'Настройки звонка' })).toBeVisible();

    const form = this.page.locator('#callForm');

    await expect(form).toBeVisible();

    await Promise.all(
      expected.fieldIds.map(async (fieldId) => {
        await expect(form.locator(`#${fieldId}`)).toBeVisible();
      }),
    );

    const autoRedial = form.locator('#autoRedialEnabled');

    await (expected.autoRedialChecked
      ? expect(autoRedial).toBeChecked()
      : expect(autoRedial).not.toBeChecked());

    await Promise.all(
      expected.buttons.map(async ({ name, visibility }) => {
        const button = this.page.getByRole('button', { name, exact: true });

        await (visibility === 'visible'
          ? expect(button).toBeVisible()
          : expect(button).toBeHidden());
      }),
    );
  }

  public async expectStatusAndLogsSections() {
    await expect(this.page.getByText('Статусы', { exact: true })).toBeVisible();
    await expect(this.page.getByText('Логи событий', { exact: true })).toBeVisible();
  }

  public async openLogsAndExpectClearButton() {
    await this.page.locator('#logsContainer summary').click();
    await expect(this.page.getByRole('button', { name: 'clear logs' })).toBeVisible();
  }

  public async openMainStreamSettingsAndExpectDefaults() {
    await this.page.locator('#mainStreamSettingsSection summary').click();
    await expect(this.page.locator('#mainStreamSettingsForm')).toBeVisible();
    await expect(this.page.locator('#minConsecutiveProblemSamplesCount')).toHaveValue('3');
    await expect(this.page.getByRole('button', { name: 'Применить настройки' })).toBeVisible();
  }
}
