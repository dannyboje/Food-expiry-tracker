// Module-level store so camera screens can hand results back to the add-item
// form without URL params (which only affect the current screen's own route).

export interface CameraResult {
  type: 'expiry' | 'nutrition';
  uri: string;
  date?: string; // only set for expiry captures
}

let pending: CameraResult | null = null;

export function setCameraResult(result: CameraResult): void {
  pending = result;
}

/** Read and clear the pending result — call inside useFocusEffect. */
export function consumeCameraResult(): CameraResult | null {
  const result = pending;
  pending = null;
  return result;
}
