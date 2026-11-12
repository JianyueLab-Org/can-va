import type { Translator } from "@jianyuelab-org/can-ui/i18n";
import type { Recording } from "./va";
import { errorText } from "./errors";

interface EvidenceFailure {
  status: number;
  error: string;
  message: string;
}

export function evidenceFailure(
  recording: Recording | null,
  failure: EvidenceFailure,
  t: Translator,
  tc: Translator,
) {
  const denied = [401, 403, 404].includes(failure.status);
  return {
    recording: denied
      ? null
      : failure.error === "raw_unavailable" && recording
        ? { ...recording, rawAvailable: false }
        : recording,
    denied,
    message: denied
      ? t("recording.noAccess")
      : errorText(tc, {
          error: failure.error,
          message: failure.message || `HTTP ${failure.status}`,
        }),
  };
}

export async function trackHttpFailure(
  response: Response,
): Promise<EvidenceFailure> {
  const value: unknown = await response.json().catch(() => null);
  const body =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    status: response.status,
    error: typeof body.error === "string" ? body.error : "http_error",
    message:
      typeof body.message === "string" && body.message.trim()
        ? body.message
        : `HTTP ${response.status}`,
  };
}
