import { createApiManagerEvents, EContentUseLicense } from '@/ApiManager';
import { CallSessionState } from '../@CallSessionState';

describe('CallSessionState', () => {
  it('collects initial snapshot with derived flags', () => {
    const callSessionState = new CallSessionState();

    callSessionState.setCallRoleSpectatorSynthetic();

    const snapshot = callSessionState.getSnapshot();

    expect(snapshot.role).toEqual({ type: 'spectator_synthetic' });
    expect(snapshot.license).toBeUndefined();
    expect(snapshot.derived).toEqual({
      isSpectatorAny: true,
      isRecvSessionExpected: false,
      isAvailableSendingMedia: true,
    });
  });

  it('does not notify listeners when snapshot has no semantic changes', () => {
    const callSessionState = new CallSessionState();
    const listener = jest.fn();

    callSessionState.subscribe(listener);

    callSessionState.reset();

    expect(listener).not.toHaveBeenCalled();
    expect(callSessionState.getDiagnostics()).toEqual({
      emitsTotal: 0,
      dedupedTotal: 1,
      subscribersCount: 1,
    });
  });

  it('notifies subscriber when role changes', () => {
    const callSessionState = new CallSessionState();
    const listener = jest.fn();
    const calls = listener.mock.calls as [ReturnType<CallSessionState['getSnapshot']>][];

    callSessionState.subscribe(listener);

    callSessionState.setCallRoleSpectator({ audioId: 'audio-1' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(calls[0]?.[0]?.role).toEqual({
      type: 'spectator',
      recvParams: { audioId: 'audio-1' },
    });
  });

  it('syncs license from use-license event', () => {
    const apiEvents = createApiManagerEvents();
    const callSessionState = new CallSessionState();
    const listener = jest.fn();
    const calls = listener.mock.calls as [ReturnType<CallSessionState['getSnapshot']>][];

    callSessionState.subscribe(listener);
    callSessionState.subscribeToApiEvents(apiEvents);

    apiEvents.trigger('use-license', EContentUseLicense.AUDIO);
    apiEvents.trigger('use-license', EContentUseLicense.AUDIO);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(calls[0]?.[0]?.license).toBe(EContentUseLicense.AUDIO);
    expect(callSessionState.getDiagnostics()).toEqual({
      emitsTotal: 1,
      dedupedTotal: 1,
      subscribersCount: 1,
    });
  });

  it('syncs isAvailableSendingMedia from role methods', () => {
    const callSessionState = new CallSessionState();
    const listener = jest.fn();
    const calls = listener.mock.calls as [ReturnType<CallSessionState['getSnapshot']>][];

    callSessionState.subscribe(listener);
    callSessionState.setCallRoleSpectatorSynthetic(false);
    callSessionState.setCallRoleParticipant();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(calls[0]?.[0]?.derived.isAvailableSendingMedia).toBe(false);
    expect(calls[1]?.[0]?.derived.isAvailableSendingMedia).toBe(true);
    expect(callSessionState.getDiagnostics()).toEqual({
      emitsTotal: 2,
      dedupedTotal: 0,
      subscribersCount: 1,
    });
  });

  it('stops subscriptions and keeps diagnostics counters', () => {
    const callSessionState = new CallSessionState();
    const listener = jest.fn();

    callSessionState.subscribe(listener);
    callSessionState.setCallRoleSpectatorSynthetic();
    callSessionState.stop();
    callSessionState.setCallRoleParticipant();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(callSessionState.getDiagnostics()).toEqual({
      emitsTotal: 1,
      dedupedTotal: 0,
      subscribersCount: 0,
    });
  });

  it('reset: возвращает роль participant и доступность отправки media в true', () => {
    const callSessionState = new CallSessionState();
    const apiEvents = createApiManagerEvents();

    callSessionState.subscribeToApiEvents(apiEvents);

    callSessionState.setCallRoleSpectatorSynthetic(false);
    apiEvents.trigger('use-license', EContentUseLicense.VIDEO);
    callSessionState.reset();

    expect(callSessionState.getSnapshot().role).toEqual({ type: 'participant' });
    expect(callSessionState.getSnapshot().license).toBeUndefined();
    expect(callSessionState.getSnapshot().derived.isAvailableSendingMedia).toBe(true);
  });
});
