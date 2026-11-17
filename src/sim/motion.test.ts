import { describe, expect, it } from "vitest";

import {
  asOrientation,
  asReading,
  gravityFromAcceleration,
  gravityFromOrientation,
  MAX_SHAKE_G,
  SENSOR_G,
} from "./motion";

describe("asReading", () => {
  it("keeps finite x and y", () => {
    expect(asReading(1, -2)).toEqual({ x: 1, y: -2 });
  });

  it.each([
    [null, 9.8],
    [undefined, 9.8],
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
    [1, null],
    [1, undefined],
  ])("ignores a reading of (%s, %s)", (x, y) => {
    expect(asReading(x, y)).toBeUndefined();
  });
});

describe("asOrientation", () => {
  it("keeps finite beta and gamma", () => {
    expect(asOrientation(10, -20)).toEqual({ beta: 10, gamma: -20 });
  });

  it("ignores a missing or non-finite angle", () => {
    expect(asOrientation(null, 5)).toBeUndefined();
    expect(asOrientation(5, Number.NaN)).toBeUndefined();
    expect(asOrientation(undefined, undefined)).toBeUndefined();
  });
});

describe("gravityFromAcceleration", () => {
  it("points an upright device at rest straight down", () => {
    const gravity = gravityFromAcceleration({ x: 0, y: SENSOR_G }, 0);
    expect(gravity.x).toBeCloseTo(0);
    expect(gravity.y).toBeCloseTo(-1);
  });

  it("follows the device's own axes", () => {
    const upsideDown = gravityFromAcceleration({ x: 0, y: -SENSOR_G }, 0);
    expect(upsideDown.y).toBeCloseTo(1);
    const rightSideDown = gravityFromAcceleration({ x: -SENSOR_G, y: 0 }, 0);
    expect(rightSideDown.x).toBeCloseTo(1);
    expect(rightSideDown.y).toBeCloseTo(0);
  });

  // At angle 90 the device is turned counter-clockwise, its top to the left, so its +x points up.
  it.each([
    [0, { x: 0, y: SENSOR_G }, { x: 0, y: -1 }],
    [90, { x: SENSOR_G, y: 0 }, { x: 0, y: -1 }],
    [180, { x: 0, y: -SENSOR_G }, { x: 0, y: -1 }],
    [270, { x: -SENSOR_G, y: 0 }, { x: 0, y: -1 }],
  ])("keeps the pull down at screen angle %s", (angle, reading, expected) => {
    const gravity = gravityFromAcceleration(reading, angle);
    expect(gravity.x).toBeCloseTo(expected.x);
    expect(gravity.y).toBeCloseTo(expected.y);
  });

  it.each([
    [0, { x: 1, y: 0 }],
    [90, { x: 0, y: 1 }],
    [180, { x: -1, y: 0 }],
    [270, { x: 0, y: -1 }],
  ])(
    "rotates a sideways tug with the screen at angle %s",
    (angle, expected) => {
      const gravity = gravityFromAcceleration({ x: -SENSOR_G, y: 0 }, angle);
      expect(gravity.x).toBeCloseTo(expected.x);
      expect(gravity.y).toBeCloseTo(expected.y);
    },
  );

  it("treats an angle outside 0..270 as the matching quarter turn", () => {
    const gravity = gravityFromAcceleration({ x: -SENSOR_G, y: 0 }, -90);
    expect(gravity.x).toBeCloseTo(0);
    expect(gravity.y).toBeCloseTo(-1);
  });

  it("clamps a harder shake to 3 g in the same direction", () => {
    const gravity = gravityFromAcceleration({ x: 0, y: 400 }, 0);
    expect(gravity.x).toBeCloseTo(0);
    expect(gravity.y).toBeCloseTo(-MAX_SHAKE_G);
    const diagonal = gravityFromAcceleration({ x: 300, y: 400 }, 0);
    expect(diagonal.x).toBeCloseTo(-1.8);
    expect(diagonal.y).toBeCloseTo(-2.4);
  });

  it("leaves a reading of exactly 3 g alone", () => {
    const gravity = gravityFromAcceleration(
      { x: 0, y: MAX_SHAKE_G * SENSOR_G },
      0,
    );
    expect(gravity.y).toBeCloseTo(-MAX_SHAKE_G);
  });

  it("gives no pull in free fall", () => {
    const gravity = gravityFromAcceleration({ x: 0, y: 0 }, 0);
    expect(gravity.x).toBeCloseTo(0);
    expect(gravity.y).toBeCloseTo(0);
  });
});

describe("gravityFromOrientation", () => {
  it("points an upright device straight down", () => {
    const tilt = gravityFromOrientation({ beta: 90, gamma: 0 }, 0);
    expect(tilt.x).toBeCloseTo(0);
    expect(tilt.y).toBeCloseTo(-1);
  });

  it("pulls toward the side tipped down", () => {
    const right = gravityFromOrientation({ beta: 0, gamma: 45 }, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
    const left = gravityFromOrientation({ beta: 0, gamma: -45 }, 0);
    expect(left.x).toBeCloseTo(-1);
    const topDown = gravityFromOrientation({ beta: 45, gamma: 0 }, 0);
    expect(topDown.y).toBeCloseTo(-1);
    const bottomDown = gravityFromOrientation({ beta: -45, gamma: 0 }, 0);
    expect(bottomDown.y).toBeCloseTo(1);
  });

  it.each([
    [0, { x: 1, y: 0 }],
    [90, { x: 0, y: 1 }],
    [180, { x: -1, y: 0 }],
    [270, { x: 0, y: -1 }],
  ])("rotates the tilt with the screen at angle %s", (angle, expected) => {
    const tilt = gravityFromOrientation({ beta: 0, gamma: 45 }, angle);
    expect(tilt.x).toBeCloseTo(expected.x);
    expect(tilt.y).toBeCloseTo(expected.y);
  });

  it("is a unit vector however far the device leans", () => {
    const tilt = gravityFromOrientation({ beta: 60, gamma: 30 }, 0);
    expect(Math.hypot(tilt.x, tilt.y)).toBeCloseTo(1);
  });

  it("has no direction for a device lying flat", () => {
    expect(gravityFromOrientation({ beta: 0, gamma: 0 }, 0)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
