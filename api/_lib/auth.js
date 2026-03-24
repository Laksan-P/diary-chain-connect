import jwt from 'jsonwebtoken';
const sign = jwt.sign;
const verify = jwt.verify;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Verify JWT token from Authorization header.
 * Returns decoded payload or null.
 */
export function verifyToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.split(' ')[1];
  try {
    return verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Middleware-style auth check for serverless handlers.
 * Returns decoded user or sends 401 and returns null.
 */
export function authenticate(req, res) {
  const user = verifyToken(req);
  if (!user) {
    res.status(401).json({ error: 'No token provided or token invalid' });
    return null;
  }
  return user;
}

/**
 * Sign a JWT token.
 */
export function signToken(payload) {
  return sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
