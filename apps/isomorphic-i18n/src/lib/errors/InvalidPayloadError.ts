export default class InvalidPayloadError extends Error {
  constructor() {
    super('Invalid username or password.');

    this.name = 'InvalidPayloadError';

    Object.setPrototypeOf(this, InvalidPayloadError.prototype);
  }
}