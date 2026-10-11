const { verifyToken } = require('../config/jwt');
const authenticate = (req, res, next) => {
  const decoded = verifyToken(req.cookies.token || req.headers.authorization?.split(' ')[1]);
  if (!decoded) return res.status(401).json({ error: 'Please sign in to continue' });
  req.user = decoded; next();
};
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Your role does not have access to this action' });
  next();
};
module.exports = { authenticate, authorize };
