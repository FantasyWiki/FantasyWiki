import type { LanguageScale } from "../../../../model/languageScale";
import type { LanguageScaleRepository } from "../languageScaleRepository";
import { Result, success, failure } from "../result";

/** A `language_scales` row as SQLite hands it back. */
interface LanguageScaleRow {
  domain: string;
  scale: number;
  measuredAt: string;
  qualifyingRanks: number;
  sampleSize: number;
  referenceDomain: string;
}

export class LanguageScaleRepositoryD1 implements LanguageScaleRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getByDomain(domain: string): Promise<Result<LanguageScale | null>> {
    try {
      const row = await this.db
        .prepare(
          `SELECT domain, scale, measuredAt, qualifyingRanks, sampleSize, referenceDomain
             FROM language_scales WHERE domain = ?`,
        )
        .bind(domain)
        .first<LanguageScaleRow>();
      return success(row ?? null);
    } catch (error) {
      return failure(
        `Error fetching language scale: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async save(scale: LanguageScale): Promise<Result<void>> {
    try {
      // OR IGNORE, not an upsert: a stored factor is never overwritten, because
      // doing so re-rates every contract already priced in that edition (ADR
      // 0002). See `LanguageScaleRepository.save`.
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO language_scales
             (domain, scale, measuredAt, qualifyingRanks, sampleSize, referenceDomain)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          scale.domain,
          scale.scale,
          scale.measuredAt,
          scale.qualifyingRanks,
          scale.sampleSize,
          scale.referenceDomain,
        )
        .run();
      return success(undefined);
    } catch (error) {
      return failure(
        `Error saving language scale: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
