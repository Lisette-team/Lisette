// The camera reports the same barcode many times a second. The gate lets one scan through and
// ignores every callback after it until the screen is ready for the next scan.
export function createScanGate() {
  let locked = false;
  return {
    accept(_code: string): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    reset() {
      locked = false;
    },
  };
}

export type ScanGate = ReturnType<typeof createScanGate>;
