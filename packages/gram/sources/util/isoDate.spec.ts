import { describe, it, expect } from 'vitest';
import {
  parseISODate,
  toISODateString,
  toISODateTimeString,
  addDuration,
  subDuration,
  dateDiff,
  startOf,
  endOf
} from './isoDate';

describe('parseISODate', () => {
  it('parses date-only string', () => {
    const date = parseISODate('2024-01-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(15);
  });

  it('parses datetime string', () => {
    const date = parseISODate('2024-01-15T14:30:45');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
    expect(date.getSeconds()).toBe(45);
  });
});

describe('toISODateString', () => {
  it('formats date to YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15);
    expect(toISODateString(date)).toBe('2024-01-15');
  });
});

describe('toISODateTimeString', () => {
  it('formats date to YYYY-MM-DDTHH:mm:ss', () => {
    const date = new Date(2024, 0, 15, 14, 30, 45);
    expect(toISODateTimeString(date)).toBe('2024-01-15T14:30:45');
  });
});

describe('addDuration', () => {
  it('adds seconds', () => {
    const result = addDuration('2024-01-15T12:00:00', 30, 'seconds');
    expect(toISODateTimeString(result)).toBe('2024-01-15T12:00:30');
  });

  it('adds minutes', () => {
    const result = addDuration('2024-01-15T12:00:00', 15, 'minutes');
    expect(toISODateTimeString(result)).toBe('2024-01-15T12:15:00');
  });

  it('adds hours', () => {
    const result = addDuration('2024-01-15T12:00:00', 3, 'hours');
    expect(toISODateTimeString(result)).toBe('2024-01-15T15:00:00');
  });

  it('adds days', () => {
    const result = addDuration('2024-01-15', 5, 'days');
    expect(toISODateString(result)).toBe('2024-01-20');
  });

  it('adds weeks', () => {
    const result = addDuration('2024-01-15', 2, 'weeks');
    expect(toISODateString(result)).toBe('2024-01-29');
  });

  it('adds months', () => {
    const result = addDuration('2024-01-15', 3, 'months');
    expect(toISODateString(result)).toBe('2024-04-15');
  });

  it('adds years', () => {
    const result = addDuration('2024-01-15', 2, 'years');
    expect(toISODateString(result)).toBe('2026-01-15');
  });

  it('accepts Date object', () => {
    const date = new Date(2024, 0, 15);
    const result = addDuration(date, 5, 'days');
    expect(toISODateString(result)).toBe('2024-01-20');
  });
});

describe('subDuration', () => {
  it('subtracts seconds', () => {
    const result = subDuration('2024-01-15T12:00:30', 30, 'seconds');
    expect(toISODateTimeString(result)).toBe('2024-01-15T12:00:00');
  });

  it('subtracts days', () => {
    const result = subDuration('2024-01-15', 5, 'days');
    expect(toISODateString(result)).toBe('2024-01-10');
  });

  it('subtracts months', () => {
    const result = subDuration('2024-01-15', 1, 'months');
    expect(toISODateString(result)).toBe('2023-12-15');
  });
});

describe('dateDiff', () => {
  it('calculates difference in days', () => {
    const diff = dateDiff('2024-01-20', '2024-01-15', 'days');
    expect(diff).toBe(5);
  });

  it('calculates difference in hours', () => {
    const diff = dateDiff('2024-01-15T15:00:00', '2024-01-15T12:00:00', 'hours');
    expect(diff).toBe(3);
  });

  it('calculates difference in weeks', () => {
    const diff = dateDiff('2024-01-29', '2024-01-15', 'weeks');
    expect(diff).toBe(2);
  });

  it('returns negative for earlier dates', () => {
    const diff = dateDiff('2024-01-10', '2024-01-15', 'days');
    expect(diff).toBe(-5);
  });
});

describe('startOf', () => {
  it('gets start of day', () => {
    const result = startOf('2024-01-15T14:30:45', 'day');
    expect(toISODateTimeString(result)).toBe('2024-01-15T00:00:00');
  });

  it('gets start of month', () => {
    const result = startOf('2024-01-15', 'month');
    expect(toISODateString(result)).toBe('2024-01-01');
  });

  it('gets start of year', () => {
    const result = startOf('2024-06-15', 'year');
    expect(toISODateString(result)).toBe('2024-01-01');
  });
});

describe('endOf', () => {
  it('gets end of day', () => {
    const result = endOf('2024-01-15T14:30:45', 'day');
    expect(toISODateTimeString(result)).toBe('2024-01-15T23:59:59');
  });

  it('gets end of month', () => {
    const result = endOf('2024-01-15', 'month');
    expect(toISODateString(result)).toBe('2024-01-31');
  });

  it('gets end of year', () => {
    const result = endOf('2024-06-15', 'year');
    expect(toISODateString(result)).toBe('2024-12-31');
  });
});
