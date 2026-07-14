<template>
  <!-- Rendered inside an ion-popover on desktop and an ion-modal sheet on
       mobile, so it owns no chrome of its own — just the rows. -->
  <ion-list lines="none" class="settings-menu ion-no-padding">
    <template v-if="view === 'root'">
      <ion-item
        v-if="appStore.isAuthenticated"
        class="account-row"
        lines="full"
      >
        <ion-avatar slot="start" class="account-avatar" aria-hidden="true">
          <img
            v-if="picture"
            :src="picture"
            alt=""
            referrerpolicy="no-referrer"
          />
          <ion-icon v-else :icon="personCircleOutline" />
        </ion-avatar>
        <ion-label>
          <h3 class="account-name">{{ appStore.currentUser?.name }}</h3>
          <p class="account-email">{{ appStore.currentUser?.email }}</p>
        </ion-label>
      </ion-item>

      <ion-item :button="true" :detail="true" @click="view = 'language'">
        <ion-icon :icon="globeOutline" slot="start" aria-hidden="true" />
        <ion-label>{{ $t("menu.language") }}</ion-label>
        <ion-note slot="end">{{ appStore.currentLanguage.fullName }}</ion-note>
      </ion-item>

      <!-- Theme is a binary, so it toggles in place: a submenu for two states
           would cost a click and teach nothing. -->
      <ion-item>
        <ion-icon
          :icon="appStore.isDarkMode ? moonOutline : sunnyOutline"
          slot="start"
          aria-hidden="true"
        />
        <ion-toggle
          :checked="appStore.isDarkMode"
          @ion-change="appStore.setDarkMode($event.detail.checked)"
        >
          {{ $t("menu.darkMode") }}
        </ion-toggle>
      </ion-item>

      <ion-item
        :button="true"
        :detail="false"
        :href="USER_GUIDE_URL"
        target="_blank"
        rel="noopener"
        @click="emit('close')"
      >
        <ion-icon :icon="bookOutline" slot="start" aria-hidden="true" />
        <ion-label>{{ $t("menu.userGuide") }}</ion-label>
        <ion-icon
          :icon="openOutline"
          slot="end"
          class="external-icon"
          aria-hidden="true"
        />
      </ion-item>

      <ion-item
        :button="true"
        :detail="false"
        lines="full"
        class="auth-row"
        @click="onAuth"
      >
        <ion-icon
          :icon="appStore.isAuthenticated ? logOutOutline : logInOutline"
          slot="start"
          aria-hidden="true"
        />
        <ion-label>
          {{ appStore.isAuthenticated ? $t("nav.signOut") : $t("nav.signIn") }}
        </ion-label>
      </ion-item>
    </template>

    <template v-else>
      <ion-item
        :button="true"
        :detail="false"
        lines="full"
        @click="view = 'root'"
      >
        <ion-icon :icon="chevronBackOutline" slot="start" aria-hidden="true" />
        <ion-label>{{ $t("menu.language") }}</ion-label>
      </ion-item>

      <ion-item
        v-for="lang in appStore.availableLanguages"
        :key="lang.code"
        :button="true"
        :detail="false"
        @click="selectLanguage(lang.code)"
      >
        <ion-label>{{ lang.label }} {{ lang.fullName }}</ion-label>
        <ion-icon
          v-if="appStore.isLanguage(lang.code)"
          :icon="checkmarkOutline"
          slot="end"
          aria-hidden="true"
        />
      </ion-item>
    </template>
  </ion-list>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  IonAvatar,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonToggle,
} from "@ionic/vue";
import {
  bookOutline,
  checkmarkOutline,
  chevronBackOutline,
  globeOutline,
  logInOutline,
  logOutOutline,
  moonOutline,
  openOutline,
  personCircleOutline,
  sunnyOutline,
} from "ionicons/icons";
import { useAppStore } from "@/stores/app";

const USER_GUIDE_URL =
  "https://github.com/FantasyWiki/FantasyWiki/tree/master/docs";

const emit = defineEmits<{ close: [] }>();

const appStore = useAppStore();

// A nested list rather than an inline segment: adding a locale to
// AVAILABLE_LANGUAGES then costs no layout work here.
const view = ref<"root" | "language">("root");

const picture = computed(() => appStore.currentUser?.picture);

function selectLanguage(code: string) {
  appStore.setLanguage(code);
  view.value = "root";
  emit("close");
}

// The menu closes first: both modals are siblings of the popover/sheet, and
// Ionic will not stack them reliably if the trigger is still open.
function onAuth() {
  emit("close");
  if (appStore.isAuthenticated) {
    appStore.openLogoutModal();
  } else {
    appStore.openLoginModal();
  }
}
</script>

<style scoped>
.settings-menu ion-item {
  font-size: 0.875rem;
  --min-height: 44px;
}

.account-row {
  --min-height: 60px;
}

.account-avatar {
  width: 2rem;
  height: 2rem;
  color: var(--ion-color-medium);
}

.account-avatar ion-icon {
  font-size: 2rem;
}

.account-name {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.account-email {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.external-icon {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.auth-row {
  --border-width: 1px 0 0 0;
}
</style>
