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

  it('setRole не вызывает onRoleChanged при той же роли', () => {
    const { mainManager, recvManager } = createManagers();
    const onRoleChanged = jest.fn();
    const roleManager = new RoleManager({ mainManager, recvManager }, onRoleChanged);

    roleManager.setRole({ type: 'participant' });

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
});
