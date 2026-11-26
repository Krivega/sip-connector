import createVideoTrack from '@/VideoSendingBalancer/__fixtures__/createVideoTrack';
import createObservedSender from '../createObservedSender';

import type { TObservedSender } from '../createObservedSender';

// так параметры пишет вызывающий код: getParameters, изменение encodings и setParameters
const callSetScale = async (observed: TObservedSender, scaleResolutionDownBy: number) => {
  const parameters = observed.sender.getParameters();

  parameters.encodings = [{ ...parameters.encodings[0], scaleResolutionDownBy }];

  return observed.sender.setParameters(parameters);
};

const getScale = (observed: TObservedSender) => {
  return observed.sender.getParameters().encodings[0].scaleResolutionDownBy;
};

describe('createObservedSender: setParameters как в спецификации W3C', () => {
  let observed: TObservedSender;

  beforeEach(() => {
    observed = createObservedSender(createVideoTrack(1280, 720));
  });

  it('применяет отложенную запись после её отпускания, даже если после вызова setParameters был вызван getParameters', async () => {
    const write = observed.deferNextSetParameters();
    const writing = callSetScale(observed, 3);

    observed.sender.getParameters();
    write.resolve(undefined);
    await writing;

    expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(3);
    expect(getScale(observed)).toBe(3);
  });

  it('отдаёт прежние параметры из getParameters, пока отложенная запись не применена', async () => {
    await callSetScale(observed, 2);

    const write = observed.deferNextSetParameters();
    const writing = callSetScale(observed, 3);

    expect(getScale(observed)).toBe(2);
    expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(2);

    write.resolve(undefined);
    await writing;

    expect(getScale(observed)).toBe(3);
  });

  it('применяет записи в порядке вызовов: запись, вызванная во время отложенной, применяется после неё', async () => {
    const write = observed.deferNextSetParameters();
    const firstWriting = callSetScale(observed, 3);
    const secondWriting = callSetScale(observed, 6);

    expect(observed.log).toEqual([]);

    write.resolve(undefined);
    await Promise.all([firstWriting, secondWriting]);

    expect(observed.log).toEqual([
      { type: 'setParameters', scaleResolutionDownBy: 3 },
      { type: 'setParameters', scaleResolutionDownBy: 6 },
    ]);
    expect(getScale(observed)).toBe(6);
  });

  it('применяет следующую запись, если отложенная запись перед ней отклонена', async () => {
    const error = new Error('setParameters failed');

    observed.rejectNextSetParameters(error);

    const write = observed.deferNextSetParameters();
    const rejectedWriting = callSetScale(observed, 3);
    const deferredWriting = callSetScale(observed, 4);
    const nextWriting = callSetScale(observed, 6);

    write.resolve(undefined);

    expect(await Promise.allSettled([rejectedWriting, deferredWriting, nextWriting])).toEqual([
      { status: 'rejected', reason: error },
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ]);
    expect(observed.log).toEqual([
      { type: 'setParameters', scaleResolutionDownBy: 4 },
      { type: 'setParameters', scaleResolutionDownBy: 6 },
    ]);
  });

  it('отклоняет при вызове запись с параметрами не из последнего getParameters и не применяет её', async () => {
    await callSetScale(observed, 2);

    const parameters = observed.sender.getParameters();

    observed.sender.getParameters();
    parameters.encodings = [{ ...parameters.encodings[0], scaleResolutionDownBy: 3 }];

    await expect(observed.sender.setParameters(parameters)).rejects.toThrow(
      'Read-only field modified',
    );
    expect(observed.log).toEqual([{ type: 'setParameters', scaleResolutionDownBy: 2 }]);
    expect(getScale(observed)).toBe(2);
  });

  it('откладывает по условию только подходящую запись, а записи перед ней применяет сразу', async () => {
    const write = observed.deferNextSetParameters((encoding) => {
      return encoding.scaleResolutionDownBy === 3;
    });

    await callSetScale(observed, 2);

    const writing = callSetScale(observed, 3);

    expect(observed.log).toEqual([{ type: 'setParameters', scaleResolutionDownBy: 2 }]);

    write.resolve(undefined);
    await writing;

    expect(observed.log).toEqual([
      { type: 'setParameters', scaleResolutionDownBy: 2 },
      { type: 'setParameters', scaleResolutionDownBy: 3 },
    ]);
  });
});
