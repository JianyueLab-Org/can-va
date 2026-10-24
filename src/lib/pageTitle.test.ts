import { expect, test } from "bun:test";
import { siteLabel } from "@jianyuelab-org/can-ui/sites";
import { pageTitle } from "./pageTitle";

test("page · site, localised", () => {
  expect(pageTitle("Ranks", "en-us")).toBe(
    `Ranks · ${siteLabel("en-us", "va").name}`,
  );
});

test("root page is the site name alone", () => {
  expect(pageTitle(undefined, "zh-cn")).toBe(siteLabel("zh-cn", "va").name);
});
