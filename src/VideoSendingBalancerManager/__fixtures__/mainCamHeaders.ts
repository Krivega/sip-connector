import { EContentMainCAM, EContentTypeReceived, EKeyHeader } from '@/ApiManager';

export const mainCamHeaders = (
  mainCam: EContentMainCAM,
  resolutionMainCam?: string,
): [string, string][] => {
  const headers: [string, string][] = [
    [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
    [EKeyHeader.MAIN_CAM, mainCam],
  ];

  if (resolutionMainCam !== undefined) {
    headers.push([EKeyHeader.MAIN_CAM_RESOLUTION, resolutionMainCam]);
  }

  return headers;
};

export const HEADERS_MAX_360P = mainCamHeaders(EContentMainCAM.MAX_MAIN_CAM_RESOLUTION, '640x360');
export const HEADERS_MAX_720P = mainCamHeaders(EContentMainCAM.MAX_MAIN_CAM_RESOLUTION, '1280x720');
export const HEADERS_PAUSE = mainCamHeaders(EContentMainCAM.PAUSE_MAIN_CAM);
export const HEADERS_RESUME = mainCamHeaders(EContentMainCAM.RESUME_MAIN_CAM);
