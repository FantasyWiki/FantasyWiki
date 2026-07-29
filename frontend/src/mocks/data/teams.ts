import type { TeamDTO } from "../../../../dto/teamDTO";
import { players } from "./players";

const coreTeams: TeamDTO[] = [
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

/**
 * Rivals that exist only to give the Global League a table deep enough for the
 * standings card to window: with these it runs 12 deep and the current player
 * sits 5th, so the card pins the leader and marks the skipped rank.
 *
 * Named rather than sliced off `teams` by index, so appending a team for some
 * other league can't silently enrol it in the Global League. None of these
 * belong to `currentPlayerId` — that would shadow the real team in getMyTeam.
 */
export const globalFillerTeams: TeamDTO[] = [
  {
    id: "team-9",
    name: "Byte Brigade",
    player: players[1],
    credits: 720,
  },
  {
    id: "team-10",
    name: "Cache Kings",
    player: players[2],
    credits: 640,
  },
  {
    id: "team-11",
    name: "Redirect Rebels",
    player: players[3],
    credits: 510,
  },
  {
    id: "team-12",
    name: "Stub Squad",
    player: players[4],
    credits: 470,
  },
  {
    id: "team-13",
    name: "Edit Warriors",
    player: players[5],
    credits: 410,
  },
  {
    id: "team-14",
    name: "Talk Page Titans",
    player: players[1],
    credits: 360,
  },
  {
    id: "team-15",
    name: "Citation Nation",
    player: players[2],
    credits: 300,
  },
  {
    id: "team-16",
    name: "Notable Nine",
    player: players[3],
    credits: 260,
  },
  {
    id: "team-17",
    name: "Disambiguators",
    player: players[4],
    credits: 180,
  },
  {
    id: "team-18",
    name: "Red Link Rovers",
    player: players[5],
    credits: 90,
  },
];

export const teams: TeamDTO[] = [...coreTeams, ...globalFillerTeams];
