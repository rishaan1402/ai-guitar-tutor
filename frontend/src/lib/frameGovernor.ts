/**
 * Frame-rate governor for canvas stages. Keeps an EMA of the frame interval;
 * if it stays above the budget for `frames` frames in a row it steps down one
 * quality tier (and logs that once). Pure: the caller applies the tier.
 */

export interface QualityTier {
  /** Max backing-store pixel ratio. */
  dpr: number;
  /** Polyline segments = width / segDiv. */
  segDiv: number;
  glow: boolean;
}

export const TIERS: readonly QualityTier[] = [
  { dpr: 1.75, segDiv: 9, glow: true },
  { dpr: 1.25, segDiv: 9, glow: true },
  { dpr: 1, segDiv: 9, glow: true },
  { dpr: 1, segDiv: 14, glow: true },
  { dpr: 1, segDiv: 14, glow: false },
];

/** Backing-store ratio: tier cap, device ratio, and ≤ 1.5 MP of canvas pixels. */
export function backingDpr(tierDpr: number, deviceDpr: number, w: number, h: number): number {
  const area = Math.max(1, w * h);
  return Math.max(0.5, Math.min(tierDpr, deviceDpr || 1, Math.sqrt(1.5e6 / area)));
}

export class FrameGovernor {
  tier = 0;
  ema: number;
  private slow = 0;
  private logged = new Set<number>();

  constructor(
    private readonly label = "StringField",
    private readonly budgetMs = 20,
    private readonly frames = 30,
    private readonly maxTier = TIERS.length - 1,
  ) {
    this.ema = 1000 / 60;
  }

  get quality(): QualityTier {
    return TIERS[this.tier];
  }

  /** Feed one frame interval (ms). Returns true when the tier just stepped down. */
  sample(dtMs: number): boolean {
    const dt = Math.min(Math.max(dtMs, 0), 100); // a hidden-tab gap is not a slow frame
    this.ema = this.ema * 0.9 + dt * 0.1;
    if (this.ema > this.budgetMs) this.slow++;
    else this.slow = 0;
    if (this.slow >= this.frames && this.tier < this.maxTier) {
      this.tier++;
      this.slow = 0;
      this.ema = this.budgetMs * 0.75; // give the new tier a fair start
      if (!this.logged.has(this.tier) && typeof console !== "undefined") {
        this.logged.add(this.tier);
        console.info(`[${this.label}] frame governor → tier ${this.tier}`, TIERS[this.tier]);
      }
      return true;
    }
    return false;
  }
}
