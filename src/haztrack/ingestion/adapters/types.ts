export interface RawHazard {
  externalId: string;
  geom: { type: string; coordinates: number[] };
  payload: Record<string, unknown>;
}

export interface IHazardFeedAdapter {
  source: 'bom' | 'afac' | 'ses';
  fetch(): Promise<RawHazard[]>;
}
