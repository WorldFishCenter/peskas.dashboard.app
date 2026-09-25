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
A page that charts the district selection over the time range: catch, revenue and catch composition. Catch and revenue also let the viewer pick a metric, each remembering its own choice.
_Avoid_: data page, detail page

**District selection**:
The districts a viewer picked in the header filter. The analysis pages (catch, revenue, catch composition) follow it; the home page always covers every district of the country.
_Avoid_: filter, selected districts

### Measures

**Metric**:
A named measure that coasts computes for each district and month, such as mean CPUE or estimated catch. Taxa and gear summaries carry their own metrics.
_Avoid_: indicator, KPI

**Total metric**:
A metric that adds up: combining months or districts sums it (catch, revenue, submissions).
_Avoid_: sum metric, aggregated metric

**Average metric**:
A metric that is a rate or a mean: combining months or districts averages it, unweighted (CPUE, RPUE, price per kg, trip duration).
_Avoid_: mean metric

**Taxon**:
A kind of catch the taxa summaries report catch, length and price for, usually a species. Screens call taxa "species".
_Avoid_: catch taxon, fish

**Fisher count**:
The number of active fishers. Across months it is averaged (fishers in a typical month); across districts it is summed.
_Avoid_: n_fishers

### Time

**Month window**:
The span of months a view covers: the last N months, or all time. Summaries are monthly, so a window always covers whole months.
_Avoid_: date range, period

**Portal summary**:
One of the collections that `peskas.coasts` writes for the dashboard: monthly, taxa, district, gear and grid summaries. The dashboard only reads them.
_Avoid_: dataset, stats
