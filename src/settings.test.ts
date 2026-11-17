import { expect, it } from "vitest";

import { asPointerMode, asScene } from "./settings";

it("narrows a known string and rejects others", () => {
  expect(asScene("dam")).toBe("dam");
  expect(asScene("lava")).toBeUndefined();
  expect(asPointerMode("repel")).toBe("repel");
  expect(asPointerMode("")).toBeUndefined();
});
