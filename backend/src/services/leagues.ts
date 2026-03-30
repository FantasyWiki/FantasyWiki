import { Temporal } from '@js-temporal/polyfill'
import {League} from '../../../model'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getLeagues(user_id: string): League[] {
  return [
  {
      id: '0',
      name: "Global League",
      icon: "🌍",
      adminId: '0',
      startDate: Temporal.Now.instant(),
      endDate: Temporal.Now.instant().add({"hours": 24}),
      domain: 'en'
  },
  {
      id: '1',
      name: "Italia League",
      icon: "🌍",
      adminId: '1',
      startDate: Temporal.Now.instant().add({"hours": 24}),
      endDate: Temporal.Now.instant().add({"hours": 48}),
      domain: 'it'
  },
  ]
}
