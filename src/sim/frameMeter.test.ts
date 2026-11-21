import { expect, it } from "vitest";

import { FrameMeter } from "./frameMeter";

it("reports nothing until the window has elapsed", () => {
  const meter = new FrameMeter(500);
  expect(meter.record(0, 4)).toBeUndefined();
  expect(meter.record(100, 4)).toBeUndefined();
});

it("reports the frame rate and the mean processing time of the window", () => {
  const meter = new FrameMeter(500);
  meter.record(0, 2);
  meter.record(250, 4);
  const timing = meter.record(500, 6);
  expect(timing?.fps).toBeCloseTo(6);
  expect(timing?.processingMs).toBeCloseTo(4);
});

it("counts untimed frames toward the frame rate only", () => {
  const meter = new FrameMeter(500);
  meter.record(0, 2);
  meter.record(250, undefined);
  const timing = meter.record(500, 4);
  expect(timing?.fps).toBeCloseTo(6);
  expect(timing?.processingMs).toBeCloseTo(3);
});

it("starts a fresh window after each report", () => {
  const meter = new FrameMeter(500);
  meter.record(0, 10);
  meter.record(500, 10);
  meter.record(750, 2);
  const timing = meter.record(1000, 2);
  expect(timing?.fps).toBeCloseTo(4);
  expect(timing?.processingMs).toBeCloseTo(2);
});
