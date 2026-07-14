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
          <ion-button
            id="league-selector"
            fill="solid"
            size="small"
            shape="round"
            @click="openLeaguePopover($event)"
            v-if="appStore.isAuthenticated"
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
                  >{{ lg.icon }} {{ lg.title }}</ion-label
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

          <!-- Sign in stays a first-class button while logged out: it is the
               only action an anonymous visitor is here to take, and the space
               is free because there is no league selector yet. -->
          <ion-button
            v-if="!appStore.isAuthenticated"
            color="primary"
            fill="solid"
            size="small"
            shape="round"
            class="ion-hide-md-down"
            @click="appStore.openLoginModal()"
          >
            {{ $t("nav.signIn") }}
          </ion-button>

          <!-- One trigger in both auth states: the avatar slot holds a person
               glyph while logged out and fills with the Google photo after
               login. The button never changes identity or position, so the
               menu stays findable. Mobile reaches the same menu from the
               bottom nav, so this is desktop-only. -->
          <ion-button
            id="settings-menu-trigger"
            fill="clear"
            color="dark"
            size="small"
            shape="round"
            class="ion-hide-md-down settings-trigger"
            :aria-label="$t('menu.open')"
            @click="openSettingsPopover($event)"
          >
            <ion-avatar class="profile-avatar" aria-hidden="true">
              <img
                v-if="profilePicture"
                :src="profilePicture"
                alt=""
                referrerpolicy="no-referrer"
              />
              <ion-icon v-else :icon="personCircleOutline" />
            </ion-avatar>
            <ion-icon :icon="chevronDownOutline" class="trigger-chevron" />
          </ion-button>

          <ion-popover
            :is-open="settingsPopoverOpen"
            :event="settingsPopoverEvent"
            side="bottom"
            alignment="end"
            class="settings-popover"
            @did-dismiss="settingsPopoverOpen = false"
          >
            <settings-menu @close="settingsPopoverOpen = false" />
          </ion-popover>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <slot></slot>
      <info-footer></info-footer>
      <ion-modal
        :is-open="appStore.isLoginModalOpen"
        css-class="login-modal"
        @did-dismiss="appStore.closeLoginModal()"
      >
        <login-page />
      </ion-modal>
      <ion-modal
        :is-open="appStore.isLogoutModalOpen"
        css-class="login-modal"
        @did-dismiss="onLogoutDismiss"
      >
        <logout-confirm-page />
      </ion-modal>

      <!-- Mobile reaches the settings menu as a bottom sheet: it is anchored to
           the bottom nav, where the thumb already is. Auto-height rather than a
           breakpoint, so the sheet is exactly as tall as its rows instead of
           leaving dead space below them. -->
      <ion-modal
        :is-open="settingsSheetOpen"
        class="settings-sheet"
        @did-dismiss="settingsSheetOpen = false"
      >
        <div class="sheet-inner">
          <settings-menu @close="settingsSheetOpen = false" />
        </div>
      </ion-modal>
    </ion-content>

    <!-- Mobile Footer -->
    <!-- mobile-nav-footer is the positionAnchor for bottom toasts (see
         useToast). It must be a class: the router outlet keeps previous
         pages (each with its own NavBar) mounted, so the selector can match
         several footers and useToast picks the visible one. -->
    <ion-footer
      class="mobile-nav-footer ion-hide-md-up transparent-top-layer"
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
          <!-- Was an auth toggle; now the entry point to the same settings menu
               the desktop avatar opens. Sign in/out is a row inside it. -->
          <ion-button
            fill="clear"
            :aria-label="$t('menu.open')"
            @click="settingsSheetOpen = true"
          >
            <ion-avatar
              v-if="profilePicture"
              class="profile-avatar"
              aria-hidden="true"
            >
              <img :src="profilePicture" alt="" referrerpolicy="no-referrer" />
            </ion-avatar>
            <ion-icon v-else :icon="personCircleOutline" />
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  IonModal,
  IonAvatar,
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
  IonToolbar,
} from "@ionic/vue";
import {
  chevronDownOutline,
  gridOutline,
  personCircleOutline,
  storefrontOutline,
  trophyOutline,
} from "ionicons/icons";

import AppLogo from "@/components/AppLogo.vue";
import SettingsMenu from "@/components/SettingsMenu.vue";
import InfoFooter from "@/layout/InfoFooter.vue";
import LoginPage from "@/views/auth/LoginPage.vue";
import LogoutConfirmPage from "@/views/auth/LogoutConfirmPage.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import { useNotifications } from "@/composables/useNotifications";
import { LeagueDTO } from "../../../dto/leagueDTO";

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

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
const settingsPopoverOpen = ref(false);
const settingsPopoverEvent = ref<MouseEvent | undefined>(undefined);

// Mobile opens the same menu as a bottom sheet from the bottom nav.
const settingsSheetOpen = ref(false);

function openLeaguePopover(e: MouseEvent) {
  leaguePopoverEvent.value = e;
  leaguePopoverOpen.value = true;
}

function openSettingsPopover(e: MouseEvent) {
  settingsPopoverEvent.value = e;
  settingsPopoverOpen.value = true;
}

function selectLeague(lg: LeagueDTO) {
  leagueStore.setCurrentLeague(lg);
  leaguePopoverOpen.value = false;
}

// Google profile picture from the session; shown in the auth buttons so a
// logged-in state is visible at a glance (issue #385).
const profilePicture = computed(() =>
  appStore.isAuthenticated ? appStore.currentUser?.picture : undefined
);

const navLinks = computed(() => [
  { name: t("nav.dashboard"), href: "/dashboard", icon: gridOutline },
  { name: t("nav.leagues"), href: "/leagues", icon: trophyOutline },
  { name: t("nav.market"), href: "/market", icon: storefrontOutline },
]);

const isActive = (href: string) => route.path === href;

// Signing out asks for confirmation in a modal (same style as the login
// one); the store is only touched when the modal is dismissed with the
// "confirm" role.
const onLogoutDismiss = (event: CustomEvent) => {
  appStore.closeLogoutModal();
  if (event.detail.role === "confirm") {
    appStore.logout();
    router.push("/");
  }
};

onMounted(async () => {
  if (appStore.isAuthenticated && !leagueStore.currentLeague) {
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

/* Keep the bar full-width, just stop the logo and the actions sitting right on
   the screen edge once there is room to breathe. */
@media (min-width: 768px) {
  ion-toolbar {
    --padding-start: 32px;
    --padding-end: 32px;
  }
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

.profile-avatar {
  width: 1.75rem;
  height: 1.75rem;
  color: var(--ion-color-medium);
}

.profile-avatar ion-icon {
  font-size: 1.75rem;
}

/* The chevron is the whole affordance: it says "this opens" without a gear
   claiming the menu is only settings. */
.settings-trigger {
  --padding-start: 4px;
  --padding-end: 4px;
}

.trigger-chevron {
  font-size: 0.75rem;
  margin-inline-start: 0.25rem;
  color: var(--ion-color-medium);
}

.settings-popover {
  --width: 17rem;
}

ion-modal {
  --backdrop-opacity: 100%;
}

/* The sheet is a surface, not a dialog — it should not black out the page
   behind it the way the login modal does. --height: auto makes it hug its
   rows; align-items pins it to the bottom, where the trigger is. */
ion-modal.settings-sheet {
  --backdrop-opacity: 0.3;
  --height: auto;
  --width: 100%;
  --border-radius: 16px 16px 0 0;
  align-items: flex-end;
}

ion-modal.settings-sheet .sheet-inner {
  /* Auto-height modals size to their content, so the scroll cap has to live
     here — otherwise a long menu would grow past the viewport. */
  max-height: 80vh;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
