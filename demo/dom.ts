/* eslint-disable @typescript-eslint/class-methods-use-this */
import type { TStatusesRootSnapshot } from './StatusesRoot';

type TDomIds = {
  overlayId: string;
  connectButtonId: string;
  disconnectButtonId: string;
  callButtonId: string;
  endCallButtonId: string;
  muteCameraButtonId: string;
  unmuteCameraButtonId: string;
  muteMicButtonId: string;
  unmuteMicButtonId: string;
  localVideoSectionId: string;
  activeCallSectionId: string;
  localVideoId: string;
  remoteStreamsContainerId: string;
  callFormId: string;
  connectionStatusId: string;
  callStatusId: string;
  incomingStatusId: string;
  presentationStatusId: string;
  systemStatusId: string;
  autoConnectorManagerStatusId: string;
  callReconnectStatusId: string;
  callReconnectIndicatorId: string;
  sessionStatusesDiagramsId: string;
  statusesNodeValuesId: string;
  callStatsSectionId: string;
  callStatsTabAudioId: string;
  callStatsTabMainStreamId: string;
  callStatsTabContentedStreamId: string;
  callStatsAudioPanelId: string;
  callStatsMainStreamPanelId: string;
  callStatsContentedStreamPanelId: string;
  callStatsAudioId: string;
  callStatsMainStreamId: string;
  callStatsContentedStreamId: string;
  recvQualitySectionId: string;
  recvQualityRadiosId: string;
  recvQualityStatusId: string;
  logsContainerId: string;
  logsListId: string;
  clearLogsButtonId: string;
  filterLogsInputId: string;
  presentationStressTestingSectionId: string;
  presentationStressMaxAttemptsCountId: string;
  presentationStressDelayBetweenAttemptsId: string;
  presentationStressDelayBetweenStartAndStopId: string;
  mainStreamSettingsFormId: string;
  minConsecutiveProblemSamplesCountId: string;
  throttleRecoveryTimeoutId: string;
  startPresentationId: string;
  startStressTestingPresentationId: string;
  stopStressTestingPresentationButton: string;
  stressTestingPresentationStatusId: string;
  stopPresentationId: string;
  presentationVideoId: string;
};

export type TStatusCategory =
  | 'connection'
  | 'autoConnectorManager'
  | 'callReconnect'
  | 'call'
  | 'incoming'
  | 'presentation'
  | 'system';

const STATUS_DIAGRAMS: Record<TStatusCategory, readonly string[]> = {
  connection: [
    'connection:idle',
    'connection:preparing',
    'connection:connecting',
    'connection:connected',
    'connection:registered',
    'connection:established',
    'connection:disconnecting',
    'connection:disconnected',
  ],
  autoConnectorManager: [
    'idle',
    'disconnecting',
    'attemptingGate',
    'attemptingConnect',
    'waitingBeforeRetry',
    'connectedMonitoring',
    'telephonyChecking',
    'errorTerminal',
  ],
  callReconnect: [
    'idle',
    'armed',
    'evaluating',
    'backoff',
    'waitingSignaling',
    'attempting',
    'limitReached',
    'errorTerminal',
  ],
  call: [
    'call:idle',
    'call:connecting',
    'call:roomPendingAuth',
    'call:purgatory',
    'call:p2pRoom',
    'call:directP2pRoom',
    'call:inRoom',
    'call:disconnecting',
  ],
  incoming: [
    'incoming:idle',
    'incoming:ringing',
    'incoming:consumed',
    'incoming:declined',
    'incoming:terminated',
    'incoming:failed',
  ],
  presentation: [
    'presentation:idle',
    'presentation:starting',
    'presentation:active',
    'presentation:stopping',
    'presentation:failed',
  ],
  system: [
    'system:disconnected',
    'system:disconnecting',
    'system:connecting',
    'system:readyToCall',
    'system:callConnecting',
    'system:callDisconnecting',
    'system:callActive',
  ],
};

const EXPECTED_NODE_FIELDS: Record<keyof TStatusesRootSnapshot, readonly string[]> = {
  connection: ['state', 'context', 'connectionConfig'],
  autoConnector: ['state', 'afterDisconnect', 'parameters', 'stopReason', 'lastError'],
  callReconnect: [
    'state',
    'attempt',
    'nextDelayMs',
    'lastFailureCause',
    'lastError',
    'cancelledReason',
  ],
  call: [
    'state',
    'hasPendingDisconnect',
    'number',
    'isAnswered',
    'extraHeaders',
    'isConfirmed',
    'room',
    'participantName',
    'isDirectP2P',
    'token',
    'conferenceForToken',
    'startedTimestamp',
  ],
  callSession: ['license', 'roleType', 'roleAudioId', 'isSpectatorAny', 'isRecvSessionExpected'],
  incoming: ['state', 'remoteCallerData', 'terminalReason'],
  presentation: ['state', 'lastError'],
  system: ['state'],
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const getElementById = <T extends Element = HTMLElement>(id: string) => {
  const element = document.querySelector<T>(`#${id}`);

  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }

  return element;
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const querySelectorByParent = <T extends Element = HTMLElement>(
  selectors: string,
  parent: HTMLElement,
) => {
  const element = parent.querySelector<T>(selectors);

  if (!element) {
    throw new Error(`Element with selectors "${selectors}" not found`);
  }

  return element;
};

class DOM {
  public overlayElement: HTMLElement;

  public connectButtonElement: HTMLButtonElement;

  public disconnectButtonElement: HTMLButtonElement;

  public callButtonElement: HTMLButtonElement;

  public endCallButtonElement: HTMLButtonElement;

  public startPresentationElement: HTMLButtonElement;

  public startStressTestingPresentationElement: HTMLButtonElement;

  public stopStressTestingPresentationButton: HTMLButtonElement;

  public stressTestingPresentationStatusElement: HTMLElement;

  public stopPresentationElement: HTMLButtonElement;

  public muteCameraButtonElement: HTMLButtonElement;

  public unmuteCameraButtonElement: HTMLButtonElement;

  public muteMicButtonElement: HTMLButtonElement;

  public unmuteMicButtonElement: HTMLButtonElement;

  public localVideoSectionElement: HTMLElement;

  public activeCallSectionElement: HTMLElement;

  public remoteStreamsContainerElement: HTMLElement;

  public localVideoElement: HTMLVideoElement;

  public presentationVideoElement: HTMLVideoElement;

  public formElement: HTMLFormElement;

  public serverAddressInput: HTMLInputElement;

  public displayNameInput: HTMLInputElement;

  public authEnabledInput: HTMLInputElement;

  public userNumberInput: HTMLInputElement;

  public passwordInput: HTMLInputElement;

  public conferenceNumberInput: HTMLInputElement;

  public userNumberLabel: HTMLLabelElement;

  public passwordLabel: HTMLLabelElement;

  public connectionStatusElement: HTMLElement;

  public callStatusElement: HTMLElement;

  public incomingStatusElement: HTMLElement;

  public presentationStatusElement: HTMLElement;

  public systemStatusElement: HTMLElement;

  public autoConnectorManagerStatusElement: HTMLElement;

  public callReconnectStatusElement: HTMLElement;

  public callReconnectIndicatorElement: HTMLElement;

  public autoRedialEnabledInput: HTMLInputElement;

  public sessionStatusesDiagramsElement: HTMLElement;

  public statusesNodeValuesElement: HTMLElement;

  public callStatsSectionElement: HTMLElement;

  public callStatsTabAudioButtonElement: HTMLButtonElement;

  public callStatsTabMainStreamButtonElement: HTMLButtonElement;

  public callStatsTabContentedStreamButtonElement: HTMLButtonElement;

  public callStatsAudioPanelElement: HTMLElement;

  public callStatsMainStreamPanelElement: HTMLElement;

  public callStatsContentedStreamPanelElement: HTMLElement;

  public callStatsAudioElement: HTMLElement;

  public callStatsMainStreamElement: HTMLElement;

  public callStatsContentedStreamElement: HTMLElement;

  public recvQualitySectionElement: HTMLElement;

  public recvQualityRadiosElement: HTMLFieldSetElement;

  public recvQualityStatusElement: HTMLElement;

  public logsContainerElement: HTMLElement;

  public logsListElement: HTMLElement;

  public clearLogsButtonElement: HTMLButtonElement;

  public filterLogsInputElement: HTMLInputElement;

  public presentationStressTestingSectionElement: HTMLElement;

  public presentationStressMaxAttemptsCountInputElement: HTMLInputElement;

  public presentationStressDelayBetweenAttemptsInputElement: HTMLInputElement;

  public presentationStressDelayBetweenStartAndStopInputElement: HTMLInputElement;

  public mainStreamSettingsFormElement: HTMLFormElement;

  public minConsecutiveProblemSamplesCountInputElement: HTMLInputElement;

  public throttleRecoveryTimeoutInputElement: HTMLInputElement;

  public constructor({
    overlayId,
    connectButtonId,
    disconnectButtonId,
    callButtonId,
    endCallButtonId,
    muteCameraButtonId,
    unmuteCameraButtonId,
    muteMicButtonId,
    unmuteMicButtonId,
    localVideoSectionId,
    activeCallSectionId,
    localVideoId,
    remoteStreamsContainerId,
    callFormId,
    connectionStatusId,
    callStatusId,
    incomingStatusId,
    presentationStatusId,
    systemStatusId,
    autoConnectorManagerStatusId,
    callReconnectStatusId,
    callReconnectIndicatorId,
    sessionStatusesDiagramsId,
    statusesNodeValuesId,
    callStatsSectionId,
    callStatsTabAudioId,
    callStatsTabMainStreamId,
    callStatsTabContentedStreamId,
    callStatsAudioPanelId,
    callStatsMainStreamPanelId,
    callStatsContentedStreamPanelId,
    callStatsAudioId,
    callStatsMainStreamId,
    callStatsContentedStreamId,
    recvQualitySectionId,
    recvQualityRadiosId,
    recvQualityStatusId,
    logsContainerId,
    logsListId,
    clearLogsButtonId,
    filterLogsInputId,
    presentationStressTestingSectionId,
    presentationStressMaxAttemptsCountId,
    presentationStressDelayBetweenAttemptsId,
    presentationStressDelayBetweenStartAndStopId,
    mainStreamSettingsFormId,
    minConsecutiveProblemSamplesCountId,
    throttleRecoveryTimeoutId,
    startPresentationId,
    startStressTestingPresentationId,
    stopStressTestingPresentationButton,
    stressTestingPresentationStatusId,
    stopPresentationId,
    presentationVideoId,
  }: TDomIds) {
    this.overlayElement = getElementById(overlayId);
    this.connectButtonElement = getElementById<HTMLButtonElement>(connectButtonId);
    this.disconnectButtonElement = getElementById<HTMLButtonElement>(disconnectButtonId);
    this.callButtonElement = getElementById<HTMLButtonElement>(callButtonId);
    this.endCallButtonElement = getElementById<HTMLButtonElement>(endCallButtonId);
    this.startPresentationElement = getElementById<HTMLButtonElement>(startPresentationId);
    this.startStressTestingPresentationElement = getElementById<HTMLButtonElement>(
      startStressTestingPresentationId,
    );
    this.stopStressTestingPresentationButton = getElementById<HTMLButtonElement>(
      stopStressTestingPresentationButton,
    );
    this.stressTestingPresentationStatusElement = getElementById(stressTestingPresentationStatusId);
    this.stopPresentationElement = getElementById<HTMLButtonElement>(stopPresentationId);
    this.muteCameraButtonElement = getElementById<HTMLButtonElement>(muteCameraButtonId);
    this.unmuteCameraButtonElement = getElementById<HTMLButtonElement>(unmuteCameraButtonId);
    this.muteMicButtonElement = getElementById<HTMLButtonElement>(muteMicButtonId);
    this.unmuteMicButtonElement = getElementById<HTMLButtonElement>(unmuteMicButtonId);
    this.localVideoSectionElement = getElementById(localVideoSectionId);
    this.activeCallSectionElement = getElementById(activeCallSectionId);
    this.remoteStreamsContainerElement = getElementById(remoteStreamsContainerId);
    this.localVideoElement = getElementById<HTMLVideoElement>(localVideoId);
    this.presentationVideoElement = getElementById<HTMLVideoElement>(presentationVideoId);
    this.formElement = getElementById<HTMLFormElement>(callFormId);

    // Инициализируем элементы формы
    this.serverAddressInput = querySelectorByParent<HTMLInputElement>(
      'input[name="serverAddress"]',
      this.formElement,
    );
    this.displayNameInput = querySelectorByParent<HTMLInputElement>(
      'input[name="displayName"]',
      this.formElement,
    );
    this.authEnabledInput = querySelectorByParent<HTMLInputElement>(
      'input[type="checkbox"][name="authEnabled"]',
      this.formElement,
    );
    this.userNumberInput = querySelectorByParent<HTMLInputElement>(
      'input[name="userNumber"]',
      this.formElement,
    );
    this.passwordInput = querySelectorByParent<HTMLInputElement>(
      'input[name="password"]',
      this.formElement,
    );
    this.conferenceNumberInput = querySelectorByParent<HTMLInputElement>(
      'input[name="conferenceNumber"]',
      this.formElement,
    );
    this.userNumberLabel = querySelectorByParent<HTMLLabelElement>(
      'label[for="userNumber"]',
      this.formElement,
    );
    this.passwordLabel = querySelectorByParent<HTMLLabelElement>(
      'label[for="password"]',
      this.formElement,
    );
    this.connectionStatusElement = getElementById(connectionStatusId);
    this.callStatusElement = getElementById(callStatusId);
    this.incomingStatusElement = getElementById(incomingStatusId);
    this.presentationStatusElement = getElementById(presentationStatusId);
    this.systemStatusElement = getElementById(systemStatusId);
    this.autoConnectorManagerStatusElement = getElementById(autoConnectorManagerStatusId);
    this.callReconnectStatusElement = getElementById(callReconnectStatusId);
    this.callReconnectIndicatorElement = getElementById(callReconnectIndicatorId);
    this.autoRedialEnabledInput = querySelectorByParent<HTMLInputElement>(
      'input[type="checkbox"][name="autoRedialEnabled"]',
      this.formElement,
    );
    this.sessionStatusesDiagramsElement = getElementById(sessionStatusesDiagramsId);
    this.statusesNodeValuesElement = getElementById(statusesNodeValuesId);
    this.callStatsSectionElement = getElementById(callStatsSectionId);
    this.callStatsTabAudioButtonElement = getElementById<HTMLButtonElement>(callStatsTabAudioId);
    this.callStatsTabMainStreamButtonElement =
      getElementById<HTMLButtonElement>(callStatsTabMainStreamId);
    this.callStatsTabContentedStreamButtonElement = getElementById<HTMLButtonElement>(
      callStatsTabContentedStreamId,
    );
    this.callStatsAudioPanelElement = getElementById(callStatsAudioPanelId);
    this.callStatsMainStreamPanelElement = getElementById(callStatsMainStreamPanelId);
    this.callStatsContentedStreamPanelElement = getElementById(callStatsContentedStreamPanelId);
    this.callStatsAudioElement = getElementById(callStatsAudioId);
    this.callStatsMainStreamElement = getElementById(callStatsMainStreamId);
    this.callStatsContentedStreamElement = getElementById(callStatsContentedStreamId);
    this.recvQualitySectionElement = getElementById(recvQualitySectionId);
    this.recvQualityRadiosElement = getElementById<HTMLFieldSetElement>(recvQualityRadiosId);
    this.recvQualityStatusElement = getElementById(recvQualityStatusId);
    this.logsContainerElement = getElementById(logsContainerId);
    this.logsListElement = getElementById(logsListId);
    this.clearLogsButtonElement = getElementById<HTMLButtonElement>(clearLogsButtonId);
    this.filterLogsInputElement = getElementById<HTMLInputElement>(filterLogsInputId);

    this.presentationStressTestingSectionElement = getElementById(
      presentationStressTestingSectionId,
    );
    this.presentationStressMaxAttemptsCountInputElement = getElementById<HTMLInputElement>(
      presentationStressMaxAttemptsCountId,
    );
    this.presentationStressDelayBetweenAttemptsInputElement = getElementById<HTMLInputElement>(
      presentationStressDelayBetweenAttemptsId,
    );
    this.presentationStressDelayBetweenStartAndStopInputElement = getElementById<HTMLInputElement>(
      presentationStressDelayBetweenStartAndStopId,
    );
    this.mainStreamSettingsFormElement = getElementById<HTMLFormElement>(mainStreamSettingsFormId);
    this.minConsecutiveProblemSamplesCountInputElement = getElementById<HTMLInputElement>(
      minConsecutiveProblemSamplesCountId,
    );
    this.throttleRecoveryTimeoutInputElement =
      getElementById<HTMLInputElement>(throttleRecoveryTimeoutId);
  }

  /**
   * Показывает элемент, удаляя класс hidden
   */
  public show(element: HTMLElement): void {
    element.classList.remove('hidden');
  }

  /**
   * Скрывает элемент, добавляя класс hidden
   */
  public hide(element: HTMLElement): void {
    element.classList.add('hidden');
  }

  /**
   * Переключает видимость элемента
   * @param element - элемент для переключения
   * @param force - если указан, принудительно показывает (true) или скрывает (false)
   */
  public toggle(element: HTMLElement, force?: boolean): void {
    if (force === undefined) {
      element.classList.toggle('hidden');
    } else if (force) {
      this.show(element);
    } else {
      this.hide(element);
    }
  }

  /**
   * Проверяет, скрыт ли элемент (имеет класс hidden)
   */
  public isHidden(element: HTMLElement): boolean {
    return element.classList.contains('hidden');
  }

  /**
   * Проверяет, видим ли элемент (не имеет класс hidden)
   */
  public isVisible(element: HTMLElement): boolean {
    return !this.isHidden(element);
  }

  public disable(element: HTMLElement): void {
    element.classList.add('disabled');
  }

  public enable(element: HTMLElement): void {
    element.classList.remove('disabled');
  }

  public isDisabled(element: HTMLElement): boolean {
    return element.classList.contains('disabled');
  }

  public isEnabled(element: HTMLElement): boolean {
    return !this.isDisabled(element);
  }

  public toggleDisabled(element: HTMLElement, force?: boolean): void {
    if (force === undefined) {
      element.classList.toggle('disabled');
    } else if (force) {
      this.disable(element);
    } else {
      this.enable(element);
    }
  }

  public renderSessionStatusDiagrams(): void {
    const template = (Object.entries(STATUS_DIAGRAMS) as [TStatusCategory, readonly string[]][])
      .map(([category, states]) => {
        const nodesMarkup = states
          .map((state) => {
            return `<span class="status-diagram__node" data-status-category="${category}" data-status-value="${state}">${state}</span>`;
          })
          .join('<span class="status-diagram__arrow">→</span>');

        return `<div class="status-diagram"><div class="status-diagram__title">${category}</div><div class="status-diagram__nodes">${nodesMarkup}</div></div>`;
      })
      .join('');

    this.sessionStatusesDiagramsElement.innerHTML = template;
  }

  public setActiveSessionStatusNode(category: TStatusCategory, statusValue: string): void {
    const selectorByCategory = `.status-diagram__node[data-status-category="${category}"]`;
    const nodes =
      this.sessionStatusesDiagramsElement.querySelectorAll<HTMLElement>(selectorByCategory);

    nodes.forEach((node) => {
      node.classList.remove('status-diagram__node--active');
    });

    const activeNode = this.sessionStatusesDiagramsElement.querySelector<HTMLElement>(
      `.status-diagram__node[data-status-category="${category}"][data-status-value="${statusValue}"]`,
    );

    if (activeNode) {
      activeNode.classList.add('status-diagram__node--active');
    }
  }

  public renderStatusesNodeValues(statuses: TStatusesRootSnapshot): void {
    this.statusesNodeValuesElement.innerHTML = '';

    const fragment = document.createDocumentFragment();

    const statusesEntries = Object.entries(statuses) as [keyof TStatusesRootSnapshot, unknown][];

    statusesEntries.forEach(([nodeName, nodeValue]) => {
      if (!this.isRecord(nodeValue)) {
        return;
      }

      const nodeSection = document.createElement('section');

      nodeSection.className = 'conference-state__node';

      const nodeTitle = document.createElement('h4');

      nodeTitle.className = 'conference-state__node-title';
      nodeTitle.textContent = this.toDisplayLabel(nodeName);

      const nodeList = document.createElement('ul');

      nodeList.className = 'conference-state__list';

      this.buildNodeEntries(nodeName, nodeValue).forEach(([propertyName, propertyValue]) => {
        const nodeListItem = document.createElement('li');
        const propertyLabel = document.createElement('b');
        const propertyValueElement = document.createElement('span');

        propertyLabel.textContent = `${this.toDisplayLabel(propertyName)}: `;
        this.renderPropertyValue(propertyValueElement, propertyName, propertyValue);
        nodeListItem.append(propertyLabel, propertyValueElement);
        nodeList.append(nodeListItem);
      });

      nodeSection.append(nodeTitle, nodeList);
      fragment.append(nodeSection);
    });

    this.statusesNodeValuesElement.append(fragment);
  }

  private buildNodeEntries(
    nodeName: keyof TStatusesRootSnapshot,
    nodeValue: Record<string, unknown>,
  ): [string, unknown][] {
    const expectedFields = EXPECTED_NODE_FIELDS[nodeName];
    const entriesByName = new Map<string, unknown>();
    const { context } = nodeValue;
    const contextRecord = this.isRecord(context) ? context : undefined;

    expectedFields.forEach((fieldName) => {
      const valueFromNode = nodeValue[fieldName];

      if (valueFromNode !== undefined) {
        entriesByName.set(fieldName, valueFromNode);

        return;
      }

      if (contextRecord !== undefined && fieldName in contextRecord) {
        entriesByName.set(fieldName, contextRecord[fieldName]);

        return;
      }

      entriesByName.set(fieldName, undefined);
    });

    if (contextRecord !== undefined) {
      Object.entries(contextRecord).forEach(([fieldName, fieldValue]) => {
        if (entriesByName.has(fieldName)) {
          return;
        }

        entriesByName.set(fieldName, fieldValue);
      });
    }

    Object.entries(nodeValue).forEach(([fieldName, fieldValue]) => {
      if (fieldName === 'context' || entriesByName.has(fieldName)) {
        return;
      }

      entriesByName.set(fieldName, fieldValue);
    });

    return [...entriesByName.entries()];
  }

  private renderPropertyValue(
    propertyValueElement: HTMLElement,
    propertyName: string,
    value: unknown,
  ): void {
    if (this.isComplexJsonValue(value)) {
      const detailsElement = document.createElement('details');

      detailsElement.className = 'conference-state__json';

      const summaryElement = document.createElement('summary');

      summaryElement.textContent = 'JSON';

      const preElement = document.createElement('pre');

      preElement.textContent = this.stringifyForDisplay(value);

      detailsElement.append(summaryElement, preElement);
      propertyValueElement.append(detailsElement);

      return;
    }

    const parsedValue = this.parseStatusValue(propertyName, value);
    const valueTextNode = document.createTextNode(parsedValue);

    propertyValueElement.append(valueTextNode);
  }

  private parseStatusValue(propertyName: string, value: unknown): string {
    if (value === undefined || value === null) {
      return '-';
    }

    if (propertyName === 'token' && typeof value === 'string') {
      return `${value.slice(0, 20)}...`;
    }

    if (propertyName === 'startedTimestamp' && typeof value === 'number') {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }

    return this.stringifyForDisplay(value);
  }

  private stringifyForDisplay(value: unknown): string {
    if (typeof value === 'function') {
      return value.toString();
    }

    try {
      const replacer = (_key: string, nestedValue: unknown): unknown => {
        if (typeof nestedValue === 'function') {
          return nestedValue.toString();
        }

        return nestedValue;
      };

      const serialized = JSON.stringify(value, replacer, 2) as string | undefined;

      if (serialized === undefined) {
        return '-';
      }

      return this.expandJsonEscapesForDisplay(serialized);
    } catch {
      return '-';
    }
  }

  /**
   * JSON.stringify экранирует переводы строк в строковых значениях как `\n` (два символа),
   * из‑за чего тело функций в <pre> сливается в одну строку. Раскрываем типичные escape-последовательности для читаемого вывода.
   */
  private expandJsonEscapesForDisplay(serialized: string): string {
    return serialized
      .replaceAll(String.raw`\r\n`, '\n')
      .replaceAll(String.raw`\n`, '\n')
      .replaceAll(String.raw`\t`, '\t')
      .replaceAll(String.raw`\r`, '\n');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isComplexJsonValue(value: unknown): boolean {
    return this.isRecord(value) || Array.isArray(value);
  }

  private toDisplayLabel(value: string): string {
    const normalized = value.replaceAll(/([A-Z])/g, ' $1').trim();

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}

export const dom = new DOM({
  overlayId: 'loaderOverlay',
  connectButtonId: 'connectButton',
  disconnectButtonId: 'disconnectButton',
  callButtonId: 'callButton',
  endCallButtonId: 'endCallButton',
  muteCameraButtonId: 'muteCameraButton',
  unmuteCameraButtonId: 'unmuteCameraButton',
  startPresentationId: 'startPresentationButton',
  startStressTestingPresentationId: 'startStressTestingPresentationButton',
  stopStressTestingPresentationButton: 'stopStressTestingPresentationButton',
  stressTestingPresentationStatusId: 'stressTestingPresentationStatus',
  stopPresentationId: 'stopPresentationButton',
  muteMicButtonId: 'muteMicButton',
  unmuteMicButtonId: 'unmuteMicButton',
  localVideoSectionId: 'localVideoSection',
  activeCallSectionId: 'activeCallSection',
  localVideoId: 'localVideo',
  presentationVideoId: 'presentationVideo',
  remoteStreamsContainerId: 'remoteStreamsContainer',
  callFormId: 'callForm',
  connectionStatusId: 'connectionStatus',
  callStatusId: 'callStatus',
  incomingStatusId: 'incomingStatus',
  presentationStatusId: 'presentationStatus',
  systemStatusId: 'systemStatus',
  autoConnectorManagerStatusId: 'autoConnectorManagerStatus',
  callReconnectStatusId: 'callReconnectStatus',
  callReconnectIndicatorId: 'callReconnectIndicator',
  sessionStatusesDiagramsId: 'sessionStatusesDiagrams',
  statusesNodeValuesId: 'statusesNodeValues',
  callStatsSectionId: 'callStatsSection',
  callStatsTabAudioId: 'callStatsTabAudio',
  callStatsTabMainStreamId: 'callStatsTabMainStream',
  callStatsTabContentedStreamId: 'callStatsTabContentedStream',
  callStatsAudioPanelId: 'callStatsAudioPanel',
  callStatsMainStreamPanelId: 'callStatsMainStreamPanel',
  callStatsContentedStreamPanelId: 'callStatsContentedStreamPanel',
  callStatsAudioId: 'callStatsAudio',
  callStatsMainStreamId: 'callStatsMainStream',
  callStatsContentedStreamId: 'callStatsContentedStream',
  recvQualitySectionId: 'recvQualitySection',
  recvQualityRadiosId: 'recvQualityRadios',
  recvQualityStatusId: 'recvQualityStatus',
  logsContainerId: 'logsContainer',
  logsListId: 'logsList',
  clearLogsButtonId: 'clearLogsButton',
  filterLogsInputId: 'filterLogsInput',
  presentationStressTestingSectionId: 'presentationStressTestingSection',
  presentationStressMaxAttemptsCountId: 'presentationStressMaxAttemptsCount',
  presentationStressDelayBetweenAttemptsId: 'presentationStressDelayBetweenAttempts',
  presentationStressDelayBetweenStartAndStopId: 'presentationStressDelayBetweenStartAndStop',
  mainStreamSettingsFormId: 'mainStreamSettingsForm',
  minConsecutiveProblemSamplesCountId: 'minConsecutiveProblemSamplesCount',
  throttleRecoveryTimeoutId: 'throttleRecoveryTimeout',
});
