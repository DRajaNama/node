function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { authHeader };
