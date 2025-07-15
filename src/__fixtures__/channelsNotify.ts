import { CONTENT_TYPE_NOTIFY, HEADER_CONTENT_TYPE_NAME, HEADER_NOTIFY } from '../headers';

const channelsStringified = JSON.stringify({ cmd: 'channels', input: '0,1', output: '0' });
const channelsParsed = JSON.parse(channelsStringified) as { input: string; output: string };

export const channelsHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, channelsStringified],
];

export const channelsData = {
  inputChannels: channelsParsed.input,
  outputChannels: channelsParsed.output,
};
