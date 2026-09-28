import mongoose from "mongoose";

const GridSummarySchema = new mongoose.Schema(
  {
    lat_grid_1km: { type: Number, required: true },
    lng_grid_1km: { type: Number, required: true },
    avg_speed: { type: Number },
    avg_range: { type: Number },
    total_visits: { type: Number },
    original_cells: { type: Number },
    total_points: { type: Number },
    avg_time_hours: { type: Number },
    timestamp: { type: Date },
  },
  { collection: "grid_summaries" },
);

export const GridSummaryModel =
  mongoose.models.GridSummary || mongoose.model("GridSummary", GridSummarySchema);
