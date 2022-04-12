import { HEADER_MEDIA_STATE, HEADER_MAIN_CAM_STATE, HEADER_MIC_STATE } from '../headers';

const mainCam = '1' as const;
const mic = '1' as const;

const headerMediaState = `${HEADER_MEDIA_STATE}: currentstate`;
const headerMainCam = `${HEADER_MAIN_CAM_STATE}: ${mainCam}`;
const headerMic = `${HEADER_MIC_STATE}: ${mic}`;

export const mediaStateData = { mainCam, mic };

export const extraHeaders = {
  extraHeaders: [headerMediaState, headerMainCam, headerMic],
};
