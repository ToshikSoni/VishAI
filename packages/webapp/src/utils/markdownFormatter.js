export function formatMarkdown(text) {
  if (!text) return '';

  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  formatted = formatted.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '&#92;$1');

  formatted = formatted.replace(/```([a-z]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="code-block">${code.trim()}</code></pre>`;
  });

  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  formatted = formatted.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  formatted = formatted.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');

  formatted = formatted.replace(/\*([^\s*].*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/\b_([^\s_].*?)_\b/g, '<em>$1</em>');

  formatted = formatted.replace(/~~(.+?)~~/g, '<del>$1</del>');

  formatted = formatted.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="markdown-image" />');

  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  formatted = formatted.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  formatted = formatted.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  formatted = formatted.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  formatted = formatted.replace(/^\- \[x\] (.+)$/gm, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>');
  formatted = formatted.replace(/^\- \[ \] (.+)$/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>');
  formatted = formatted.replace(/^[\-\*] (.+)$/gm, (match, content) => {
    if (match.includes('<li class="task-item">')) return match;
    return `<li>${content}</li>`;
  });

  formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li class="ordered-item">$1</li>');
  formatted = formatted.replace(/^&gt;&gt; (.+)$/gm, '<blockquote class="nested-quote">$1</blockquote>');
  formatted = formatted.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  formatted = formatted.replace(/^(\-{3,}|\*{3,})$/gm, '<hr>');

  formatted = processMarkdownTables(formatted);
  formatted = processLists(formatted);
  const paragraphs = formatted.split(/\n\n+/);
  formatted = paragraphs
    .map(p => {
      p = p.trim();
      if (p.match(/^<(h[1-6]|ul|ol|pre|blockquote|hr|table)/)) {
        return p;
      }
      p = p.replace(/\n/g, '<br>');
      return p ? `<p>${p}</p>` : '';
    })
    .join('');

  return formatted;
}

function processMarkdownTables(text) {
  const tableRegex = /^\|(.+)\|\n\|[\s\-\|:]+\|\n((?:\|.+\|\n?)+)/gm;
  
  return text.replace(tableRegex, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
    const headerHtml = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
    const rows = bodyRows.trim().split('\n');
    const bodyHtml = '<tbody>' + rows.map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }).join('') + '</tbody>';
    
    return `<table class="markdown-table">${headerHtml}${bodyHtml}</table>`;
  });
}

function processLists(text) {
  text = text.replace(/(<li>(?:(?!<li class=).)*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  

  text = text.replace(/(<li class="task-item">.*?<\/li>\n?)+/g, (match) => {
    return `<ul class="task-list">${match}</ul>`;
  });
  
  text = text.replace(/((<li class="ordered-item">.*?<\/li>\n?)+)/g, (match) => {
    match = match.replace(/class="ordered-item"/g, '');
    return `<ol>${match}</ol>`;
  });
  
  return text;
}
