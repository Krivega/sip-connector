import { RoleManager } from '../RoleManager';

import type { RemoteStreamsManager } from '../RemoteStreamsManager';
import type { TCallRoleSpectator } from '../types';

const createManagers = () => {
  const mainManager: RemoteStreamsManager = { reset: jest.fn() } as unknown as RemoteStreamsManager;
  const recvManager: RemoteStreamsManager = { reset: jest.fn() } as unknown as RemoteStreamsManager;

  return { mainManager, recvManager };
};

describe('RoleManager', () => {
  it('начальное состояние: participant и основной менеджер активен', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);

    expect(roleManager.getRole()).toEqual({ type: 'participant' });
    expect(roleManager.hasParticipant()).toBe(true);
    expect(roleManager.hasSpectatorSynthetic()).toBe(false);
    expect(roleManager.hasSpectator()).toBe(false);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).not.toHaveBeenCalled();
  });

  it('setCallRoleSpectator переключает роль, сохраняет recvParams и активирует recvManager', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleSpectator(recvParams);

    expect(roleManager.getRole()).toEqual({ type: 'spectator', recvParams });
    expect(roleManager.hasSpectator()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(recvManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'participant' },
      next: { type: 'spectator', recvParams },
    });
  });

  it('changeRole не вызывает onRoleChanged при той же роли', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);

    roleManager.changeRole({ type: 'participant' });

    expect(onRoleChanged).not.toHaveBeenCalled();
    expect(roleManager.getRole()).toEqual({ type: 'participant' });
  });

  it('setCallRoleSpectatorSynthetic переключает с spectator на spectator и активирует основной менеджер', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleSpectator(recvParams);
    onRoleChanged.mockClear();

    roleManager.setCallRoleSpectatorSynthetic();

    expect(roleManager.getRole()).toEqual({ type: 'spectator_synthetic' });
    expect(roleManager.hasSpectatorSynthetic()).toBe(true);
    expect(roleManager.hasSpectator()).toBe(false);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'spectator', recvParams },
      next: { type: 'spectator_synthetic' },
    });
  });

  it('setCallRoleParticipant переключает на participant и onRoleChanged получает предыдущую роль', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);

    roleManager.setCallRoleSpectatorSynthetic();
    onRoleChanged.mockClear();

    roleManager.setCallRoleParticipant();

    expect(roleManager.getRole()).toEqual({ type: 'participant' });
    expect(roleManager.hasParticipant()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'spectator_synthetic' },
      next: { type: 'participant' },
    });
  });

  it('reset возвращает роль participant и сбрасывает recvManager', () => {
    const { mainManager, recvManager } = createManagers();
    const roleManager = new RoleManager({ mainManager, recvManager });
    const recvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleSpectator(recvParams);
    (recvManager.reset as jest.Mock).mockClear();

    roleManager.reset();

    expect(roleManager.getRole()).toEqual({ type: 'participant' });
    expect(roleManager.hasParticipant()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(recvManager.reset).toHaveBeenCalledTimes(1);
  });

  it('статические гард-функции корректно определяют роль', () => {
    expect(RoleManager.hasParticipant({ type: 'participant' })).toBe(true);
    expect(RoleManager.hasSpectatorSynthetic({ type: 'participant' })).toBe(false);
    expect(RoleManager.hasSpectatorSynthetic({ type: 'spectator_synthetic' })).toBe(true);
    expect(
      RoleManager.hasSpectator({
        type: 'spectator',
        recvParams: { audioId: 'a', sendOffer: jest.fn() },
      }),
    ).toBe(true);
  });

  it('setCallRoleSpectator вызывает onRoleChanged при смене audioId в той же роли spectator', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const firstRecvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };

    // Устанавливаем первую роль spectator
    roleManager.setCallRoleSpectator(firstRecvParams);
    onRoleChanged.mockClear();

    // Меняем audioId в той же роли
    roleManager.setCallRoleSpectator(secondRecvParams);

    expect(roleManager.getRole()).toEqual({ type: 'spectator', recvParams: secondRecvParams });
    expect(roleManager.hasSpectator()).toBe(true);
    expect(onRoleChanged).toHaveBeenCalledTimes(1);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'spectator', recvParams: firstRecvParams },
      next: { type: 'spectator', recvParams: secondRecvParams },
    });
  });

  it('setCallRoleSpectator не вызывает onRoleChanged если audioId не изменился', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };

    // Устанавливаем роль spectator
    roleManager.setCallRoleSpectator(recvParams);
    onRoleChanged.mockClear();

    // Пытаемся установить ту же роль с тем же audioId
    roleManager.setCallRoleSpectator(recvParams);

    expect(roleManager.getRole()).toEqual({ type: 'spectator', recvParams });
    expect(roleManager.hasSpectator()).toBe(true);
    expect(onRoleChanged).not.toHaveBeenCalled();
  });

  it('setCallRoleSpectator обновляет роль с новым audioId', () => {
    const { mainManager, recvManager } = createManagers();
    const roleManager = new RoleManager({ mainManager, recvManager });
    const firstRecvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleSpectator(firstRecvParams);
    expect(roleManager.getRole()).toEqual({ type: 'spectator', recvParams: firstRecvParams });

    roleManager.setCallRoleSpectator(secondRecvParams);
    expect(roleManager.getRole()).toEqual({ type: 'spectator', recvParams: secondRecvParams });
  });

  it('changeRole: при последовательных вызовах setCallRoleSpectator с разными audioId previous корректно обновляется', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const firstRecvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };
    const thirdRecvParams: TCallRoleSpectator['recvParams'] = {
      audioId: 'audio-3',
      sendOffer: jest.fn() as unknown as TCallRoleSpectator['recvParams']['sendOffer'],
    };

    // Первый вызов: переход с participant на spectator с audio-1
    roleManager.setCallRoleSpectator(firstRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(1);
    expect(onRoleChanged).toHaveBeenNthCalledWith(1, {
      previous: { type: 'participant' },
      next: { type: 'spectator', recvParams: firstRecvParams },
    });

    // Второй вызов: смена audioId с audio-1 на audio-2
    roleManager.setCallRoleSpectator(secondRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(2);
    expect(onRoleChanged).toHaveBeenNthCalledWith(2, {
      previous: { type: 'spectator', recvParams: firstRecvParams },
      next: { type: 'spectator', recvParams: secondRecvParams },
    });

    // Третий вызов: смена audioId с audio-2 на audio-3
    roleManager.setCallRoleSpectator(thirdRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(3);
    expect(onRoleChanged).toHaveBeenNthCalledWith(3, {
      previous: { type: 'spectator', recvParams: secondRecvParams },
      next: { type: 'spectator', recvParams: thirdRecvParams },
    });

    // Проверяем, что previous всегда был предыдущей ролью, а не изначальной participant
    const allCalls = onRoleChanged.mock.calls;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[0]?.[0]?.previous).toEqual({ type: 'participant' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[1]?.[0]?.previous).toEqual({ type: 'spectator', recvParams: firstRecvParams });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[2]?.[0]?.previous).toEqual({
      type: 'spectator',
      recvParams: secondRecvParams,
    });
  });
});
