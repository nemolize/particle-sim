import { useCallback, useEffect, useRef, useState } from "react";

import {
  asReading,
  GRAVITY_AT_REST,
  gravityFromAcceleration,
  gravityFromOrientation,
  type Vec2,
} from "@/sim/motion";

export interface MotionInput {
  available: boolean;
  enabled: boolean;
  message: string | undefined;
  setEnabled: (enabled: boolean) => void;
  readGravity: () => Vec2;
}

interface Sensors {
  acceleration: Vec2 | undefined;
  orientation: { beta: number; gamma: number } | undefined;
}

const DENIED_MESSAGE =
  "Motion access was denied, so gravity stays straight down. Allow motion in the browser's site settings to use it.";

/** iOS Safari gates sensor events behind a permission asked from a user gesture. */
const permissionRequest = (): (() => Promise<boolean>) | undefined => {
  if (!("DeviceMotionEvent" in globalThis)) return undefined;
  const request: unknown = Reflect.get(DeviceMotionEvent, "requestPermission");
  if (typeof request !== "function") return undefined;
  return async () => {
    const answer: unknown = await Reflect.apply(request, DeviceMotionEvent, []);
    return answer === "granted";
  };
};

export const useMotionInput = (): MotionInput => {
  const sensors = useRef<Sensors>({
    acceleration: undefined,
    orientation: undefined,
  });
  const enabledRef = useRef(false);
  const [heardSensor, setHeardSensor] = useState(false);
  const [needsPermission] = useState(() => permissionRequest() !== undefined);
  const [choice, setChoice] = useState<boolean>();
  const [message, setMessage] = useState<string>();

  // Until the user chooses: on where events flow freely, off where permission is asked.
  const enabled = choice ?? (heardSensor && !needsPermission);
  const available = heardSensor || needsPermission;

  useEffect(() => {
    enabledRef.current = enabled;
  });

  useEffect(() => {
    const onMotion = (event: DeviceMotionEvent): void => {
      const reading = asReading(
        event.accelerationIncludingGravity?.x,
        event.accelerationIncludingGravity?.y,
      );
      if (reading === undefined) return;
      sensors.current.acceleration = reading;
      setHeardSensor(true);
    };
    const onOrientation = (event: DeviceOrientationEvent): void => {
      const reading = asReading(event.beta, event.gamma);
      if (reading === undefined) return;
      sensors.current.orientation = { beta: reading.x, gamma: reading.y };
      setHeardSensor(true);
    };
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, []);

  const setEnabled = useCallback((next: boolean): void => {
    setMessage(undefined);
    const request = permissionRequest();
    if (!next || request === undefined) {
      setChoice(next);
      return;
    }
    request()
      .then((granted) => {
        setChoice(granted);
        if (!granted) setMessage(DENIED_MESSAGE);
      })
      .catch(() => {
        setChoice(false);
        setMessage(DENIED_MESSAGE);
      });
  }, []);

  const readGravity = useCallback((): Vec2 => {
    if (!enabledRef.current) return GRAVITY_AT_REST;
    const { acceleration, orientation } = sensors.current;
    const angle = screen.orientation.angle;
    if (acceleration !== undefined) {
      return gravityFromAcceleration(acceleration, angle);
    }
    if (orientation !== undefined) {
      return gravityFromOrientation(orientation.beta, orientation.gamma, angle);
    }
    return GRAVITY_AT_REST;
  }, []);

  return { available, enabled, message, setEnabled, readGravity };
};
