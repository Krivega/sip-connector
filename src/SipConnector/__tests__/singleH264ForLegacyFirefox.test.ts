import JsSIP from '@krivega/jssip';

import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import SipConnector from '../@SipConnector';

import type { OutgoingRequest, SDPEvent } from '@krivega/jssip';

const audio = ['m=audio 9 UDP/TLS/RTP/SAVPF 111', 'a=mid:0', 'a=rtpmap:111 opus/48000/2'];
const mainVideo = [
  'a=mid:1',
  'a=sendrecv',
  'a=rtpmap:99 H264/90000',
  'a=fmtp:99 profile-level-id=42e01f;packetization-mode=1',
  'a=rtpmap:101 rtx/90000',
  'a=fmtp:101 apt=99',
];
const presentation = [
  'a=mid:2',
  'a=bundle-only',
  'a=rtpmap:126 H264/90000',
  'a=fmtp:126 packetization-mode=1',
  'a=rtpmap:127 rtx/90000',
  'a=fmtp:127 apt=126',
];
const createOffer = (sharing: boolean): SDPEvent => {
  const sdp = [
    'v=0',
    sharing ? 'a=group:BUNDLE 0 1 2' : 'a=group:BUNDLE 0 1',
    ...audio,
    'm=video 9 UDP/TLS/RTP/SAVPF 99 101 98 100 120',
    ...mainVideo,
    'a=rtpmap:98 H264/90000',
    'a=fmtp:98 profile-level-id=42e01f',
    'a=rtpmap:100 rtx/90000',
    'a=fmtp:100 apt=98',
    'a=rtpmap:120 VP8/90000',
    ...(sharing
      ? ['m=video 0 UDP/TLS/RTP/SAVPF 120 126 127', ...presentation, 'a=rtpmap:120 VP8/90000']
      : []),
    '',
  ].join('\r\n');

  return { type: 'offer', originator: 'local', sdp };
};

const firefox = (version: string) => {
  return `Mozilla/5.0 (X11; Linux x86_64; rv:${version}) Gecko/20100101 Firefox/${version}`;
};

const createSession = (userAgent: string) => {
  const userAgentSpy = jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  let connector: SipConnector;

  try {
    connector = new SipConnector({ JsSIP });
  } finally {
    userAgentSpy.mockRestore();
  }

  const session = new RTCSessionMock({ originator: 'local', eventHandlers: {} });

  connector.connectionManager.events.trigger('newRTCSession', {
    originator: 'local',
    session,
    request: {} as OutgoingRequest,
  });

  return session;
};

describe('SipConnector', () => {
  it('должен предлагать один вариант H.264 и связанный RTX при звонке в Firefox 104', () => {
    const session = createSession(firefox('104.0.2'));
    const offer = createOffer(false);

    session.trigger('sdp', offer);

    expect(offer.sdp).toBe(
      [
        'v=0',
        'a=group:BUNDLE 0 1',
        ...audio,
        'm=video 9 UDP/TLS/RTP/SAVPF 99 101',
        ...mainVideo,
        '',
      ].join('\r\n'),
    );
  });

  it('должен ограничивать оба видеоканала при согласовании демонстрации в Firefox 137', () => {
    const session = createSession(firefox('137.0.2'));
    const offer = createOffer(true);

    session.trigger('sdp', offer);

    expect(offer.sdp).toBe(
      [
        'v=0',
        'a=group:BUNDLE 0 1 2',
        ...audio,
        'm=video 9 UDP/TLS/RTP/SAVPF 99 101',
        ...mainVideo,
        'm=video 0 UDP/TLS/RTP/SAVPF 126 127',
        ...presentation,
        '',
      ].join('\r\n'),
    );
  });

  it('должен сохранять исходящий SDP без H.264 с режимом упаковки 1', () => {
    const session = createSession(firefox('104.0'));
    const sdp = ['v=0', 'm=video 9 UDP/TLS/RTP/SAVPF 120', 'a=rtpmap:120 VP8/90000', ''].join('\n');
    const answer: SDPEvent = { type: 'answer', originator: 'local', sdp };

    session.trigger('sdp', answer);

    expect(answer.sdp).toBe(sdp);
  });

  it('должен оставлять один вариант H.264 с режимом упаковки 1 в исходящем ответе', () => {
    const session = createSession(firefox('104.0'));
    const answer: SDPEvent = { ...createOffer(false), type: 'answer' };

    session.trigger('sdp', answer);

    expect(answer.sdp).toContain('m=video 9 UDP/TLS/RTP/SAVPF 99 101\r\n');
  });

  it('должен сохранять входящий SDP сервера', () => {
    const session = createSession(firefox('104.0'));
    const { sdp } = createOffer(true);
    const offer: SDPEvent = { type: 'offer', originator: 'remote', sdp };

    session.trigger('sdp', offer);

    expect(offer.sdp).toBe(sdp);
  });

  it.each([
    ['Firefox 103', firefox('103.0.2')],
    ['Firefox 138', firefox('138.0')],
    ['Chrome', 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'],
  ] as const)('должен сохранять исходящие кодеки для %s', (_, userAgent) => {
    const session = createSession(userAgent);
    const offer = createOffer(false);
    const { sdp } = offer;

    session.trigger('sdp', offer);

    expect(offer.sdp).toBe(sdp);
  });
});
