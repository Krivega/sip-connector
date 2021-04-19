import {
  HEADER_CONTENT_TYPE_NAME,
  CONTENT_TYPE_ENTER_ROOM,
  HEADER_INPUT_CHANNELS,
  HEADER_OUTPUT_CHANNELS,
} from '../headers';

const inputChannels = '100,1';
const outputChannels = '2,3';
const headerInputChannels = `${HEADER_INPUT_CHANNELS}: ${inputChannels}`;
const headerOutputChannels = `${HEADER_OUTPUT_CHANNELS}: ${outputChannels}`;

export const channelsHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_ENTER_ROOM],
  [HEADER_INPUT_CHANNELS, inputChannels],
  [HEADER_OUTPUT_CHANNELS, outputChannels],
];

export const channelsData = { inputChannels, outputChannels };

export const sendedExtraHeaders = {
  extraHeaders: [headerInputChannels, headerOutputChannels],
};
