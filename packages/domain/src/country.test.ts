import { describe, expect, test } from "vitest";
import { COUNTRY_REGISTRY, resolveCountry } from "./country";

describe("resolveCountry", () => {
  test("defaults to Zanzibar when the code is unset", () => {
    expect(resolveCountry(undefined).countryCode).toBe("TZ");
    expect(resolveCountry("").countryCode).toBe("TZ");
  });

  test("fails loudly on an unknown code instead of showing another country", () => {
    expect(() => resolveCountry("XX")).toThrow(/Unknown VITE_COUNTRY_CODE "XX"/);
  });
});

// A region or district spelled differently in two places renders "-" with no error anywhere.
describe.each(Object.entries(COUNTRY_REGISTRY))("%s registry", (code, country) => {
  const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();
  const regions = sorted(Object.values(country.districtToRegion));

  test("is filed under its own code", () => {
    expect(country.countryCode).toBe(code);
  });

  test("gives every district exactly one region", () => {
    expect(sorted(Object.keys(country.districtToRegion))).toEqual(sorted(country.districts));
  });

  test.runIf(country.features.regionBreakdown)("names the same regions in the region bars", () => {
    const breakdown = country.features.regionBreakdown!;
    expect(sorted(breakdown.regions)).toEqual(regions);
    expect(sorted(Object.keys(breakdown.colors))).toEqual(regions);
  });

  test("colours and pre-selects only its own districts", () => {
    expect(sorted(Object.keys(country.districtColors))).toEqual(sorted(country.districts));
    expect(country.districts).toEqual(expect.arrayContaining(country.defaultSelectedDistricts));
  });
});
