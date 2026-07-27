import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import HomeMock from "@/views/MockHome.vue";
import TeamDashboard from "@/views/TeamDashboard.vue";
import HomePage from "@/views/HomePage.vue";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";
import EnvInfoPage from "@/views/EnvInfoPage.vue";
import TeamPage from "@/views/TeamPage.vue";
import TeamCreationPage from "@/views/TeamCreationPage.vue";
import MarketPage from "@/views/MarketPage.vue";
import LegalPage from "@/views/LegalPage.vue";
import GuidePage from "@/views/GuidePage.vue";
import ReportProblemPage from "@/views/ReportProblemPage.vue";
import NotFoundPage from "@/views/NotFoundPage.vue";
import { useAppStore } from "@/stores/app";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: TeamDashboard,
  },
  {
    path: "/how-it-works",
    redirect: "/home",
  },
  {
    path: "/leagues",
    name: "Leagues",
    component: HomeMock,
  },
  {
    path: "/community",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "Home",
    component: HomePage,
    meta: { public: true },
  },
  {
    path: "/legal",
    name: "Legal",
    component: LegalPage,
    meta: { public: true },
  },
  {
    path: "/auth/callback",
    name: "AuthCallback",
    component: AuthCallbackPage,
    meta: { public: true },
  },
  {
    path: "/env-info",
    name: "EnvInfo",
    component: EnvInfoPage,
  },
  {
    path: "/team",
    name: "Team",
    component: TeamPage,
  },
  {
    path: "/team-creation",
    name: "TeamCreation",
    component: TeamCreationPage,
  },
  {
    // Onboarding is no longer a place: it is the guided tour running on top of
    // the real pages (see stores/onboarding.ts). The old path is kept as a
    // redirect so bookmarks and older links land on the tour rather than a 404.
    path: "/onboarding",
    redirect: { path: "/dashboard", query: { tour: "1" } },
  },
  {
    path: "/guide",
    name: "Guide",
    component: GuidePage,
    meta: { public: true },
  },
  {
    path: "/market",
    name: "Market",
    component: MarketPage,
  },
  {
    // Auth-gated (no `public` meta): the reporter is resolved from the session,
    // which is also what keeps the endpoint from being an open spam funnel.
    path: "/report",
    name: "Report",
    component: ReportProblemPage,
  },
  // Catch-all 404 — must stay last
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: NotFoundPage,
    meta: { public: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || "/"),
  routes,
});

router.beforeEach((to) => {
  const appStore = useAppStore();
  if (!to.meta.public && !appStore.isAuthenticated) {
    // Bouncing to the landing page without a word was indistinguishable from a
    // broken link. The login modal both explains the redirect and offers the
    // way out of it; it is opened before the redirect rather than after
    // because the blocked route never mounts, so the only NavBar that ends up
    // rendering is the landing page's, already reading this flag.
    appStore.openLoginModal("auth-required");
    return "/home";
  }
});

export default router;
