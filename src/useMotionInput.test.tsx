import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMotionInput } from "./useMotionInput";

const motionEvent = (x: number | null, y: number | null): Event =>
  Object.assign(new Event("devicemotion"), {
    accelerationIncludingGravity: { x, y, z: 0 },
  });

const orientationEvent = (beta: number | null, gamma: number | null): Event =>
  Object.assign(new Event("deviceorientation"), { beta, gamma });

const fire = (event: Event): void => {
  act(() => {
    window.dispatchEvent(event);
  });
};

const setAngle = (angle: number): void => {
  vi.stubGlobal("screen", { orientation: { angle } });
};

beforeEach(() => {
  setAngle(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("without a permission prompt", () => {
  it("is unavailable until a usable event arrives", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMotionInput());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.available).toBe(false);
    fire(motionEvent(null, null));
    fire(orientationEvent(null, null));
    fire(motionEvent(Number.NaN, 9.8));
    expect(result.current.available).toBe(false);
    fire(motionEvent(0, 9.8));
    expect(result.current.available).toBe(true);
    vi.useRealTimers();
  });

  it("starts on once sensor data arrives, and off again on request", () => {
    const { result } = renderHook(() => useMotionInput());
    expect(result.current.enabled).toBe(false);
    fire(motionEvent(0, 9.8));
    expect(result.current.enabled).toBe(true);
    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.enabled).toBe(false);
    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.enabled).toBe(true);
    expect(result.current.message).toBeUndefined();
  });

  it("reads gravity straight down until motion is on", () => {
    const { result } = renderHook(() => useMotionInput());
    expect(result.current.readGravity()).toEqual({ x: 0, y: -1 });
    fire(motionEvent(-9.8, 0));
    expect(result.current.readGravity().x).toBeCloseTo(1);
    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.readGravity()).toEqual({ x: 0, y: -1 });
  });

  it("follows the shake, clamps it, and keeps the last valid reading", () => {
    const { result } = renderHook(() => useMotionInput());
    fire(motionEvent(0, -9.8));
    expect(result.current.readGravity().y).toBeCloseTo(1);
    fire(motionEvent(0, 400));
    expect(result.current.readGravity().y).toBeCloseTo(-3);
    fire(motionEvent(null, 9.8));
    fire(motionEvent(Number.NaN, 9.8));
    expect(result.current.readGravity().y).toBeCloseTo(-3);
  });

  it("follows the screen's rotation without new sensor data", () => {
    const { result } = renderHook(() => useMotionInput());
    fire(motionEvent(-9.8, 0));
    expect(result.current.readGravity().x).toBeCloseTo(1);
    setAngle(90);
    const rotated = result.current.readGravity();
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it("falls back to the orientation tilt only until an acceleration arrives", () => {
    const { result } = renderHook(() => useMotionInput());
    fire(orientationEvent(0, 45));
    expect(result.current.available).toBe(true);
    expect(result.current.readGravity().x).toBeCloseTo(1);
    fire(motionEvent(0, 9.8));
    fire(orientationEvent(0, 45));
    expect(result.current.readGravity().x).toBeCloseTo(0);
    expect(result.current.readGravity().y).toBeCloseTo(-1);
  });

  it("stops listening when it unmounts", () => {
    const { result, unmount } = renderHook(() => useMotionInput());
    unmount();
    fire(motionEvent(0, 9.8));
    expect(result.current.available).toBe(false);
  });
});

describe("with a permission prompt", () => {
  const stubPermission = (request: () => Promise<string>) => {
    const requestPermission = vi.fn(request);
    vi.stubGlobal("DeviceMotionEvent", { requestPermission });
    return requestPermission;
  };

  it("shows the toggle off before any event, since none arrive until permitted", () => {
    stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() => useMotionInput());
    expect(result.current.available).toBe(true);
    expect(result.current.enabled).toBe(false);
    fire(motionEvent(0, 9.8));
    expect(result.current.enabled).toBe(false);
  });

  it("asks when turned on and turns on once granted", async () => {
    const requestPermission = stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() => useMotionInput());
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(result.current.enabled).toBe(true);
    expect(result.current.message).toBeUndefined();
  });

  it("keeps gravity straight down while on but before the first event", async () => {
    stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() => useMotionInput());
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(result.current.readGravity()).toEqual({ x: 0, y: -1 });
  });

  it("stays off with a message when denied", async () => {
    stubPermission(() => Promise.resolve("denied"));
    const { result } = renderHook(() => useMotionInput());
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(result.current.enabled).toBe(false);
    expect(result.current.message).toMatch(/denied/);
  });

  it("stays off with a message when the request rejects", async () => {
    stubPermission(() => Promise.reject(new Error("not allowed")));
    const { result } = renderHook(() => useMotionInput());
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(result.current.enabled).toBe(false);
    expect(result.current.message).toMatch(/denied/);
  });

  it("turns off without asking, and clears the message when asked again", async () => {
    const requestPermission = stubPermission(() => Promise.resolve("denied"));
    const { result } = renderHook(() => useMotionInput());
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(result.current.message).toBeDefined();
    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.message).toBeUndefined();
    expect(requestPermission).toHaveBeenCalledOnce();
  });
});

it("needs no permission when the browser has no DeviceMotionEvent", () => {
  vi.stubGlobal("DeviceMotionEvent", undefined);
  Reflect.deleteProperty(globalThis, "DeviceMotionEvent");
  const { result } = renderHook(() => useMotionInput());
  expect(result.current.available).toBe(false);
});
