import type { Page, WebSocket } from '@playwright/test';

export type TSipFrame = {
  /** Миллисекунды от создания журнала. */
  t: number;
  direction: 'sent' | 'received';
  firstLine: string;
  callId?: string;
  cseq?: string;
  headers: Partial<Record<string, string>>;
};

const parseSipFrame = (text: string) => {
  const [head] = text.split('\r\n\r\n');
  const [firstLine, ...lines] = head.split('\r\n');
  const headers: Partial<Record<string, string>> = {};

  lines.forEach((line) => {
    const index = line.indexOf(':');

    if (index > 0) {
      headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    }
  });

  return { firstLine, headers };
};

const isOptions = (frame: TSipFrame): boolean => {
  return frame.firstLine.startsWith('OPTIONS ') || (frame.cseq ?? '').endsWith(' OPTIONS');
};

/**
 * Журнал SIP-кадров на уровне сети (Playwright `framesent`/`framereceived`).
 *
 * Видит кадры, которые страница заглушила у себя, поэтому показывает и запросы сервера
 * к прежнему подключению. OPTIONS (пинги) не сохраняются.
 */
export const createSipFrameJournal = (page: Page, startedAt = Date.now()) => {
  const frames: TSipFrame[] = [];

  const push = (direction: TSipFrame['direction'], payload: string | Buffer) => {
    const text = typeof payload === 'string' ? payload : payload.toString('utf8');
    const { firstLine, headers } = parseSipFrame(text);
    const frame: TSipFrame = {
      t: Date.now() - startedAt,
      direction,
      firstLine,
      callId: headers['call-id'] ?? headers.i,
      cseq: headers.cseq,
      headers,
    };

    if (!isOptions(frame)) {
      frames.push(frame);
    }
  };

  page.on('websocket', (socket: WebSocket) => {
    socket.on('framesent', ({ payload }) => {
      push('sent', payload);
    });
    socket.on('framereceived', ({ payload }) => {
      push('received', payload);
    });
  });

  return {
    startedAt,
    now: () => {
      return Date.now() - startedAt;
    },
    frames: () => {
      return [...frames];
    },
    findSentInvite: (afterT: number): TSipFrame | undefined => {
      return frames.find((frame) => {
        return (
          frame.t >= afterT && frame.direction === 'sent' && frame.firstLine.startsWith('INVITE ')
        );
      });
    },
    byCallId: (callId: string | undefined): TSipFrame[] => {
      return frames.filter((frame) => {
        return callId !== undefined && frame.callId === callId;
      });
    },
  };
};

export type TSipFrameJournal = ReturnType<typeof createSipFrameJournal>;
