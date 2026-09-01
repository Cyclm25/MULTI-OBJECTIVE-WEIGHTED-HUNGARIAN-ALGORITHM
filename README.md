# MULTI-OBJECTIVE-WEIGHTED-HUNGARIAN-ALGORITHM

## Allocation Lab Data Flow

The uploaded CSV is the source of truth. The sample CSV is for development only and the app should work with a replacement Barangay dataset without source-code changes.

Preferred household columns:

```csv
household,address,urgency,compatible_resource,verification
```

The importer also recognizes common equivalents such as `Household No.`, `Household ID`, `Residential Address`, `Primary Need`, `Resource Requirement`, and `Verification Status`. If a mapping is missing or ambiguous, the Dataset page asks the researcher to select columns before validation.

Latitude and longitude are not required input fields. If provided, they are treated as already resolved location data. If absent, the app geocodes addresses through an OpenStreetMap-compatible Nominatim flow, stores results in a local browser cache, and reports unresolved addresses instead of fabricating coordinates.

Algorithm methodology:

- Standard / Existing Hungarian: distance only.
- Enhanced Hungarian: distance + urgency + resource compatibility using the fixed research weights.

Verification is preprocessing eligibility, not an optimization weight. Pending households can remain visible on maps but are not included in algorithm assignment until verified.
