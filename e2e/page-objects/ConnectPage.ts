import { expect } from '@playwright/test';

import { DemoPage } from './DemoPage';

import type { Page } from '@playwright/test';
import type { TConnectionFormConfig } from '../connection.config';
import type { TSipConnectorDemoE2EWindow } from '../types';

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

  public async disconnect({ timeout = 30_000 }: { timeout?: number } = {}) {
    if (await this.disconnectButton.isVisible()) {
      await this.disconnectButton.click();
      await expect(this.connectButton).toBeVisible({ timeout });
    }
  }
}
