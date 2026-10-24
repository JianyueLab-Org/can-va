import { expect, test } from "bun:test";
import { createTranslator } from "@jianyuelab-org/can-ui/i18n";
import { errorText } from "./errors";

const t = createTranslator({ errors: { code_taken: "代码已被占用" } });

test("known codes are localised", () => {
  expect(errorText(t, { error: "code_taken", message: "code taken" })).toBe(
    "代码已被占用",
  );
});

test("unknown codes fall back to the server message", () => {
  expect(errorText(t, { error: "brand_new", message: "Brand new." })).toBe(
    "Brand new.",
  );
});
