import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
// Set up the worker for the browser with the given request handlers.
// The worker will intercept requests on the client side
// and return mocked responses based on the handlers defined in './handlers'.
