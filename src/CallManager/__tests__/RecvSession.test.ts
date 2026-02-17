import { hasCanceledError, hasReachedLimitError } from 'repeated-calls';

import delayPromise from '@/__fixtures__/delayPromise';
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
            token: string;
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
    const token = 'test-token';

    const callPromise = session.call({ conferenceNumber, token });

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
        token,
        quality: session.getEffectiveQuality(),
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
    const token = 'test-token';

    const callPromise = session.call({ conferenceNumber, token });

    dispatchTrack(session, 'audio');
    dispatchTrack(session, 'video');

    await callPromise;

    const renegotiateResult = await session.renegotiate({ conferenceNumber, token });

    expect(session.peerConnection.createOffer).toHaveBeenCalledTimes(2);

    expect(session.peerConnection.setLocalDescription).toHaveBeenCalledTimes(2);

    expect(session.peerConnection.setRemoteDescription).toHaveBeenCalledTimes(2);

    expect(renegotiateResult).toBe(true);

    expect(tools.sendOffer).toHaveBeenNthCalledWith(
      2,
      {
        conferenceNumber,
        token,
        quality: session.getEffectiveQuality(),
        audioChannel: config.audioChannel,
      },
      expect.objectContaining({ type: 'offer', sdp: 'offer-sdp' }),
    );
  });

  it('возвращает настройки и peerConnection', () => {
    const config = createConfig();
    const tools = createTools();
    const session = new RecvSession(config, tools);

    expect(session.settings).toEqual({
      ...config,
      effectiveQuality: session.getEffectiveQuality(),
    });
    expect(session.peerConnection).toBe(session.peerConnection);
  });

  it('getQuality: возвращает запрошенное качество', () => {
    const config = createConfig({ quality: 'auto' });
    const tools = createTools();
    const session = new RecvSession(config, tools);

    expect(session.getQuality()).toBe('auto');
  });

  it('использует quality по умолчанию "auto", если quality не передан', () => {
    const config = { audioChannel: '1' };
    const tools = createTools();
    const session = new RecvSession(config, tools);

    expect(session.getQuality()).toBe('auto');
    expect(session.getEffectiveQuality()).toBe('high');
    expect(session.settings.quality).toBe('auto');
    expect(session.settings.effectiveQuality).toBe('high');
  });

  it('закрывает peerConnection', () => {
    const config = createConfig();
    const tools = createTools();
    const session = new RecvSession(config, tools);

    session.close();

    expect(session.peerConnection.close).toHaveBeenCalledTimes(1);
  });

  describe('repeatedCallsAsync sendOffer', () => {
    const SEND_OFFER_CALL_LIMIT = 10;

    it('повторяет вызов sendOffer при ошибке и завершается успехом', async () => {
      const config = createConfig();
      const sendOfferMock = jest.fn(
        async (
          params: {
            conferenceNumber: string;
            token: string;
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
      );
      const tools = createTools({ sendOffer: sendOfferMock });
      const session = new RecvSession(config, tools);
      const conferenceNumber = '123';
      const token = 'test-token';

      sendOfferMock
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockImplementationOnce(
          async (
            params: {
              conferenceNumber: string;
              token: string;
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
        );

      const result = await session.renegotiate({ conferenceNumber, token });

      expect(result).toBe(true);
      expect(sendOfferMock).toHaveBeenCalledTimes(3);
      expect(session.peerConnection.setRemoteDescription).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'answer', sdp: 'offer-sdp' }),
      );
    });

    it('повторяет вызов sendOffer до лимита попыток, затем выбрасывает ошибку', async () => {
      const config = createConfig();
      const sendOfferMock = jest.fn().mockRejectedValue(new Error('server error'));
      const tools = createTools({ sendOffer: sendOfferMock });
      const session = new RecvSession(config, tools);
      const conferenceNumber = '123';
      const token = 'test-token';

      const error = await session.renegotiate({ conferenceNumber, token }).then(
        () => {
          throw new Error('expected renegotiate to reject');
        },
        (error_: unknown) => {
          return error_;
        },
      );

      expect(hasReachedLimitError(error)).toBe(true);
      expect(sendOfferMock).toHaveBeenCalledTimes(SEND_OFFER_CALL_LIMIT);
    });

    it('close() отменяет повторные вызовы sendOffer при выполняющемся renegotiate', async () => {
      const config = createConfig();
      const sendOfferMock = jest.fn(async () => {
        return new Promise<RTCSessionDescription>(() => {
          // никогда не резолвится
        });
      });
      const tools = createTools({ sendOffer: sendOfferMock });
      const session = new RecvSession(config, tools);
      const conferenceNumber = '123';
      const token = 'test-token';

      const renegotiatePromise = session.renegotiate({ conferenceNumber, token });

      await delayPromise(0);
      session.close();

      const error = await renegotiatePromise.then(
        () => {
          throw new Error('expected renegotiate to reject');
        },
        (error_: unknown) => {
          return error_;
        },
      );

      expect(hasCanceledError(error)).toBe(true);
      expect(sendOfferMock).toHaveBeenCalled();
    });
  });

  it('setQuality: пересогласует только при изменении effectiveQuality', async () => {
    const config = createConfig({ quality: 'auto' });
    const tools = createTools();
    const session = new RecvSession(config, tools);
    const conferenceNumber = '123';
    const token = 'test-token';

    const callPromise = session.call({ conferenceNumber, token });

    dispatchTrack(session, 'audio');
    dispatchTrack(session, 'video');
    await callPromise;

    const renegotiateSpy = jest.spyOn(session, 'renegotiate');

    // quality меняется с 'auto' на 'high', но effectiveQuality остается 'high'
    // поэтому renegotiate не вызывается, но метод возвращает true (quality изменился)
    const noEffectiveChange = await session.setQuality('high');
    // quality меняется с 'high' на 'low', effectiveQuality тоже меняется
    // поэтому renegotiate вызывается
    const hasEffectiveChange = await session.setQuality('low');

    expect(noEffectiveChange).toBe(true);
    expect(hasEffectiveChange).toBe(true);
    expect(renegotiateSpy).toHaveBeenCalledTimes(1);
  });

  it('setQuality: возвращает false без lastCallParams', async () => {
    const config = createConfig();
    const tools = createTools();
    const session = new RecvSession(config, tools);

    await expect(session.setQuality('low')).resolves.toBe(false);
  });

  it('setQuality: возвращает false если quality и effectiveQuality не изменились', async () => {
    const config = createConfig({ quality: 'high' });
    const tools = createTools();
    const session = new RecvSession(config, tools);
    const conferenceNumber = '123';
    const token = 'test-token';

    const callPromise = session.call({ conferenceNumber, token });

    dispatchTrack(session, 'audio');
    dispatchTrack(session, 'video');
    await callPromise;

    const renegotiateSpy = jest.spyOn(session, 'renegotiate');

    // Вызываем setQuality с тем же значением, что уже установлено
    const result = await session.setQuality('high');

    expect(result).toBe(false);
    expect(renegotiateSpy).not.toHaveBeenCalled();
    expect(session.getQuality()).toBe('high');
    expect(session.getEffectiveQuality()).toBe('high');
  });

  describe('applyQuality', () => {
    it('возвращает { applied: true, effectiveQuality } при успешном изменении качества', async () => {
      const config = createConfig({ quality: 'auto' });
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const conferenceNumber = '123';
      const token = 'test-token';

      const callPromise = session.call({ conferenceNumber, token });

      dispatchTrack(session, 'audio');
      dispatchTrack(session, 'video');
      await callPromise;

      const result = await session.applyQuality('low');

      expect(result).toEqual({ applied: true, effectiveQuality: 'low' });
      expect(session.getQuality()).toBe('low');
      expect(session.getEffectiveQuality()).toBe('low');
    });

    it('возвращает { applied: true, effectiveQuality } при изменении quality, даже если effectiveQuality не меняется', async () => {
      const config = createConfig({ quality: 'auto' });
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const conferenceNumber = '123';
      const token = 'test-token';

      const callPromise = session.call({ conferenceNumber, token });

      dispatchTrack(session, 'audio');
      dispatchTrack(session, 'video');
      await callPromise;

      // quality меняется с 'auto' на 'high', но effectiveQuality остается 'high'
      // метод возвращает applied: true, потому что quality изменился
      const result = await session.applyQuality('high');

      expect(result).toEqual({ applied: true, effectiveQuality: 'high' });
      expect(session.getQuality()).toBe('high');
      expect(session.getEffectiveQuality()).toBe('high');
    });

    it('возвращает { applied: false, effectiveQuality } без lastCallParams', async () => {
      const config = createConfig({ quality: 'high' });
      const tools = createTools();
      const session = new RecvSession(config, tools);

      // Без lastCallParams setQuality возвращает false и не обновляет конфигурацию
      const result = await session.applyQuality('low');

      expect(result).toEqual({ applied: false, effectiveQuality: 'high' });
      expect(session.getQuality()).toBe('high');
      expect(session.getEffectiveQuality()).toBe('high');
    });

    it('effectiveQuality совпадает с getEffectiveQuality() после вызова', async () => {
      const config = createConfig({ quality: 'medium' });
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const conferenceNumber = '123';
      const token = 'test-token';

      const callPromise = session.call({ conferenceNumber, token });

      dispatchTrack(session, 'audio');
      dispatchTrack(session, 'video');
      await callPromise;

      const result = await session.applyQuality('high');

      expect(result.effectiveQuality).toBe(session.getEffectiveQuality());
      expect(result.effectiveQuality).toBe('high');
    });
  });
});
