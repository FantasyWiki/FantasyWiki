import { GoogleProfile } from "../types";

// Extend Express Request to carry the decoded JWT user
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends GoogleProfile {}
  }
}
