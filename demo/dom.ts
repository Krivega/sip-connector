/* eslint-disable @typescript-eslint/class-methods-use-this */
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
  participantRoleId: string;
  useLicenseId: string;
  connectionStatusId: string;
  callStatusId: string;
  incomingStatusId: string;
  presentationStatusId: string;
  systemStatusId: string;
  autoConnectorManagerStatusId: string;
  sessionStatusesDiagramsId: string;
  conferenceStateRoomId: string;
  conferenceStateParticipantNameId: string;
  conferenceStateTokenId: string;
  conferenceStateConferenceForTokenId: string;
  conferenceStatePendingDisconnectId: string;
  conferenceStateNumberId: string;
  conferenceStateAnswerId: string;
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
    'standby',
    'haltedByError',
    'cancelled',
    'failed',
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

  public participantRoleElement: HTMLElement;

  public useLicenseElement: HTMLElement;

  public connectionStatusElement: HTMLElement;

  public callStatusElement: HTMLElement;

  public incomingStatusElement: HTMLElement;

  public presentationStatusElement: HTMLElement;

  public systemStatusElement: HTMLElement;

  public autoConnectorManagerStatusElement: HTMLElement;

  public sessionStatusesDiagramsElement: HTMLElement;

  public conferenceStateRoomElement: HTMLElement;

  public conferenceStateParticipantNameElement: HTMLElement;

  public conferenceStateTokenElement: HTMLElement;

  public conferenceStateConferenceForTokenElement: HTMLElement;

  public conferenceStatePendingDisconnectElement: HTMLElement;

  public conferenceStateNumberElement: HTMLElement;

  public conferenceStateAnswerElement: HTMLElement;

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
    participantRoleId,
    useLicenseId,
    connectionStatusId,
    callStatusId,
    incomingStatusId,
    presentationStatusId,
    systemStatusId,
    autoConnectorManagerStatusId,
    sessionStatusesDiagramsId,
    conferenceStateRoomId,
    conferenceStateParticipantNameId,
    conferenceStateTokenId,
    conferenceStateConferenceForTokenId,
    conferenceStatePendingDisconnectId,
    conferenceStateNumberId,
    conferenceStateAnswerId,
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
    this.participantRoleElement = getElementById(participantRoleId);
    this.useLicenseElement = getElementById(useLicenseId);
    this.connectionStatusElement = getElementById(connectionStatusId);
    this.callStatusElement = getElementById(callStatusId);
    this.incomingStatusElement = getElementById(incomingStatusId);
    this.presentationStatusElement = getElementById(presentationStatusId);
    this.systemStatusElement = getElementById(systemStatusId);
    this.autoConnectorManagerStatusElement = getElementById(autoConnectorManagerStatusId);
    this.sessionStatusesDiagramsElement = getElementById(sessionStatusesDiagramsId);
    this.conferenceStateRoomElement = getElementById(conferenceStateRoomId);
    this.conferenceStateParticipantNameElement = getElementById(conferenceStateParticipantNameId);
    this.conferenceStateTokenElement = getElementById(conferenceStateTokenId);
    this.conferenceStateConferenceForTokenElement = getElementById(
      conferenceStateConferenceForTokenId,
    );
    this.conferenceStatePendingDisconnectElement = getElementById(
      conferenceStatePendingDisconnectId,
    );
    this.conferenceStateNumberElement = getElementById(conferenceStateNumberId);
    this.conferenceStateAnswerElement = getElementById(conferenceStateAnswerId);
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
  participantRoleId: 'participantRole',
  useLicenseId: 'useLicense',
  connectionStatusId: 'connectionStatus',
  callStatusId: 'callStatus',
  incomingStatusId: 'incomingStatus',
  presentationStatusId: 'presentationStatus',
  systemStatusId: 'systemStatus',
  autoConnectorManagerStatusId: 'autoConnectorManagerStatus',
  sessionStatusesDiagramsId: 'sessionStatusesDiagrams',
  conferenceStateRoomId: 'conferenceStateRoom',
  conferenceStateParticipantNameId: 'conferenceStateParticipantName',
  conferenceStateTokenId: 'conferenceStateToken',
  conferenceStateConferenceForTokenId: 'conferenceStateConferenceForToken',
  conferenceStatePendingDisconnectId: 'conferenceStatePendingDisconnect',
  conferenceStateNumberId: 'conferenceStateNumber',
  conferenceStateAnswerId: 'conferenceStateAnswer',
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
