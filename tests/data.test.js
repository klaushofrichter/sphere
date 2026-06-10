import { describe, it, expect } from 'vitest';
import { makeCards, CARD_COUNT, COLS, ROWS } from '../src/data.js';

describe('makeCards', () => {
  it('produces COLS*ROWS = 100 cards', () => {
    expect(CARD_COUNT).toBe(100);
    expect(COLS * ROWS).toBe(CARD_COUNT);
    expect(makeCards()).toHaveLength(100);
  });

  it('is deterministic', () => {
    expect(makeCards()).toEqual(makeCards());
  });

  it('gives every card the required fields', () => {
    for (const [i, card] of makeCards().entries()) {
      expect(card.id).toBe(i);
      expect(card.client).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.tags.length).toBeGreaterThanOrEqual(1);
      expect(card.year).toBeGreaterThanOrEqual(2017);
      expect(card.year).toBeLessThanOrEqual(2026);
      expect(card.image).toBe(`/assets/img-${i}.jpg`);
    }
  });
});
