/**
 * Registers the Peskas dashboard's GA4 custom definitions across every country
 * property and the roll-up.
 *
 * GA4 has no import, copy, or bulk-create action for custom definitions, and they
 * are not shared between properties, so the same list has to exist in each one.
 * This script does that through the Admin API instead of by hand.
 *
 * Setup (about two minutes):
 *   1. Open script.google.com and create a new project.
 *   2. Services -> add "Google Analytics Admin API". Leave the identifier as
 *      AnalyticsAdmin.
 *   3. Paste this file in, then run listProperties() and authorise when prompted.
 *      It logs the numeric property ID and measurement ID of everything you can
 *      administer, so you can match each property to the right country.
 *   4. Fill in the propertyId values in PROPERTIES below.
 *   5. Run createDefinitions(). It prints a plan while DRY_RUN is true; set
 *      DRY_RUN to false to actually create them.
 *
 * Requires Editor or Administrator on each property. Re-running is safe:
 * anything already present is matched by parameter name and skipped, and nothing
 * is ever modified or deleted.
 *
 * Keep the parameterName values in step with trackEvent() call sites in
 * src/lib/analytics.ts. See ANALYTICS.md for the event reference.
 */

/** While true, log what would be created without writing anything. */
const DRY_RUN = true;

/**
 * Target properties.
 *
 * propertyId is the numeric GA4 property ID, for example '498765432' — not the
 * G-XXXXXXXXXX measurement ID, which identifies a data stream inside a property.
 * Run listProperties() to get the numbers.
 *
 * peskas_country and peskas_country_code are constant inside a single-country
 * property, so includeDeploymentParams is only worth enabling on the roll-up,
 * where all three countries are mixed together.
 */
const PROPERTIES = [
  { label: 'Zanzibar', propertyId: '547237501', includeDeploymentParams: false },
  { label: 'Kenya', propertyId: '547285618', includeDeploymentParams: false },
  { label: 'Mozambique', propertyId: '547282994', includeDeploymentParams: false },
  // The roll-up is the property holding G-R8LTN94QRZ. Run listProperties() and
  // read the measurement ID column to identify it.
  { label: 'Roll-up', propertyId: '', includeDeploymentParams: true },
];

/**
 * Event-scoped custom dimensions.
 *
 * displayName may only contain letters, digits, spaces and underscores, and must
 * start with a letter — punctuation such as brackets is rejected by the API.
 * parameterName is immutable once created: a typo has to be archived in the UI
 * and recreated rather than renamed.
 */
const DIMENSIONS = [
  {
    parameterName: 'peskas_country',
    displayName: 'Deployment country',
    description: 'Which country dashboard sent the event, not the visitor location',
    deploymentWide: true,
  },
  {
    parameterName: 'peskas_country_code',
    displayName: 'Deployment country code',
    description: 'ISO code of the country dashboard that sent the event',
    deploymentWide: true,
  },
  {
    parameterName: 'time_range',
    displayName: 'Time range',
    description: 'Months of data selected in the header time range control',
  },
  {
    parameterName: 'metric',
    displayName: 'Metric',
    description: 'Metric key selected by the user',
  },
  {
    parameterName: 'control_source',
    displayName: 'Metric control',
    description: 'Which control changed the metric: header or district_widget',
  },
  {
    parameterName: 'action',
    displayName: 'District action',
    description: 'How the district selection changed: add, remove, clear or a region action',
  },
  {
    parameterName: 'district',
    displayName: 'District',
    description: 'District added or removed, absent on clear and region actions',
  },
  {
    parameterName: 'peskas_region',
    displayName: 'Fisheries region',
    description: 'Fisheries region on region actions, distinct from GA4 geographic Region',
  },
  {
    parameterName: 'basemap',
    displayName: 'Basemap',
    description: 'Grid map basemap chosen: satellite or map',
  },
  {
    parameterName: 'effort_range',
    displayName: 'Effort range',
    description: 'Fishing effort band toggled in the map info panel',
  },
  {
    parameterName: 'enabled',
    displayName: 'Effort range enabled',
    description: 'Whether the toggled effort band was switched on or off',
  },
  {
    parameterName: 'chart',
    displayName: 'Chart',
    description: 'Chart whose explanation was opened or whose data was downloaded',
  },
];

/** Numeric parameters. These are custom metrics, not dimensions. */
const METRICS = [
  {
    parameterName: 'district_count',
    displayName: 'Districts selected',
    description: 'Number of districts selected after the filter change',
    measurementUnit: 'STANDARD',
  },
];

/**
 * Logs every property you can administer, with its measurement IDs, so the
 * PROPERTIES config above can be filled in confidently.
 */
function listProperties() {
  const properties = propertySummaries();

  if (properties.length === 0) {
    console.log('No GA4 properties are visible to this Google account.');
    console.log('Check that you are signed in as the account holding Analytics access.');
    return;
  }

  console.log('propertyId  name  account  [measurement IDs]');
  properties.forEach(function (property) {
    console.log(
      '  ' +
        property.propertyId +
        '  ' +
        property.displayName +
        '  (' +
        property.account +
        ')  [' +
        measurementIdsFor('properties/' + property.propertyId) +
        ']'
    );
  });
}

/**
 * Every property visible to the authorised account. Used both for reporting and
 * to check the configured IDs before any write is attempted.
 */
function propertySummaries() {
  const properties = [];
  let pageToken = null;

  do {
    const options = { pageSize: 200 };
    if (pageToken) {
      options.pageToken = pageToken;
    }

    const response = AnalyticsAdmin.AccountSummaries.list(options);

    (response.accountSummaries || []).forEach(function (account) {
      (account.propertySummaries || []).forEach(function (summary) {
        properties.push({
          propertyId: summary.property.split('/')[1],
          displayName: summary.displayName,
          account: account.displayName,
        });
      });
    });

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return properties;
}

function measurementIdsFor(parent) {
  try {
    const streams = AnalyticsAdmin.Properties.DataStreams.list(parent, { pageSize: 50 });
    const ids = (streams.dataStreams || [])
      .map(function (stream) {
        return stream.webStreamData ? stream.webStreamData.measurementId : null;
      })
      .filter(function (id) {
        return Boolean(id);
      });
    return ids.length > 0 ? ids.join(', ') : 'no web stream';
  } catch (error) {
    return 'streams unreadable';
  }
}

/** Creates every missing definition in each configured property. */
function createDefinitions() {
  if (DRY_RUN) {
    console.log('DRY_RUN is true: nothing will be written. Set it to false to apply.');
  }

  const configured = PROPERTIES.filter(function (target) {
    return String(target.propertyId).trim() !== '';
  });

  if (configured.length === 0) {
    console.log('No propertyId values set. Run listProperties() first.');
    return;
  }

  const invalid = configured.filter(function (target) {
    return !/^\d+$/.test(String(target.propertyId).trim());
  });

  if (invalid.length > 0) {
    invalid.forEach(function (target) {
      const value = String(target.propertyId).trim();
      const reason =
        value.indexOf('G-') === 0
          ? 'that is a measurement ID, which identifies a data stream rather than a property'
          : 'property IDs contain digits only';
      console.log('Invalid propertyId for ' + target.label + ': "' + value + '" - ' + reason + '.');
    });
    console.log('Run listProperties() and copy the numeric ID from the first column.');
    return;
  }

  // A stream ID is numeric too, so it passes the check above and then fails at the
  // API as a permission error. Comparing against the visible properties first turns
  // that into something readable.
  const visible = {};
  propertySummaries().forEach(function (property) {
    visible[property.propertyId] = property.displayName;
  });

  const unreachable = configured.filter(function (target) {
    return !visible[String(target.propertyId).trim()];
  });

  if (unreachable.length > 0) {
    unreachable.forEach(function (target) {
      console.log(
        'Cannot reach ' +
          target.label +
          ' (' +
          String(target.propertyId).trim() +
          '): not a property this account can see. Common causes are using a stream ID ' +
          'instead of a property ID, or being signed in as the wrong Google account.'
      );
    });
    console.log('Properties this account can see:');
    Object.keys(visible).forEach(function (id) {
      console.log('  ' + id + '  ' + visible[id]);
    });
    console.log('Nothing was written. Fix the IDs, or blank one out to skip it.');
    return;
  }

  configured.forEach(function (target) {
    const propertyId = String(target.propertyId).trim();
    const parent = 'properties/' + propertyId;
    // Print the property's real name so a mis-pasted ID is obvious in the dry run.
    console.log('--- ' + target.label + ' -> ' + parent + ' "' + visible[propertyId] + '" ---');

    const wanted = DIMENSIONS.filter(function (dimension) {
      return target.includeDeploymentParams || !dimension.deploymentWide;
    });

    syncDimensions(parent, wanted);
    syncMetrics(parent, METRICS);
  });
}

function syncDimensions(parent, wanted) {
  const existing = existingParameterNames(parent, 'dimension');

  wanted.forEach(function (dimension) {
    if (existing[dimension.parameterName]) {
      console.log('  skip     ' + dimension.parameterName + ' (already present)');
      return;
    }
    if (DRY_RUN) {
      console.log('  would create dimension ' + dimension.parameterName);
      return;
    }
    try {
      AnalyticsAdmin.Properties.CustomDimensions.create(
        {
          parameterName: dimension.parameterName,
          displayName: dimension.displayName,
          description: dimension.description,
          scope: 'EVENT',
        },
        parent
      );
      console.log('  created  ' + dimension.parameterName);
    } catch (error) {
      console.log('  FAILED   ' + dimension.parameterName + ': ' + error.message);
    }
  });
}

function syncMetrics(parent, wanted) {
  const existing = existingParameterNames(parent, 'metric');

  wanted.forEach(function (metric) {
    if (existing[metric.parameterName]) {
      console.log('  skip     ' + metric.parameterName + ' (already present)');
      return;
    }
    if (DRY_RUN) {
      console.log('  would create metric ' + metric.parameterName);
      return;
    }
    try {
      AnalyticsAdmin.Properties.CustomMetrics.create(
        {
          parameterName: metric.parameterName,
          displayName: metric.displayName,
          description: metric.description,
          scope: 'EVENT',
          measurementUnit: metric.measurementUnit,
        },
        parent
      );
      console.log('  created  ' + metric.parameterName);
    } catch (error) {
      console.log('  FAILED   ' + metric.parameterName + ': ' + error.message);
    }
  });
}

function existingParameterNames(parent, kind) {
  const found = {};
  let pageToken = null;

  do {
    const options = { pageSize: 200 };
    if (pageToken) {
      options.pageToken = pageToken;
    }

    const response =
      kind === 'dimension'
        ? AnalyticsAdmin.Properties.CustomDimensions.list(parent, options)
        : AnalyticsAdmin.Properties.CustomMetrics.list(parent, options);

    const items = (kind === 'dimension' ? response.customDimensions : response.customMetrics) || [];
    items.forEach(function (item) {
      found[item.parameterName] = true;
    });

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return found;
}
