import { IncomingRequest } from '@krivega/jssip';

type TCreateDisconnectRequestParams = {
  method?: string;
  raw?: string;
  headerName?: string;
};

// Проверяем настоящий SIP-парсер установленного JsSIP, не подменяя getHeader.
const { parseMessage } = jest.requireActual<{
  parseMessage: (data: string) => IncomingRequest | undefined;
}>('@krivega/jssip/lib/Parser');

const createDisconnectRequest = ({
  method = 'BYE',
  raw,
  headerName = 'X-VINTEO-DISCONNECT-CAUSE',
}: TCreateDisconnectRequestParams = {}): IncomingRequest => {
  const request = parseMessage(
    [
      `${method} sip:client@example.com SIP/2.0`,
      'Via: SIP/2.0/WSS example.com;branch=z9hG4bK-disconnect',
      'From: <sip:server@example.com>;tag=remote',
      'To: <sip:client@example.com>;tag=local',
      'Call-ID: disconnect-test@example.com',
      `CSeq: 2 ${method}`,
      'Max-Forwards: 70',
      ...(raw === undefined ? [] : [`${headerName}: ${raw}`]),
      'Content-Length: 0',
      '',
      '',
    ].join('\r\n'),
  );

  if (!(request instanceof IncomingRequest)) {
    throw new TypeError('Не удалось разобрать тестовый SIP-запрос');
  }

  return request;
};

export default createDisconnectRequest;
