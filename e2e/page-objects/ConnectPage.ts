import { expect } from '@playwright/test';

import { DemoPage } from './DemoPage';

import type { Page } from '@playwright/test';
import type { TConnectionFormConfig } from '../connection.config';
import type { TSipConnectorDemoE2EWindow } from '../types';

type TRecvQuality = 'auto' | 'high' | 'medium' | 'low';

export class ConnectPage {
  private readonly page: Page;

  private readonly demoPage: DemoPage;

  public constructor(page: Page) {
    this.page = page;
    this.demoPage = new DemoPage(page);
  }

  public get connectButton() {
    return this.page.locator('#connectButton');
  }

  public get disconnectButton() {
    return this.page.locator('#disconnectButton');
  }

  public get callButton() {
    return this.page.locator('#callButton');
  }

  public get endCallButton() {
    return this.page.locator('#hangupButton');
  }

  public get connectAndCallButton() {
    return this.page.locator('#connectAndCallButton');
  }

  public get hangupAndDisconnectButton() {
    return this.page.locator('#endCallButton');
  }

  public get startShareButton() {
    return this.page.locator('#startShareButton');
  }

  public get stopShareButton() {
    return this.page.locator('#stopShareButton');
  }

  public get visibleCameraActionButton() {
    return this.page.locator('#muteCameraButton:not(.hidden), #unmuteCameraButton:not(.hidden)');
  }

  public get visibleMicActionButton() {
    return this.page.locator('#muteMicButton:not(.hidden), #unmuteMicButton:not(.hidden)');
  }

  public get recvQualitySection() {
    return this.page.locator('#recvQualitySection');
  }

  public get recvQualityRadios() {
    return this.page.locator('#recvQualityRadios');
  }

  public get recvQualityStatus() {
    return this.page.locator('#recvQualityStatus');
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
    await this.startConnectionAttempt();
    await this.expectConnected({ timeout });
  }

  public async expectConnected({ timeout = 30_000 }: { timeout?: number } = {}) {
    await expect(this.disconnectButton).toBeVisible({ timeout });
    await expect(this.connectButton).toBeHidden();
    await this.page.waitForTimeout(1000);
  }

  public async startConnectionAttempt() {
    await this.connectButton.click();
  }

  public async startConnectionAttemptTwiceFast() {
    await this.page.evaluate(() => {
      const element = document.querySelector<HTMLButtonElement>('#connectButton');

      if (!element) {
        throw new Error('Connect button is not found');
      }

      element.click();
      element.click();
    });
  }

  public async expectReadyForConnection({ timeout = 30_000 }: { timeout?: number } = {}) {
    await expect(this.connectButton).toBeVisible({ timeout });
    await expect(this.connectButton).toBeEnabled({ timeout });
    await expect(this.disconnectButton).toBeHidden();
  }

  public async blockServerAddressApi(serverAddress: string) {
    await this.page.evaluate((address) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.blockServerAddressApi(address);
    }, serverAddress);
  }

  public async blockWsMessages(serverAddress: string) {
    await this.page.evaluate((address) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.blockWsMessages(address);
    }, serverAddress);
  }

  public async blockWsResponseMessages(serverAddress: string) {
    await this.page.evaluate((address) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.blockWsResponseMessages(address);
    }, serverAddress);
  }

  public async disconnectWsTransport(serverAddress: string) {
    await this.page.evaluate((address) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.disconnectWsTransport(address);
    }, serverAddress);
  }

  public async blockCreateNewWsTransport(serverAddress: string) {
    await this.page.evaluate((address) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.blockCreateNewWsTransport(address);
    }, serverAddress);
  }

  public async simulateNetworkInterfaceChange() {
    await this.page.evaluate(() => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.simulateNetworkInterfaceChange();
    });
  }

  public async forcePingProbeResult(result: 'ok' | 'fail' | 'real') {
    await this.page.evaluate((probeResult) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.forcePingProbeResult(probeResult);
    }, result);
  }

  public async forceGetUserMediaResult(result: 'real' | 'fail') {
    await this.page.evaluate((mediaResult) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.forceGetUserMediaResult(mediaResult);
    }, result);
  }

  public async forceGetDisplayMediaResult(result: 'real' | 'fail') {
    await this.page.evaluate((mediaResult) => {
      const hooks = (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E;

      if (!hooks) {
        throw new Error('Demo e2e hooks are not available');
      }

      hooks.forceGetDisplayMediaResult(mediaResult);
    }, result);
  }

  public async startCallAttempt() {
    await this.callButton.click();
    await this.demoPage.waitForLoaderToBeHidden();
  }

  public async startConnectAndCallAttempt() {
    await this.connectAndCallButton.click();
    await this.demoPage.waitForLoaderToBeHidden();
  }

  public async hangupOnly() {
    await expect(this.endCallButton).toBeVisible();
    await expect(this.endCallButton).toBeEnabled();
    await this.endCallButton.click();
    await this.demoPage.waitForLoaderToBeHidden();
  }

  public async setConferenceNumber(value: string) {
    await this.page.locator('#conferenceNumber').fill(value);
  }

  public async startShare() {
    await this.startShareButton.click();
  }

  public async expectCallReady({ timeout = 30_000 }: { timeout?: number } = {}) {
    await expect(this.callButton).toBeVisible({ timeout });
    await expect(this.callButton).toBeEnabled();
    await expect(this.endCallButton).toBeHidden();
  }

  public async expectVisibleMediaActionButtonsDisabled({
    timeout = 30_000,
  }: { timeout?: number } = {}) {
    await expect(this.visibleCameraActionButton).toBeVisible({ timeout });
    await expect(this.visibleCameraActionButton).toBeDisabled();
    await expect(this.visibleMicActionButton).toBeVisible({ timeout });
    await expect(this.visibleMicActionButton).toBeDisabled();
  }

  public async expectRecvQualitySectionVisible({ timeout = 30_000 }: { timeout?: number } = {}) {
    await expect(this.recvQualitySection).toBeVisible({ timeout });
    await expect(this.recvQualityRadios).toBeVisible({ timeout });
  }

  public async expectRecvQualitySelected(
    quality: TRecvQuality,
    { timeout = 30_000 }: { timeout?: number } = {},
  ) {
    await expect(
      this.page.locator(`#recvQualityRadios input[name="recvQuality"][value="${quality}"]`),
    ).toBeChecked({
      timeout,
    });
  }

  public async setRecvQuality(quality: TRecvQuality) {
    await this.page
      .locator(`#recvQualityRadios input[name="recvQuality"][value="${quality}"]`)
      .check();
  }

  public async expectRecvQualityStatusContains(
    text: string,
    { timeout = 30_000 }: { timeout?: number } = {},
  ) {
    await expect(this.recvQualityStatus).toContainText(text, { timeout });
  }

  public async setRecvQualityAndExpectStatus({
    quality,
    timeout = 30_000,
    maxAttempts = 3,
  }: {
    quality: TRecvQuality;
    timeout?: number;
    maxAttempts?: number;
  }) {
    const startedAt = Date.now();
    const attemptChange = async (attempt: number): Promise<void> => {
      await this.setRecvQuality(quality);
      await this.expectRecvQualitySelected(quality, {
        timeout: Math.min(5000, timeout),
      });

      const elapsed = Date.now() - startedAt;
      const remaining = timeout - elapsed;

      if (remaining <= 0) {
        throw new Error(`Timeout waiting for recv quality status update: "${quality}"`);
      }

      try {
        await expect(this.recvQualityStatus).toHaveText(
          new RegExp(String.raw`(Применено|Не применено|Текущее):\s*${quality}\b`, 'i'),
          { timeout: Math.min(remaining, 10_000) },
        );
      } catch (error) {
        if (attempt >= maxAttempts) {
          const message = `Failed to observe recv quality status update for quality "${quality}"`;

          throw error instanceof Error ? new Error(message, { cause: error }) : new Error(message);
        }

        await attemptChange(attempt + 1);
      }
    };

    await attemptChange(1);
  }

  public async disconnect({ timeout = 30_000 }: { timeout?: number } = {}) {
    if (await this.disconnectButton.isVisible()) {
      await this.disconnectButton.click();
      await expect(this.connectButton).toBeVisible({ timeout });
    }
  }
}
