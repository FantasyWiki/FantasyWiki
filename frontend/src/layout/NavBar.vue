<template>
  <!-- Top Header -->
  <ion-page>
    <ion-header class="ion-no-border transparent-top-layer">
      <ion-toolbar class="transparent-bot-layer">
         <app-logo slot="start"></app-logo>

        <!-- Desktop Navigation -->
        <div class="desktop-nav ion-hide-md-down">
          <ion-button v-for="link in navLinks" :key="link.name" :router-link="link.href" router-direction="forward"
            fill="clear" class="nav-link" :class="{ 'active': isActive(link.href) }">
            <ion-icon v-if="link.icon" :icon="link.icon" slot="start" />
            {{ link.name }}
          </ion-button>
        </div>

        <!-- Right Actions -->
        <div slot="end" class="actions-container">
          <!-- Language Selector (Desktop) -->
          <ion-button fill="solid" size="small" shape="round" class="action-btn" @click="openLanguageMenu">
            <ion-icon :icon="globeOutline" slot="start" />
            {{ currentLanguage }}
          </ion-button>

          <!-- Theme Toggle -->
          <ion-button fill="solid" size="small" shape="round" class="action-btn" @click="toggleTheme">
            <ion-icon :icon="isDark ? moonOutline : sunnyOutline" />
          </ion-button>

          <!-- Sign In Button (Desktop) -->
          <ion-button color="primary" class="signin-btn ion-hide-sm-down" id="open-modal">
            {{ isLoggedIn ? 'Sign Out' : 'Sign In' }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <slot></slot>
      <ion-modal trigger="open-modal">
        <login-page></login-page>
      </ion-modal>
    </ion-content>

  <ion-footer class="ion-hide-md-up">
    <ion-toolbar>
      <ion-segment>
        <ion-segment-button v-for="link in mobileNavLinks" :key="link.name" :value="link.tab"
          @click="router.push(link.href)">
          <ion-icon :icon="link.icon" />
          <ion-label class="ion-text-capitalize">{{ link.name }}</ion-label>
        </ion-segment-button>

        <ion-segment-button value="auth" id="-open-modal">
          <ion-icon :icon="isLoggedIn ? logOutOutline : logInOutline" />
          <ion-label class="ion-text-capitalize">{{ isLoggedIn ? 'Sign Out' : 'Sign In' }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-toolbar>
  </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonContent,
  IonFooter,
  IonPage,
  IonLabel,
  IonSegment,
  IonModal,
  IonSegmentButton,
  actionSheetController
} from '@ionic/vue';
import {
  globeOutline,
  gridOutline,
  trophyOutline,
  peopleOutline,
  moonOutline,
  sunnyOutline,
  helpCircleOutline,
  logInOutline,
  logOutOutline
} from 'ionicons/icons';
import AppLogo from '@/views/AppLogo.vue';
import LoginPage from '@/views/LoginPage.vue';

const router = useRouter();
const route = useRoute();

// State
const isDark = ref(false);
const currentLanguage = ref('EN');
const isLoggedIn = ref(false);

// Navigation links configuration
const navLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: gridOutline, requiresAuth: true },
  { name: 'How It Works', href: '/how-it-works', icon: helpCircleOutline, requiresAuth: false },
  { name: 'Leagues', href: '/leagues', icon: trophyOutline, requiresAuth: true },
  { name: 'Community', href: '/community', icon: peopleOutline, requiresAuth: false },
];

// Mobile navigation (subset of desktop nav)
const mobileNavLinks = computed(() => [
  { name: 'Dashboard', href: '/dashboard', icon: gridOutline, tab: 'dashboard' },
  { name: 'How It Works', href: '/how-it-works', icon: helpCircleOutline, tab: 'how' },
  { name: 'Leagues', href: '/leagues', icon: trophyOutline, tab: 'leagues' },
  { name: 'Community', href: '/community', icon: peopleOutline, tab: 'community' },
]);

// Check if route is active
const isActive = (href: string) => {
  return route.path === href;
};

// Theme toggle
const toggleTheme = () => {
  isDark.value = !isDark.value;
  document.body.classList.toggle('ion-palette-dark', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

// Language selector
const openLanguageMenu = async () => {
  const actionSheet = await actionSheetController.create({
    header: 'Select Language',
    buttons: [
      { text: 'English', handler: () => { currentLanguage.value = 'EN'; } },
      { text: 'Español', handler: () => { currentLanguage.value = 'ES'; } },
      { text: 'Français', handler: () => { currentLanguage.value = 'FR'; } },
      { text: 'Deutsch', handler: () => { currentLanguage.value = 'DE'; } },
      { text: '日本語', handler: () => { currentLanguage.value = 'JP'; } },
      { text: 'Cancel', role: 'cancel' }
    ]
  });
  await actionSheet.present();
};
</script>

<style scoped>
.nav-link {
	--ion-toolbar-color: var(--ion-text-color);
}

.action-btn {
  --color: var(--ion-color-dark);
  --background: var(--ion-background-color-step-100);
}


/* ===================================
   HEADER & TOOLBAR
   ================================== */

.transparent-bot-layer {
  --background: transparent;
  --min-height: 64px;
  --padding-start: 16px;
  --padding-end: 16px;
}

ion-toolbar {
  border-bottom: 1px solid var(--ion-border-color);
}

/* ===================================
   DESKTOP NAVIGATION
   ================================== */

.desktop-nav {
  display: flex;
  gap: 4px;
  align-items: center;
}

.nav-link {
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  transition: all 0.2s ease;
}

.nav-link ion-icon {
  font-size: 1.125rem;
  margin-right: 4px;
}

.nav-link:hover {
  --color: var(--ion-color-primary);
}

.nav-link.active {
  --color: var(--ion-color-primary);
  font-weight: 600;
}

/* ===================================
   RIGHT ACTIONS
   ================================== */

.actions-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  font-size: 0.875rem;
  text-transform: none;
}

.action-btn:hover {
  --color: var(--ion-color-primary);
}

.action-btn ion-icon {
  font-size: 1.25rem;
}

.signin-btn {
  --padding-start: 20px;
  --padding-end: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: none;
  margin-left: 8px;
}

ion-footer {
  border-top: 1px solid var(--ion-background-color-step-350);
}

ion-modal {
  --width: fit-content;
  --min-width: 250px;
  --height: fit-content;
  --border-radius: 6px;
  --box-shadow: 0 28px 48px rgba(0, 0, 0, 0.4);
}

</style>