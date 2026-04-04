import { Hono } from "hono";
import { getLeagues } from "../services/leagues";
import { League } from "../../../model";

const leagues = new Hono();

leagues.get("/", async (c) => {
  const allLeagues: League[] = getLeagues("DUMMY_ID");
  return c.json(allLeagues);
});

export default leagues;
