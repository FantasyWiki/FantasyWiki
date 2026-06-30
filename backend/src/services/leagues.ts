import { LeagueDTO } from "../../../dto/leagueDTO";
import { Domain } from "../../../model/enums";
import { League } from "../../../model";

/**
 * Map a domain League to the LeagueDTO shape returned by the API.
 * The list endpoint only needs identity + presentation, so `description` is
 * left empty and `teams` is populated by the team-scoped endpoints, not here.
 */
export function toLeagueDTO(league: League): LeagueDTO {
  return {
    id: league.id,
    title: league.name,
    description: "",
    domain: league.domain as Domain,
    icon: league.icon,
    startDate: league.startDate,
    endDate: league.endDate,
    teams: [],
  };
}
