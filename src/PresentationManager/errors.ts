/* eslint-disable max-classes-per-file */
export class PresentationReinviteError extends Error {
  public readonly cause: unknown;

  public constructor(cause: unknown) {
    super('Presentation renegotiation failed');
    this.name = 'PresentationReinviteError';
    this.cause = cause;
  }
}

export class PresentationTrackError extends Error {
  public readonly cause: unknown;

  public constructor(cause: unknown) {
    super('Failed to attach presentation track');
    this.name = 'PresentationTrackError';
    this.cause = cause;
  }
}
