/// <reference types="jest" />
import JsSIP from '@/__fixtures__/jssip.mock';
import SipConnector from '../@SipConnector';
import { VIDEO_BALANCER_OPTIONS } from '../constants';

import type { TJsSIP } from '@/types';
import type { IBalancerOptions } from '@/VideoSendingBalancer';

const VideoSendingBalancerManagerMock = jest.fn();

jest.mock('@/VideoSendingBalancerManager', () => {
  const VIDEO_SENDING_BALANCER_MANAGER_EVENT_NAMES: string[] = [];

  class VideoSendingBalancerManager {
    public readonly events = {
      eachTriggers: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public on() {}

    // eslint-disable-next-line @typescript-eslint/member-ordering
    public constructor(...args: unknown[]) {
      VideoSendingBalancerManagerMock(...args);
    }
  }

  return {
    __esModule: true,
    VideoSendingBalancerManager,
    VIDEO_SENDING_BALANCER_MANAGER_EVENT_NAMES,
  };
});

describe('SipConnector videoBalancerOptions defaults', () => {
  beforeEach(() => {
    VideoSendingBalancerManagerMock.mockClear();
  });

  it('должен использовать VIDEO_BALANCER_OPTIONS по умолчанию', () => {
    // Создаём коннектор без явных videoBalancerOptions
    // eslint-disable-next-line no-new
    new SipConnector({ JsSIP: JsSIP as unknown as TJsSIP });

    expect(VideoSendingBalancerManagerMock).toHaveBeenCalledTimes(1);

    const balancerOptions = (
      VideoSendingBalancerManagerMock.mock.calls[0] as [unknown, unknown, IBalancerOptions]
    )[2];

    expect(balancerOptions).toBe(VIDEO_BALANCER_OPTIONS);
  });

  it('должен использовать переданные videoBalancerOptions если они заданы', () => {
    const customOptions: IBalancerOptions = {
      ignoreForCodec: 'vp8',
    };

    // eslint-disable-next-line no-new
    new SipConnector(
      { JsSIP: JsSIP as unknown as TJsSIP },
      {
        videoBalancerOptions: customOptions,
      },
    );

    expect(VideoSendingBalancerManagerMock).toHaveBeenCalledTimes(1);

    const balancerOptions = (
      VideoSendingBalancerManagerMock.mock.calls[0] as [unknown, unknown, IBalancerOptions]
    )[2];

    expect(balancerOptions).toBe(customOptions);
  });
});
