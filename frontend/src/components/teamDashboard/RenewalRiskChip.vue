<template>
  <ion-chip v-if="shortfall !== null" class="risk-chip" :disabled="true">
    <ion-icon :icon="walletOutline" />
    <ion-label>
      {{ $t("dashboard.neededAttention.renewalAtRisk") }} ·
      {{
        $t("dashboard.neededAttention.renewalShortfall", { amount: shortfall })
      }}
    </ion-label>
  </ion-chip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonChip, IonIcon, IonLabel } from "@ionic/vue";
import { walletOutline } from "ionicons/icons";
import { useArticleViews } from "@/composables/useArticleViews";
import { useMyTeam } from "@/composables/useMyTeam";
import { buildArticleDetail } from "@/types/articleDetail";
import type { ContractDTO } from "../../../../dto/contractDTO";

/**
 * Warns that an elected renewal can no longer be covered.
 *
 * Electing a renewal moves no money — the settlement sweep charges at expiry
 * (ADR 0003) — so nothing stops a player from electing and then spending down
 * their balance. The sweep's own affordability check would then quietly settle
 * the contract instead of renewing it, and the player would only learn from the
 * inbox notification the morning after. This surfaces that shortfall while it
 * can still be acted on (top up by selling, or cancel the renewal).
 *
 * Mount only for contracts with `renewalElected` — it fetches live views to
 * price the renewal (the fetch is module-cached, so re-opening is free).
 */
const props = defineProps<{ contract: ContractDTO }>();

const { myTeam, myTeamId } = useMyTeam();

const viewsSource = computed(() => ({
  title: props.contract.article.title,
  domain: props.contract.article.domain,
}));
const { views } = useArticleViews(viewsSource);

/**
 * Credits still needed to cover the renewal, or null when it is covered (or not
 * yet knowable). The comparison mirrors the sweep exactly: what it checks is the
 * *incremental* cost against the team's credits, not the full renewal price —
 * the original stake is already sunk in the derived ledger.
 */
const shortfall = computed<number | null>(() => {
  const averageViews30d = views.value?.averageViews30d;
  const credits = myTeam.value?.credits;
  if (averageViews30d === undefined || credits === undefined) return null;

  const detail = buildArticleDetail({
    article: props.contract.article,
    contract: props.contract,
    viewerTeamId: myTeamId.value ?? undefined,
    viewerCredits: credits,
    averageViews30d,
  });
  if (detail.availability !== "owned-by-viewer" || !detail.renewalElected) {
    return null;
  }

  const missing = detail.renewalIncrementalCost - credits;
  return missing > 0 ? missing : null;
});
</script>

<style scoped>
.risk-chip {
  --background: rgba(var(--ion-color-danger-rgb), 0.14);
  --color: var(--ion-color-danger-shade);
  margin: 0;
  font-size: 0.68rem;
  height: 1.45rem;
  font-weight: 600;
  white-space: nowrap;
  opacity: 1;
}

.risk-chip ion-icon {
  font-size: 0.78rem;
  margin-right: 3px;
}
</style>
