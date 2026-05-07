export interface ScanResult {
  barcode?: string;
  name?: string;
  category?: string;
  nutriScore?: string;
  novaGroup?: number;
  rawScore?: number;
  expiryDate?: string;
  expiryHint?: string;
}

let pending: ScanResult | null = null;

export function setScanResult(result: ScanResult): void {
  pending = result;
}

export function consumeScanResult(): ScanResult | null {
  const result = pending;
  pending = null;
  return result;
}
