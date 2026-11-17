export const SCENES = ["dam", "drop", "collision", "block", "splash"] as const;
export type Scene = (typeof SCENES)[number];

export const SCENE_LABELS: Record<Scene, string> = {
  dam: "Dam break",
  drop: "Droplet",
  collision: "Colliding blobs",
  block: "Elastic block",
  splash: "Block in a pool",
};

export const POINTER_MODES = ["attract", "repel"] as const;
export type PointerMode = (typeof POINTER_MODES)[number];

export const POINTER_MODE_LABELS: Record<PointerMode, string> = {
  attract: "Attract",
  repel: "Repel",
};

export interface Settings {
  scene: Scene;
  pointerMode: PointerMode;
  /** Bulk stiffness of the fluid: higher is less compressible. */
  stiffness: number;
  solidStiffness: number;
  gravity: number;
}

export const STIFFNESS_RANGE = { min: 100, max: 800, step: 50 } as const;
/** The top end keeps the solid's wave speed under the fluid's at its stiffest. */
export const SOLID_STIFFNESS_RANGE = { min: 50, max: 250, step: 25 } as const;
export const GRAVITY_RANGE = { min: 0, max: 20, step: 0.5 } as const;

export const DEFAULT_SETTINGS: Settings = {
  scene: "dam",
  pointerMode: "attract",
  stiffness: 400,
  solidStiffness: 150,
  gravity: 9.8,
};

export const asScene = (value: string): Scene | undefined =>
  SCENES.find((scene) => scene === value);

export const asPointerMode = (value: string): PointerMode | undefined =>
  POINTER_MODES.find((mode) => mode === value);
