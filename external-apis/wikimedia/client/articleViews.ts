import type { Domain } from "../../../dto/enums";
import {
    PAGEVIEWS_BASE_URL,
    fetchJsonWithRetry,
    shiftUtcDays,
    toDateParts,
} from "./internal";
import type { WikimediaHttp } from "../client";

const HISTORY_DAYS = 365;

export type ArticleViews = {
    latestDayViews: number | undefined;
    averageViews30d: number | undefined;
    weekViews: number | undefined;
    previousWeekViews: number | undefined;
    monthViews: number | undefined;
    yearViews: number | undefined;
};

type PerArticleResponse = {
    items: Array<{ views: number }>;
};

export function createResolveArticleViews(
    http: WikimediaHttp,
    retryCount: number,
    averageDays: number,
) {
    return async function resolveArticleViews(
        domain: Domain,
        title: string,
        snapshotDate: Date,
    ): Promise<ArticleViews> {
        const end = toDateParts(snapshotDate);
        const startDate = shiftUtcDays(snapshotDate, -(HISTORY_DAYS - 1));
        const start = toDateParts(startDate);
        const encodedTitle = encodeURIComponent(title).replace(/%20/g, "_");
        const url = `${PAGEVIEWS_BASE_URL}/per-article/${domain}.wikipedia/all-access/user/${encodedTitle}/daily/${start.year}${start.month}${start.day}/${end.year}${end.month}${end.day}`;

        try {
            const response = await fetchJsonWithRetry<PerArticleResponse>(
                http,
                url,
                retryCount,
            );
            const items = response.items;
            if (items.length === 0) {
                return {
                    latestDayViews: undefined,
                    averageViews30d: undefined,
                    weekViews: undefined,
                    previousWeekViews: undefined,
                    monthViews: undefined,
                    yearViews: undefined,
                };
            }

            const sum = (slice: Array<{ views: number }>) =>
                slice.reduce((acc, item) => acc + item.views, 0);

            const trailing7 = items.slice(-7);
            const previous7 = items.slice(-14, -7);
            const trailing30 = items.slice(-30);
            const trailingAvg = items.slice(-averageDays);

            return {
                latestDayViews: items[items.length - 1]?.views,
                averageViews30d: sum(trailingAvg) / trailingAvg.length,
                weekViews: sum(trailing7),
                previousWeekViews: previous7.length > 0 ? sum(previous7) : undefined,
                monthViews: sum(trailing30),
                yearViews: sum(items),
            };
        } catch {
            return {
                latestDayViews: undefined,
                averageViews30d: undefined,
                weekViews: undefined,
                previousWeekViews: undefined,
                monthViews: undefined,
                yearViews: undefined,
            };
        }
    };
}
