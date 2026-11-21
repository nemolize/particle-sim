import {
  CELL_SIZE,
  GRID_ROWS,
  MAX_GRID_COLUMNS,
  MIN_GRID_COLUMNS,
} from "./params";

/** Grid columns that make square cells fill a `width` by `height` view. */
export const gridColumnsFor = (width: number, height: number): number => {
  const columns = Math.round((GRID_ROWS * width) / height);
  if (!Number.isFinite(columns)) return GRID_ROWS;
  return Math.min(MAX_GRID_COLUMNS, Math.max(MIN_GRID_COLUMNS, columns));
};

export const domainWidthFor = (columns: number): number => columns * CELL_SIZE;
