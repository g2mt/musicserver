import { type Dispatch, type SetStateAction } from "react";
import * as z from "zod";
import type { AudioState } from "./AudioState";

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

export const TrackQueueSchema = z.object({
  enqueuedTracks: z.array(TrackDataSchema).default([]),
});

export type TrackQueueData = z.infer<typeof TrackQueueSchema>;

export interface TrackQueue extends TrackQueueData {
  enqueuedTrackIndex: number | null;
  setEnqueuedTracks: Dispatch<SetStateAction<TrackData[]>>;
  enqueueTrack: (track: TrackData | TrackData[]) => void;
  unqueueTrack: (index?: number) => void;
  setEnqueuedTrackIndex: Dispatch<SetStateAction<number | null>>;
  goNextQueue: () => void;
}
