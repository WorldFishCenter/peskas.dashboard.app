import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import { getPortalDb } from "@repo/nosql";
import { createCallerFactory } from "../trpc";
import { fishingEffortRouter } from "./fishing-effort";

const effort = createCallerFactory(fishingEffortRouter)({});

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI_COASTS = mongod.getUri();
  process.env.VITE_COUNTRY_CODE = "TZ";
  const db = (await getPortalDb()).db!;

  // The coasts collections hold every country, plus coasts' metadata document.
  const cell = (country: string) => ({
    h3_index: `89-${country}`,
    country,
    unique_trips: 5,
    avg_hours_per_day: 0.4,
    lng: 39.2,
    lat: -6.1,
  });
  await db
    .collection("pds_effort")
    .insertMany([
      { type: ["metadata"], timestamp: [new Date()] },
      cell("Zanzibar"),
      cell("Tanzania"),
      cell("Kenya"),
    ]);
  const ground = (country: string) => ({
    ground_id: `FG-${country}`,
    country,
    unique_trips: 40,
    avg_hours_per_day: 0.7,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [39, -6],
          [39.1, -6],
          [39.1, -6.1],
          [39, -6],
        ],
      ],
    },
  });
  await db.collection("pds_fishing_grounds").insertMany([ground("Zanzibar"), ground("Tanzania")]);
});

afterAll(async () => {
  await (await getPortalDb()).close();
  await mongod.stop();
});

test("a dashboard gets only its own country's effort cells and grounds", async () => {
  expect(await effort.cells()).toEqual([
    { unique_trips: 5, avg_hours_per_day: 0.4, lng: 39.2, lat: -6.1 },
  ]);

  const grounds = await effort.grounds();
  expect(grounds.features).toHaveLength(1);
  expect(grounds.features[0]).toMatchObject({
    type: "Feature",
    geometry: { type: "Polygon" },
    properties: { unique_trips: 40, avg_hours_per_day: 0.7 },
  });
});
