import { Domain } from "../../../../model/enums";

const domainIt: Domain = "it";
const domainEn: Domain = "en";
export const articles = [
  { id: "art-1", title: "Bitcoin", domain: domainIt },
  { id: "art-2", title: "Ethereum", domain: domainIt },
  { id: "art-3", title: "Intelligenza artificiale", domain: domainIt },
  { id: "art-4", title: "Apprendimento automatico", domain: domainIt },
  { id: "art-5", title: "Cloud computing", domain: domainIt },
  { id: "art-6", title: "Blockchain", domain: domainIt },
  { id: "art-7", title: "Python", domain: domainIt },
  { id: "art-8", title: "JavaScript", domain: domainIt },
  { id: "art-9", title: "React", domain: domainEn },
  { id: "art-10", title: "TypeScript", domain: domainEn },
  { id: "art-11", title: "Albert Einstein", domain: domainEn },
  { id: "art-12", title: "Artificial intelligence", domain: domainEn },
  // Owned by teams outside player-1's own teams, matching titles from the
  // mocked Wikimedia top-read list — so the Market view has real rows that
  // show as "owned by another team" (not just mine or free) for the default
  // dev session, in every league that includes a non-mine team.
  { id: "art-13", title: "GPT-4", domain: domainEn },
  { id: "art-14", title: "Quantum computing", domain: domainEn },
  { id: "art-15", title: "Neural network", domain: domainEn },
];
