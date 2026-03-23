import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
// Set up the Test environment
