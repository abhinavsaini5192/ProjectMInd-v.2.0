export interface ParsedProtocolVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly raw: string;
}

export class AgentProtocolVersion {
  public static parse(versionStr: string): ParsedProtocolVersion | undefined {
    if (!versionStr || typeof versionStr !== 'string') {
      return undefined;
    }
    const trimmed = versionStr.trim();
    if (!/^\d+(\.\d+)*$/.test(trimmed)) {
      return undefined;
    }

    const parts = trimmed.split('.').map((p) => parseInt(p, 10));
    const major = parts[0] ?? 1;
    const minor = parts.length > 1 && parts[1] !== undefined ? parts[1] : 0;
    const patch = parts.length > 2 && parts[2] !== undefined ? parts[2] : 0;

    return { major, minor, patch, raw: trimmed };
  }

  public static isCompatible(supported: string, requested: string): boolean {
    const sup = this.parse(supported);
    const req = this.parse(requested);

    if (!sup || !req) {
      return false;
    }

    // Major versions must match; requested minor must be <= supported minor
    if (sup.major !== req.major) return false;
    return req.minor <= sup.minor;
  }

  public static compare(v1: string, v2: string): number {
    const p1 = this.parse(v1) ?? { major: 0, minor: 0, patch: 0, raw: v1 };
    const p2 = this.parse(v2) ?? { major: 0, minor: 0, patch: 0, raw: v2 };

    if (p1.major !== p2.major) return p1.major - p2.major;
    if (p1.minor !== p2.minor) return p1.minor - p2.minor;
    return p1.patch - p2.patch;
  }
}
