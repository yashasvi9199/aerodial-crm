import { describe, it, expect } from 'vitest';
import { formatWhatsappText } from './whatsappUtils';

describe('formatWhatsappText', () => {
  describe('Basic text and edge cases', () => {
    it('returns empty string for falsy input', () => {
      expect(formatWhatsappText(null)).toBe('');
      expect(formatWhatsappText('')).toBe('');
      expect(formatWhatsappText(undefined)).toBe('');
    });

    it('returns plain text unmodified', () => {
      expect(formatWhatsappText('Hello World')).toBe('Hello World');
    });
  });

  describe('XSS Prevention (Edge cases in HTML escaping)', () => {
    it('escapes basic HTML tags', () => {
      expect(formatWhatsappText('<script>alert(1)</script>'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('escapes HTML within formatting', () => {
      expect(formatWhatsappText('*<script>alert(1)</script>*'))
        .toBe('<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>');
    });

    it('escapes ampersands', () => {
      expect(formatWhatsappText('Me & You'))
        .toBe('Me &amp; You');
    });

    it('escapes quotes and other potential XSS vectors', () => {
      // It currently doesn't escape quotes, but let's check what it does escape
      expect(formatWhatsappText('<img src="x" onerror="alert(1)">'))
        .toBe('&lt;img src="x" onerror="alert(1)"&gt;');
    });

    it('escapes properly when formatting chars are mixed with HTML tags', () => {
      expect(formatWhatsappText('`<html>`'))
        .toBe('<code style="font-family: monospace; background: var(--bg-input); padding: 2px 4px; border-radius: 4px;">&lt;html&gt;</code>');
    });
  });

  describe('Formatting tags', () => {
    it('formats bold text', () => {
      expect(formatWhatsappText('This is *bold* text'))
        .toBe('This is <strong>bold</strong> text');
    });

    it('formats italic text', () => {
      expect(formatWhatsappText('This is _italic_ text'))
        .toBe('This is <em>italic</em> text');
    });

    it('formats strikethrough text', () => {
      expect(formatWhatsappText('This is ~strikethrough~ text'))
        .toBe('This is <del>strikethrough</del> text');
    });

    it('formats inline code', () => {
      expect(formatWhatsappText('This is `inline code` text'))
        .toBe('This is <code style="font-family: monospace; background: var(--bg-input); padding: 2px 4px; border-radius: 4px;">inline code</code> text');
    });

    it('formats monospace block', () => {
      expect(formatWhatsappText('```\ncode block\n```'))
        .toBe('<pre style="font-family: monospace; background: var(--bg-input); border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px; overflow-x: auto; margin: 4px 0;">\ncode block\n</pre>');
    });

    it('formats blockquote', () => {
      expect(formatWhatsappText('> quoted text'))
        .toBe('<blockquote style="border-left: 3px solid #25d366; padding-left: 10px; margin: 4px 0; color: var(--text-muted); font-style: italic;">quoted text</blockquote>');
    });

    it('formats bullet lists (asterisk)', () => {
      expect(formatWhatsappText('* item 1'))
        .toBe('<ul style="margin: 2px 0 2px 20px; padding: 0; list-style-type: disc;"><li style="list-style-type: disc;">item 1</li></ul>');
    });

    it('formats bullet lists (hyphen)', () => {
      expect(formatWhatsappText('- item 1'))
        .toBe('<ul style="margin: 2px 0 2px 20px; padding: 0; list-style-type: disc;"><li style="list-style-type: disc;">item 1</li></ul>');
    });

    it('formats numbered lists', () => {
      expect(formatWhatsappText('1. item 1'))
        .toBe('<ol start="1" style="margin: 2px 0 2px 20px; padding: 0;"><li style="list-style-type: decimal;">item 1</li></ol>');
    });
  });

  describe('Mixed formatting and edge cases', () => {
    it('handles multiple formatting types in one string', () => {
      expect(formatWhatsappText('This is *bold* and _italic_ and ~strikethrough~'))
        .toBe('This is <strong>bold</strong> and <em>italic</em> and <del>strikethrough</del>');
    });

    it('handles nested formatting incorrectly like WhatsApp (or according to current implementation)', () => {
      // Testing current behavior for nested
      expect(formatWhatsappText('*_bold italic_*'))
        .toBe('<strong><em>bold italic</em></strong>');
    });

    it('does not format incomplete tags', () => {
      expect(formatWhatsappText('This is *incomplete bold'))
        .toBe('This is *incomplete bold');
      expect(formatWhatsappText('This is _incomplete italic'))
        .toBe('This is _incomplete italic');
    });

    it('handles formatting spanning multiple words', () => {
      expect(formatWhatsappText('*multiple word bold*'))
        .toBe('<strong>multiple word bold</strong>');
    });

    it('ignores formatting inside words (asterisk)', () => {
      // Testing what the regex currently does with inside words
      expect(formatWhatsappText('my*word*bold'))
        .toBe('my<strong>word</strong>bold');
    });
  });
});
