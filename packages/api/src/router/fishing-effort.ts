import { getPortalDb } from "@repo/nosql";
import { getPdsEffortModel, getPdsFishingGroundsModel } from "@repo/nosql/schema/pds-effort";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { activeCountry } from "../lib/country";

/**
 * Where tracked boats fish, as the coasts portal shows it: H3 cells and the
 * fishing grounds they form, all years pooled, this country only.
 */
export const fishingEffortRouter = createTRPCRouter({
  cells: publicProcedure.query(async () => {
    const Model = getPdsEffortModel(await getPortalDb());
    return Model.find({ country: activeCountry().countryName })
      .select({ _id: 0, lng: 1, lat: 1, avg_hours_per_day: 1, unique_trips: 1 })
      .lean();
  }),

  grounds: publicProcedure.query(async () => {
    const Model = getPdsFishingGroundsModel(await getPortalDb());
    const docs = await Model.find({ country: activeCountry().countryName })
      .select({ _id: 0, geometry: 1, avg_hours_per_day: 1, unique_trips: 1 })
      .lean();
    return {
      type: "FeatureCollection" as const,
      features: docs.map(({ geometry, ...properties }) => ({
        type: "Feature" as const,
        geometry,
        properties,
      })),
    };
  }),
});
