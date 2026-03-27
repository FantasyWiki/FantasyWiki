<template>
  <ion-page>
    <ion-header
      :translucent="true"
      class="ion-no-border ion-padding-horizontal-md-up transparent-top-layer"
    >
      <ion-toolbar
        class="transparent-bot-layer ion-padding-horizontal-md-up ion-display-flex ion-flex-wrap"
      >
        <app-logo slot="start"></app-logo>

        <!-- Desktop Navigation -->
        <div class="desktop-nav ion-hide-md-down">
          <ion-button
            v-for="link in navLinks"
            :key="link.name"
            :router-link="link.href"
            router-direction="forward"
            fill="clear"
            class="nav-link"
            :class="{ active: isActive(link.href) }"
          >
            <ion-icon v-if="link.icon" :icon="link.icon" slot="start" />
            {{ link.name }}
          </ion-button>
        </div>

        <!-- Right Actions -->
        <div slot="end" class="actions-container">
          <!-- League Selector -->
          <ion-button
            fill="solid"
            size="small"
            shape="round"
            @click="openLeaguePopover($event)"
          >
            <ion-label>{{ leagueStore.currentLeague?.icon ?? "" }}</ion-label>
            <ion-label class="ion-hide-md-down">
              {{ leagueStore.currentLeagueName }}
            </ion-label>
            <!--
              Badge shows the GLOBAL unread count across all leagues so the
              player can see there is activity even on inactive leagues.
            -->
            <ion-badge color="danger" v-if="unreadCount > 0">
              {{ unreadCount > 99 ? "99+" : unreadCount }}
            </ion-badge>
          </ion-button>

          <ion-popover
            :is-open="leaguePopoverOpen"
            :event="leaguePopoverEvent"
            side="bottom"
            alignment="end"
            @did-dismiss="leaguePopoverOpen = false"
          >
            <ion-list lines="none" class="ion-no-margin">
              <ion-item
                class="ion-no-margin league-item"
                :detail="false"
                v-for="lg in leagueStore.availableLeagues"
                :key="lg.id"
                :button="true"
                @click="selectLeague(lg)"
              >
                <ion-label class="league-label"
                  >{{ lg.icon }} {{ lg.name }}</ion-label
                >
                <ion-badge
                  v-if="unreadCountByLeague[lg.id]"
                  slot="end"
                  color="danger"
                  class="league-unread-badge"
                >
                  {{ unreadCountByLeague[lg.id] }}
                </ion-badge>
              </ion-item>
            </ion-list>
          </ion-popover>

          <!-- Language Selector -->
          <ion-button
            fill="solid"
            size="small"
            shape="round"
            @click="openLangPopover($event)"
          >
            <ion-icon :icon="globeOutline" />
            <ion-text class="ion-hide-md-down">
              {{ appStore.currentLanguage.label }}
              {{ appStore.currentLanguage.code }}
            </ion-text>
          </ion-button>
          <ion-popover
            :is-open="langPopoverOpen"
            :event="langPopoverEvent"
            side="bottom"
            alignment="end"
            @did-dismiss="langPopoverOpen = false"
          >
            <ion-list lines="none" class="ion-no-margin">
              <ion-item
                class="ion-no-margin"
                :detail="false"
                v-for="lang in appStore.availableLanguages"
                :key="lang.code"
                :button="true"
                @click="selectLanguage(lang.code)"
              >
                <ion-label>{{ lang.label }} {{ lang.fullName }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-popover>

          <!-- Theme Toggle -->
          <ion-button
            fill="solid"
            size="small"
            shape="round"
            @click="toggleTheme"
          >
            <ion-icon
              :icon="appStore.isDarkMode ? moonOutline : sunnyOutline"
            />
          </ion-button>

          <!-- Sign In / Out -->
          <ion-button
            color="primary"
            fill="solid"
            class="ion-hide-sm-down"
            @click="handleAuth"
          >
            {{ appStore.isAuthenticated ? "Sign Out" : "Sign In with Google" }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <slot></slot>
      <ion-modal
        :is-open="isLoginOpen"
        css-class="login-modal"
        @did-dismiss="isLoginOpen = false"
      >
        <login-page />
      </ion-modal>
    </ion-content>

    <!-- Mobile Footer -->
    <ion-footer
      class="ion-hide-md-up transparent-top-layer"
      :translucent="true"
    >
      <ion-toolbar class="transparent-bot-layer">
        <div class="mobile-nav">
          <ion-button
            fill="clear"
            v-for="link in navLinks"
            :key="link.name"
            @click="router.push(link.href)"
          >
            <ion-icon :icon="link.icon" />
          </ion-button>
          <ion-button fill="clear" @click="handleAuth">
            <ion-icon
              :icon="appStore.isAuthenticated ? logOutOutline : logInOutline"
            />
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonModal,
  IonButton,
  IonBadge,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonPopover,
  IonText,
  IonToolbar,
} from "@ionic/vue";
import {
  globeOutline,
  gridOutline,
  logInOutline,
  logOutOutline,
  moonOutline,
  storefrontOutline,
  sunnyOutline,
  trophyOutline,
} from "ionicons/icons";

import AppLogo from "@/views/AppLogo.vue";
import LoginPage from "@/views/auth/LoginPage.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import { useNotifications } from "@/stores/useNotifications";

const router = useRouter();
const route = useRoute();
const isLoginOpen = ref(false);

// State
const appStore = useAppStore();
const leagueStore = useLeagueStore();

// Global unread count — sums across ALL leagues, not just the current one.
// TanStack Query fetches this once and keeps it fresh on window focus.
const { unreadCount, unreadCountByLeague } = useNotifications();

// ── Popover state ────────────────────────────────────────────────────────────
// We use isOpen + :event instead of the declarative trigger prop.
// The trigger prop loses its DOM reference after Ionic page navigation inside
// a persistent layout and silently stops working until a full reload.
// Passing the raw MouseEvent via :event lets Ionic read event.target to
// anchor the popover correctly below the button that was clicked.

const leaguePopoverOpen = ref(false);
const leaguePopoverEvent = ref<MouseEvent | undefined>(undefined);
const langPopoverOpen = ref(false);
const langPopoverEvent = ref<MouseEvent | undefined>(undefined);

function openLeaguePopover(e: MouseEvent) {
  leaguePopoverEvent.value = e;
  leaguePopoverOpen.value = true;
}

function openLangPopover(e: MouseEvent) {
  langPopoverEvent.value = e;
  langPopoverOpen.value = true;
}

function selectLeague(lg: (typeof leagueStore.availableLeagues)[0]) {
  leagueStore.setCurrentLeague(lg);
  leaguePopoverOpen.value = false;
}

function selectLanguage(code: string) {
  appStore.setLanguage(code);
  langPopoverOpen.value = false;
}

const navLinks = [
  { name: "Dashboard", href: "/dashboard", icon: gridOutline },
  { name: "Leagues", href: "/leagues", icon: trophyOutline },
  { name: "Market", href: "/market", icon: storefrontOutline },
];

const isActive = (href: string) => route.path === href;

const toggleTheme = () => {
  appStore.toggleDarkMode();
  document.body.classList.toggle("ion-palette-dark", appStore.isDarkMode);
  localStorage.setItem("theme", appStore.isDarkMode ? "dark" : "light");
};

const handleAuth = async () => {
  if (appStore.isAuthenticated) {
    appStore.logout();
    router.push("/");
  } else {
    router.push("/signin");
    isLoginOpen.value = true;
  }
};

onMounted(async () => {
  if (!leagueStore.currentLeague) {
    await leagueStore.initialize();
  }
});
</script>

<style scoped>
ion-popover {
  --backdrop-opacity: 0;
  --border-radius: 6px;
  --border-color: var(--ion-border-color);
  --width: 14rem;
}

ion-item {
  font-size: 0.875rem;
  --min-height: 36px;
}

.league-item {
  --min-height: 40px;
}

.league-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.league-unread-badge {
  font-size: 0.65rem;
  min-width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

ion-header {
  border-bottom: 1px solid var(--ion-border-color);
}

ion-toolbar {
  border-bottom: 1px solid var(--ion-border-color);
  --padding-start: 16px;
  --padding-end: 16px;
}

.transparent-top-layer {
  background: rgba(var(--ion-background-color-rgb), 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.transparent-bot-layer {
  --background: transparent;
  --min-height: 64px;
}

ion-footer {
  border-top: 1px solid var(--ion-border-color);
}

.desktop-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
}

.mobile-nav {
  display: flex;
  justify-content: space-around;
  width: 100%;
}

.actions-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

ion-modal {
  --backdrop-opacity: 100%;
}
</style>
