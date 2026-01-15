/* eslint-disable @typescript-eslint/class-methods-use-this */
type TDomIds = {
  overlayId: string;
  callButtonId: string;
  endCallButtonId: string;
  toggleCameraButtonId: string;
  toggleMicButtonId: string;
  toggleCameraButtonTextId: string;
  toggleMicButtonTextId: string;
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
  logsContainerId: string;
  logsListId: string;
  clearLogsButtonId: string;
  filterLogsInputId: string;
  startPresentationId: string;
  stopPresentationId: string;
  presentationVideoId: string;
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

  public callButtonElement: HTMLButtonElement;

  public endCallButtonElement: HTMLButtonElement;

  public startPresentationElement: HTMLButtonElement;

  public stopPresentationElement: HTMLButtonElement;

  public toggleCameraButtonElement: HTMLButtonElement;

  public toggleMicButtonElement: HTMLButtonElement;

  public toggleCameraButtonTextElement: HTMLSpanElement;

  public toggleMicButtonTextElement: HTMLSpanElement;

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

  public logsContainerElement: HTMLElement;

  public logsListElement: HTMLElement;

  public clearLogsButtonElement: HTMLButtonElement;

  public filterLogsInputElement: HTMLInputElement;

  public constructor({
    overlayId,
    callButtonId,
    endCallButtonId,
    toggleCameraButtonId,
    toggleMicButtonId,
    toggleCameraButtonTextId,
    toggleMicButtonTextId,
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
    logsContainerId,
    logsListId,
    clearLogsButtonId,
    filterLogsInputId,
    startPresentationId,
    stopPresentationId,
    presentationVideoId,
  }: TDomIds) {
    this.overlayElement = getElementById(overlayId);
    this.callButtonElement = getElementById<HTMLButtonElement>(callButtonId);
    this.endCallButtonElement = getElementById<HTMLButtonElement>(endCallButtonId);
    this.startPresentationElement = getElementById<HTMLButtonElement>(startPresentationId);
    this.stopPresentationElement = getElementById<HTMLButtonElement>(stopPresentationId);
    this.toggleCameraButtonElement = getElementById<HTMLButtonElement>(toggleCameraButtonId);
    this.toggleMicButtonElement = getElementById<HTMLButtonElement>(toggleMicButtonId);
    this.toggleCameraButtonTextElement = getElementById<HTMLSpanElement>(toggleCameraButtonTextId);
    this.toggleMicButtonTextElement = getElementById<HTMLSpanElement>(toggleMicButtonTextId);
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
    this.logsContainerElement = getElementById(logsContainerId);
    this.logsListElement = getElementById(logsListId);
    this.clearLogsButtonElement = getElementById<HTMLButtonElement>(clearLogsButtonId);
    this.filterLogsInputElement = getElementById<HTMLInputElement>(filterLogsInputId);
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
}

export const dom = new DOM({
  overlayId: 'loaderOverlay',
  callButtonId: 'callButton',
  endCallButtonId: 'endCallButton',
  startPresentationId: 'startPresentationButton',
  stopPresentationId: 'stopPresentationButton',
  toggleCameraButtonId: 'toggleCameraButton',
  toggleMicButtonId: 'toggleMicButton',
  toggleCameraButtonTextId: 'toggleCameraButtonText',
  toggleMicButtonTextId: 'toggleMicButtonText',
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
  logsContainerId: 'logsContainer',
  logsListId: 'logsList',
  clearLogsButtonId: 'clearLogsButton',
  filterLogsInputId: 'filterLogsInput',
});
