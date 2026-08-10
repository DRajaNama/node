class QuotaExceededError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'QuotaExceededError';
    this.code = 'QUOTA_EXCEEDED';
    this.details = details;
  }
}

module.exports = QuotaExceededError;
