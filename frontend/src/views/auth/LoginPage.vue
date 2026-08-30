<template>
  <div class="login-card">
    <button class="dismiss-btn" @click="dismiss">
      <ion-icon aria-hidden="true" :icon="closeOutline" />
    </button>

    <app-logo />

    <ion-text color="medium" class="login-subtitle">
      <p>{{ $t("auth.login.subtitle") }}</p>
    </ion-text>

    <div v-if="errorMessage" class="error-banner">
      <ion-icon aria-hidden="true" :icon="alertCircleOutline" />
      {{ errorMessage }}
    </div>

    <!-- Shown when the router bounced the visitor off a page instead of when
         they opened this themselves, so the redirect reads as an explanation
         rather than a dead link. -->
    <div
      v-else-if="appStore.loginReason === 'auth-required'"
      class="notice-banner"
    >
      <ion-icon aria-hidden="true" :icon="lockClosedOutline" />
      {{ $t("auth.login.authRequired") }}
    </div>

    <ion-button expand="block" class="google-btn" @click="signInWithGoogle">
      <ion-icon aria-hidden="true" :icon="logoGoogle" slot="start" />
      <ion-text>{{ $t("auth.login.signInGoogle") }}</ion-text>
    </ion-button>

    <!-- Gated twice, like the demo button below: this build has to have been
         started with VITE_PASSWORD_AUTH=true, and the backend only serves
         /auth/password when it was built from `src/indexPassword.ts` — the
         deployed Worker does not contain those routes at all. Neither side
         trusts the other. See docs/architecture/auth-modes.md. -->
    <form
      v-if="isPasswordAuthEnabled"
      class="password-form"
      @submit.prevent="submitPassword"
    >
      <label class="form-label" for="password-username">
        {{ t("auth.login.passwordUsername") }}
      </label>
      <ion-item lines="none" :color="passwordError ? 'danger' : ''">
        <ion-input
          id="password-username"
          v-model="username"
          autocomplete="username"
          :placeholder="t('auth.login.passwordUsername')"
          @ionInput="passwordError = ''"
        />
      </ion-item>
      <!-- Only when registering: on the way in, the rule is not news, and the
           401 deliberately will not say which field was wrong anyway. There is
           no password hint beside it because there are no password rules. -->
      <ion-text v-if="registering" color="medium">
        <p class="field-hint">
          {{
            t("auth.login.usernameHint", {
              min: PASSWORD_RULES.USERNAME_MIN,
              max: PASSWORD_RULES.USERNAME_MAX,
            })
          }}
        </p>
      </ion-text>

      <label class="form-label" for="password-password">
        {{ t("auth.login.passwordPassword") }}
      </label>
      <ion-item lines="none" :color="passwordError ? 'danger' : ''">
        <ion-input
          id="password-password"
          v-model="password"
          type="password"
          :maxlength="PASSWORD_RULES.PASSWORD_MAX"
          :autocomplete="registering ? 'new-password' : 'current-password'"
          :placeholder="t('auth.login.passwordPassword')"
          @ionInput="passwordError = ''"
        >
          <!-- Ionic's own show/hide control, which matters more on a password
               field than the typing it saves elsewhere: it is the only field
               here a typo in is invisible. -->
          <ion-input-password-toggle slot="end" />
        </ion-input>
      </ion-item>

      <ion-text v-if="passwordError" color="danger">
        <p class="field-hint">{{ passwordError }}</p>
      </ion-text>

      <ion-button
        expand="block"
        type="submit"
        :disabled="isSubmitting || !username.trim()"
      >
        {{
          registering
            ? t("auth.login.registerPassword")
            : t("auth.login.signInPassword")
        }}
      </ion-button>

      <ion-button fill="clear" size="small" @click="toggleMode">
        {{
          registering
            ? t("auth.login.switchToLogin")
            : t("auth.login.switchToRegister")
        }}
      </ion-button>
    </form>

    <!-- Local development only, and gated twice: this build has to have been
         started with VITE_DEV_LOGIN=true, and the backend refuses /auth/dev
         unless it is running on the `local` environment. Neither side trusts
         the other. See docs/development/docker-local-dev.md. -->
    <div v-if="isDevLoginEnabled" class="dev-login">
      <ion-button fill="clear" size="small" @click="signInAsDemoPlayer">
        <ion-icon aria-hidden="true" :icon="terminalOutline" slot="start" />
        {{ $t("auth.login.signInDemo") }}
      </ion-button>
      <ion-text color="medium">
        <p>{{ $t("auth.login.signInDemoNote") }}</p>
      </ion-text>
    </div>

    <ion-text color="medium" class="login-terms">
      <p>
        <i18n-t keypath="auth.login.termsPrefix" tag="span">
          <template #terms
            ><router-link to="/legal">{{
              $t("auth.login.terms")
            }}</router-link></template
          >
          <template #privacy
            ><router-link to="/legal">{{
              $t("auth.login.privacy")
            }}</router-link></template
          >
        </i18n-t>
      </p>
    </ion-text>
  </div>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonText,
  IonIcon,
  modalController,
} from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  alertCircleOutline,
  closeOutline,
  lockClosedOutline,
  logoGoogle,
  terminalOutline,
} from "ionicons/icons";
import { computed, ref } from "vue";
import AppLogo from "@/components/AppLogo.vue";
import { useAppStore } from "@/stores/app";
import { ApiError, passwordAuthApi, sessionApi } from "@/services/api";
import {
  PASSWORD_REQUEST_ERRORS,
  PASSWORD_RULES,
} from "../../../../dto/passwordAuthDTO";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();

const errorMessage = computed(() =>
  route.query.error === "auth_failed" ? t("auth.login.authFailed") : null
);

function dismiss() {
  modalController.dismiss();
}

function signInWithGoogle() {
  window.location.href = "/auth/google";
}

/**
 * Only ever true in a local build. It lets someone with no share of the
 * project's Google OAuth client still get past the login wall — a reviewer, a
 * new collaborator, or the container in `compose.yaml`.
 */
const isDevLoginEnabled = import.meta.env.VITE_DEV_LOGIN === "true";

function signInAsDemoPlayer() {
  window.location.href = "/auth/dev";
}

/**
 * Only ever true in a build served by a backend that has the routes. The
 * deployed Worker does not contain them, and there is no Pages Function
 * forwarding `/auth/password` either, so a build that set this by mistake would
 * find nothing there (docs/architecture/auth-modes.md).
 */
const isPasswordAuthEnabled = import.meta.env.VITE_PASSWORD_AUTH === "true";

const registering = ref(false);
const username = ref("");
const password = ref("");
const passwordError = ref("");
const isSubmitting = ref(false);

function toggleMode() {
  registering.value = !registering.value;
  passwordError.value = "";
}

/**
 * The backend's refusal, in this reader's language and pointed at the field
 * that caused it.
 *
 * It branches on the error *constant*, never on the message text, which is
 * display only and free to be reworded
 * (docs/architecture/backend-error-constants.md). The bounds come from the same
 * shared `PASSWORD_RULES` the backend validates against, so this cannot promise
 * a limit the server does not honour.
 */
function messageFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;

  switch (code) {
    case PASSWORD_REQUEST_ERRORS.USERNAME_INVALID:
      return t("auth.login.usernameInvalid", {
        min: PASSWORD_RULES.USERNAME_MIN,
        max: PASSWORD_RULES.USERNAME_MAX,
      });
    case PASSWORD_REQUEST_ERRORS.PASSWORD_TOO_LONG:
      return t("auth.login.passwordTooLong", {
        max: PASSWORD_RULES.PASSWORD_MAX,
      });
  }

  // 409 on register is the one remaining failure the user can act on; a 401 is
  // deliberately unspecific about which half was wrong.
  if (error instanceof ApiError && error.status === 409) {
    return t("auth.login.usernameTaken");
  }
  return t("auth.login.signInFailed");
}

/**
 * Unlike the two buttons above this is a POST, not a navigation, so there is no
 * redirect through `/auth/callback` to land on. The session cookie is set by
 * the response, so this does what that page does: read the session, put it in
 * the store, and route on — new accounts into onboarding, the rest home.
 */
async function submitPassword() {
  isSubmitting.value = true;
  passwordError.value = "";

  const credentials = {
    username: username.value.trim(),
    password: password.value,
  };

  let isNew: boolean;
  try {
    ({ isNew } = registering.value
      ? await passwordAuthApi.register(credentials)
      : await passwordAuthApi.login(credentials));
  } catch (error) {
    // Only this call may be reported as a credential problem. Everything after
    // it happens *after* the account exists and the cookie is set, and saying
    // "check your username and password" there would be a lie that a retry then
    // compounds: registering again answers 409, telling someone the name they
    // just took is taken.
    passwordError.value = messageFor(error);
    return;
  } finally {
    isSubmitting.value = false;
  }

  // Past this point the account exists and the cookie is set, so a failure is
  // not a credential problem and must not be dressed as one — nor left to
  // reject unhandled. The session is already valid; a reload picks it up.
  try {
    appStore.setUserFromData(await sessionApi.get());
  } catch {
    passwordError.value = t("auth.login.sessionFailed");
    return;
  }

  await modalController.dismiss();
  await router.replace(isNew ? "/team-creation" : "/home");
}
</script>

<style scoped>
.login-card {
  position: relative;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.dismiss-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ion-color-medium);
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-subtitle {
  text-align: center;
  font-size: 0.95rem;
}

.login-subtitle p {
  margin: 0;
}

.error-banner {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  border: 1px solid var(--ion-color-danger);
  border-radius: 8px;
  color: var(--ion-color-danger);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Same shape as the error banner, in the neutral brand tone — this explains a
   detour, it does not report a failure. */
.notice-banner {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  border: 1px solid var(--ion-color-primary);
  border-radius: 8px;
  color: var(--ion-color-primary);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.google-btn {
  width: 100%;
  --border-radius: 8px;
  --padding-start: 1rem;
  --padding-end: 1rem;
  height: 48px;
}

.password-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--ion-color-step-150, #e0e0e0);
  padding-top: 1rem;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.field-hint {
  margin: 0;
  font-size: 0.75rem;
}

/* Deliberately quiet: a development affordance, not a second front door. */
.dev-login {
  text-align: center;
  border-top: 1px solid var(--ion-color-step-150, #e0e0e0);
  padding-top: 0.75rem;
  width: 100%;
}

.dev-login p {
  margin: 0;
  font-size: 0.75rem;
}

.login-terms {
  text-align: center;
  font-size: 0.75rem;
}

.login-terms p {
  margin: 0;
}

.login-terms a {
  color: var(--ion-color-primary);
  text-decoration: none;
}
</style>
