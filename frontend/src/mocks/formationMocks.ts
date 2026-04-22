import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "../../../dto/contractDTO";
import type { ArticleDTO } from "../../../dto/articleDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import {
  createDraftFormation,
  createFormation,
  type DraftFormationDTO,
  type FormationDTO,
} from "../../../dto/formationDTO";

const mockTeam: TeamDTO = {
  id: "team-mock-1",
  name: "Mock Formation FC",
  credits: 999,
  points: 1234,
  player: {
    id: "player-mock-1",
    name: "MockManager",
  },
};

const formationArticles: ArticleDTO[] = [
  { id: "art-gk", title: "Goalkeeper", domain: "itwiki" },
  { id: "art-rb", title: "Right Back", domain: "itwiki" },
  { id: "art-crb", title: "Center Back Right", domain: "itwiki" },
  { id: "art-clb", title: "Center Back Left", domain: "itwiki" },
  { id: "art-lb", title: "Left Back", domain: "itwiki" },
  { id: "art-crm", title: "Right Midfield", domain: "itwiki" },
  { id: "art-cm", title: "Central Midfield", domain: "itwiki" },
  { id: "art-clm", title: "Left Midfield", domain: "itwiki" },
  { id: "art-rw", title: "Right Wing", domain: "itwiki" },
  { id: "art-st", title: "Striker", domain: "itwiki" },
  { id: "art-lw", title: "Left Wing", domain: "itwiki" },
];

function instantDaysAgo(days: number): Temporal.Instant {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .add({ days: -days })
    .toInstant();
}

function buildContract(id: string, article: ArticleDTO, daysAgo: number): ContractDTO {
  return new ContractDTO(
    id,
    mockTeam,
    article,
    instantDaysAgo(daysAgo),
    Temporal.Duration.from({ days: 14 }),
    100 + daysAgo * 3
  );
}

const contractsByPosition = {
  GK: buildContract("ctr-gk", formationArticles[0], 3),
  RB: buildContract("ctr-rb", formationArticles[1], 8),
  CRB: buildContract("ctr-crb", formationArticles[2], 2),
  CLB: buildContract("ctr-clb", formationArticles[3], 10),
  LB: buildContract("ctr-lb", formationArticles[4], 6),
  CRM: buildContract("ctr-crm", formationArticles[5], 5),
  CM: buildContract("ctr-cm", formationArticles[6], 9),
  CLM: buildContract("ctr-clm", formationArticles[7], 7),
  RW: buildContract("ctr-rw", formationArticles[8], 4),
  ST: buildContract("ctr-st", formationArticles[9], 1),
  LW: buildContract("ctr-lw", formationArticles[10], 11),
} as const;

/** Complete 4-3-3 formation with all required positions filled. */
export const mockFullFormation433: FormationDTO<"4-3-3"> = createFormation("4-3-3", {
  LW: contractsByPosition.LW,
  ST: contractsByPosition.ST,
  RW: contractsByPosition.RW,
  CLM: contractsByPosition.CLM,
  CM: contractsByPosition.CM,
  CRM: contractsByPosition.CRM,
  LB: contractsByPosition.LB,
  CLB: contractsByPosition.CLB,
  CRB: contractsByPosition.CRB,
  RB: contractsByPosition.RB,
  GK: contractsByPosition.GK,
});

/** Draft 4-3-3 formation with missing slots to preview empty positions in TeamFormation. */
export const mockDraftFormation433: DraftFormationDTO<"4-3-3"> = createDraftFormation(
  "4-3-3",
  {
    LW: contractsByPosition.LW,
    ST: contractsByPosition.ST,
    CM: contractsByPosition.CM,
    LB: contractsByPosition.LB,
    CLB: contractsByPosition.CLB,
    GK: contractsByPosition.GK,
  }
);

