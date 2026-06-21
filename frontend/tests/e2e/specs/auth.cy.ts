describe("Auth: unauthenticated state", () => {
  beforeEach(() => {
    cy.visit("/home");
  });

  it("shows Sign In with Google button in nav", () => {
    cy.get(".actions-container").contains("Sign In with Google").should("be.visible");
  });

  it("league selector is not visible when unauthenticated", () => {
    cy.get("#league-selector").should("not.exist");
  });

  it("clicking Sign In opens the login modal", () => {
    cy.get(".actions-container").contains("Sign In with Google").click();
    // NavBar opens a modal containing LoginPage when not authenticated
    cy.get(".login-card").should("be.visible");
    cy.get(".login-card").contains("Sign in with Google").should("be.visible");
  });

  it("login modal has a dismiss button", () => {
    cy.get(".actions-container").contains("Sign In with Google").click();
    cy.get(".login-card .dismiss-btn").should("be.visible");
  });

  it("login modal can be dismissed", () => {
    cy.get(".actions-container").contains("Sign In with Google").click();
    cy.get(".login-card").should("be.visible");
    cy.get(".login-card .dismiss-btn").click();
    cy.get(".login-card").should("not.exist");
  });
});

describe("Auth: login simulation via callback", () => {
  it("loginWithMockSession sets authenticated state and redirects to /home", () => {
    cy.loginWithMockSession();
    cy.url().should("include", "/home");
  });

  it("after login, NavBar shows Sign Out instead of Sign In", () => {
    cy.loginWithMockSession();
    cy.get(".actions-container").contains("Sign Out").should("be.visible");
    cy.get(".actions-container").contains("Sign In with Google").should("not.exist");
  });

  it("after login, league selector appears in NavBar", () => {
    cy.loginWithMockSession();
    cy.get("#league-selector").should("be.visible");
  });

  it("after login, clicking Sign Out reverts NavBar to unauthenticated state", () => {
    cy.loginWithMockSession();
    cy.get(".actions-container").contains("Sign Out").should("be.visible");

    cy.get(".actions-container").contains("Sign Out").click();

    cy.url().should("include", "/home");
    cy.get(".actions-container").contains("Sign In with Google").should("be.visible");
    cy.get("#league-selector").should("not.exist");
  });
});

describe("Auth: callback error handling", () => {
  it("shows error state when /api/session returns 500", () => {
    cy.intercept("GET", "**/api/session", {
      statusCode: 500,
      body: { error: "Internal Server Error" },
    }).as("failedSession");

    cy.visit("/auth/callback");
    cy.wait("@failedSession");

    cy.contains("Sign-in failed").should("be.visible");
    cy.contains("Try again").should("be.visible");
  });
});
