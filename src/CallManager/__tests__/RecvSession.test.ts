import RecvSession from '../RecvSession';

import type RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';

type TTools = ConstructorParameters<typeof RecvSession>[1];
type TConfig = ConstructorParameters<typeof RecvSession>[0];

const dispatchTrack = (session: RecvSession, kind: 'audio' | 'video'): void => {
  (session.peerConnection as RTCPeerConnectionMock).dispatchTrack(kind);
};

describe('RecvSession', () => {
  const createConfig = (overrides: Partial<TConfig> = {}): TConfig => {
    return {
      quality: 'high',
      audioChannel: '1',
      ...overrides,
    };
  };
  const createTools = (overrides: Partial<TTools> = {}): TTools => {
    return {
      sendOffer: jest.fn(
        async (
          params: {
            conferenceNumber: string;
            quality: 'low' | 'medium' | 'high';
            audioChannel: string;
          },
          offer: RTCSessionDescriptionInit,
        ) => {
          return {
            ...offer,
            type: 'answer',
            params,
            toJSON: () => {
              return { ...offer, type: 'answer', params };
            },
          } as RTCSessionDescription;
        },
      ),
      ...overrides,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('создает recvonly трансиверы для основных аудио и видео, и 3 видео для презентации', () => {
    const config = createConfig();
    const tools = createTools();

    const session = new RecvSession(config, tools);

    expect(session).toBeDefined();
    expect(session.peerConnection.addTransceiver).toHaveBeenCalledTimes(5);
    expect(session.peerConnection.addTransceiver).toHaveBeenNthCalledWith(
      1,
      'audio',
      expect.objectContaining({ direction: 'recvonly' }),
    );
    expect(session.peerConnection.addTransceiver).toHaveBeenNthCalledWith(
      2,
      'video',
      expect.objectContaining({ direction: 'recvonly' }),
    );
    expect(session.peerConnection.addTransceiver).toHaveBeenNthCalledWith(
      3,
      'video',
      expect.objectContaining({ direction: 'recvonly' }),
    );
    expect(session.peerConnection.addTransceiver).toHaveBeenNthCalledWith(
      4,
      'video',
      expect.objectContaining({ direction: 'recvonly' }),
    );
    expect(session.peerConnection.addTransceiver).toHaveBeenNthCalledWith(
      5,
      'video',
      expect.objectContaining({ direction: 'recvonly' }),
    );
  });

  it('делает offer, отправляет его с параметрами, ставит answer и ждет оба трека', async () => {
    const config = createConfig();
    const tools = createTools();
    const session = new RecvSession(config, tools);
    const conferenceNumber = '123';

    const callPromise = session.call(conferenceNumber);

    // эмитим оба трека, чтобы завершить ожидание
    dispatchTrack(session, 'audio');
    dispatchTrack(session, 'video');

    await callPromise;

    expect(session.peerConnection.createOffer).toHaveBeenCalledTimes(1);
    expect(session.peerConnection.setLocalDescription).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'offer', sdp: 'offer-sdp' }),
    );
    expect(tools.sendOffer).toHaveBeenCalledWith(
      {
        conferenceNumber,
        quality: config.quality,
        audioChannel: config.audioChannel,
      },
      expect.objectContaining({ type: 'offer', sdp: 'offer-sdp' }),
    );
    expect(session.peerConnection.setRemoteDescription).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'answer', sdp: 'offer-sdp' }),
    );
  });

  it('renegotiate: пересогласует с переданным conferenceNumber', async () => {
    const config = createConfig();
    const tools = createTools();
    const session = new RecvSession(config, tools);
    const conferenceNumber = '123';

    const callPromise = session.call(conferenceNumber);

    dispatchTrack(session, 'audio');
    dispatchTrack(session, 'video');

    await callPromise;

    const renegotiateResult = await session.renegotiate(conferenceNumber);

    expect(session.peerConnection.createOffer).toHaveBeenCalledTimes(2);

    expect(session.peerConnection.setLocalDescription).toHaveBeenCalledTimes(2);

    expect(session.peerConnection.setRemoteDescription).toHaveBeenCalledTimes(2);

    expect(renegotiateResult).toBe(true);

    expect(tools.sendOffer).toHaveBeenNthCalledWith(
      2,
      {
        conferenceNumber,
        quality: config.quality,
        audioChannel: config.audioChannel,
      },
      expect.objectContaining({ type: 'offer', sdp: 'offer-sdp' }),
    );
  });

  it('возвращает настройки и peerConnection', () => {
    const config = createConfig();
    const tools = createTools();
    const session = new RecvSession(config, tools);

    expect(session.settings).toEqual(config);
    expect(session.peerConnection).toBe(session.peerConnection);
  });

  it('закрывает peerConnection', () => {
    const config = createConfig();
    const tools = createTools();
    const session = new RecvSession(config, tools);

    session.close();

    expect(session.peerConnection.close).toHaveBeenCalledTimes(1);
  });
});
