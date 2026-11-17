/** A 2D vector; its unit and axes depend on where it is used. */
export interface Vec2 {
  x: number;
  y: number;
}

export const GRAVITY_AT_REST: Vec2 = { x: 0, y: -1 };

export const SENSOR_G = 9.8;
/** Chosen empirically, no fixed source. */
export const MAX_SHAKE_G = 3;

export interface Orientation {
  beta: number;
  gamma: number;
}

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const asReading = (
  x: number | null | undefined,
  y: number | null | undefined,
): Vec2 | undefined =>
  isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : undefined;

export const asOrientation = (
  beta: number | null | undefined,
  gamma: number | null | undefined,
): Orientation | undefined =>
  isFiniteNumber(beta) && isFiniteNumber(gamma) ? { beta, gamma } : undefined;

const rotateToScreen = ({ x, y }: Vec2, angle: number): Vec2 => {
  const quarterTurns = ((Math.round(angle / 90) % 4) + 4) % 4;
  if (quarterTurns === 1) return { x: -y, y: x };
  if (quarterTurns === 2) return { x: -x, y: -y };
  if (quarterTurns === 3) return { x: y, y: -x };
  return { x, y };
};

/**
 * Gravity from an `accelerationIncludingGravity` reading in device axes. A device
 * at rest reads the reaction to gravity, so an upright one reads `y = +9.8`.
 */
export const gravityFromAcceleration = (reading: Vec2, angle: number): Vec2 => {
  const screen = rotateToScreen(reading, angle);
  const gravity = { x: -screen.x / SENSOR_G, y: -screen.y / SENSOR_G };
  const magnitude = Math.hypot(gravity.x, gravity.y);
  if (magnitude <= MAX_SHAKE_G) return gravity;
  const scale = MAX_SHAKE_G / magnitude;
  return { x: gravity.x * scale, y: gravity.y * scale };
};

const FLAT = 1e-9;

/** Unit in-plane gravity from `deviceorientation` degrees; a flat device has none. */
export const gravityFromOrientation = (
  { beta, gamma }: Orientation,
  angle: number,
): Vec2 => {
  const betaRadians = (beta * Math.PI) / 180;
  const gammaRadians = (gamma * Math.PI) / 180;
  const screen = rotateToScreen(
    {
      x: Math.sin(gammaRadians) * Math.cos(betaRadians),
      y: -Math.sin(betaRadians),
    },
    angle,
  );
  const magnitude = Math.hypot(screen.x, screen.y);
  if (magnitude < FLAT) return { x: 0, y: 0 };
  return { x: screen.x / magnitude, y: screen.y / magnitude };
};
