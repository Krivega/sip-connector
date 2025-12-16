const getMediaStream = async () => {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
};

export default getMediaStream;
