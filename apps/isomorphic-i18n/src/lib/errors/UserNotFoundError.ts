export default class UserNotFoundError extends Error {
  constructor() {
    super("User doesn't exist.");

    this.name = 'UserNotFoundError';

    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}