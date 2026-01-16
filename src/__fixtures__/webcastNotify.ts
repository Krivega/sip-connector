import { EContentTypeReceived, EKeyHeader } from '../ApiManager';

const webcastStarted = {
  cmd: 'WebcastStarted',
  body: { conference: '111', type: 'hls' },
};

export const webcastStartedHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, JSON.stringify(webcastStarted)],
];

export const webcastStartedData = {
  conference: webcastStarted.body.conference,
  type: webcastStarted.body.type,
};

const webcastStopped = {
  cmd: 'WebcastStopped',
  body: { conference: '222', type: 'hls' },
};

export const webcastStoppedHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, JSON.stringify(webcastStopped)],
];

export const webcastStoppedData = {
  conference: webcastStopped.body.conference,
  type: webcastStopped.body.type,
};
