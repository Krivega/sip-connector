import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY, HEADER_NOTIFY } from '../headers';

const webcastStarted = {
  cmd: 'WebcastStarted',
  body: { conference: '111', type: 'hls' },
};

export const webcastStartedHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(webcastStarted)],
];

export const webcastStartedData = {
  conference: webcastStarted.body.conference,
  type: webcastStarted.body.type,
};

const webcastStopped = {
  cmd: 'WebcastStopped',
  body: { conference: '222', type: 'hls' },
};

export const webcastStoppedHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(webcastStopped)],
];

export const webcastStoppedData = {
  conference: webcastStopped.body.conference,
  type: webcastStopped.body.type,
};
