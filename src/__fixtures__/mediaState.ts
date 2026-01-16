import { EKeyHeader } from '../ApiManager';

const cam = true;
const mic = true;

const headerMediaState = `${EKeyHeader.MEDIA_STATE}: currentstate`;
const headerCam = `${EKeyHeader.MAIN_CAM_STATE}: 1`;
const headerMic = `${EKeyHeader.MIC_STATE}: 1`;

export const mediaStateData = { cam, mic };

export const extraHeaders = {
  extraHeaders: [headerMediaState, headerCam, headerMic],
};
