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

  public toggleCameraButtonElement: HTMLButtonElement;

  public toggleMicButtonElement: HTMLButtonElement;

  public toggleCameraButtonTextElement: HTMLSpanElement;

  public toggleMicButtonTextElement: HTMLSpanElement;

  public localVideoSectionElement: HTMLElement;

  public activeCallSectionElement: HTMLElement;

  public remoteStreamsContainerElement: HTMLElement;

  public localVideoElement: HTMLVideoElement;

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
  }: TDomIds) {
    this.overlayElement = getElementById(overlayId);
    this.callButtonElement = getElementById<HTMLButtonElement>(callButtonId);
    this.endCallButtonElement = getElementById<HTMLButtonElement>(endCallButtonId);
    this.toggleCameraButtonElement = getElementById<HTMLButtonElement>(toggleCameraButtonId);
    this.toggleMicButtonElement = getElementById<HTMLButtonElement>(toggleMicButtonId);
    this.toggleCameraButtonTextElement = getElementById<HTMLSpanElement>(toggleCameraButtonTextId);
    this.toggleMicButtonTextElement = getElementById<HTMLSpanElement>(toggleMicButtonTextId);
    this.localVideoSectionElement = getElementById(localVideoSectionId);
    this.activeCallSectionElement = getElementById(activeCallSectionId);
    this.remoteStreamsContainerElement = getElementById(remoteStreamsContainerId);
    this.localVideoElement = getElementById<HTMLVideoElement>(localVideoId);
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
  }
}

export const dom = new DOM({
  overlayId: 'loaderOverlay',
  callButtonId: 'callButton',
  endCallButtonId: 'endCallButton',
  toggleCameraButtonId: 'toggleCameraButton',
  toggleMicButtonId: 'toggleMicButton',
  toggleCameraButtonTextId: 'toggleCameraButtonText',
  toggleMicButtonTextId: 'toggleMicButtonText',
  localVideoSectionId: 'localVideoSection',
  activeCallSectionId: 'activeCallSection',
  localVideoId: 'localVideo',
  remoteStreamsContainerId: 'remoteStreamsContainer',
  callFormId: 'callForm',
  participantRoleId: 'participantRole',
  useLicenseId: 'useLicense',
});
