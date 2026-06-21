const MOCK_SESSION = {
  sub: "player-1",
  email: "mario@example.com",
  name: "Mario_Rossi",
  picture: "https://example.com/avatar.png",
};

declare global {
  namespace Cypress {
    interface Chainable {
      loginWithMockSession(): Chainable<void>;
    }
  }
}

// Simulate post-Google-OAuth login by intercepting /api/session and visiting
// the auth callback page. AuthCallbackPage calls GET /api/session on mount,
// stores the result in Pinia, then redirects to /home.
// cy.intercept() fires before MSW's service worker passthrough, so it wins.
Cypress.Commands.add("loginWithMockSession", () => {
  cy.intercept("GET", "**/api/session", {
    statusCode: 200,
    body: MOCK_SESSION,
  }).as("sessionIntercept");
  cy.visit("/auth/callback");
  cy.wait("@sessionIntercept");
  cy.url().should("include", "/home");
});

// Clear persisted league selection before each test to prevent cross-test bleed.
beforeEach(() => {
  cy.clearLocalStorage("currentLeague");
});
