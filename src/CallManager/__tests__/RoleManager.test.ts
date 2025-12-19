import { RoleManager } from '../RoleManager';

import type { RemoteStreamsManager } from '../RemoteStreamsManager';
import type { TCallRoleViewerNew } from '../types';

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
    expect(roleManager.hasViewer()).toBe(false);
    expect(roleManager.hasViewerNew()).toBe(false);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).not.toHaveBeenCalled();
  });

  it('setCallRoleViewerNew переключает роль, сохраняет recvParams и активирует recvManager', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewerNew(recvParams);

    expect(roleManager.getRole()).toEqual({ type: 'viewer_new', recvParams });
    expect(roleManager.hasViewerNew()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(recvManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'participant' },
      next: { type: 'viewer_new', recvParams },
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

  it('setCallRoleViewer переключает с viewer_new на viewer и активирует основной менеджер', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewerNew(recvParams);
    onRoleChanged.mockClear();

    roleManager.setCallRoleViewer();

    expect(roleManager.getRole()).toEqual({ type: 'viewer' });
    expect(roleManager.hasViewer()).toBe(true);
    expect(roleManager.hasViewerNew()).toBe(false);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'viewer_new', recvParams },
      next: { type: 'viewer' },
    });
  });

  it('setCallRoleParticipant переключает на participant и onRoleChanged получает предыдущую роль', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);

    roleManager.setCallRoleViewer();
    onRoleChanged.mockClear();

    roleManager.setCallRoleParticipant();

    expect(roleManager.getRole()).toEqual({ type: 'participant' });
    expect(roleManager.hasParticipant()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'viewer' },
      next: { type: 'participant' },
    });
  });

  it('reset возвращает роль participant и сбрасывает recvManager', () => {
    const { mainManager, recvManager } = createManagers();
    const roleManager = new RoleManager({ mainManager, recvManager });
    const recvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewerNew(recvParams);
    (recvManager.reset as jest.Mock).mockClear();

    roleManager.reset();

    expect(roleManager.getRole()).toEqual({ type: 'participant' });
    expect(roleManager.hasParticipant()).toBe(true);
    expect(roleManager.getActiveManager()).toBe(mainManager);
    expect(recvManager.reset).toHaveBeenCalledTimes(1);
  });

  it('статические гард-функции корректно определяют роль', () => {
    expect(RoleManager.hasParticipant({ type: 'participant' })).toBe(true);
    expect(RoleManager.hasViewer({ type: 'participant' })).toBe(false);
    expect(RoleManager.hasViewer({ type: 'viewer' })).toBe(true);
    expect(
      RoleManager.hasViewerNew({
        type: 'viewer_new',
        recvParams: { audioId: 'a', sendOffer: jest.fn() },
      }),
    ).toBe(true);
  });

  it('setCallRoleViewerNew вызывает onRoleChanged при смене audioId в той же роли viewer_new', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const firstRecvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };

    // Устанавливаем первую роль viewer_new
    roleManager.setCallRoleViewerNew(firstRecvParams);
    onRoleChanged.mockClear();

    // Меняем audioId в той же роли
    roleManager.setCallRoleViewerNew(secondRecvParams);

    expect(roleManager.getRole()).toEqual({ type: 'viewer_new', recvParams: secondRecvParams });
    expect(roleManager.hasViewerNew()).toBe(true);
    expect(onRoleChanged).toHaveBeenCalledTimes(1);
    expect(onRoleChanged).toHaveBeenCalledWith({
      previous: { type: 'viewer_new', recvParams: firstRecvParams },
      next: { type: 'viewer_new', recvParams: secondRecvParams },
    });
  });

  it('setCallRoleViewerNew не вызывает onRoleChanged если audioId не изменился', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const recvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };

    // Устанавливаем роль viewer_new
    roleManager.setCallRoleViewerNew(recvParams);
    onRoleChanged.mockClear();

    // Пытаемся установить ту же роль с тем же audioId
    roleManager.setCallRoleViewerNew(recvParams);

    expect(roleManager.getRole()).toEqual({ type: 'viewer_new', recvParams });
    expect(roleManager.hasViewerNew()).toBe(true);
    expect(onRoleChanged).not.toHaveBeenCalled();
  });

  it('setCallRoleViewerNew обновляет роль с новым audioId', () => {
    const { mainManager, recvManager } = createManagers();
    const roleManager = new RoleManager({ mainManager, recvManager });
    const firstRecvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };

    roleManager.setCallRoleViewerNew(firstRecvParams);
    expect(roleManager.getRole()).toEqual({ type: 'viewer_new', recvParams: firstRecvParams });

    roleManager.setCallRoleViewerNew(secondRecvParams);
    expect(roleManager.getRole()).toEqual({ type: 'viewer_new', recvParams: secondRecvParams });
  });

  it('changeRole: при последовательных вызовах setCallRoleViewerNew с разными audioId previous корректно обновляется', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);
    const firstRecvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-1',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };
    const secondRecvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-2',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };
    const thirdRecvParams: TCallRoleViewerNew['recvParams'] = {
      audioId: 'audio-3',
      sendOffer: jest.fn() as unknown as TCallRoleViewerNew['recvParams']['sendOffer'],
    };

    // Первый вызов: переход с participant на viewer_new с audio-1
    roleManager.setCallRoleViewerNew(firstRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(1);
    expect(onRoleChanged).toHaveBeenNthCalledWith(1, {
      previous: { type: 'participant' },
      next: { type: 'viewer_new', recvParams: firstRecvParams },
    });

    // Второй вызов: смена audioId с audio-1 на audio-2
    roleManager.setCallRoleViewerNew(secondRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(2);
    expect(onRoleChanged).toHaveBeenNthCalledWith(2, {
      previous: { type: 'viewer_new', recvParams: firstRecvParams },
      next: { type: 'viewer_new', recvParams: secondRecvParams },
    });

    // Третий вызов: смена audioId с audio-2 на audio-3
    roleManager.setCallRoleViewerNew(thirdRecvParams);
    expect(onRoleChanged).toHaveBeenCalledTimes(3);
    expect(onRoleChanged).toHaveBeenNthCalledWith(3, {
      previous: { type: 'viewer_new', recvParams: secondRecvParams },
      next: { type: 'viewer_new', recvParams: thirdRecvParams },
    });

    // Проверяем, что previous всегда был предыдущей ролью, а не изначальной participant
    const allCalls = onRoleChanged.mock.calls;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[0]?.[0]?.previous).toEqual({ type: 'participant' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[1]?.[0]?.previous).toEqual({ type: 'viewer_new', recvParams: firstRecvParams });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(allCalls[2]?.[0]?.previous).toEqual({
      type: 'viewer_new',
      recvParams: secondRecvParams,
    });
  });
});
