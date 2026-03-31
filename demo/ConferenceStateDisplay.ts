import sipConnectorFacade from './Session/sipConnectorFacade';

type TConferenceState = {
  number?: string;
  answer?: boolean;
  room?: string;
  participantName?: string;
  token?: string; // jwt
  conferenceForToken?: string;
  pendingDisconnect?: boolean;
};

class ConferenceStateDisplay {
  private currentState: TConferenceState = {};

  public subscribe(
    onStateChange: (state: {
      room: string;
      participantName: string;
      token: string;
      conferenceForToken: string;
      number: string;
      answer: string;
      pendingDisconnect: string;
    }) => void,
  ) {
    this.subscribeConferenceState((state) => {
      onStateChange({
        room: state.room ?? '-',
        token: state.token === undefined ? '-' : `${state.token.slice(0, 20)}...`,
        conferenceForToken: state.conferenceForToken ?? '-',
        participantName: state.participantName ?? '-',
        number: state.number ?? '-',
        answer: state.answer === undefined ? '-' : String(state.answer),
        pendingDisconnect:
          state.pendingDisconnect === undefined ? '-' : String(state.pendingDisconnect),
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
    this.currentState = stateMachine.getSnapshot().context.raw;

    onStateChange(this.currentState);
    stateMachine.subscribe((snapshot) => {
      const current = snapshot.context;

      this.currentState = current.raw;
      onStateChange(this.currentState);
    });
  }
}

export default ConferenceStateDisplay;
