import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';
import type { connectionFormConfig } from '../connection.config';

type TConnectionFormConfig = typeof connectionFormConfig;

const CONNECT_BUTTON_NAME = 'Подключиться к серверу';
const DISCONNECT_BUTTON_NAME = 'Отключиться от сервера';

export class ConnectPage {
  private readonly page: Page;

  public constructor(page: Page) {
    this.page = page;
  }

  public get connectButton() {
    return this.page.getByRole('button', { name: CONNECT_BUTTON_NAME });
  }

  public get disconnectButton() {
    return this.page.getByRole('button', { name: DISCONNECT_BUTTON_NAME });
  }

  public async fillForm(config: TConnectionFormConfig) {
    await this.page.locator('#serverAddress').fill(config.serverAddress);
    await this.page.locator('#displayName').fill(config.displayName);
    await this.page.locator('#conferenceNumber').fill(config.conferenceNumber);
    await this.page.locator('#authEnabled').setChecked(true);
    await expect(this.page.locator('#userNumber')).toBeVisible();
    await expect(this.page.locator('#password')).toBeVisible();
    await this.page.locator('#userNumber').fill(config.userNumber);
    await this.page.locator('#password').fill(config.password);
  }

  public async connect({ timeout }: { timeout: number }) {
    await this.connectButton.click();
    await expect(this.disconnectButton).toBeVisible({ timeout });
    await expect(this.connectButton).toBeHidden();
  }

  public async disconnect({ timeout = 30_000 }: { timeout?: number } = {}) {
    if (await this.disconnectButton.isVisible()) {
      await this.disconnectButton.click();
      await expect(this.connectButton).toBeVisible({ timeout });
    }
  }
}
