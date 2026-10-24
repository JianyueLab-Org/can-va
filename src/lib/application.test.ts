import { describe, expect, test } from "bun:test";
import {
  airlineCode,
  toApplicationInput,
  validateApplication,
  type ApplicationDraft,
} from "./application";

const DRAFT: ApplicationDraft = {
  name: " Cerulean Air ",
  icao: "cca",
  iata: " ca ",
  telephony: " CERULEAN ",
  description: " Hello ",
  hubIcao: "zbaa",
};

describe("toApplicationInput", () => {
  test("trims and upper-cases the codes, keeps telephony case", () => {
    expect(toApplicationInput(DRAFT)).toEqual({
      name: "Cerulean Air",
      icao: "CCA",
      iata: "CA",
      telephony: "CERULEAN",
      description: "Hello",
      hubIcao: "ZBAA",
    });
  });

  test("an empty IATA is omitted, not sent as an empty string", () => {
    expect("iata" in toApplicationInput({ ...DRAFT, iata: "  " })).toBe(false);
  });
});

describe("validateApplication", () => {
  test("a complete draft has no problems", () => {
    expect(validateApplication(toApplicationInput(DRAFT))).toEqual({});
  });

  test("required fields", () => {
    const input = toApplicationInput({
      name: "",
      icao: "",
      iata: "",
      telephony: "",
      description: "",
      hubIcao: "",
    });
    expect(validateApplication(input)).toEqual({
      name: "required",
      icao: "required",
      telephony: "required",
      hubIcao: "required",
    });
  });

  test("code formats", () => {
    const input = toApplicationInput({
      ...DRAFT,
      icao: "CC1",
      iata: "C",
      hubIcao: "ZBA",
    });
    expect(validateApplication(input)).toEqual({
      icao: "format",
      iata: "format",
      hubIcao: "format",
    });
  });
});

describe("airlineCode", () => {
  test("normalises a path segment to an airline ICAO or null", () => {
    expect(airlineCode("cca")).toBe("CCA");
    expect(airlineCode("CCAX")).toBeNull();
    expect(airlineCode(undefined)).toBeNull();
  });
});
