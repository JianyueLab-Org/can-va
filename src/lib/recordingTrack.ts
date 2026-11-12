export interface TrackPoint {
  latitude: number;
  longitude: number;
  move: boolean;
}
export interface TrackPreview {
  points: TrackPoint[];
  sampleCount: number;
  sampled: boolean;
}
export class TrackError extends Error {}

const MAX_POINTS = 4096;
const MAX_SAMPLES = 300000;
const MAX_BYTES = 97 * 1024 * 1024;
const MAX_LINE = 256 * 1024;

/** Reads NDJSON incrementally. Only a bounded, explicitly sampled preview is retained. */
export async function readTrack(
  body: ReadableStream<Uint8Array>,
): Promise<TrackPreview> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const points: TrackPoint[] = [];
  let expectedSamples = 0,
    stride = 1;
  let pending = "",
    bytes = 0,
    count = 0,
    metadata = false;
  let previousElapsed: number | null = null,
    previousGeneration: number | null = null;
  let move = true,
    last: TrackPoint | null = null,
    lastStored = false;
  function line(text: string) {
    if (!text.trim()) return;
    if (text.length > MAX_LINE) throw new TrackError("track_too_large");
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new TrackError("track_invalid");
    const sample = value as Record<string, unknown>;
    if (!metadata) {
      metadata = true;
      if (
        !sample.recording ||
        typeof sample.recording !== "object" ||
        Array.isArray(sample.recording) ||
        "timestampUtc" in sample
      )
        throw new TrackError("track_invalid");
      const metadataCount = (sample.recording as Record<string, unknown>)
        .sampleCount;
      if (
        typeof metadataCount !== "number" ||
        !Number.isSafeInteger(metadataCount) ||
        metadataCount < 0 ||
        metadataCount > MAX_SAMPLES
      )
        throw new TrackError("track_invalid");
      expectedSamples = metadataCount;
      stride = Math.max(1, Math.ceil(expectedSamples / (MAX_POINTS - 1)));
      return;
    }
    if (++count > MAX_SAMPLES || count > expectedSamples)
      throw new TrackError("track_too_large");
    const elapsed = sample.elapsedMs,
      generation = sample.connectionGeneration;
    if (
      typeof elapsed !== "number" ||
      !Number.isSafeInteger(elapsed) ||
      typeof generation !== "number" ||
      !Number.isSafeInteger(generation)
    )
      throw new TrackError("track_invalid");
    if (
      previousElapsed === null ||
      elapsed <= previousElapsed ||
      elapsed - previousElapsed > 10000 ||
      generation !== previousGeneration
    )
      move = true;
    previousElapsed = elapsed;
    previousGeneration = generation;
    const lat = sample.latitude,
      lon = sample.longitude;
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      move = true;
      last = null;
      return;
    }
    last = { latitude: lat, longitude: lon, move };
    lastStored = false;
    if ((count - 1) % stride === 0) {
      points.push(last);
      move = false;
      lastStored = true;
    }
  }
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw new TrackError("track_too_large");
      pending += decoder.decode(part.value, { stream: true });
      let start = 0,
        end: number;
      while ((end = pending.indexOf("\n", start)) !== -1) {
        line(pending.slice(start, end));
        start = end + 1;
      }
      pending = pending.slice(start);
      if (pending.length > MAX_LINE) throw new TrackError("track_too_large");
    }
    pending += decoder.decode();
    line(pending);
    if (!metadata || count !== expectedSamples)
      throw new TrackError("track_incomplete");
    if (last && !lastStored && points.length < MAX_POINTS) points.push(last);
    return { points, sampleCount: count, sampled: stride > 1 };
  } catch (error) {
    if (
      error instanceof TrackError ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new TrackError("track_invalid");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Equirectangular geographic plot; unwraps the date line and preserves evidence gaps. */
export function projectTrack(points: readonly TrackPoint[]) {
  let previous = points[0]?.longitude ?? 0;
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  const positions = points.map((point) => {
    let longitude = point.longitude;
    while (longitude - previous > 180) longitude -= 360;
    while (longitude - previous < -180) longitude += 360;
    previous = longitude;
    minLon = Math.min(minLon, longitude);
    maxLon = Math.max(maxLon, longitude);
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    return { ...point, longitude };
  });
  if (!positions.length)
    return { path: "", start: null, end: null, longitudeSpan: 0 };
  const cosine = Math.max(
    0.01,
    Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180),
  );
  const width = Math.max((maxLon - minLon) * cosine, 0.001);
  const height = Math.max(maxLat - minLat, 0.001);
  const scale = Math.min(720 / width, 320 / height);
  const offsetX = (800 - (maxLon - minLon) * cosine * scale) / 2;
  const offsetY = (400 - (maxLat - minLat) * scale) / 2;
  const projected = positions.map((point) => ({
    x: offsetX + (point.longitude - minLon) * cosine * scale,
    y: offsetY + (maxLat - point.latitude) * scale,
    move: point.move,
  }));
  return {
    path: projected
      .map(
        (point, i) =>
          `${i === 0 || point.move ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
      )
      .join(" "),
    start: projected[0]!,
    end: projected.at(-1)!,
    longitudeSpan: maxLon - minLon,
  };
}
