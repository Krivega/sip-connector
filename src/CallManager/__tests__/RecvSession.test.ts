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

  it('инициализация: возвращает audioChannel, quality и effectiveQuality', () => {
    const config = createConfig();
    const tools = createTools();

    const session = new RecvSession(config, tools);

    expect(session).toBeDefined();
    expect(session.getAudioChannel()).toBe(config.audioChannel);
    expect(session.getQuality()).toBe(config.quality);
    expect(session.getEffectiveQuality()).toBe(config.quality);
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
    }, 10_000);

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

  describe('renegotiate: signaling state and serialization', () => {
    it('signalingState === stable после завершения renegotiate', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;
      const conferenceNumber = '123';
      const token = 'test-token';

      const callPromise = session.call({ conferenceNumber, token });

      dispatchTrack(session, 'audio');
      dispatchTrack(session, 'video');
      await callPromise;

      expect(pc.signalingState).toBe('stable');

      await session.renegotiate({ conferenceNumber, token });

      expect(pc.signalingState).toBe('stable');
    });

    it('не очищает currentRenegotiation в finally, если новый renegotiate уже перезаписал его', async () => {
      const config = createConfig();
      let sendOfferCallCount = 0;
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
          sendOfferCallCount += 1;

          if (sendOfferCallCount === 1) {
            return new Promise<RTCSessionDescription>(() => {});
          }

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
      const params = { conferenceNumber: '123', token: 'test-token' };

      const first = session.renegotiate(params);

      await delayPromise(0);

      const second = session.renegotiate(params);

      // Эмулируем ситуацию, когда currentRenegotiation уже перезаписан следующим renegotiate.
      // В нормальном flow second не успевает установить его до first's finally, поэтому
      // принудительно задаём иное значение для покрытия else на строке 206.
      (session as unknown as { currentRenegotiation?: Promise<boolean> }).currentRenegotiation =
        second;

      const firstError = await first.then(
        () => {
          throw new Error('expected first renegotiate to reject');
        },
        (error: unknown) => {
          return error;
        },
      );

      expect(hasCanceledError(firstError)).toBe(true);

      await expect(second).resolves.toBe(true);
      expect(sendOfferCallCount).toBe(2);
    });

    it('отменяет предыдущий sendOffer и откатывает signalingState при параллельном вызове', async () => {
      const config = createConfig();
      let sendOfferCallCount = 0;
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
          sendOfferCallCount += 1;

          if (sendOfferCallCount === 1) {
            return new Promise<RTCSessionDescription>(() => {});
          }

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
      const pc = session.peerConnection as RTCPeerConnectionMock;
      const params = { conferenceNumber: '123', token: 'test-token' };

      const first = session.renegotiate(params);

      await delayPromise(0);

      expect(pc.signalingState).toBe('have-local-offer');

      const second = session.renegotiate(params);

      const firstError = await first.then(
        () => {
          throw new Error('expected first renegotiate to reject');
        },
        (error_: unknown) => {
          return error_;
        },
      );

      expect(hasCanceledError(firstError)).toBe(true);

      await expect(second).resolves.toBe(true);
      expect(pc.signalingState).toBe('stable');
      expect(pc.setLocalDescription).toHaveBeenCalledWith({ type: 'rollback' });
    });

    it('сериализует параллельные renegotiate: второй ждёт завершения первого', async () => {
      const config = createConfig();
      let sendOfferResolve!: (value: RTCSessionDescription) => void;
      let sendOfferCallCount = 0;
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
          sendOfferCallCount += 1;

          if (sendOfferCallCount === 1) {
            return new Promise<RTCSessionDescription>((resolve) => {
              sendOfferResolve = resolve;
            });
          }

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
      const params = { conferenceNumber: '123', token: 'test-token' };

      const first = session.renegotiate(params);

      await delayPromise(0);

      const second = session.renegotiate(params);

      const firstError = await first.then(
        () => {
          throw new Error('expected first renegotiate to reject');
        },
        (error_: unknown) => {
          return error_;
        },
      );

      expect(hasCanceledError(firstError)).toBe(true);

      const secondResult = await second;

      expect(secondResult).toBe(true);
      expect(sendOfferCallCount).toBe(2);

      sendOfferResolve(undefined as unknown as RTCSessionDescription);
    });

    it('ожидает stable signalingState при медленном setRemoteDescription', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;
      const params = { conferenceNumber: '123', token: 'test-token' };

      let resolveSlowSetRemote!: () => void;
      const originalSetRemoteImpl = pc.setRemoteDescription.getMockImplementation();

      pc.setRemoteDescription.mockImplementationOnce(async (description) => {
        await new Promise<void>((resolve) => {
          resolveSlowSetRemote = resolve;
        });

        if (originalSetRemoteImpl) {
          return originalSetRemoteImpl(description);
        }

        return undefined;
      });

      const renegotiatePromise = session.renegotiate(params);

      await delayPromise(0);

      expect(pc.signalingState).toBe('have-local-offer');

      resolveSlowSetRemote();

      await renegotiatePromise;

      expect(pc.signalingState).toBe('stable');
    });

    it('waitForPeerConnectionReady: handler резолвит при переходе в ready по signalingstatechange', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;
      const params = { conferenceNumber: '123', token: 'test-token' };

      const removeEventListenerSpy = jest.spyOn(pc, 'removeEventListener');

      let resolveSetRemote!: () => void;

      pc.setRemoteDescription.mockImplementationOnce(async () => {
        await new Promise<void>((r) => {
          resolveSetRemote = r;
        });
        // Не меняем state — оставляем have-local-offer. setTimeout(0) откладывает dispatch
        // после выполнения performRenegotiate -> waitForPeerConnectionReady (подписка handler)
        setTimeout(() => {
          pc.signalingState = 'stable';
          pc.dispatchEvent(new Event('signalingstatechange'));
        }, 0);
      });

      const renegotiatePromise = session.renegotiate(params);

      await delayPromise(0);

      resolveSetRemote();

      await expect(renegotiatePromise).resolves.toBe(true);

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'signalingstatechange',
        expect.any(Function),
      );
    });

    it('waitForPeerConnectionReady: handler продолжает ждать при signalingstatechange без ready', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;
      const params = { conferenceNumber: '123', token: 'test-token' };

      let resolveSetRemote!: () => void;

      pc.setRemoteDescription.mockImplementationOnce(async () => {
        await new Promise<void>((r) => {
          resolveSetRemote = r;
        });
        setTimeout(() => {
          pc.signalingState = 'have-remote-offer';
          pc.dispatchEvent(new Event('signalingstatechange'));
        }, 0);
        setTimeout(() => {
          pc.signalingState = 'stable';
          pc.dispatchEvent(new Event('signalingstatechange'));
        }, 20);
      });

      const renegotiatePromise = session.renegotiate(params);

      await delayPromise(0);

      resolveSetRemote();

      await expect(renegotiatePromise).resolves.toBe(true);
    });

    it('waitForPeerConnectionReady: не таймаутится, если ready наступил до подписки на listener', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;

      pc.signalingState = 'have-local-offer';

      const originalAddEventListener = pc.addEventListener.bind(pc);
      const addEventListenerSpy = jest
        .spyOn(pc, 'addEventListener')
        .mockImplementation((type, listener, options) => {
          // Эмулируем гонку: stable + dispatch происходят до фактической подписки.
          pc.signalingState = 'stable';
          pc.dispatchEvent(new Event('signalingstatechange'));

          originalAddEventListener(type, listener, options);
        });

      try {
        const waitPromise = (
          session as unknown as { waitForPeerConnectionReady: () => Promise<void> }
        ).waitForPeerConnectionReady();

        await expect(waitPromise).resolves.toBeUndefined();
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('выбрасывает ошибку по таймауту waitForPeerConnectionReady', async () => {
      jest.useFakeTimers();

      try {
        const config = createConfig();
        const tools = createTools();
        const session = new RecvSession(config, tools);
        const pc = session.peerConnection as RTCPeerConnectionMock;
        const params = { conferenceNumber: '123', token: 'test-token' };

        // Мокируем setRemoteDescription так, чтобы он не менял signalingState
        // Это оставит состояние в 'have-local-offer', что вызовет таймаут
        pc.setRemoteDescription.mockImplementationOnce(async () => {
          // signalingState остаётся have-local-offer — не меняется и event не диспатчится
        });

        const renegotiatePromise = session.renegotiate(params);

        // Даём промису время дойти до waitForPeerConnectionReady
        await Promise.resolve();

        // Присоединяем expect ДО advance timers — при срабатывании таймаута rejection
        // уже будет обработан, иначе возможен unhandled rejection.
        // Без await: иначе deadlock — ждали бы rejection до advance, но rejection — после advance
        // eslint-disable-next-line jest/valid-expect
        const expectPromise = expect(renegotiatePromise).rejects.toThrow(
          'Timed out waiting for stable signaling state and ready connection state',
        );

        // Advance timers на 5000ms — сработает таймаут waitForPeerConnectionReady
        await jest.advanceTimersByTimeAsync(5000);

        await expectPromise;
      } finally {
        // Всегда очищаем fake timers, даже если тест упал
        jest.useRealTimers();
      }
    });

    it('waitForPeerConnectionReady: reject при connectionState failed до ожидания', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;

      pc.signalingState = 'have-local-offer';
      pc.connectionState = 'failed';

      const waitPromise = (
        session as unknown as { waitForPeerConnectionReady: () => Promise<void> }
      ).waitForPeerConnectionReady();

      await expect(waitPromise).rejects.toThrow(
        'Peer connection in terminal state: failed. Recovery is not possible.',
      );
    });

    it('waitForPeerConnectionReady: reject при connectionState closed до ожидания', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;

      pc.signalingState = 'have-local-offer';
      pc.connectionState = 'closed';

      const waitPromise = (
        session as unknown as { waitForPeerConnectionReady: () => Promise<void> }
      ).waitForPeerConnectionReady();

      await expect(waitPromise).rejects.toThrow(
        'Peer connection in terminal state: closed. Recovery is not possible.',
      );
    });

    it('waitForPeerConnectionReady: reject при terminal state между подпиской и проверкой', async () => {
      const config = createConfig();
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;

      pc.signalingState = 'have-local-offer';
      pc.connectionState = 'connecting';

      const originalAddEventListener = pc.addEventListener.bind(pc);

      jest.spyOn(pc, 'addEventListener').mockImplementation((type, listener, options) => {
        if (type === 'connectionstatechange') {
          pc.connectionState = 'failed';
        }

        originalAddEventListener(type, listener, options);
      });

      const waitPromise = (
        session as unknown as { waitForPeerConnectionReady: () => Promise<void> }
      ).waitForPeerConnectionReady();

      await expect(waitPromise).rejects.toThrow(
        'Peer connection in terminal state: failed. Recovery is not possible.',
      );
    });

    it('waitForPeerConnectionReady: reject при переходе connectionState в failed во время ожидания', async () => {
      const config = createConfig();
      let resolveSetRemote!: () => void;
      const tools = createTools();
      const session = new RecvSession(config, tools);
      const pc = session.peerConnection as RTCPeerConnectionMock;
      const params = { conferenceNumber: '123', token: 'test-token' };

      pc.setRemoteDescription.mockImplementationOnce(async () => {
        await new Promise<void>((r) => {
          resolveSetRemote = r;
        });
        setTimeout(() => {
          pc.connectionState = 'failed';
          pc.dispatchEvent(new Event('connectionstatechange'));
        }, 0);
      });

      const renegotiatePromise = session.renegotiate(params);

      await delayPromise(0);
      resolveSetRemote();

      await expect(renegotiatePromise).rejects.toThrow(
        'Peer connection in terminal state: failed. Recovery is not possible.',
      );
    });
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
