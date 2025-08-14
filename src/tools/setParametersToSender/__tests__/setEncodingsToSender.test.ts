/// <reference types="jest" />
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import setEncodingsToSender from '../setEncodingsToSender';

describe('setEncodingsToSender', () => {
  let sender: RTCRtpSender;

  beforeEach(() => {
    sender = new RTCRtpSenderMock();
  });

  it('without targets', async () => {
    expect.assertions(2);

    return setEncodingsToSender(sender, {}).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(false);
      expect(parameters.encodings).toEqual([{}]);
    });
  });

  it('by scaleResolutionDownBy=2', async () => {
    expect.assertions(2);

    const scaleResolutionDownBy = 2;

    return setEncodingsToSender(sender, { scaleResolutionDownBy }).then(
      ({ parameters, isChanged }) => {
        expect(isChanged).toBe(true);
        expect(parameters.encodings).toEqual([{ scaleResolutionDownBy }]);
      },
    );
  });

  it('by scaleResolutionDownBy=2 repeat', async () => {
    expect.assertions(2);

    const scaleResolutionDownBy = 2;

    await setEncodingsToSender(sender, { scaleResolutionDownBy });

    return setEncodingsToSender(sender, { scaleResolutionDownBy }).then(
      ({ parameters, isChanged }) => {
        expect(isChanged).toBe(false);
        expect(parameters.encodings).toEqual([{ scaleResolutionDownBy }]);
      },
    );
  });

  it('reset scaleResolutionDownBy to 1', async () => {
    expect.assertions(2);

    const scaleResolutionDownBy = 1;

    await setEncodingsToSender(sender, { scaleResolutionDownBy: 2 });

    return setEncodingsToSender(sender, { scaleResolutionDownBy }).then(
      ({ parameters, isChanged }) => {
        expect(isChanged).toBe(true);
        expect(parameters.encodings).toEqual([{ scaleResolutionDownBy }]);
      },
    );
  });

  it('reset scaleResolutionDownBy to 2 after 1', async () => {
    expect.assertions(2);

    const scaleResolutionDownBy = 2;

    await setEncodingsToSender(sender, { scaleResolutionDownBy: 1 });

    return setEncodingsToSender(sender, { scaleResolutionDownBy }).then(
      ({ parameters, isChanged }) => {
        expect(isChanged).toBe(true);
        expect(parameters.encodings).toEqual([{ scaleResolutionDownBy }]);
      },
    );
  });

  it('by scaleResolutionDownBy less then 1', async () => {
    expect.assertions(2);

    const scaleResolutionDownBy = 0.5;

    return setEncodingsToSender(sender, { scaleResolutionDownBy }).then(
      ({ parameters, isChanged }) => {
        expect(isChanged).toBe(false);
        expect(parameters.encodings).toEqual([{}]);
      },
    );
  });

  it('by scaleResolutionDownBy less then 1 after 2', async () => {
    expect.assertions(2);

    const scaleResolutionDownBy = 0.5;

    await setEncodingsToSender(sender, { scaleResolutionDownBy: 2 });

    return setEncodingsToSender(sender, { scaleResolutionDownBy }).then(
      ({ parameters, isChanged }) => {
        expect(isChanged).toBe(true);
        expect(parameters.encodings).toEqual([{ scaleResolutionDownBy: 1 }]);
      },
    );
  });
});
