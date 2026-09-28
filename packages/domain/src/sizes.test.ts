import { expect, test } from "vitest";
import {
  froeseBands,
  immatureByGear,
  maturityPosition,
  measuredSpecies,
  shareInBand,
} from "./sizes";

const classes = [
  { length_min: 10, length_max: 15, catch_kg: 1 },
  { length_min: 15, length_max: 20, catch_kg: 2 },
  { length_min: 20, length_max: 25, catch_kg: 1 },
];

test("a band's share is a range: straddling classes count only towards the most", () => {
  // Below 18 cm: 10–15 surely, 15–20 perhaps.
  expect(shareInBand(classes, { from: 0, to: 18 })).toEqual({ least: 0.25, most: 0.75 });
  // Below 20 cm: both lower classes surely.
  expect(shareInBand(classes, { from: 0, to: 20 })).toEqual({ least: 0.75, most: 0.75 });
  // The open top class lies wholly in an open band.
  expect(
    shareInBand([{ length_min: 200, length_max: null, catch_kg: 1 }], { from: 150, to: Infinity }),
  ).toEqual({
    least: 1,
    most: 1,
  });
  expect(shareInBand([], { from: 0, to: 18 })).toBeNull();
});

test("Froese's bands sit around the optimum length", () => {
  expect(froeseBands(18, 30)).toEqual({
    immature: { from: 0, to: 18 },
    optimum: { from: 27, to: 33 },
    megaspawners: { from: 33, to: Infinity },
  });
  expect(froeseBands(null, null)).toEqual({ immature: null, optimum: null, megaspawners: null });
});

test("a class is below, above, or straddles the maturity length", () => {
  expect(maturityPosition({ length_min: 10, length_max: 15 }, 18)).toBe("below");
  expect(maturityPosition({ length_min: 15, length_max: 20 }, 18)).toBe("spanning"); // midpoint 17.5, yet fish up to 20 cm
  expect(maturityPosition({ length_min: 20, length_max: 25 }, 20)).toBe("above");
  expect(maturityPosition({ length_min: 100, length_max: null }, 150)).toBe("spanning");
});

test("gears are ranked by their least immature share and thin gears are left out", () => {
  const measured = [
    { taxon: "A", gear: "net", classes, trips: 6 },
    {
      taxon: "A",
      gear: "net",
      classes: [{ length_min: 30, length_max: 40, catch_kg: 4 }],
      trips: 6,
    },
    { taxon: "A", gear: "line", classes, trips: 3 }, // too few measured trips
    { taxon: "B", gear: "net", classes, trips: 50 }, // no maturity length
  ];
  expect(immatureByGear(measured, { A: 18 })).toEqual([
    { gear: "net", least: 1 / 8, most: 3 / 8, trips: 12 },
  ]);
});

test("a species' classes add up over its gears; species measured on too few landings are left out", () => {
  const measured = [
    { taxon: "A", gear: "net", classes, trips: 6 },
    {
      taxon: "A",
      gear: "line",
      classes: [{ length_min: 15, length_max: 20, catch_kg: 3 }],
      trips: 6,
    },
    { taxon: "B", gear: "net", classes, trips: 3 },
  ];
  expect(measuredSpecies(measured, { A: 18 }, {})).toEqual([
    {
      taxon: "A",
      trips: 12,
      catch_kg: 7,
      maturity: 18,
      optimum: undefined,
      classes: [
        { length_min: 10, length_max: 15, catch_kg: 1 },
        { length_min: 15, length_max: 20, catch_kg: 5 },
        { length_min: 20, length_max: 25, catch_kg: 1 },
      ],
    },
  ]);
});
