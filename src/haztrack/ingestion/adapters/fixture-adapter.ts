import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { IHazardFeedAdapter, RawHazard } from './types';

export class FixtureFeedAdapter implements IHazardFeedAdapter {
  constructor(public readonly source: 'bom' | 'afac' | 'ses') {}

  async fetch(): Promise<RawHazard[]> {
    const filePath = resolve(process.cwd(), `fixtures/${this.source}.json`);
    const raw = await readFile(filePath, 'utf-8');
    const all: RawHazard[] = JSON.parse(raw);
    const count = Math.max(1, Math.floor(Math.random() * all.length) + 1);
    return all.slice(0, count);
  }
}
