import { DemoCallFlowService } from '../DemoCallFlowService';

import type { IFormState } from '../../state/FormState';

const buildFormState = (): IFormState => {
  return {
    serverAddress: 'https://example.test',
    displayName: 'Demo',
    authEnabled: false,
    userNumber: '1000',
    password: '',
    conferenceNumber: '2000',
    autoRedialEnabled: true,
  };
};

describe('DemoCallFlowService', () => {
  it('после connect вызывает фабрику, connect у сессии и скрывает лоадер', async () => {
    const loader = {
      show: jest.fn(),
      hide: jest.fn(),
      setMessage: jest.fn(),
    };

    const session = {
      hasConnected: jest.fn(() => {
        return true;
      }),
      connect: jest.fn().mockResolvedValue(undefined),
      callToServer: jest.fn(),
      disconnectFromServer: jest.fn(),
      hangUpCall: jest.fn(),
      stopCall: jest.fn(),
      sendMediaState: jest.fn().mockResolvedValue(undefined),
    };

    const createSession = jest.fn(() => {
      return session;
    });

    const service = new DemoCallFlowService({
      loader,
      sessionFactory: { createSession },
      media: {
        initialize: jest.fn(),
        getStream: jest.fn(),
      },
    });

    await service.connect(buildFormState());

    expect(loader.setMessage).toHaveBeenCalledWith('Подключение к серверу...');
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(session.connect).toHaveBeenCalledTimes(1);
    expect(loader.hide).toHaveBeenCalledTimes(1);
    expect(service.hasConnected()).toBe(true);
  });

  it('callToServer без сессии бросает ошибку', async () => {
    const service = new DemoCallFlowService({
      loader: { show: jest.fn(), hide: jest.fn(), setMessage: jest.fn() },
      sessionFactory: { createSession: jest.fn() },
      media: { initialize: jest.fn(), getStream: jest.fn() },
    });

    await expect(
      service.callToServer(buildFormState(), () => {
        return undefined;
      }),
    ).rejects.toThrow('Session is not initialized');
  });

  it('callToServer инициализирует медиа и отдаёт поток в session.callToServer', async () => {
    const loader = {
      show: jest.fn(),
      hide: jest.fn(),
      setMessage: jest.fn(),
    };

    const mediaStream = new MediaStream();

    const session = {
      hasConnected: jest.fn(() => {
        return true;
      }),
      connect: jest.fn(),
      callToServer: jest.fn().mockResolvedValue(undefined),
      disconnectFromServer: jest.fn(),
      hangUpCall: jest.fn(),
      stopCall: jest.fn(),
      sendMediaState: jest.fn().mockResolvedValue(undefined),
    };

    const initialize = jest.fn().mockResolvedValue(mediaStream);
    const getStream = jest.fn(() => {
      return mediaStream;
    });

    const service = new DemoCallFlowService({
      loader,
      sessionFactory: {
        createSession: () => {
          return session;
        },
      },
      media: { initialize, getStream },
    });

    await service.connect(buildFormState());

    const onStreams = jest.fn();

    await service.callToServer(buildFormState(), onStreams);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(session.callToServer).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaStream,
        conference: '2000',
        autoRedial: true,
        setRemoteStreams: onStreams,
      }),
    );
    expect(loader.hide).toHaveBeenCalled();
  });
});
