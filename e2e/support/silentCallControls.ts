import type { TSipConnectorDemoE2ESilentCallHooks } from '../types';

/** Ключ `window`, куда кладётся управление «молчащим» звонком. */
export const SIP_CONNECTOR_DEMO_E2E_SILENT_CALL_GLOBAL_KEY =
  'sipConnectorDemoE2ESilentCall' as const;

/**
 * Init script: оборачивает WebSocket и глушит SIP-кадры выбранных Call-ID в обе стороны.
 *
 * Так клиент перестаёт отвечать старому диалогу (без 481), как при пропавшей сети,
 * и сервер продолжает держать прежнее подключение. Регистрировать после
 * `installE2EWebSocketControls`, чтобы оборачивать уже обёрнутый WebSocket.
 */
export const installE2ESilentCallControls = () => {
  // context.addInitScript сериализует только тело функции: ключ должен совпадать
  // с SIP_CONNECTOR_DEMO_E2E_SILENT_CALL_GLOBAL_KEY.
  const globalKey = 'sipConnectorDemoE2ESilentCall';
  const silencedCallIds = new Set<string>();
  const droppedFrames: ReturnType<TSipConnectorDemoE2ESilentCallHooks['getDroppedFrames']> = [];
  const PreviousWebSocket = window.WebSocket;

  const readCallId = (data: unknown): string | undefined => {
    return typeof data === 'string' ? /^(?:call-id|i)\s*:\s*(\S+)/im.exec(data)?.[1] : undefined;
  };

  const isSilenced = (data: unknown): boolean => {
    const callId = readCallId(data);

    return callId !== undefined && silencedCallIds.has(callId);
  };

  const readFirstLine = (data: unknown): string => {
    return String(data).split('\r\n')[0];
  };

  const SilentCallWebSocket = function silentCallWebSocket(
    url: string | URL,
    protocols?: string | string[],
  ): WebSocket {
    const socket =
      protocols === undefined ? new PreviousWebSocket(url) : new PreviousWebSocket(url, protocols);
    const previousSend = socket.send.bind(socket);

    socket.send = ((data: Parameters<WebSocket['send']>[0]) => {
      if (isSilenced(data)) {
        droppedFrames.push({ direction: 'sent', firstLine: readFirstLine(data) });

        return;
      }

      previousSend(data);
    }) as WebSocket['send'];

    socket.addEventListener(
      'message',
      (event: MessageEvent) => {
        if (isSilenced(event.data)) {
          droppedFrames.push({ direction: 'received', firstLine: readFirstLine(event.data) });
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );

    return socket;
  } as unknown as typeof WebSocket;

  SilentCallWebSocket.prototype = PreviousWebSocket.prototype;
  Object.assign(SilentCallWebSocket, PreviousWebSocket);
  window.WebSocket = SilentCallWebSocket;

  const hooks: TSipConnectorDemoE2ESilentCallHooks = {
    silenceCall: (callId: string) => {
      silencedCallIds.add(callId);
    },
    getDroppedFrames: () => {
      return [...droppedFrames];
    },
  };

  Reflect.set(window, globalKey, hooks);
};
