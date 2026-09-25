export default class UserInactiveError extends Error {
  constructor() {
    super("User account is inactive.");

    this.name = 'UserInactiveError';

    Object.setPrototypeOf(this, UserInactiveError.prototype);
  }
}