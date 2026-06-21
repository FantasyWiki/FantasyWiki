describe("Client-side routing", () => {
  it("/ redirects to /home", () => {
    cy.visit("/");
    cy.url().should("include", "/home");
  });

  it("/how-it-works redirects to /home", () => {
    cy.visit("/how-it-works");
    cy.url().should("include", "/home");
  });

  it("/community redirects to /home", () => {
    cy.visit("/community");
    cy.url().should("include", "/home");
  });

  it("/dashboard renders without crashing", () => {
    cy.visit("/dashboard");
    cy.url().should("include", "/dashboard");
    cy.get("ion-page").should("exist");
  });

  it("/dashboard shows No League Selected when unauthenticated and no league stored", () => {
    cy.visit("/dashboard");
    cy.contains("No League Selected").should("be.visible");
    cy.contains("Select a league from the header").should("be.visible");
  });

  it("/env-info renders the environment info page", () => {
    cy.visit("/env-info");
    cy.contains("Environment").should("be.visible");
  });

  it("logo click navigates to /home from another page", () => {
    cy.visit("/dashboard");
    cy.get(".logo-container").click();
    cy.url().should("include", "/home");
  });

  it("desktop nav Dashboard link navigates to /dashboard", () => {
    cy.visit("/home");
    cy.get(".desktop-nav").contains("Dashboard").click();
    cy.url().should("include", "/dashboard");
  });

  it("desktop nav Leagues link navigates to /leagues", () => {
    cy.visit("/home");
    cy.get(".desktop-nav").contains("Leagues").click();
    cy.url().should("include", "/leagues");
  });

  it("browser back button works after SPA navigation", () => {
    cy.visit("/home");
    cy.get(".desktop-nav").contains("Leagues").click();
    cy.url().should("include", "/leagues");
    cy.go("back");
    cy.url().should("include", "/home");
  });
});
