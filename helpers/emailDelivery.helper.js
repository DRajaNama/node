const normalizeAddress = (value) => String(
  typeof value === 'object' && value !== null ? value.address || '' : value || ''
).trim().toLowerCase();

const isRecipientAccepted = (result, recipientEmail) => {
  // SMTP transports normally return `accepted`. Some compatible transports
  // only resolve/reject the send promise, so a resolved result without that
  // field is treated as accepted.
  if (!Array.isArray(result?.accepted)) return true;
  const recipient = normalizeAddress(recipientEmail);
  return result.accepted.some((accepted) => normalizeAddress(accepted) === recipient);
};

module.exports = { isRecipientAccepted };
