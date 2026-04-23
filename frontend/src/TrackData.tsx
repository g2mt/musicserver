import * as z from "zod";

export const TrackDataSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  path: z.string(),
  thumbnail_path: z.string().optional(),
});

export type TrackData = z.infer<typeof TrackDataSchema>;

export const TrackListResultSchema = z.object({
  filters: z.record(z.string()),
  limit: z.number(),
  tracks: TrackDataSchema.array(),
});

export type TrackListResult = z.infer<typeof TrackListResultSchema>;

