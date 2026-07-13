/// <reference types="jest" />
import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { replaceMediaStreamInConnection } from '../replaceMediaStream';

describe('replaceMediaStreamInConnection', () => {
  let connection: RTCPeerConnectionMock;
  let renegotiate: jest.Mock<Promise<boolean>, []>;

  beforeEach(() => {
    connection = new RTCPeerConnectionMock();
    renegotiate = jest.fn(async () => {
      return true;
    });
  });

  it('заменяет треки у существующих senders', async () => {
    const oldAudioTrack = createAudioMediaStreamTrackMock();
    const oldVideoTrack = createVideoMediaStreamTrackMock();
    const newAudioTrack = createAudioMediaStreamTrackMock();
    const newVideoTrack = createVideoMediaStreamTrackMock();
    const oldStream = new MediaStream([oldAudioTrack, oldVideoTrack]);
    const newStream = new MediaStream([newAudioTrack, newVideoTrack]);

    connection.addTrack(oldAudioTrack, oldStream);
    connection.addTrack(oldVideoTrack, oldStream);

    const replaceTrackSpy = jest.spyOn(connection.getSenders()[0], 'replaceTrack');

    const result = await replaceMediaStreamInConnection({
      connection,
      stream: newStream,
      localMediaStream: oldStream,
      renegotiate,
      options: { deleteExisting: false },
    });

    expect(replaceTrackSpy).toHaveBeenCalledWith(newAudioTrack);
    expect(result).toBe(newStream);
    expect(renegotiate).not.toHaveBeenCalled();
  });

  it('не заменяет трек, если sender уже использует тот же track', async () => {
    const audioTrack = createAudioMediaStreamTrackMock();
    const stream = new MediaStream([audioTrack]);

    connection.addTrack(audioTrack, stream);

    const replaceTrackSpy = jest.spyOn(connection.getSenders()[0], 'replaceTrack');

    await replaceMediaStreamInConnection({
      connection,
      stream,
      renegotiate,
      options: { deleteExisting: false },
    });

    expect(replaceTrackSpy).not.toHaveBeenCalled();
    expect(renegotiate).not.toHaveBeenCalled();
  });

  it('добавляет отсутствующий трек и вызывает renegotiate', async () => {
    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const audioOnlyStream = new MediaStream([audioTrack]);
    const newStream = new MediaStream([audioTrack, videoTrack]);

    connection.addTrack(audioTrack, audioOnlyStream);

    const onAddedTransceiver = jest.fn(async () => {});

    await replaceMediaStreamInConnection({
      connection,
      stream: newStream,
      localMediaStream: audioOnlyStream,
      renegotiate,
      options: {
        deleteExisting: false,
        onAddedTransceiver,
      },
    });

    expect(connection.addTransceiver).toHaveBeenCalled();
    expect(onAddedTransceiver).toHaveBeenCalled();
    expect(renegotiate).toHaveBeenCalled();
  });

  it('не добавляет отсутствующий трек при addMissing=false', async () => {
    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const audioOnlyStream = new MediaStream([audioTrack]);
    const newStream = new MediaStream([audioTrack, videoTrack]);

    connection.addTrack(audioTrack, audioOnlyStream);

    await replaceMediaStreamInConnection({
      connection,
      stream: newStream,
      localMediaStream: audioOnlyStream,
      renegotiate,
      options: {
        addMissing: false,
        deleteExisting: false,
      },
    });

    expect(connection.addTransceiver).not.toHaveBeenCalled();
    expect(renegotiate).not.toHaveBeenCalled();
  });

  it('удаляет треки старого localMediaStream при deleteExisting=true', async () => {
    const oldAudioTrack = createAudioMediaStreamTrackMock();
    const oldVideoTrack = createVideoMediaStreamTrackMock();
    const newAudioTrack = createAudioMediaStreamTrackMock();
    const oldStream = new MediaStream([oldAudioTrack, oldVideoTrack]);
    const newStream = new MediaStream([newAudioTrack]);

    connection.addTrack(oldAudioTrack, oldStream);
    connection.addTrack(oldVideoTrack, oldStream);

    const removeTrackSpy = jest.spyOn(connection, 'removeTrack').mockImplementation(() => {});

    await replaceMediaStreamInConnection({
      connection,
      stream: newStream,
      localMediaStream: oldStream,
      renegotiate,
    });

    expect(removeTrackSpy).toHaveBeenCalled();
    expect(renegotiate).toHaveBeenCalled();
  });

  it('не удаляет треки, если localMediaStream не задан', async () => {
    const audioTrack = createAudioMediaStreamTrackMock();
    const newAudioTrack = createAudioMediaStreamTrackMock();
    const stream = new MediaStream([audioTrack]);
    const newStream = new MediaStream([newAudioTrack]);

    connection.addTrack(audioTrack, stream);

    const removeTrackSpy = jest.spyOn(connection, 'removeTrack').mockImplementation(() => {});

    await replaceMediaStreamInConnection({
      connection,
      stream: newStream,
      renegotiate,
      options: { deleteExisting: true },
    });

    expect(removeTrackSpy).not.toHaveBeenCalled();
    expect(renegotiate).not.toHaveBeenCalled();
  });

  it('вызывает renegotiate при forceRenegotiation=true', async () => {
    const audioTrack = createAudioMediaStreamTrackMock();
    const newAudioTrack = createAudioMediaStreamTrackMock();
    const oldStream = new MediaStream([audioTrack]);
    const newStream = new MediaStream([newAudioTrack]);

    connection.addTrack(audioTrack, oldStream);

    await replaceMediaStreamInConnection({
      connection,
      stream: newStream,
      localMediaStream: oldStream,
      renegotiate,
      options: {
        deleteExisting: false,
        forceRenegotiation: true,
      },
    });

    expect(renegotiate).toHaveBeenCalled();
  });

  it('использует directionAudio при добавлении отсутствующего audio трека', async () => {
    const videoTrack = createVideoMediaStreamTrackMock();
    const audioTrack = createAudioMediaStreamTrackMock();
    const videoOnlyStream = new MediaStream([videoTrack]);
    const newStream = new MediaStream([videoTrack, audioTrack]);

    connection.addTrack(videoTrack, videoOnlyStream);

    await replaceMediaStreamInConnection({
      connection,
      stream: newStream,
      localMediaStream: videoOnlyStream,
      renegotiate,
      options: {
        deleteExisting: false,
        directionAudio: 'sendonly',
      },
    });

    expect(connection.addTransceiver).toHaveBeenCalledWith(
      audioTrack,
      expect.objectContaining({
        direction: 'sendonly',
      }),
    );
  });
});
