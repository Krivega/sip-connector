import type { Page, WebSocketRoute } from '@playwright/test';

type TDirection = 'toServer' | 'toClient';

export type TSipMessage = {
  direction: TDirection;
  /** Метод запроса или метод из CSeq для ответа. */
  method: string;
  /** Код ответа; у запроса отсутствует. */
  status?: number;
  /** Сообщение не переслано: соединение заморожено. */
  isDropped: boolean;
  atMs: number;
};

type TConnection = {
  index: number;
  isFrozen: boolean;
  isClosedByProxy: boolean;
  openedAtMs: number;
  messages: TSipMessage[];
  client: WebSocketRoute;
  server: WebSocketRoute;
};

const SIP_WEB_SOCKET_URL = /\/webrtc\/wss\/?$/;

const parseSipMessage = (raw: string): Pick<TSipMessage, 'method' | 'status'> | undefined => {
  const startLine = raw.split('\r\n', 1)[0]?.trim() ?? '';

  // Пустые строки — keep-alive CRLF, это не SIP-сообщение.
  if (startLine === '') {
    return undefined;
  }

  const status = /^SIP\/2\.0 (\d{3})/.exec(startLine)?.[1];

  return status === undefined
    ? { method: startLine.split(' ', 1)[0] ?? '' }
    : { method: /^CSeq:\s*\d+\s+(\S+)/im.exec(raw)?.[1] ?? '', status: Number(status) };
};

/**
 * Прозрачный прокси SIP over WebSocket между демо и настоящим сервером.
 * Ведёт учёт сообщений по каждому соединению и умеет имитировать полуоткрытое
 * или закрытое соединение, не меняя код клиента.
 */
export class SipWebSocketProxy {
  private readonly page: Page;

  private readonly connections: TConnection[] = [];

  private readonly startedAt = Date.now();

  private isAcceptingConnections = true;

  private rejectedConnectionsCount = 0;

  public constructor(page: Page) {
    this.page = page;
  }

  public async install(): Promise<void> {
    await this.page.routeWebSocket(SIP_WEB_SOCKET_URL, async (client) => {
      if (!this.isAcceptingConnections) {
        this.rejectedConnectionsCount += 1;
        await client.close({ code: 1011, reason: 'e2e proxy: server unavailable' });

        return;
      }

      const server = client.connectToServer();
      const connection: TConnection = {
        index: this.connections.length,
        isFrozen: false,
        isClosedByProxy: false,
        openedAtMs: this.getElapsedMs(),
        messages: [],
        client,
        server,
      };

      this.connections.push(connection);

      client.onMessage((message) => {
        this.forward(connection, { direction: 'toServer', message, target: server });
      });
      server.onMessage((message) => {
        this.forward(connection, { direction: 'toClient', message, target: client });
      });
    });
  }

  /** Текущее соединение перестаёт пересылать сообщения в обе стороны, сокет остаётся открытым. */
  public freezeLatestConnection(): number {
    const connection = this.getLatestConnection();

    connection.isFrozen = true;

    return connection.index;
  }

  /** Закрывает текущее соединение и сразу закрывает все новые подключения клиента. */
  public async closeLatestConnectionAndReject(): Promise<void> {
    this.isAcceptingConnections = false;

    const connection = this.getLatestConnection();

    connection.isClosedByProxy = true;
    await connection.client.close({ code: 1011, reason: 'e2e proxy: connection lost' });
    await connection.server.close();
  }

  public acceptConnections(): void {
    this.isAcceptingConnections = true;
  }

  public getConnectionsCount(): number {
    return this.connections.length;
  }

  /** Последнее соединение пересылает сообщения и клиент зарегистрирован по нему. */
  public isLatestConnectionRegistered(): boolean {
    const connection = this.connections.at(-1);

    return (
      connection !== undefined &&
      !connection.isFrozen &&
      !connection.isClosedByProxy &&
      this.getServerResponses(connection.index, 'REGISTER').includes(200)
    );
  }

  public getRejectedConnectionsCount(): number {
    return this.rejectedConnectionsCount;
  }

  public getMessages(index: number): TSipMessage[] {
    return [...(this.connections[index]?.messages ?? [])];
  }

  public countRequests(index: number, direction: TDirection, method: string): number {
    return this.getMessages(index).filter((message) => {
      return (
        message.direction === direction && message.status === undefined && message.method === method
      );
    }).length;
  }

  /** Коды ответов сервера на запросы клиента указанного метода по соединению. */
  public getServerResponses(index: number, method: string): number[] {
    return this.getMessages(index)
      .filter((message) => {
        return (
          message.direction === 'toClient' &&
          message.status !== undefined &&
          message.method === method
        );
      })
      .map(({ status = 0 }) => {
        return status;
      });
  }

  /** Запросы сервера к клиенту по всем соединениям, включая не пересланные. */
  public countServerRequestsEverywhere(method: string): number {
    return this.connections.reduce((total, { index }) => {
      return total + this.countRequests(index, 'toClient', method);
    }, 0);
  }

  public getElapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  /** Краткая сводка соединений для отчёта: `>` к серверу, `<` к клиенту, `x` не переслано. */
  public describe(): string {
    const lines = this.connections.map((connection) => {
      const flow = connection.messages
        .map(({ direction, method, status, isDropped }) => {
          const arrow = direction === 'toServer' ? '>' : '<';
          const mark = isDropped ? 'x' : '';

          return `${mark}${arrow}${status === undefined ? method : `${status} ${method}`}`;
        })
        .join(', ');

      return `#${connection.index} opened@${connection.openedAtMs}ms frozen=${String(connection.isFrozen)}: ${flow}`;
    });

    return [...lines, `rejected=${this.rejectedConnectionsCount}`].join('\n');
  }

  private forward(
    connection: TConnection,
    {
      direction,
      message,
      target,
    }: { direction: TDirection; message: string | Buffer; target: WebSocketRoute },
  ): void {
    const parsed = parseSipMessage(message.toString());

    if (parsed !== undefined) {
      connection.messages.push({
        ...parsed,
        direction,
        isDropped: connection.isFrozen,
        atMs: this.getElapsedMs(),
      });
    }

    if (!connection.isFrozen) {
      target.send(message);
    }
  }

  private getLatestConnection(): TConnection {
    const connection = this.connections.at(-1);

    if (connection === undefined) {
      throw new Error('SIP WebSocket ещё не открыт');
    }

    return connection;
  }
}
