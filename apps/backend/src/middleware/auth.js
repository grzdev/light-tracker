export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Bearer token is required",
      statusCode: 401,
    });
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token || token !== process.env.API_SECRET_KEY) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid bearer token",
      statusCode: 401,
    });
  }

  next();
}