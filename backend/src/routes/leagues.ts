import { Hono } from "hono";
import { getLeagues } from "../services/leagues";
import { League } from "../../../model";

const leagues = new Hono();

leagues.get("/", async (c) => {
  const allLeagues: League[] = getLeagues("DUMMY_ID");
  return c.json(allLeagues);
});

leagues.get("/:id/my-team", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

leagues.get("/:id/my-contracts", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

leagues.get("/:id/my-notifications", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default leagues;
