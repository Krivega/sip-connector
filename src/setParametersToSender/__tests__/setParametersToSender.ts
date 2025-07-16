/* eslint-disable @typescript-eslint/unbound-method */
/// <reference types="jest" />
import setParametersToSender from '../setParametersToSender';

describe('setParametersToSender', () => {
  let mockSender: RTCRtpSender;

  beforeEach(() => {
    mockSender = {
      getParameters: jest.fn(),
      setParameters: jest.fn(),
    } as unknown as RTCRtpSender;
  });

  it('should set parameters correctly when there are changes', async () => {
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{ maxBitrate: 500_000 }],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };
    // @ts-expect-error
    const parametersTarget: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }],
    };

    (mockSender.getParameters as jest.Mock).mockReturnValue(parametersCurrent);

    const result = await setParametersToSender(mockSender, parametersTarget);

    expect(mockSender.getParameters).toHaveBeenCalled();
    expect(result.parameters.encodings).toEqual(parametersTarget.encodings);
    expect(mockSender.setParameters).toHaveBeenCalledWith(result.parameters);
    expect(result.isChanged).toBe(true);
  });

  it('should not set parameters when there are no changes', async () => {
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{ maxBitrate: 500_000 }],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };

    (mockSender.getParameters as jest.Mock).mockReturnValue(parametersCurrent);

    const result = await setParametersToSender(mockSender, parametersCurrent);

    expect(mockSender.getParameters).toHaveBeenCalled();
    expect(mockSender.setParameters).not.toHaveBeenCalled();
    expect(result.isChanged).toBe(false);
  });

  it("check error: ailed to execute 'setParameters' on 'RTCRtpSender': Read-only field modified in setParameters().", async () => {
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{ maxBitrate: 500_000 }],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };
    // @ts-expect-error
    const parametersTarget: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }],
    };

    (mockSender.getParameters as jest.Mock).mockReturnValue(parametersCurrent);

    const result = await setParametersToSender(mockSender, parametersTarget);

    const isSameParameters = parametersCurrent === result.parameters;

    expect(isSameParameters).toBe(true);
  });
});
