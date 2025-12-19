import { RoleManager } from '../RoleManager';

import type { RemoteStreamsManager } from '../RemoteStreamsManager';
import type { TCallRoleViewer } from '../types';

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
    expect(roleManager.hasViewerSynthetic()).toBe(false);
    expect(roleManager.hasViewer()).toBe(false);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).not.toHaveBeenCalled();
  });

  it('setCallRoleViewer переключает роль, сохраняет recvParams и активирует recvManager', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewer(recvParams);

    expect(roleManager.getRole()).toEqual({ type: 'viewer', recvParams });
    expect(roleManager.hasViewer()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(recvManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'participant' },
      next: { type: 'viewer', recvParams },
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

  it('setCallRoleViewerSynthetic переключает с viewer на viewer и активирует основной менеджер', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewer(recvParams);
    onRoleChanged.mockClear();

    roleManager.setCallRoleViewerSynthetic();

    expect(roleManager.getRole()).toEqual({ type: 'viewer_synthetic' });
    expect(roleManager.hasViewerSynthetic()).toBe(true);
    expect(roleManager.hasViewer()).toBe(false);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'viewer', recvParams },
      next: { type: 'viewer_synthetic' },
    });
  });

  it('setCallRoleParticipant переключает на participant и onRoleChanged получает предыдущую роль', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);

    roleManager.setCallRoleViewerSynthetic();
    onRoleChanged.mockClear();

    roleManager.setCallRoleParticipant();

    expect(roleManager.getRole()).toEqual({ type: 'participant' });
    expect(roleManager.hasParticipant()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'viewer_synthetic' },
      next: { type: 'participant' },
    });
  });

  it('reset возвращает роль participant и сбрасывает recvManager', () => {
    const { mainManager, recvManager } = createManagers();
    const roleManager = new RoleManager({ mainManager, recvManager });
    const recvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewer(recvParams);
    (recvManager.reset as jest.Mock).mockClear();

    roleManager.reset();

    expect(roleManager.getRole()).toEqual({ type: 'participant' });
    expect(roleManager.hasParticipant()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(recvManager.reset).toHaveBeenCalledTimes(1);
  });

  it('статические гард-функции корректно определяют роль', () => {
    expect(RoleManager.hasParticipant({ type: 'participant' })).toBe(true);
    expect(RoleManager.hasViewerSynthetic({ type: 'participant' })).toBe(false);
    expect(RoleManager.hasViewerSynthetic({ type: 'viewer_synthetic' })).toBe(true);
    expect(
      RoleManager.hasViewer({
        type: 'viewer',
        recvParams: { audioId: 'a', sendOffer: jest.fn() },
      }),
    ).toBe(true);
  });

  it('setCallRoleViewer вызывает onRoleChanged при смене audioId в той же роли viewer', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const firstRecvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };

    // Устанавливаем первую роль viewer
    roleManager.setCallRoleViewer(firstRecvParams);
    onRoleChanged.mockClear();

    // Меняем audioId в той же роли
    roleManager.setCallRoleViewer(secondRecvParams);

    expect(roleManager.getRole()).toEqual({ type: 'viewer', recvParams: secondRecvParams });
    expect(roleManager.hasViewer()).toBe(true);
    expect(onRoleChanged).toHaveBeenCalledTimes(1);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'viewer', recvParams: firstRecvParams },
      next: { type: 'viewer', recvParams: secondRecvParams },
    });
  });

  it('setCallRoleViewer не вызывает onRoleChanged если audioId не изменился', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };

    // Устанавливаем роль viewer
    roleManager.setCallRoleViewer(recvParams);
    onRoleChanged.mockClear();

    // Пытаемся установить ту же роль с тем же audioId
    roleManager.setCallRoleViewer(recvParams);

    expect(roleManager.getRole()).toEqual({ type: 'viewer', recvParams });
    expect(roleManager.hasViewer()).toBe(true);
    expect(onRoleChanged).not.toHaveBeenCalled();
  });

  it('setCallRoleViewer обновляет роль с новым audioId', () => {
    const { mainManager, recvManager } = createManagers();
    const roleManager = new RoleManager({ mainManager, recvManager });
    const firstRecvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewer(firstRecvParams);
    expect(roleManager.getRole()).toEqual({ type: 'viewer', recvParams: firstRecvParams });

    roleManager.setCallRoleViewer(secondRecvParams);
    expect(roleManager.getRole()).toEqual({ type: 'viewer', recvParams: secondRecvParams });
  });

  it('changeRole: при последовательных вызовах setCallRoleViewer с разными audioId previous корректно обновляется', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const firstRecvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };
    const thirdRecvParams: TCallRoleViewer['recvParams'] = {
      audioId: 'audio-3',
      sendOffer: jest.fn() as unknown as TCallRoleViewer['recvParams']['sendOffer'],
    };

    // Первый вызов: переход с participant на viewer с audio-1
    roleManager.setCallRoleViewer(firstRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(1);
    expect(onRoleChanged).toHaveBeenNthCalledWith(1, {
      previous: { type: 'participant' },
      next: { type: 'viewer', recvParams: firstRecvParams },
    });

    // Второй вызов: смена audioId с audio-1 на audio-2
    roleManager.setCallRoleViewer(secondRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(2);
    expect(onRoleChanged).toHaveBeenNthCalledWith(2, {
      previous: { type: 'viewer', recvParams: firstRecvParams },
      next: { type: 'viewer', recvParams: secondRecvParams },
    });

    // Третий вызов: смена audioId с audio-2 на audio-3
    roleManager.setCallRoleViewer(thirdRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(3);
    expect(onRoleChanged).toHaveBeenNthCalledWith(3, {
      previous: { type: 'viewer', recvParams: secondRecvParams },
      next: { type: 'viewer', recvParams: thirdRecvParams },
    });

    // Проверяем, что previous всегда был предыдущей ролью, а не изначальной participant
    const allCalls = onRoleChanged.mock.calls;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[0]?.[0]?.previous).toEqual({ type: 'participant' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[1]?.[0]?.previous).toEqual({ type: 'viewer', recvParams: firstRecvParams });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[2]?.[0]?.previous).toEqual({
      type: 'viewer',
      recvParams: secondRecvParams,
    });
  });
});
