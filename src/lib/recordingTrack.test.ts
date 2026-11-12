import { describe, expect, test } from "bun:test";
import { readTrack, projectTrack, TrackError } from "./recordingTrack";

const id = "12345678-1234-1234-1234-123456789abc";
function sample(elapsedMs: number, longitude = 120, extra = {}) {
  return {
    timestampUtc: new Date(Date.UTC(2026, 10, 10) + elapsedMs).toISOString(),
    elapsedMs,
    latitude: 30,
    longitude,
    connectionGeneration: 1,
    ...extra,
  };
}
function stream(lines: unknown[], split = 13) {
  const bytes = new TextEncoder().encode(
    lines.map((line) => JSON.stringify(line)).join("\n"),
  );
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, (offset += split)));
    },
  });
}

describe("recording evidence", () => {
  test("decodes split UTF-8 NDJSON without buffering a full track", async () => {
    const result = await readTrack(
      stream([
        { recording: { id, aircraftIdentity: "飛行機", sampleCount: 2 } },
        sample(0),
        sample(1000, 121),
      ]),
    );
    expect(result.sampleCount).toBe(2);
    expect(result.points.map((point) => point.longitude)).toEqual([120, 121]);
  });

  test("does not draw invented links over missing positions, generation changes or time gaps", async () => {
    const result = await readTrack(
      stream([
        { recording: { id, sampleCount: 6 } },
        sample(0),
        sample(1000, 121),
        sample(2000, 122, { latitude: null }),
        sample(3000, 123),
        sample(4000, 124, { connectionGeneration: 2 }),
        sample(16000, 125, { connectionGeneration: 2 }),
      ]),
    );
    expect(result.points.map((point) => point.move)).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
    expect((projectTrack(result.points).path.match(/M/g) ?? []).length).toBe(4);
  });

  test("uses monotonic gaps and breaks at clock regressions", async () => {
    const result = await readTrack(
      stream([
        { recording: { id, sampleCount: 2 } },
        sample(10000),
        sample(9000, 121),
      ]),
    );
    expect(result.points[1]?.move).toBe(true);
  });

  test("keeps trans-Pacific tracks near the date line instead of spanning the globe", () => {
    const plot = projectTrack([
      { latitude: 30, longitude: 179, move: true },
      { latitude: 30, longitude: -179, move: false },
    ]);
    expect(plot.longitudeSpan).toBe(2);
    expect(plot.path).not.toContain("NaN");
  });

  test("bounds displayed points while consuming all samples", async () => {
    const samples = Array.from({ length: 10000 }, (_, i) =>
      sample(i * 1000, 120 + i / 10000),
    );
    const result = await readTrack(
      stream([{ recording: { id, sampleCount: 10000 } }, ...samples], 8192),
    );
    expect(result.sampleCount).toBe(10000);
    expect(result.points.length).toBeLessThanOrEqual(4096);
    expect(result.sampled).toBe(true);
    expect(result.points.at(-1)?.longitude).toBe(120.9999);
  });

  test("rejects invalid coordinates rather than drawing zeroes", async () => {
    const result = await readTrack(
      stream([
        { recording: { id, sampleCount: 2 } },
        sample(0, 181),
        sample(1000, 120),
      ]),
    );
    expect(result.points).toEqual([
      { latitude: 30, longitude: 120, move: true },
    ]);
  });

  test("rejects an oversized NDJSON line and cancels the reader", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(300000).fill(32));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(readTrack(body)).rejects.toBeInstanceOf(TrackError);
    expect(cancelled).toBe(true);
  });

  test("rejects metadata-only or truncated tracks when samples are expected", async () => {
    await expect(
      readTrack(stream([{ recording: { id, sampleCount: 1 } }])),
    ).rejects.toThrow("track_incomplete");
  });

  test("uses the stream snapshot count when an active recording has gained samples", async () => {
    const result = await readTrack(
      stream([
        { recording: { id, status: "recording", sampleCount: 3 } },
        sample(0),
        sample(1000, 121),
        sample(2000, 122),
      ]),
    );
    expect(result.sampleCount).toBe(3);
    expect(result.points.map((point) => point.longitude)).toEqual([
      120, 121, 122,
    ]);
  });

  test("rejects malformed, fractional or out-of-bound metadata sample counts", async () => {
    for (const sampleCount of [
      undefined,
      null,
      "2",
      -1,
      1.5,
      300001,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await expect(
        readTrack(stream([{ recording: { id, sampleCount } }])),
      ).rejects.toThrow("track_invalid");
    }
    await expect(readTrack(stream([{ recording: [] }]))).rejects.toThrow(
      "track_invalid",
    );
  });

  test("rejects extra sample lines beyond the stream metadata count", async () => {
    await expect(
      readTrack(
        stream([
          { recording: { id, sampleCount: 1 } },
          sample(0),
          sample(1000),
        ]),
      ),
    ).rejects.toThrow("track_too_large");
  });
});
