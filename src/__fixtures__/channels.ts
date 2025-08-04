import { EContentTypeReceived, EHeader } from '../ApiManager';

const inputChannels = '100,1';
const outputChannels = '2,3';
const headerInputChannels = `${EHeader.INPUT_CHANNELS}: ${inputChannels}`;
const headerOutputChannels = `${EHeader.OUTPUT_CHANNELS}: ${outputChannels}`;

export const channelsHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM],
  [EHeader.INPUT_CHANNELS, inputChannels],
  [EHeader.OUTPUT_CHANNELS, outputChannels],
];

export const channelsData = { inputChannels, outputChannels };

export const sendedExtraHeaders = {
  extraHeaders: [headerInputChannels, headerOutputChannels],
};
