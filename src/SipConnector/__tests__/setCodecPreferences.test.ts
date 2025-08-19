/* eslint-disable import/first */
// Мокаем хелпер до импорта SipConnector
jest.mock('@/tools/setCodecPreferences', () => {
  return jest.fn();
});

import JsSIP from '@/__fixtures__/jssip.mock';
import { doMockSipConnector } from '@/doMock';
import SipConnector from '../@SipConnector';

const setCodecPreferencesMock = jest.requireMock('@/tools/setCodecPreferences') as jest.Mock;

describe('SipConnector.setCodecPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls helper with provided codec preferences', () => {
    const preferred = ['video/H264', 'video/VP9'];
    const exclude = ['video/AV1'];

    const sipConnector = new SipConnector(
      { JsSIP: JsSIP as never },
      {
        preferredMimeTypesVideoCodecs: preferred,
        excludeMimeTypesVideoCodecs: exclude,
      },
    );

    const mockTransceiver = {} as RTCRtpTransceiver;

    // Вызываем приватный метод через приведение типов
    (
      sipConnector as unknown as {
        setCodecPreferences: (transceiver: RTCRtpTransceiver) => void;
      }
    ).setCodecPreferences(mockTransceiver);

    expect(setCodecPreferencesMock).toHaveBeenCalledWith(mockTransceiver, {
      preferredMimeTypesVideoCodecs: preferred,
      excludeMimeTypesVideoCodecs: exclude,
    });
  });

  it('calls helper with undefined preferences when options not passed', () => {
    const sipConnector = doMockSipConnector();

    const mockTransceiver = {} as RTCRtpTransceiver;

    (
      sipConnector as unknown as {
        setCodecPreferences: (transceiver: RTCRtpTransceiver) => void;
      }
    ).setCodecPreferences(mockTransceiver);

    expect(setCodecPreferencesMock).toHaveBeenCalledWith(mockTransceiver, {
      preferredMimeTypesVideoCodecs: undefined,
      excludeMimeTypesVideoCodecs: undefined,
    });
  });
});
