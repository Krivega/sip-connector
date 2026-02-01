/// <reference types="jest" />

import sendOffer from '../sendOffer';

const token = 'jwt-token-123';

describe('sendOffer', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('должен отправлять POST запрос с корректным URL и телом и возвращать SDP answer', async () => {
    expect.assertions(7);

    const serverUrl = 'dev.vinteo.com/';
    const conferenceNumber = '1008';
    const quality = 'medium';
    const audio = 0;
    const offer: RTCSessionDescriptionInit = {
      type: 'offer',
      sdp: 'test-sdp',
    };

    const responseJson = {
      type: 'answer' as RTCSdpType,
      sdp: 'answer-sdp',
    };

    // @ts-expect-error: используем мок
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        return responseJson;
      },
    });

    const result = await sendOffer({
      serverUrl,
      conferenceNumber,
      quality,
      audio,
      offer,
      token,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;

    expect(calledUrl).toContain('https://dev.vinteo.com');
    expect(calledUrl).toContain('/api/v2/rtp2webrtc/offer/');
    expect(calledUrl).toContain(conferenceNumber);
    expect(calledOptions.body).toEqual(JSON.stringify(offer));

    expect(result).toEqual({
      type: responseJson.type,
      sdp: responseJson.sdp,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      toJSON: expect.any(Function),
    });
    expect(result.toJSON()).toEqual({
      type: responseJson.type,
      sdp: responseJson.sdp,
    });
  });

  it('должен кидать ошибку, если сервер вернул не ok статус', async () => {
    expect.assertions(2);

    // @ts-expect-error: используем мок
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        return {};
      },
    });

    const params = {
      serverUrl: 'dev.vinteo.com',
      conferenceNumber: '1008',
      quality: 'medium' as const,
      audio: 0,
      offer: {
        type: 'offer' as RTCSdpType,
        sdp: 'test-sdp',
      },
      token,
    };

    await expect(sendOffer(params)).rejects.toThrow('sendOffer failed with status 500');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('должен добавлять заголовок Authorization', async () => {
    expect.assertions(2);

    const responseJson = {
      type: 'answer' as RTCSdpType,
      sdp: 'answer-sdp',
    };

    // @ts-expect-error: используем мок
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        return responseJson;
      },
    });

    await sendOffer({
      serverUrl: 'dev.vinteo.com',
      conferenceNumber: '1008',
      quality: 'medium',
      audio: 0,
      offer: {
        type: 'offer',
        sdp: 'test-sdp',
      },
      token,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;

    expect(calledOptions.headers).toBeDefined();

    const headers = calledOptions.headers as Record<string, string>;

    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });
});
