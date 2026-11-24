import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

const DEFAULT_HEIGHT = 480;

// Helper to create mock MediaStreamTrack based on webrtc-mock implementation
const createMockTrack = (initialWidth: number, initialHeight: number = DEFAULT_HEIGHT) => {
  let width = initialWidth;
  let height = initialHeight;

  // webrtc-mock возвращает полноценный объект с необходимыми методами
  const track = createVideoMediaStreamTrackMock({
    constraints: { width, height },
  });

  // Переопределяем getSettings, чтобы он отражал динамический размер кадра
  Object.defineProperty(track, 'getSettings', {
    value: jest.fn(() => {
      return { width, height };
    }),
  });

  const setWidth = (newWidth: number) => {
    width = newWidth;
  };

  // Меняет размер кадра без событий трека, как при смене размера захватываемого окна
  const setSize = (size: { width: number; height: number }) => {
    width = size.width;
    height = size.height;
  };

  return { track, setWidth, setSize };
};

export default createMockTrack;
