import { CALL_MACHINE_EVALUATE_STATE, EState } from '../constants';
import { shouldResetInRoomCredentialsPrevious } from '../inRoomCredentialsPreviousReset';

describe('shouldResetInRoomCredentialsPrevious', () => {
  it('возвращает false для служебного состояния evaluate (previous не сбрасываем)', () => {
    expect(shouldResetInRoomCredentialsPrevious(CALL_MACHINE_EVALUATE_STATE)).toBe(false);
  });

  it('возвращает true для доменных состояний вне IN_ROOM (сброс previous)', () => {
    expect(shouldResetInRoomCredentialsPrevious(EState.IDLE)).toBe(true);
    expect(shouldResetInRoomCredentialsPrevious(EState.DISCONNECTING)).toBe(true);
    expect(shouldResetInRoomCredentialsPrevious(EState.ROOM_PENDING_AUTH)).toBe(true);
  });
});
