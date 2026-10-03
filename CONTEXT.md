# Peskas dashboard

A public fisheries portal for one country per deployment. It shows the monthly summaries of small-scale fishing activity that `peskas.coasts` computes from landing surveys.

## Language

### Place

**Country**:
The single place a deployment serves (Zanzibar, Kenya or Mozambique). It fixes the districts, regions, currency and languages the portal shows.
_Avoid_: site, tenant

**District**:
An administrative area at GAUL level 2, identified by its official GAUL2 name. It is the finest unit the summaries are broken down by.
_Avoid_: gaul2, area, BMU

**Region**:
A grouping of districts the dashboard defines per country for the home page (for example Pemba and Unguja in Zanzibar). It is not GAUL level 1.
_Avoid_: province, gaul1, zone

**Analysis page**:
A page that charts the district selection over the time range: catch, revenue, species and sizes, gear, and vulnerable species. Catch and revenue also let the viewer pick a metric, each remembering its own choice.
_Avoid_: data page, detail page

**District selection**:
The districts a viewer picked in the page's district filter, kept in the page address. The analysis pages follow it; the home page always covers every district of the country.
_Avoid_: filter, selected districts

### Measures

**Metric**:
A named measure that coasts computes for each district and month, such as mean CPUE or estimated catch. Taxa and gear summaries carry their own metrics.
_Avoid_: indicator, KPI

**Total metric**:
A metric that adds up: combining months or districts sums it (catch, revenue, submissions).
_Avoid_: sum metric, aggregated metric

**Average metric**:
A metric that is a rate or a mean: combining months or districts averages it, weighted by the landings behind each value (CPUE, RPUE, catch and revenue per trip, price per kg, trip duration, crew size).
_Avoid_: mean metric

**Taxon**:
A kind of catch the taxa summaries report catch, length and price for, usually a species. Screens call taxa "species".
_Avoid_: catch taxon, fish

**Crew size**:
The mean number of fishers on a surveyed trip (`n_fishers`). It is not the number of fishers in a district; months and districts average it.
_Avoid_: fisher count, number of fishers

**Recorded figure**:
A value measured on the surveyed landings themselves: catch per trip, rates, prices, catch by species.
_Avoid_: actual, observed

**Estimated figure**:
A total scaled up from the surveyed landings to all the boats of a district (estimated trips, catch, revenue), by the **GPS tracker method** or the **FAO ARTFISH method**; the dashboard shows both side by side, every figure rounded to two significant figures. Its **estimate confidence** (GPS tracker method) comes from the share of the district's boats tracked (`sampling_rate`): high from 30%, medium from 10%, low below. A district and month with fewer than ten surveyed landings has no estimated catch or revenue (coasts >= 4.19.0).
_Avoid_: total, modelled

**GPS tracker method**:
Registered boats × trips per GPS-tracked boat × catch per surveyed landing, per district and month: how often boats fish comes from the boats that carry a tracker. Short form: Tracker.
_Avoid_: current method, Peskas method

**FAO ARTFISH method**:
FAO's standard way of raising a landing survey to the fleet, published beside the GPS tracker method: boats in the census × days fished, as fishers report them × catch per surveyed landing, by gear or boat type. It needs no trackers, so it also estimates districts and months without tracked boats. Its metrics end in `_fao`; the summaries don't carry its precision, so its figures never show a change on a year earlier. Short form: ARTFISH.
_Avoid_: FAO way, sample-survey method

**Shared district-months**:
The district-months both methods estimate. The totals and trend lines of an estimate add up only these, so the two methods compare like with like; where the two share none of the selection, each shows its own. A district's own figures follow the same rule over its months, and its panel draws every month each method estimates.
_Avoid_: overlap, matched cells

**Landing**:
A boat's return to shore with its catch, as an enumerator records it. The count of landings behind a value (`n_submissions`) weights averages and flags thin data (fewer than 10).
_Avoid_: submission (in screens), trip record

**Taxon traits**:
What FishBase and SeaLifeBase say about a taxon code (`taxa_traits`): vulnerability to fishing (0–100, grouped in quarters), trophic level, IUCN and CITES status, class, and, for a code that is one species, its length at maturity. A code spanning several species carries the median and range.
_Avoid_: species info, metadata

**Length class**:
The size band a catch row is recorded in (`length_min` to `length_max`, cm). Countries store a class by its midpoint, so the summaries re-bin every value into one shared set of classes. In Kenya a catch row carries the average length of the fish measured on that landing (`survey.meanLengths`), so its classes hold landings' averages and the size views say so.
_Avoid_: length bin, size

**Length at maturity**:
The total length at which a species first reproduces (FishBase `maturity`, restated to total length).
_Avoid_: Lm (in screens), minimum size

**Optimum length**:
The total length at which a year-class of a species reaches its greatest total weight, from its asymptotic length in FishBase (Froese & Binohlan 2000). Within 10% of it a fish is at optimum length; beyond, a large spawner. Kept only when at or above the length at maturity: below it, FishBase's growth and maturity studies disagree.
_Avoid_: Lopt (in screens)

**Size band share**:
The share of a species' measured catch below maturity, at optimum length or as large spawners (Froese 2004). Length classes straddling a band's edge could hold fish on either side, so each share is a range: the least counts only classes wholly inside the band, the most every class that overlaps it.
_Avoid_: percentage mature, Pmat

### Time

**Month window**:
The span of months a view covers: the last N complete months, or all of them. The current month is left out while its landings come in, so it never reads as a drop. Summaries are monthly, so a window always covers whole months.
_Avoid_: date range, period

**Same months a year earlier**:
The comparison for a figure: its month window moved back twelve months.
_Avoid_: previous period, last year

**Portal summary**:
One of the collections that `peskas.coasts` writes for the dashboard: monthly, taxa, district, gear, grid and length summaries, and taxa traits. The dashboard only reads them.
_Avoid_: dataset, stats
