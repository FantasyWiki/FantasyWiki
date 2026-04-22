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
];




