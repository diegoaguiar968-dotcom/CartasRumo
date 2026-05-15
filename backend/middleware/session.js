function sessionMiddleware(req, _res, next) {
  req.sessionId = req.headers['x-session-id'] || 'anonymous';
  next();
}

module.exports = { sessionMiddleware };
