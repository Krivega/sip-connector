import { HEADER_MEDIA_STATE, HEADER_MAIN_CAM_STATE, HEADER_MIC_STATE } from '../headers';

const cam = true;
const mic = true;

const headerMediaState = `${HEADER_MEDIA_STATE}: currentstate`;
const headerCam = `${HEADER_MAIN_CAM_STATE}: 1`;
const headerMic = `${HEADER_MIC_STATE}: 1`;

export const mediaStateData = { cam, mic };

export const extraHeaders = {
  extraHeaders: [headerMediaState, headerCam, headerMic],
};
