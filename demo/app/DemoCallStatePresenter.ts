import { dom } from '../dom';
import resolveDebug from '../logger';
import { setElementVisible, setMediaActionButtonsDisabled } from './domUiHelpers';

import type { LocalMediaStreamManager } from '../LocalMediaStreamManager';
import type PresentationManager from '../PresentationManager';
import type Statuses from '../Statuses';
import type { TStatusesByDomain } from '../StatusesRoot';
import type { TDemoParticipantRoleState, TDemoSystemState } from './types';

const debug = resolveDebug('demo:call-state-presenter');

/**
 * Синхронизация DOM демо с состоянием звонка и ролью участника (отдельно от сценариев SIP).
 */
export class DemoCallStatePresenter {
  private isCallActivePrev = false;

  private readonly localMediaStreamManager: LocalMediaStreamManager;

  private readonly statusesManager: Statuses;

  private readonly presentationManager: PresentationManager;

  public constructor(
    localMediaStreamManager: LocalMediaStreamManager,
    statusesManager: Statuses,
    presentationManager: PresentationManager,
  ) {
    this.localMediaStreamManager = localMediaStreamManager;
    this.statusesManager = statusesManager;
    this.presentationManager = presentationManager;
  }

  public renderSystemState(state: TDemoSystemState): void {
    const {
      isDisconnected,
      isDisconnecting,
      isConnecting,
      isCallConnecting,
      isCallDisconnecting,
      isCallActive,
    } = state;

    const isCallFinished = this.isCallActivePrev && !isCallActive;

    if (isCallFinished) {
      this.presentationManager.deactivate();
    }

    this.updateSessionStatuses({
      connection: state.connection,
      call: state.call,
      incoming: state.incoming,
      presentation: state.presentation,
      system: state.system,
      autoConnector: state.autoConnector,
      callReconnect: state.callReconnect,
    });

    dom.renderStatusesNodeValues(this.statusesManager.getStatusSnapshots());

    const isBusyWithConnection = isConnecting || isDisconnecting;

    dom.connectAndCallButtonElement.disabled =
      isBusyWithConnection || isCallConnecting || isCallDisconnecting;
    dom.callButtonElement.disabled =
      isBusyWithConnection || isCallConnecting || isCallDisconnecting || isDisconnected;
    dom.hangupButtonElement.disabled = !isCallActive;
    dom.endCallButtonElement.disabled = !isCallActive;
    dom.connectButtonElement.disabled = isBusyWithConnection;
    dom.disconnectButtonElement.disabled = isDisconnecting;

    if (isDisconnected) {
      dom.show(dom.connectButtonElement);
      dom.hide(dom.disconnectButtonElement);
    } else if (isConnecting) {
      dom.hide(dom.connectButtonElement);
      dom.show(dom.disconnectButtonElement);
    } else {
      dom.hide(dom.connectButtonElement);
      dom.show(dom.disconnectButtonElement);
    }

    if (isCallActive) {
      dom.hide(dom.connectAndCallButtonElement);
      dom.hide(dom.callButtonElement);
      dom.show(dom.hangupButtonElement);
      dom.show(dom.endCallButtonElement);
    } else if (isDisconnected) {
      dom.show(dom.connectAndCallButtonElement);
      dom.hide(dom.callButtonElement);
      dom.hide(dom.hangupButtonElement);
      dom.hide(dom.endCallButtonElement);
    } else {
      dom.hide(dom.connectAndCallButtonElement);
      dom.show(dom.callButtonElement);
      dom.hide(dom.hangupButtonElement);
      dom.hide(dom.endCallButtonElement);
    }

    setElementVisible(dom.localVideoSectionElement, isCallConnecting || isCallActive);
    setElementVisible(dom.activeCallSectionElement, isCallActive);

    this.updateMediaButtonsState({ isCallActive });
    this.isCallActivePrev = isCallActive;
  }

  public renderParticipantRole(participantRoleState: TDemoParticipantRoleState): void {
    const canSendMedia =
      participantRoleState.isParticipant || participantRoleState.isAvailableSendingMedia;

    setMediaActionButtonsDisabled(!canSendMedia);

    if (participantRoleState.isSpectatorRoleAny) {
      this.localMediaStreamManager.disableAll();
    }

    setElementVisible(dom.recvQualitySectionElement, participantRoleState.isSpectator);
    dom.renderStatusesNodeValues(this.statusesManager.getStatusSnapshots());
  }

  public syncMediaActionButtonsWithStreamState(): void {
    if (!dom.isVisible(dom.activeCallSectionElement)) {
      return;
    }

    this.updateCamButtonsState();
    this.updateMicButtonsState();
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private updateSessionStatuses(statuses: TStatusesByDomain): void {
    debug('updateSessionStatuses', statuses);

    dom.setActiveSessionStatusNode('connection', statuses.connection);
    dom.setActiveSessionStatusNode('autoConnectorManager', statuses.autoConnector);
    dom.setActiveSessionStatusNode('callReconnect', statuses.callReconnect);
    dom.setActiveSessionStatusNode('call', statuses.call);
    dom.setActiveSessionStatusNode('incoming', statuses.incoming);
    dom.setActiveSessionStatusNode('presentation', statuses.presentation);
    dom.setActiveSessionStatusNode('system', statuses.system);
  }

  private updateMediaButtonsState({ isCallActive }: { isCallActive: boolean }): void {
    if (isCallActive) {
      this.updateCamButtonsState();
      this.updateMicButtonsState();
    } else {
      dom.hide(dom.muteCameraButtonElement);
      dom.hide(dom.unmuteCameraButtonElement);
      dom.hide(dom.muteMicButtonElement);
      dom.hide(dom.unmuteMicButtonElement);
    }
  }

  private updateCamButtonsState(): void {
    const isEnabledCam = this.localMediaStreamManager.isEnabledCam();

    if (isEnabledCam) {
      dom.show(dom.muteCameraButtonElement);
      dom.hide(dom.unmuteCameraButtonElement);
    } else {
      dom.show(dom.unmuteCameraButtonElement);
      dom.hide(dom.muteCameraButtonElement);
    }
  }

  private updateMicButtonsState(): void {
    const isEnabledMic = this.localMediaStreamManager.isEnabledMic();

    if (isEnabledMic) {
      dom.show(dom.muteMicButtonElement);
      dom.hide(dom.unmuteMicButtonElement);
    } else {
      dom.show(dom.unmuteMicButtonElement);
      dom.hide(dom.muteMicButtonElement);
    }
  }
}
