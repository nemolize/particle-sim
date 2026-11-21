import { expect, it } from "vitest";

import { domainWidthFor, gridColumnsFor } from "./domain";
import {
  CELL_SIZE,
  GRID_ROWS,
  MAX_GRID_COLUMNS,
  MIN_GRID_COLUMNS,
} from "./params";

it("makes a square view as many columns as rows", () => {
  expect(gridColumnsFor(800, 800)).toBe(GRID_ROWS);
});

it("widens the grid with the view's aspect ratio", () => {
  expect(gridColumnsFor(1920, 1080)).toBe(Math.round((GRID_ROWS * 16) / 9));
  expect(gridColumnsFor(400, 800)).toBe(GRID_ROWS / 2);
});

it("keeps the column count within the grid buffer", () => {
  expect(gridColumnsFor(100_000, 100)).toBe(MAX_GRID_COLUMNS);
  expect(gridColumnsFor(10, 10_000)).toBe(MIN_GRID_COLUMNS);
});

it("falls back to a square grid for a view with no size yet", () => {
  expect(gridColumnsFor(0, 0)).toBe(GRID_ROWS);
});

it("measures the domain width in cells of the shared size", () => {
  expect(domainWidthFor(GRID_ROWS)).toBeCloseTo(1);
  expect(domainWidthFor(3)).toBeCloseTo(3 * CELL_SIZE);
});
