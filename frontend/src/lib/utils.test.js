import { fuzzyMatch } from './utils.js';

describe('fuzzyMatch', () => {
  it('returns true when query is empty', () => {
    expect(fuzzyMatch('hello', '')).toBe(true);
    expect(fuzzyMatch('hello', null)).toBe(true);
    expect(fuzzyMatch('hello', undefined)).toBe(true);
  });

  it('returns false when itemText is falsy and query is not empty', () => {
    expect(fuzzyMatch('', 'a')).toBe(false);
    expect(fuzzyMatch(null, 'a')).toBe(false);
    expect(fuzzyMatch(undefined, 'a')).toBe(false);
  });

  it('matches exactly identical strings', () => {
    expect(fuzzyMatch('hello world', 'hello world')).toBe(true);
  });

  it('matches exact substrings', () => {
    expect(fuzzyMatch('hello world', 'world')).toBe(true);
    expect(fuzzyMatch('hello world', 'lo wo')).toBe(true);
  });

  it('performs case-insensitive matching', () => {
    expect(fuzzyMatch('HeLlO wOrLd', 'hello')).toBe(true);
    expect(fuzzyMatch('hello world', 'WORLD')).toBe(true);
    expect(fuzzyMatch('HeLlO wOrLd', 'HeLlO wOrLd')).toBe(true);
  });

  it('performs fuzzy matching (subsequence matching)', () => {
    expect(fuzzyMatch('axbyc', 'abc')).toBe(true);
    expect(fuzzyMatch('hello world', 'hlowrd')).toBe(true);
    expect(fuzzyMatch('frontend development', 'fdev')).toBe(true);
  });

  it('fails when subsequence characters are out of order', () => {
    expect(fuzzyMatch('axbyc', 'cba')).toBe(false);
    expect(fuzzyMatch('hello', 'eh')).toBe(false);
  });

  it('handles numbers and other types by converting them to strings', () => {
    expect(fuzzyMatch(12345, 234)).toBe(true);
    expect(fuzzyMatch(12345, '24')).toBe(true);
    expect(fuzzyMatch(12345, 54)).toBe(false);
  });

  it('fails if query has characters not in itemText', () => {
    expect(fuzzyMatch('hello', 'hellox')).toBe(false);
    expect(fuzzyMatch('hello', 'z')).toBe(false);
  });
});
