import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "../../../../dto/contractDTO";
import { articles } from "./articles";
import { teams } from "./teams";

function instantDaysFromNow(days: number) {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .add({ days })
    .toInstant();
}

export const contracts: ContractDTO[] = [
  new ContractDTO(
    "ctr-1",
    teams[0],
    articles[0],
    instantDaysFromNow(-8),
    Temporal.Duration.from({ days: 10 }),
    150
  ),
  new ContractDTO(
    "ctr-2",
    teams[0],
    articles[1],
    instantDaysFromNow(-20),
    Temporal.Duration.from({ days: 15 }),
    120
  ),
  new ContractDTO(
    "ctr-3",
    teams[0],
    articles[2],
    instantDaysFromNow(-15),
    Temporal.Duration.from({ days: 30 }),
    200
  ),
  new ContractDTO(
    "ctr-4",
    teams[0],
    articles[3],
    instantDaysFromNow(-4),
    Temporal.Duration.from({ days: 7 }),
    80
  ),
  new ContractDTO(
    "ctr-5",
    teams[1],
    articles[4],
    instantDaysFromNow(-20),
    Temporal.Duration.from({ days: 30 }),
    180
  ),
  new ContractDTO(
    "ctr-6",
    teams[1],
    articles[5],
    instantDaysFromNow(-13),
    Temporal.Duration.from({ days: 14 }),
    140
  ),
  new ContractDTO(
    "ctr-7",
    teams[0],
    articles[6],
    instantDaysFromNow(-5),
    Temporal.Duration.from({ days: 14 }),
    95
  ),
  new ContractDTO(
    "ctr-8",
    teams[0],
    articles[7],
    instantDaysFromNow(-9),
    Temporal.Duration.from({ days: 21 }),
    130
  ),
  new ContractDTO(
    "ctr-9",
    teams[0],
    articles[8],
    instantDaysFromNow(-3),
    Temporal.Duration.from({ days: 10 }),
    170
  ),
  new ContractDTO(
    "ctr-10",
    teams[0],
    articles[9],
    instantDaysFromNow(-11),
    Temporal.Duration.from({ days: 28 }),
    140
  ),
  new ContractDTO(
    "ctr-11",
    teams[0],
    articles[10],
    instantDaysFromNow(-2),
    Temporal.Duration.from({ days: 7 }),
    210
  ),
  new ContractDTO(
    "ctr-12",
    teams[0],
    articles[11],
    instantDaysFromNow(-6),
    Temporal.Duration.from({ days: 18 }),
    185
  ),
  new ContractDTO(
    "ctr-13",
    teams[0],
    articles[0],
    instantDaysFromNow(-1),
    Temporal.Duration.from({ days: 12 }),
    160
  ),
  new ContractDTO(
    "ctr-14",
    teams[0],
    articles[1],
    instantDaysFromNow(-7),
    Temporal.Duration.from({ days: 9 }),
    110
  ),
  new ContractDTO(
    "ctr-15",
    teams[0],
    articles[2],
    instantDaysFromNow(-14),
    Temporal.Duration.from({ days: 30 }),
    220
  ),
  // Held by teams other than player-1's own teams (team-6 in the "global"
  // league, team-7 in "europe"), on articles matching the mocked Wikimedia
  // top-read list — so the Market view has real "owned by another team" rows
  // for the default dev session, not just free agents or my own contracts.
  new ContractDTO(
    "ctr-16",
    teams[5],
    articles[12],
    instantDaysFromNow(-2),
    Temporal.Duration.from({ days: 14 }),
    240
  ),
  new ContractDTO(
    "ctr-17",
    teams[5],
    articles[13],
    instantDaysFromNow(-5),
    Temporal.Duration.from({ days: 7 }),
    190
  ),
  new ContractDTO(
    "ctr-18",
    teams[6],
    articles[14],
    instantDaysFromNow(-3),
    Temporal.Duration.from({ days: 21 }),
    260
  ),
];
