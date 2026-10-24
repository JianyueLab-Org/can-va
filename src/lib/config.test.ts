import { expect, test } from "bun:test";
import { CAN_WEB_ORIGIN, origin, signInUrl } from "./config";

test("sign-in without a return target is the bare sign-in page", () => {
  expect(signInUrl()).toBe(`${CAN_WEB_ORIGIN}/signin`);
});

test("callbackUrl is built on PUBLIC_ORIGIN, not the request origin", () => {
  const url = signInUrl(new URL("http://internal:4321/airlines/CCA?tab=1#x"));
  expect(url).toBe(
    `${CAN_WEB_ORIGIN}/signin?callbackUrl=${encodeURIComponent(
      `${origin()}/airlines/CCA?tab=1`,
    )}`,
  );
});

test("origin has no trailing slash", () => {
  expect(origin().endsWith("/")).toBe(false);
});
