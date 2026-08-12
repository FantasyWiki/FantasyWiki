import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { alertController } from "@ionic/vue";
import { useI18n } from "vue-i18n";
import { queryKeys } from "@/composables/queryKeys";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { GLOBAL_LEAGUE_ID } from "../../../model/league";
import type { LeagueDTO } from "../../../dto/leagueDTO";

/**
 * The two ways a league stops being somewhere you play: its admin closes it, or
 * you leave it. See docs/domain/league-lifecycle.md for what each one means —
 * neither deletes anything.
 *
 * Which of the two to offer is the server's answer, not a guess made here:
 * `LeagueDTO` carries no `adminId` on purpose, so the page asks `my-role` and
 * renders only what it is told applies. The same shape as the invitation card.
 */
export function useLeagueLifecycle(
  leagueId: MaybeRefOrGetter<string | undefined>,
  league: MaybeRefOrGetter<LeagueDTO | undefined>
) {
  const id = computed(() => toValue(leagueId) ?? null);
  const { t } = useI18n();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const { data: role } = useQuery({
    queryKey: computed(() => queryKeys.leagueRole(id.value)),
    queryFn: () => api.leagues.getMyRole(id.value!),
    enabled: computed(() => !!id.value),
    // A refusal here is the endpoint working — a league the caller has nothing
    // to do with — not a fetch worth repeating.
    retry: false,
  });

  const isClosed = computed(() => toValue(league)?.closedAt != null);

  /**
   * Neither action is offered once the league is closed: there is nothing left
   * to close, and nothing left to walk out of. A season that has merely run out
   * is left to the page, which already knows its phase — this composable does
   * not re-derive that, so the two cannot disagree.
   */
  const canClose = computed(() => !!role.value?.isAdmin && !isClosed.value);
  const canLeave = computed(
    () =>
      !!role.value?.isMember &&
      // The admin closes the league instead; leaving would leave one nobody
      // could end.
      !role.value?.isAdmin &&
      !isClosed.value &&
      // The one league nobody may leave — first run enrols every player into
      // it and would route them straight back. The backend refuses this too;
      // asking would only be a request spent to be told no.
      id.value !== GLOBAL_LEAGUE_ID
  );

  /** True while a confirmed action is in flight, so the buttons can be held. */
  const isWorking = ref(false);

  /**
   * Ionic's alert rather than `confirm()`: a native dialog blocks the whole
   * page — and the automation harness with it — and cannot be styled or read
   * by a screen reader the way the rest of the app is.
   */
  async function confirmed(
    header: string,
    message: string,
    confirmText: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      alertController
        .create({
          header,
          message,
          buttons: [
            {
              text: t("leagueLifecycle.cancel"),
              role: "cancel",
              handler: () => resolve(false),
            },
            {
              text: confirmText,
              role: "destructive",
              handler: () => resolve(true),
            },
          ],
        })
        .then((alert) => {
          // A dismissal that went through neither button (backdrop, Escape) is
          // still a "no", and without this the promise would never settle.
          alert.onDidDismiss().then(() => resolve(false));
          return alert.present();
        });
    });
  }

  async function close() {
    if (!id.value || isWorking.value) return;
    const ok = await confirmed(
      t("leagueLifecycle.closeTitle"),
      t("leagueLifecycle.closeMessage"),
      t("leagueLifecycle.closeCta")
    );
    if (!ok) return;

    isWorking.value = true;
    try {
      await api.leagues.close(id.value);
      // The league itself changed, and so did what the caller may now do.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.league(id.value),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leagueRole(id.value),
      });
      await showSuccess(t("leagueLifecycle.closeDone"));
    } catch (error) {
      await showError(
        error instanceof Error
          ? error.message
          : t("leagueLifecycle.closeFailed")
      );
    } finally {
      isWorking.value = false;
    }
  }

  async function leave() {
    if (!id.value || isWorking.value) return;
    const ok = await confirmed(
      t("leagueLifecycle.leaveTitle"),
      t("leagueLifecycle.leaveMessage"),
      t("leagueLifecycle.leaveCta")
    );
    if (!ok) return;

    isWorking.value = true;
    try {
      await api.leagues.leave(id.value);
      // `my-team` is what every scoped surface reads, and it now answers with
      // nothing; the role decides whether the control is still offered.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myTeam(id.value),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leagueRole(id.value),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.league(id.value),
      });
      await showSuccess(t("leagueLifecycle.leaveDone"));
    } catch (error) {
      await showError(
        error instanceof Error
          ? error.message
          : t("leagueLifecycle.leaveFailed")
      );
    } finally {
      isWorking.value = false;
    }
  }

  return { canClose, canLeave, isClosed, isWorking, close, leave };
}
