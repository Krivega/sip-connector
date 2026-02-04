import sipConnectorFacade from './Session/sipConnectorFacade';

type TConferenceState = {
  // Данные конференции
  room?: string;
  participantName?: string;
  token?: string; // jwt
  conference?: string;
  participant?: string;
  number?: string;
  answer?: boolean;
};

class ConferenceStateDisplay {
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private unsubscribe(): void {
    // do nothing
  }

  private subscribeConferenceState(onStateChange: (state: TConferenceState) => void) {
    this.unsubscribe();

    const { stateMachine } = sipConnectorFacade.sipConnector.callManager;

    // Показываем текущее состояние
    this.currentState = stateMachine.getSnapshot().context as TConferenceState;
    onStateChange(this.currentState);
    stateMachine.subscribe((snapshot) => {
      const current = snapshot.context as TConferenceState;

      this.currentState = current;
      onStateChange(this.currentState);
    });
  }
}

export default ConferenceStateDisplay;
