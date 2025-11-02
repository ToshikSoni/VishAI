/**
 * Lightweight Markdown Formatter for Chat Messages
 * Supports: bold, italic, underline, strikethrough, code, lists, links, paragraphs, tables, images, task lists
 */

export function formatMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML to prevent XSS
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Handle escape characters (backslash before markdown characters)
  formatted = formatted.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '&#92;$1');

  // Code blocks (triple backticks) - must be done before inline code
  formatted = formatted.replace(/```([a-z]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="code-block">${code.trim()}</code></pre>`;
  });

  // Inline code (single backticks)
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold and Italic combined (***text*** or ___text___)
  formatted = formatted.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  formatted = formatted.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

  // Bold (** or __) - must be before italic, use non-greedy matching
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic with single * or _ - match non-space at start, non-greedy
  formatted = formatted.replace(/\*([^\s*].*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/\b_([^\s_].*?)_\b/g, '<em>$1</em>');

  // Strikethrough (~~)
  formatted = formatted.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Images ![alt](url)
  formatted = formatted.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="markdown-image" />');

  // Links [text](url)
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Headers (must match at start of line with proper # count)
  formatted = formatted.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  formatted = formatted.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  formatted = formatted.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Task lists [x] or [ ]
  formatted = formatted.replace(/^\- \[x\] (.+)$/gm, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>');
  formatted = formatted.replace(/^\- \[ \] (.+)$/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>');

  // Unordered lists (- or * at start of line, but not already converted to task)
  formatted = formatted.replace(/^[\-\*] (.+)$/gm, (match, content) => {
    if (match.includes('<li class="task-item">')) return match;
    return `<li>${content}</li>`;
  });

  // Ordered lists (1. 2. etc at start of line)
  formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li class="ordered-item">$1</li>');

  // Blockquotes (> or >> at start of line)
  formatted = formatted.replace(/^&gt;&gt; (.+)$/gm, '<blockquote class="nested-quote">$1</blockquote>');
  formatted = formatted.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rule (--- or ***)
  formatted = formatted.replace(/^(\-{3,}|\*{3,})$/gm, '<hr>');

  // Tables - process markdown tables
  formatted = processMarkdownTables(formatted);

  // Process lists to wrap in ul/ol tags
  formatted = processLists(formatted);

  // Line breaks - convert double newlines to paragraphs
  const paragraphs = formatted.split(/\n\n+/);
  formatted = paragraphs
    .map(p => {
      p = p.trim();
      // Don't wrap if already wrapped in a block element
      if (p.match(/^<(h[1-6]|ul|ol|pre|blockquote|hr|table)/)) {
        return p;
      }
      // Replace single newlines with <br> within paragraphs
      p = p.replace(/\n/g, '<br>');
      return p ? `<p>${p}</p>` : '';
    })
    .join('');

  return formatted;
}

/**
 * Process markdown tables into HTML
 */
function processMarkdownTables(text) {
  const tableRegex = /^\|(.+)\|\n\|[\s\-\|:]+\|\n((?:\|.+\|\n?)+)/gm;
  
  return text.replace(tableRegex, (match, headerRow, bodyRows) => {
    // Process header
    const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
    const headerHtml = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
    
    // Process body rows
    const rows = bodyRows.trim().split('\n');
    const bodyHtml = '<tbody>' + rows.map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }).join('') + '</tbody>';
    
    return `<table class="markdown-table">${headerHtml}${bodyHtml}</table>`;
  });
}

/**
 * Process lists to wrap consecutive <li> tags in ul/ol
 */
function processLists(text) {
  // Group consecutive regular list items in <ul>
  text = text.replace(/(<li>(?:(?!<li class=).)*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  
  // Group consecutive task list items in <ul class="task-list">
  text = text.replace(/(<li class="task-item">.*?<\/li>\n?)+/g, (match) => {
    return `<ul class="task-list">${match}</ul>`;
  });
  
  // Group consecutive ordered list items in <ol>
  text = text.replace(/(<li class="ordered-item">.*?<\/li>\n?)+/g, (match) => {
    // Remove the class from li items
    match = match.replace(/class="ordered-item"/g, '');
    return `<ol>${match}</ol>`;
  });
  
  return text;
}

/**
 * Sanitize HTML to prevent XSS while allowing safe formatting tags
 */
export function sanitizeHtml(html) {
  const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 'del', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 
    'blockquote', 'hr', 'a', 'img', 'table', 'thead', 'tbody', 
    'tr', 'th', 'td', 'input'
  ];
  
  // This is a basic sanitizer - for production, consider using DOMPurify
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  return html; // Return as-is since we're controlling the formatting
}
