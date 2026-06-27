import { Schema, Position } from "./enums";
import { ChemistryLevel } from "./enums";

export interface Formation {
    schema: Schema;
    positions: Partial<Record<Position, string>>; // position → articleId (canonical title)
    chemistry: Array<{ from: Position; to: Position; level: ChemistryLevel }>;
}