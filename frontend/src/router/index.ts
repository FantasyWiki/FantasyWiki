import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import HomeMock from "@/views/MockHome.vue";
import TeamDashboard from "@/views/TeamDashboard.vue";
import HomePage from "@/views/HomePage.vue";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";
import EnvInfoPage from "@/views/EnvInfoPage.vue";

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
  },
  {
    path: "/auth/callback",
    name: "AuthCallback",
    component: AuthCallbackPage,
  },
  {
    path: "/env-info",
    name: "EnvInfo",
    component: EnvInfoPage,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || "/"),
  routes,
});

export default router;
