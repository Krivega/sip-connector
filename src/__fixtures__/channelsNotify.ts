import { EContentTypeReceived, EKeyHeader } from '../ApiManager';

const channelsStringified = JSON.stringify({ cmd: 'channels', input: '0,1', output: '0' });
const channelsParsed = JSON.parse(channelsStringified) as { input: string; output: string };

export const channelsHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, channelsStringified],
];

export const channelsData = {
  inputChannels: channelsParsed.input,
  outputChannels: channelsParsed.output,
};
