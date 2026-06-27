import {Temporal} from "@js-temporal/polyfill";
import {Formation} from "./formation";

export interface Performance {
    teamId: string;
    date: Temporal.PlainDate;
    formation: Formation;
    points: number;
}