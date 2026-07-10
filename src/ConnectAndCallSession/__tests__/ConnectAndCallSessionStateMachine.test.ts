import { ConnectAndCallSessionStateMachine } from '../ConnectAndCallSessionStateMachine';
import { EConnectAndCallSessionPhase } from '../types';

describe('ConnectAndCallSessionStateMachine', () => {
  let stateMachine: ConnectAndCallSessionStateMachine;

  beforeEach(() => {
    stateMachine = new ConnectAndCallSessionStateMachine();
  });

  afterEach(() => {
    stateMachine.stop();
  });

  it('отправляет допустимое событие', () => {
    stateMachine.send({ type: 'START' });

    expect(stateMachine.state).toBe(EConnectAndCallSessionPhase.CONNECTING);
  });

  it('не отправляет недопустимое событие', () => {
    stateMachine.send({ type: 'CALL_STARTED' });

    expect(stateMachine.state).toBe(EConnectAndCallSessionPhase.IDLE);
  });
});
