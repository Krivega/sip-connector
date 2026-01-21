import sipConnectorFacade from './Session/sipConnectorFacade';

import type { TConferenceState } from '@/ConferenceStateManager';

class ConferenceStateDisplay {
  private unsubscribeChangedConferenceState?: () => void;

  private unsubscribeResetConferenceState?: () => void;

  private currentState: TConferenceState = {};

  public subscribe(
    onStateChange: (state: {
      room: string;
      participantName: string;
      token: string;
      conference: string;
      participant: string;
      number: string;
      answer: string;
    }) => void,
  ) {
    this.subscribeConferenceState((state) => {
      onStateChange({
        room: state.room ?? '-',
        participantName: state.participantName ?? '-',
        token: state.token === undefined ? '-' : `${state.token.slice(0, 20)}...`,
        conference: state.conference ?? '-',
        participant: state.participant ?? '-',
        number: state.number ?? '-',
        answer: state.answer === undefined ? '-' : String(state.answer),
      });
    });
  }

  private unsubscribe() {
    this.unsubscribeChangedConferenceState?.();
    this.unsubscribeResetConferenceState?.();
  }

  private subscribeConferenceState(onStateChange: (state: TConferenceState) => void) {
    this.unsubscribe();

    const { conferenceStateManager } = sipConnectorFacade.sipConnector;

    // Показываем текущее состояние
    this.currentState = conferenceStateManager.getState();
    onStateChange(this.currentState);

    // Подписываемся на изменения
    this.unsubscribeChangedConferenceState = conferenceStateManager.on(
      'state-changed',
      ({ current }) => {
        this.currentState = current;
        onStateChange(this.currentState);
      },
    );
    this.unsubscribeResetConferenceState = conferenceStateManager.on('state-reset', () => {
      this.currentState = {};
      onStateChange(this.currentState);
    });
  }
}

export default ConferenceStateDisplay;
