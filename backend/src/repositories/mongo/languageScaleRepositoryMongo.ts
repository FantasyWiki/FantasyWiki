import type { LanguageScale } from "../../../../model/languageScale";
import type { LanguageScaleRepository } from "../languageScaleRepository";
import { Result, success, failure } from "../result";
import { errorMessage } from "./connection";
import type { MongoStore } from "./store";

export class LanguageScaleRepositoryMongo implements LanguageScaleRepository {
  constructor(private readonly store: MongoStore) {}

  async getByDomain(domain: string): Promise<Result<LanguageScale | null>> {
    try {
      const { languageScales } = await this.store.collections();
      const doc = await languageScales.findOne({ _id: domain });
      if (!doc) return success(null);
      return success({
        domain: doc._id,
        scale: doc.scale,
        measuredAt: doc.measuredAt,
        qualifyingRanks: doc.qualifyingRanks,
        sampleSize: doc.sampleSize,
        referenceDomain: doc.referenceDomain,
      });
    } catch (error) {
      return failure(`Error fetching language scale: ${errorMessage(error)}`);
    }
  }

  async save(scale: LanguageScale): Promise<Result<void>> {
    try {
      const { languageScales } = await this.store.collections();
      // Insert-if-absent, not an upsert: overwriting a stored factor re-rates
      // every contract already priced in that edition (ADR 0002). Two
      // first-time calibrations racing measured the same window anyway, so the
      // loser keeping the winner's value costs nothing.
      await languageScales.updateOne(
        { _id: scale.domain },
        {
          $setOnInsert: {
            scale: scale.scale,
            measuredAt: scale.measuredAt,
            qualifyingRanks: scale.qualifyingRanks,
            sampleSize: scale.sampleSize,
            referenceDomain: scale.referenceDomain,
          },
        },
        { upsert: true },
      );
      return success(undefined);
    } catch (error) {
      return failure(`Error saving language scale: ${errorMessage(error)}`);
    }
  }
}
