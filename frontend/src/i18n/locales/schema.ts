// Translation type schema. en.json is the schema of record; this re-creates the
// compile-time completeness guarantee that the old typed `it.ts` gave us now
// that the catalogs are JSON (which the i18n lint tooling can read).
import en from "./en.json";
import it from "./it.json";

export type MessageSchema = typeof en;

// it.json must satisfy the English schema — a missing key is a build error.
const _itParity: MessageSchema = it;
void _itParity;
