import { EHeader } from '../ApiManager';

const cam = true;
const mic = true;

const headerMediaState = `${EHeader.MEDIA_STATE}: currentstate`;
const headerCam = `${EHeader.MAIN_CAM_STATE}: 1`;
const headerMic = `${EHeader.MIC_STATE}: 1`;

export const mediaStateData = { cam, mic };

export const extraHeaders = {
  extraHeaders: [headerMediaState, headerCam, headerMic],
};
