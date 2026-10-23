/** An error whose message is safe to show the user, with the HTTP status to send. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
