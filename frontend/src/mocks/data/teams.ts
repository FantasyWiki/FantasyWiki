import type { TeamDTO } from "../../../../dto/teamDTO";
import { players } from "./players";

export const teams: TeamDTO[] = [
  {
    id: "team-1",
    name: "I Cesarini",
    player: players[0],
    credits: 550,
  },
  {
    id: "team-2",
    name: "Global Warriors",
    player: players[0],
    credits: 800,
  },
  {
    id: "team-3",
    name: "Euro Champions",
    player: players[0],
    credits: 320,
  },
  {
    id: "team-4",
    name: "Wiki Masters",
    player: players[1],
    credits: 200,
  },
  {
    id: "team-5",
    name: "Data Lords",
    player: players[2],
    credits: 450,
  },
  {
    id: "team-6",
    name: "Wiki Warriors",
    player: players[3],
    credits: 600,
  },
  {
    id: "team-7",
    name: "Data Dynamos",
    player: players[4],
    credits: 380,
  },
  {
    id: "team-8",
    name: "Page Pioneers",
    player: players[5],
    credits: 290,
  },
];
