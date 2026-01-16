import { EContentTypeReceived, EKeyHeader } from '../ApiManager';

const inputChannels = '100,1';
const outputChannels = '2,3';
const headerInputChannels = `${EKeyHeader.INPUT_CHANNELS}: ${inputChannels}`;
const headerOutputChannels = `${EKeyHeader.OUTPUT_CHANNELS}: ${outputChannels}`;

export const channelsHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM],
  [EKeyHeader.INPUT_CHANNELS, inputChannels],
  [EKeyHeader.OUTPUT_CHANNELS, outputChannels],
];

export const channelsData = { inputChannels, outputChannels };

export const sendedExtraHeaders = {
  extraHeaders: [headerInputChannels, headerOutputChannels],
};
