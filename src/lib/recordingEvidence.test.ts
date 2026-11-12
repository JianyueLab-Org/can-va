import { describe, expect, test } from "bun:test";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { evidenceFailure, trackHttpFailure } from "./recordingEvidence";
import type { Recording } from "./va";

const recording: Recording = {
  id: "12345678-1234-1234-1234-123456789abc",
  bookingId: 1,
  username: "100001",
  simulator: "xplane",
  aircraftIdentity: "TEST",
  status: "completed",
  chunkCount: 1,
  sampleCount: 2,
  acceptedBytes: 200,
  acknowledgedSequences: [0],
  blockOff: "2026-11-10T00:00:00Z",
  blockOn: "2026-11-10T01:00:00Z",
  fuelKg: 20,
  manualBlockOff: false,
  manualBlockOn: false,
  manualFuel: false,
  declaredOnline: false,
  flags: ["telemetry_gap"],
  pirepId: null,
  createdAt: "2026-11-10T00:00:00Z",
  updatedAt: "2026-11-10T01:00:00Z",
  completedAt: "2026-11-10T01:00:00Z",
  rawExpiresAt: "2027-02-08T01:00:00Z",
  rawAvailable: true,
};
const t = createTranslator({ recording: { noAccess: "Access revoked" } });
const tc = createTranslator({
  errors: { raw_unavailable: "Raw expired", network: "Network failed" },
});

describe("recording evidence failures", () => {
  test("raw expiry disables downloads without erasing report summary or flags", () => {
    const result = evidenceFailure(
      recording,
      { status: 409, error: "raw_unavailable", message: "Expired" },
      t,
      tc,
    );
    expect(result.recording).toEqual({ ...recording, rawAvailable: false });
    expect(result.denied).toBe(false);
  });

  test("transient failures retain the authorized summary", () => {
    const result = evidenceFailure(
      recording,
      { status: 0, error: "network", message: "Network request failed" },
      t,
      tc,
    );
    expect(result.recording).toBe(recording);
    expect(result.denied).toBe(false);
    expect(result.message).toBe("Network failed");
  });

  test("expired sessions and revoked access remove all recording metadata", () => {
    for (const status of [401, 403, 404]) {
      const result = evidenceFailure(
        recording,
        { status, error: "forbidden", message: "Forbidden" },
        t,
        tc,
      );
      expect(result.recording).toBeNull();
      expect(result.denied).toBe(true);
      expect(result.message).toBe("Access revoked");
    }
  });

  test("unknown track errors preserve an upstream explanation", async () => {
    const failure = await trackHttpFailure(
      Response.json(
        { error: "new_failure", message: "Download failed" },
        { status: 500 },
      ),
    );
    expect(evidenceFailure(recording, failure, t, tc).message).toBe(
      "Download failed",
    );
  });

  test("malformed or empty error messages cannot hide HTTP failures", async () => {
    for (const body of [
      null,
      [],
      { error: "new_failure", message: {} },
      { error: "new_failure", message: "" },
    ]) {
      const failure = await trackHttpFailure(
        Response.json(body, { status: 500 }),
      );
      expect(evidenceFailure(recording, failure, t, tc).message).toBe(
        "HTTP 500",
      );
    }
    const failure = await trackHttpFailure(
      new Response("not JSON", { status: 502 }),
    );
    expect(evidenceFailure(recording, failure, t, tc).message).toBe("HTTP 502");
  });
});
