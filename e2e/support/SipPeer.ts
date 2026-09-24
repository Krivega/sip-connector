import { randomUUID } from 'node:crypto';

import { expect } from '@playwright/test';

import type { JSHandle, Page, WebSocketRoute } from '@playwright/test';

export const SIP_PEER_HOST = 'sip-peer.invalid';
export const SIP_PEER_NUMBER = '700';

const PEER_ADDRESS = `"Test conference" <sip:${SIP_PEER_NUMBER}@${SIP_PEER_HOST}>`;
const PEER_CONTACT = `<sip:${SIP_PEER_NUMBER}@${SIP_PEER_HOST};transport=ws>`;

type TDialog = {
  uri: string;
  callId: string;
  from: string;
  to: string;
};

type TRequest = TDialog & {
  method: string;
  cseq: number;
  branch?: string;
  headers?: string[];
  body?: string;
};

const getHeader = (message: string, name: string): string => {
  const line = message.split('\r\n').find((header) => {
    return header.toLowerCase().startsWith(`${name.toLowerCase()}:`);
  });

  if (line === undefined) {
    throw new Error(`В SIP-сообщении отсутствует ${name}`);
  }

  return line.slice(line.indexOf(':') + 1).trim();
};

const getContactUri = (message: string): string => {
  const contact = getHeader(message, 'Contact');
  const uri = /<([^>]+)>/.exec(contact)?.[1];

  if (uri === undefined) {
    throw new Error(`Некорректный Contact: ${contact}`);
  }

  return uri;
};

const createRequest = ({
  method,
  uri,
  callId,
  from,
  to,
  cseq,
  branch = randomUUID(),
  headers = [],
  body = '',
}: TRequest): string => {
  return [
    `${method} ${uri} SIP/2.0`,
    `Via: SIP/2.0/WSS ${SIP_PEER_HOST};branch=z9hG4bK${branch}`,
    'Max-Forwards: 70',
    `From: ${from}`,
    `To: ${to}`,
    `Call-ID: ${callId}`,
    `CSeq: ${cseq} ${method}`,
    `Contact: ${PEER_CONTACT}`,
    ...headers,
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join('\r\n');
};

const createResponse = (request: string, headers: string[] = [], body = ''): string => {
  const to = getHeader(request, 'To');

  return [
    'SIP/2.0 200 OK',
    `Via: ${getHeader(request, 'Via')}`,
    `From: ${getHeader(request, 'From')}`,
    `To: ${to.includes(';tag=') ? to : `${to};tag=sip-peer`}`,
    `Call-ID: ${getHeader(request, 'Call-ID')}`,
    `CSeq: ${getHeader(request, 'CSeq')}`,
    ...headers,
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join('\r\n');
};

/**
 * Тестовый SIP-собеседник одного вызова. Подменяет сервер на границе WebSocket,
 * не вызывает события JsSIP/коннектора. SDP создаёт настоящий RTCPeerConnection.
 * Регистрация упрощена: без проверки пароля, авторизация здесь не тестируется.
 */
export class SipPeer {
  private readonly page: Page;

  private socket?: WebSocketRoute;

  private registration?: string;

  private dialog?: TDialog;

  private incomingInvite?: TRequest;

  private peerConnection?: JSHandle<RTCPeerConnection>;

  private incomingAnswer?: Promise<void>;

  private cseq = 1;

  private readonly receivedMessages: string[] = [];

  public constructor(page: Page) {
    this.page = page;
  }

  public async install(): Promise<void> {
    await this.page.route(`https://${SIP_PEER_HOST}/**`, async (route) => {
      if (new URL(route.request().url()).pathname === '/api/v1/address') {
        await route.fulfill({
          json: { ip: SIP_PEER_HOST, remoteAddress: '127.0.0.1', iceServers: [], unified: true },
        });
      } else {
        await route.abort();
      }
    });
    await this.page.routeWebSocket(`wss://${SIP_PEER_HOST}/webrtc/wss/`, (socket) => {
      this.socket = socket;
      socket.onMessage(async (message) => {
        await this.handleMessage(message.toString());
      });
    });
  }

  public async invite(): Promise<void> {
    if (this.registration === undefined) {
      throw new Error('Перед входящим вызовом клиент должен зарегистрироваться');
    }

    const body = await this.createDescription();

    this.dialog = {
      uri: getContactUri(this.registration),
      callId: randomUUID(),
      from: `${PEER_ADDRESS};tag=${randomUUID()}`,
      to: getHeader(this.registration, 'To'),
    };
    this.incomingInvite = {
      ...this.dialog,
      method: 'INVITE',
      cseq: this.cseq,
      branch: randomUUID(),
      headers: ['Content-Type: application/sdp'],
      body,
    };
    this.send(createRequest(this.incomingInvite));
  }

  public async waitForMediaConnected(): Promise<void> {
    await expect
      .poll(async () => {
        return this.peerConnection?.evaluate((peer) => {
          return peer.connectionState;
        });
      })
      .toBe('connected');
  }

  public enterRoom(): void {
    this.cseq += 1;

    this.send(
      createRequest({
        ...this.getDialog(),
        method: 'INFO',
        cseq: this.cseq,
        headers: [
          'Content-Type: application/vinteo.webrtc.roomname',
          `X-Webrtc-Enter-Room: ${SIP_PEER_NUMBER}`,
          'X-Webrtc-Participant-Name: Test participant',
        ],
        body: SIP_PEER_NUMBER,
      }),
    );
  }

  public async bye(raw?: string): Promise<void> {
    const dialog = this.getDialog();

    this.cseq += 1;

    const { cseq } = this;

    this.send(
      createRequest({
        ...dialog,
        method: 'BYE',
        cseq,
        headers: raw === undefined ? [] : [`X-VINTEO-DISCONNECT-CAUSE: ${raw}`],
      }),
    );
    await this.waitForResponse(dialog.callId, `${cseq} BYE`, 200);
  }

  public async cancel(raw: string): Promise<void> {
    const invite = this.incomingInvite;

    if (invite === undefined) {
      throw new Error('Нет входящего INVITE для отмены');
    }

    // CANCEL повторяет URI, Call-ID, From, To, номер CSeq и Via branch исходного INVITE.
    this.send(
      createRequest({
        ...invite,
        method: 'CANCEL',
        headers: [`X-VINTEO-DISCONNECT-CAUSE: ${raw}`],
        body: '',
      }),
    );
    await this.waitForResponse(invite.callId, `${invite.cseq} CANCEL`, 200);
    await this.waitForResponse(invite.callId, `${invite.cseq} INVITE`, 487);
  }

  public async dispose(): Promise<void> {
    await this.peerConnection?.evaluate((peer) => {
      peer.close();
    });
    await this.peerConnection?.dispose();
    await this.socket?.close();
  }

  private getDialog(): TDialog {
    if (this.dialog === undefined) {
      throw new Error('SIP-диалог ещё не создан');
    }

    return this.dialog;
  }

  private send(message: string): void {
    if (this.socket === undefined) {
      throw new Error('SIP WebSocket ещё не открыт');
    }

    this.socket.send(message);
  }

  private async waitForResponse(callId: string, cseq: string, status: number): Promise<void> {
    await expect
      .poll(() => {
        return this.receivedMessages.some((message) => {
          return (
            message.startsWith(`SIP/2.0 ${status} `) &&
            getHeader(message, 'Call-ID') === callId &&
            getHeader(message, 'CSeq') === cseq
          );
        });
      })
      .toBe(true);
  }

  private async handleMessage(message: string): Promise<void> {
    this.receivedMessages.push(message);

    if (message.startsWith('REGISTER ')) {
      this.registration = message;
      this.send(createResponse(message, [`Contact: ${getHeader(message, 'Contact')}`]));
    } else if (message.startsWith('INVITE ')) {
      const body = await this.createDescription(message.slice(message.indexOf('\r\n\r\n') + 4));
      const response = createResponse(
        message,
        [`Contact: ${PEER_CONTACT}`, 'Content-Type: application/sdp'],
        body,
      );

      this.dialog = {
        uri: getContactUri(message),
        callId: getHeader(message, 'Call-ID'),
        from: getHeader(response, 'To'),
        to: getHeader(message, 'From'),
      };
      this.send(response);
    } else if (
      message.startsWith('SIP/2.0 200 ') &&
      getHeader(message, 'CSeq').endsWith(' INVITE')
    ) {
      const { peerConnection, incomingInvite } = this;

      if (peerConnection === undefined || incomingInvite === undefined) {
        throw new Error('Ответ INVITE получен без исходного предложения');
      }

      // До получения ACK JsSIP может повторить 200 OK. SDP применяем один раз,
      // но подтверждаем каждый ответ, сохраняя CSeq исходного INVITE.
      this.incomingAnswer ??= peerConnection.evaluate(
        async (peer, sdp) => {
          await peer.setRemoteDescription({ type: 'answer', sdp });
        },
        message.slice(message.indexOf('\r\n\r\n') + 4),
      );
      await this.incomingAnswer;
      this.dialog = {
        ...this.getDialog(),
        to: getHeader(message, 'To'),
        uri: getContactUri(message),
      };
      this.send(createRequest({ ...this.dialog, method: 'ACK', cseq: incomingInvite.cseq }));
    } else if (message.startsWith('SIP/2.0 487 ') && this.incomingInvite !== undefined) {
      this.send(
        createRequest({
          ...this.incomingInvite,
          method: 'ACK',
          to: getHeader(message, 'To'),
          headers: [],
          body: '',
        }),
      );
    } else if (/^(?:OPTIONS|INFO|BYE) /.test(message)) {
      this.send(createResponse(message));
    }
  }

  private async createDescription(remoteOffer?: string): Promise<string> {
    this.peerConnection = await this.page.evaluateHandle(() => {
      return new RTCPeerConnection({ iceServers: [] });
    });

    return this.peerConnection.evaluate(async (peer, offer) => {
      if (offer === undefined) {
        peer.addTransceiver('audio', { direction: 'sendrecv' });
      } else {
        await peer.setRemoteDescription({ type: 'offer', sdp: offer });
      }

      const description =
        offer === undefined ? await peer.createOffer() : await peer.createAnswer();

      await peer.setLocalDescription(description);

      if (peer.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve) => {
          const handleGatheringStateChange = () => {
            if (peer.iceGatheringState === 'complete') {
              peer.removeEventListener('icegatheringstatechange', handleGatheringStateChange);
              resolve();
            }
          };

          peer.addEventListener('icegatheringstatechange', handleGatheringStateChange);
        });
      }

      const sdp = peer.localDescription?.sdp;

      if (sdp === undefined) {
        throw new Error('WebRTC не создал SDP');
      }

      return sdp;
    }, remoteOffer);
  }
}
