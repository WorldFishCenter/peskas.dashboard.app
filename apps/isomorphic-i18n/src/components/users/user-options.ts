// Group names as stored in Mongo; the upsert looks the group up by this name.
export const ROLES = ["Admin", "Control", "IIA", "CIA", "WBCIA", "AIA"];

export const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const statusLabel = (status: string) => STATUSES.find((s) => s.value === status)?.label ?? status;
