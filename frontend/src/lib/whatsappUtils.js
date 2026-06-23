/**
 * Parses raw WhatsApp message formatting markup into stylized HTML.
 * Supports:
 * - *bold*
 * - _italic_
 * - ~strikethrough~
 * - ```monospace```
 * - `inline code`
 * - > blockquote
 * - * bullet list / - bullet list
 * - 1. numbered list
 */
import DOMPurify from 'dompurify';

export function formatWhatsappText(text) {
  if (!text) return '';
  
  // Escape HTML characters to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Split into lines to parse line-level formatting
  const lines = html.split('\n');
  const formattedLines = lines.map(line => {
    // Blockquote
    if (line.startsWith('&gt; ')) {
      return `<blockquote style="border-left: 3px solid #25d366; padding-left: 10px; margin: 4px 0; color: var(--text-muted); font-style: italic;">${line.substring(5)}</blockquote>`;
    }
    
    // Bullet list
    const bulletMatch = line.match(/^(\*|-|•)\s+(.*)$/);
    if (bulletMatch) {
      return `<ul style="margin: 2px 0 2px 20px; padding: 0; list-style-type: disc;"><li style="list-style-type: disc;">${bulletMatch[2]}</li></ul>`;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      return `<ol start="${numMatch[1]}" style="margin: 2px 0 2px 20px; padding: 0;"><li style="list-style-type: decimal;">${numMatch[2]}</li></ol>`;
    }

    return line;
  });
  
  html = formattedLines.join('\n');

  // Monospace blocks: ```text```
  html = html.replace(/```([\s\S]+?)```/g, (match, p1) => {
    return `<pre style="font-family: monospace; background: var(--bg-input); border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px; overflow-x: auto; margin: 4px 0;">${p1}</pre>`;
  });

  // Inline Code: `text`
  html = html.replace(/`([^`\n]+?)`/g, '<code style="font-family: monospace; background: var(--bg-input); padding: 2px 4px; border-radius: 4px;">$1</code>');

  // Bold: *text*
  html = html.replace(/\*([^\s*][^*]*[^\s*]|[^\s*])\*/g, '<strong>$1</strong>');

  // Italic: _text_
  html = html.replace(/_([^\s_][^_]*[^\s_]|[^\s_])_/g, '<em>$1</em>');

  // Strikethrough: ~text~
  html = html.replace(/~([^\s~][^~]*[^\s~]|[^\s~])~/g, '<del>$1</del>');

  return DOMPurify.sanitize(html, { ALLOWED_ATTR: ['style', 'start'] });
}

/**
 * Inserts formatting tags at the current cursor position or wraps selection.
 */
export function insertFormattingTag(textareaRef, message, setMessage, type) {
  if (!textareaRef.current) return;
  const textarea = textareaRef.current;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  switch (type) {
    case 'bold':
      replacement = `*${selectedText}*`;
      cursorOffset = selectedText ? 0 : 1;
      break;
    case 'italic':
      replacement = `_${selectedText}_`;
      cursorOffset = selectedText ? 0 : 1;
      break;
    case 'strikethrough':
      replacement = `~${selectedText}~`;
      cursorOffset = selectedText ? 0 : 1;
      break;
    case 'monospace':
      replacement = `\`\`\`${selectedText}\`\`\``;
      cursorOffset = selectedText ? 0 : 3;
      break;
    case 'blockquote':
      replacement = `> ${selectedText}`;
      cursorOffset = selectedText ? 0 : 2;
      break;
    case 'bullet':
      replacement = `- ${selectedText}`;
      cursorOffset = selectedText ? 0 : 2;
      break;
    default:
      return;
  }

  const newText = text.substring(0, start) + replacement + text.substring(end);
  setMessage(newText);

  // Focus and restore selections
  setTimeout(() => {
    textarea.focus();
    if (selectedText) {
      textarea.setSelectionRange(start, start + replacement.length);
    } else {
      textarea.setSelectionRange(start + replacement.length - cursorOffset, start + replacement.length - cursorOffset);
    }
  }, 0);
}
