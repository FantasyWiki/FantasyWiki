import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * Middleware that verifies the Bearer JWT from the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      displayName: payload.name,
      email: payload.email,
      picture: payload.picture,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
