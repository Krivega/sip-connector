import {
  HEADER_CONTENT_TYPE_NAME,
  CONTENT_TYPE_CHANNELS_NOTIFY,
  HEADER_CHANNELS_NOTIFY,
} from '../headers';

const channelsStringified = JSON.stringify({ cmd: 'channels', input: '0,1', output: '0' });
const channelsParsed = JSON.parse(channelsStringified);

export const channelsHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_CHANNELS_NOTIFY],
  [HEADER_CHANNELS_NOTIFY, channelsStringified],
];

export const channelsData = {
  inputChannels: channelsParsed.input,
  outputChannels: channelsParsed.output,
};
