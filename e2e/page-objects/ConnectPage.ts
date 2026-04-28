import { expect } from '@playwright/test';

import { DemoPage } from './DemoPage';

import type { Page } from '@playwright/test';
import type { TConnectionFormConfig } from '../connection.config';
import type { TSipConnectorDemoE2EWindow } from '../types';

const CONNECT_BUTTON_NAME = 'Подключиться к серверу';
const DISCONNECT_BUTTON_NAME = 'Отключиться от сервера';
const CONNECT_AND_CALL_BUTTON_NAME = 'Подключиться и позвонить';
const CALL_BUTTON_NAME = 'Позвонить';
const END_CALL_BUTTON_NAME = 'Завершить звонок';
const HANGUP_AND_DISCONNECT_BUTTON_NAME = 'Завершить звонок и отключиться';
const START_SHARE_BUTTON_NAME = 'Начать презентацию';
const STOP_SHARE_BUTTON_NAME = 'Завершить презентацию';

export class ConnectPage {
  private readonly page: Page;

  private readonly demoPage: DemoPage;

  public constructor(page: Page) {
    this.page = page;
    this.demoPage = new DemoPage(page);
  }

  public get connectButton() {
    return this.page.getByRole('button', { name: CONNECT_BUTTON_NAME, exact: true });
  }

  public get disconnectButton() {
    return this.page.getByRole('button', { name: DISCONNECT_BUTTON_NAME, exact: true });
  }

  public get callButton() {
    return this.page.getByRole('button', { name: CALL_BUTTON_NAME, exact: true });
  }

  public get endCallButton() {
    return this.page.getByRole('button', { name: END_CALL_BUTTON_NAME, exact: true });
  }

  public get connectAndCallButton() {
    return this.page.getByRole('button', { name: CONNECT_AND_CALL_BUTTON_NAME, exact: true });
  }

  public get hangupAndDisconnectButton() {
    return this.page.getByRole('button', { name: HANGUP_AND_DISCONNECT_BUTTON_NAME, exact: true });
  }

  public get startShareButton() {
    return this.page.getByRole('button', { name: START_SHARE_BUTTON_NAME, exact: true });
  }

  public get stopShareButton() {
    return this.page.getByRole('button', { name: STOP_SHARE_BUTTON_NAME, exact: true });
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
    await expect(this.connectButton).toBeEnabled();
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
    await this.endCallButton.click();
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

  public async disconnect({ timeout = 30_000 }: { timeout?: number } = {}) {
    if (await this.disconnectButton.isVisible()) {
      await this.disconnectButton.click();
      await expect(this.connectButton).toBeVisible({ timeout });
    }
  }
}
