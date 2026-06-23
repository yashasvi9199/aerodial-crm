import { describe, it, expect } from 'vitest';
import { formatWhatsappText } from './whatsappUtils';

describe('formatWhatsappText', () => {
  it('returns empty string for falsy input', () => {
    expect(formatWhatsappText('')).toBe('');
    expect(formatWhatsappText(null)).toBe('');
    expect(formatWhatsappText(undefined)).toBe('');
  });

  it('escapes HTML characters to prevent XSS', () => {
    const input = '<script>alert("XSS & hacks")</script>';
    const result = formatWhatsappText(input);
    expect(result).toBe('&lt;script&gt;alert("XSS &amp; hacks")&lt;/script&gt;');
  });

  it('formats bold text', () => {
    expect(formatWhatsappText('*bold*')).toBe('<strong>bold</strong>');
    expect(formatWhatsappText('Hello *world*!')).toBe('Hello <strong>world</strong>!');
  });

  it('formats italic text', () => {
    expect(formatWhatsappText('_italic_')).toBe('<em>italic</em>');
    expect(formatWhatsappText('Hello _world_!')).toBe('Hello <em>world</em>!');
  });

  it('formats strikethrough text', () => {
    expect(formatWhatsappText('~strike~')).toBe('<del>strike</del>');
    expect(formatWhatsappText('Hello ~world~!')).toBe('Hello <del>world</del>!');
  });

  it('formats inline code', () => {
    const result = formatWhatsappText('`console.log("hello")`');
    expect(result).toContain('<code');
    expect(result).toContain('console.log("hello")</code>');
  });

  it('formats monospace blocks', () => {
    const input = '```\nline 1\nline 2\n```';
    const result = formatWhatsappText(input);
    expect(result).toContain('<pre');
    expect(result).toContain('line 1\nline 2');
    expect(result).toContain('</pre>');
  });

  it('formats blockquotes', () => {
    const input = '> This is a quote\nAnd this is not';
    const result = formatWhatsappText(input);
    expect(result).toContain('<blockquote');
    expect(result).toContain('This is a quote</blockquote>\nAnd this is not');
  });

  it('formats bullet lists', () => {
    const input1 = '- item 1';
    const input2 = '* item 2';
    expect(formatWhatsappText(input1)).toContain('<ul');
    expect(formatWhatsappText(input1)).toContain('<li');
    expect(formatWhatsappText(input1)).toContain('item 1</li></ul>');

    expect(formatWhatsappText(input2)).toContain('<ul');
    expect(formatWhatsappText(input2)).toContain('item 2</li></ul>');
  });

  it('formats numbered lists', () => {
    const input = '1. First item\n2. Second item';
    const result = formatWhatsappText(input);
    expect(result).toContain('<ol start="1"');
    expect(result).toContain('First item</li></ol>');
    expect(result).toContain('<ol start="2"');
    expect(result).toContain('Second item</li></ol>');
  });

  it('handles multiple formats in a single string', () => {
    const input = '*bold* and _italic_ with ~strike~';
    const result = formatWhatsappText(input);
    expect(result).toBe('<strong>bold</strong> and <em>italic</em> with <del>strike</del>');
  });

  it('handles unclosed tags', () => {
    const input = '*unclosed bold';
    const result = formatWhatsappText(input);
    expect(result).toBe('*unclosed bold'); // No formatting applied
  });

  it('handles nested tags', () => {
    const input = '*_bold italic_*';
    const result = formatWhatsappText(input);
    // Based on the regex, bold and italic should be applied
    expect(result).toBe('<strong><em>bold italic</em></strong>');
  });

  it('handles XSS inside nested/formatted tags', () => {
    const input = '*<script>alert(1)</script>*';
    const result = formatWhatsappText(input);
    expect(result).toBe('<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>');
  });
});
