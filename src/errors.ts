export type TakeSixErrorCode =
  | 'not-found'
  | 'too-many-blocks'
  | 'duplicate-id'
  | 'invalid-move'
  | 'invalid-link'

/** Thrown by the editing helpers when an operation would break the document. */
export class TakeSixError extends Error {
  readonly code: TakeSixErrorCode

  constructor(code: TakeSixErrorCode, message: string) {
    super(message)
    this.name = 'TakeSixError'
    this.code = code
  }
}
