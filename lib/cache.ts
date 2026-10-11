import { updateTag } from "next/cache";

/** Server actions that change a workplace (category, slugs, operator, claim, a new workplace):
 *  location, company, city/category hub, search and job pages that show it expire now, and the
 *  next request waits for fresh data instead of getting the old page once ("max" would). */
export function expireWorkplaces(extra: string[] = []) {
  for (const tag of ["locations", "jobs", ...extra]) updateTag(tag);
}
