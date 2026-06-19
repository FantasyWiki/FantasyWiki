import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import HomeMock from "@/views/MockHome.vue";
import TeamDashboard from "@/views/TeamDashboard.vue";
import HomePage from "@/views/HomePage.vue";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";
import EnvInfoPage from "@/views/EnvInfoPage.vue";
import TeamPage from "@/views/TeamPage.vue";
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
    component: () => import("@/views/TeamCreationPage.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || "/"),
  routes,
});

router.beforeEach((to) => {
  if (!to.meta.public && !useAppStore().isAuthenticated) {
    return "/home";
  }
});

export default router;
