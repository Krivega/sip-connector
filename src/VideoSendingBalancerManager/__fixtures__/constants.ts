export const BALANCING_START_DELAY = 10_000;
export const CODEC = 'video/h264';
export const DEFAULT_SCALE_RESOLUTION_DOWN_BY = 1;

// начальный интервал опроса размера трека
export const POLL_INTERVAL = 1000;

// не дольше этого балансировка ждёт ответа на запрос статистики
export const STATS_TIMEOUT = 1000;

// дольше максимального интервала опроса размера трека (16 с)
export const TRACK_SIZE_POLLING_WINDOW = 20_000;
