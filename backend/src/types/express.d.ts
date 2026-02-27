import { GoogleProfile } from "../types";

// Extend Express Request to carry the decoded JWT user
declare global {
  namespace Express {
    interface User extends GoogleProfile {}
  }
}
