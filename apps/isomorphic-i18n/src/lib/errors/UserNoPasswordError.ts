export default class UserNoPasswordError extends Error {
  constructor() {
    super("No password is set for this user.");

    this.name = "UserNoPasswordError";

    Object.setPrototypeOf(this, UserNoPasswordError.prototype);
  }
}
