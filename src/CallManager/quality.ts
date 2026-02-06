export type TRecvQuality = 'low' | 'medium' | 'high' | 'auto';
export type TEffectiveQuality = Exclude<TRecvQuality, 'auto'>;

export const resolveRecvQuality = (quality: TRecvQuality): TEffectiveQuality => {
  return quality === 'auto' ? 'high' : quality;
};
