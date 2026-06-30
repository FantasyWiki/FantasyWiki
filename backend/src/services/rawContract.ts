import { Contract } from "../../../model";
import { Domain } from "../../../model/enums";
import { RawContract } from "../../../dto/contractDTO";

export function toRawContract(
  contract: Contract,
  team: { id: string; name: string; credits: number },
  player: { id: string; name: string },
  domain: Domain,
): RawContract {
  const days = Math.max(
    0,
    contract.purchaseDate.until(contract.expireDate).days,
  );
  return {
    id: contract.id,
    team: {
      id: team.id,
      name: team.name,
      credits: team.credits,
      player,
    },
    article: {
      id: contract.articleId,
      title: contract.articleId,
      domain,
    },
    startDate: `${contract.purchaseDate.toString()}T00:00:00Z`,
    duration: `P${days}D`,
    purchasePrice: contract.purchasePrice,
  };
}
