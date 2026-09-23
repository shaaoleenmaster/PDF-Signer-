export type OverlayType = 'sig' | 'seal';
export type InkColorMode = 'original' | 'blue' | 'black' | 'red';

export interface InkAsset {
  bytes: Uint8Array;
  mime: string;
  url: string;
  width: number;
  height: number;
  source: string;
}

export interface OverlayItem {
  id: string;
  type: OverlayType;
  index: number; // 0 for item 1, 1 for item 2
  page: number;
  x: number; // normalized displayed center x (0 to 1)
  y: number; // normalized displayed center y (0 to 1)
  w: number; // normalized width relative to page width (0.03 to 0.55)
  placed: boolean;
  locked: boolean;
  lockX?: number;
  lockY?: number;
  lockSize?: number;
  asset: InkAsset;
}

export interface PageState {
  sig: (OverlayItem | null)[];
  seal: (OverlayItem | null)[];
  rot: number; // 0, 90, 180, 270
}

export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

export interface Geometry {
  base: { width: number; height: number };
  vw: number;
  vh: number;
  fit: number;
  w: number;
  h: number;
}

export interface ValidationResult {
  ok: boolean;
  msg?: string;
}
