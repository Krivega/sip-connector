/// <reference types="jest" />
/* eslint-disable jest/expect-expect */
/* eslint-disable import/first */
// Мокаем хелпер setCodecPreferences до импорта SipConnector
jest.mock('@/tools/setCodecPreferences', () => {
  return jest.fn();
});

import JsSIP from '@/__fixtures__/jssip.mock';
import SipConnector from '../@SipConnector';

const setCodecPreferencesMock = jest.requireMock('@/tools/setCodecPreferences') as jest.Mock;

describe('SipConnector onAddedTransceiver wrappers', () => {
  const createMocks = () => {
    const sipConnector = new SipConnector({ JsSIP: JsSIP as never });

    // Избегаем ошибки "UA not initialized"
    Object.defineProperty(sipConnector.connectionManager, 'ua', {
      value: {},
      writable: true,
      configurable: true,
    });

    jest.spyOn(sipConnector.connectionManager, 'getUaProtected').mockImplementation(() => {
      return {} as never;
    });

    const transceiver = {} as unknown as RTCRtpTransceiver;
    const track = {} as unknown as MediaStreamTrack;

    return { sipConnector, transceiver, track };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const expectCalls = (onAddedMock: jest.Mock) => {
    expect(setCodecPreferencesMock).toHaveBeenCalledTimes(1);
    expect(onAddedMock).toHaveBeenCalledTimes(1);
  };

  it('wraps onAddedTransceiver in call()', async () => {
    const { sipConnector, transceiver, track } = createMocks();

    const calls: string[] = [];

    setCodecPreferencesMock.mockImplementation(() => {
      calls.push('codec');
    });

    const onAddedMock = jest.fn(async () => {
      calls.push('original');
    });

    jest
      .spyOn(sipConnector.callManager, 'startCall')
      .mockImplementation(async (_ua, _getUrl, params) => {
        await params.onAddedTransceiver?.(transceiver, track);

        return {} as unknown as RTCPeerConnection;
      });

    await sipConnector.call({
      number: '100',
      mediaStream: new MediaStream(),
      onAddedTransceiver: onAddedMock,
    });

    expectCalls(onAddedMock);
  });

  it('wraps onAddedTransceiver in answerToIncomingCall()', async () => {
    const { sipConnector, transceiver, track } = createMocks();

    const calls: string[] = [];

    setCodecPreferencesMock.mockImplementation(() => {
      calls.push('codec');
    });

    const onAddedMock = jest.fn(async () => {
      calls.push('original');
    });

    jest
      .spyOn(sipConnector.callManager, 'answerToIncomingCall')
      .mockImplementation(async (_extractRtc, params) => {
        await params.onAddedTransceiver?.(transceiver, track);

        return {} as unknown as RTCPeerConnection;
      });

    await sipConnector.answerToIncomingCall({
      mediaStream: new MediaStream(),
      onAddedTransceiver: onAddedMock,
    });

    expectCalls(onAddedMock);
  });

  it('wraps onAddedTransceiver in startPresentation()', async () => {
    const { sipConnector, transceiver, track } = createMocks();

    const calls: string[] = [];

    setCodecPreferencesMock.mockImplementation(() => {
      calls.push('codec');
    });

    const onAddedMock = jest.fn(async () => {
      calls.push('original');
    });

    jest

      .spyOn(sipConnector.presentationManager, 'startPresentation')
      .mockImplementation(async (_before, videoTrack: MediaStreamVideoTrack, options) => {
        await options?.onAddedTransceiver?.(transceiver, track);

        return videoTrack;
      });

    await sipConnector.startPresentation(track as MediaStreamVideoTrack, {
      onAddedTransceiver: onAddedMock,
    });

    expectCalls(onAddedMock);
  });

  it('wraps onAddedTransceiver in updatePresentation()', async () => {
    const { sipConnector, transceiver, track } = createMocks();

    const calls: string[] = [];

    setCodecPreferencesMock.mockImplementation(() => {
      calls.push('codec');
    });

    const onAddedMock = jest.fn(async () => {
      calls.push('original');
    });

    jest

      .spyOn(sipConnector.presentationManager, 'updatePresentation')
      .mockImplementation(async (_before, videoTrack: MediaStreamVideoTrack, options) => {
        await options?.onAddedTransceiver?.(transceiver, track);

        return videoTrack;
      });

    await sipConnector.updatePresentation(track as MediaStreamVideoTrack, {
      onAddedTransceiver: onAddedMock,
    });

    expectCalls(onAddedMock);
  });
});
