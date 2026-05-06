import { dom } from '../dom';

export const setElementVisible = (element: HTMLElement, isVisible: boolean): void => {
  if (isVisible) {
    dom.show(element);
  } else {
    dom.hide(element);
  }
};

export const setMediaActionButtonsDisabled = (isDisabled: boolean): void => {
  dom.toggleDisabled(dom.muteMicButtonElement, isDisabled);
  dom.toggleDisabled(dom.unmuteMicButtonElement, isDisabled);
  dom.toggleDisabled(dom.muteCameraButtonElement, isDisabled);
  dom.toggleDisabled(dom.unmuteCameraButtonElement, isDisabled);
};
