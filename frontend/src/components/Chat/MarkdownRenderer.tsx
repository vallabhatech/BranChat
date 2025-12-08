import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Simple markdown parser for common elements
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentIndex = 0;
    let globalListNumber = 1; // Track numbering across all ordered lists

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        elements.push(<br key={`br-${currentIndex++}`} />);
        continue;
      }

      // Headers
      if (trimmedLine.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${currentIndex++}`} className="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100">
            {parseInlineMarkdown(trimmedLine.substring(2))}
          </h1>
        );
      } else if (trimmedLine.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${currentIndex++}`} className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100">
            {parseInlineMarkdown(trimmedLine.substring(3))}
          </h2>
        );
      } else if (trimmedLine.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${currentIndex++}`} className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">
            {parseInlineMarkdown(trimmedLine.substring(4))}
          </h3>
        );
      } else if (trimmedLine.startsWith('#### ')) {
        elements.push(
          <h4 key={`h4-${currentIndex++}`} className="text-base font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">
            {parseInlineMarkdown(trimmedLine.substring(5))}
          </h4>
        );
      } else if (trimmedLine.startsWith('##### ')) {
        elements.push(
          <h5 key={`h5-${currentIndex++}`} className="text-sm font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">
            {parseInlineMarkdown(trimmedLine.substring(6))}
          </h5>
        );
      } else if (trimmedLine.startsWith('###### ')) {
        elements.push(
          <h6 key={`h6-${currentIndex++}`} className="text-xs font-bold mt-2 mb-1 text-gray-900 dark:text-gray-100">
            {parseInlineMarkdown(trimmedLine.substring(7))}
          </h6>
        );
      }
      // Unordered lists
      else if (trimmedLine.match(/^[\*\-\+]\s+/)) {
        const listItems = [];
        let j = i;
        
        while (j < lines.length && lines[j].trim().match(/^[\*\-\+]\s+/)) {
          const itemText = lines[j].trim().replace(/^[\*\-\+]\s+/, '');
          listItems.push(
            <li key={`li-${currentIndex++}`} className="mb-1">
              {parseInlineMarkdown(itemText)}
            </li>
          );
          j++;
        }
        
        elements.push(
          <ul key={`ul-${currentIndex++}`} className="list-disc list-inside mb-4 ml-4 space-y-1">
            {listItems}
          </ul>
        );
        i = j - 1; // Skip processed lines
      }
      // Ordered lists
      else if (trimmedLine.match(/^\d+\.\s+/)) {
        const listItems = [];
        let j = i;
        
        // Use the actual number from the markdown as the starting point
        const firstMarkdownNumber = parseInt(trimmedLine.match(/^(\d+)\./)?.[1] || '1');
        let listNumber = firstMarkdownNumber;
        
        // If this looks like a continuation (starts with number > 1), use it
        // Otherwise, check if we should continue from global counter
        if (firstMarkdownNumber === 1 && globalListNumber > 1) {
          // Check if there's a clear break that suggests a new list
          let hasBreak = false;
          for (let k = Math.max(0, i - 2); k < i; k++) {
            const prevLine = lines[k]?.trim() || '';
            if (prevLine.match(/^#{1,6}\s/) || prevLine.startsWith('**') && prevLine.endsWith('**')) {
              hasBreak = true;
              break;
            }
          }
          if (!hasBreak) {
            listNumber = globalListNumber;
          } else {
            globalListNumber = 1;
            listNumber = 1;
          }
        }
        
        while (j < lines.length && lines[j].trim().match(/^\d+\.\s+/)) {
          const itemText = lines[j].trim().replace(/^\d+\.\s+/, '');
          listItems.push(
            <li key={`oli-${currentIndex++}`} className="mb-1 flex">
              <span className="mr-2 font-medium text-gray-700 dark:text-gray-300 min-w-[1.5rem]">
                {listNumber}.
              </span>
              <span className="flex-1">
                {parseInlineMarkdown(itemText)}
              </span>
            </li>
          );
          listNumber++;
          j++;
        }
        
        // Update global counter for next list
        globalListNumber = listNumber;
        
        elements.push(
          <ol key={`ol-${currentIndex++}`} className="mb-4 ml-4 space-y-1">
            {listItems}
          </ol>
        );
        i = j - 1; // Skip processed lines
      }
      // Code blocks
      else if (trimmedLine.startsWith('```')) {
        const codeLines = [];
        let j = i + 1;
        const language = trimmedLine.substring(3).trim();
        
        while (j < lines.length && !lines[j].trim().startsWith('```')) {
          codeLines.push(lines[j]);
          j++;
        }
        
        elements.push(
          <div key={`code-block-${currentIndex++}`} className="mb-4">
            {language && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">
                {language}
              </div>
            )}
            <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
              <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
                {codeLines.join('\n')}
              </code>
            </pre>
          </div>
        );
        i = j; // Skip to end of code block
      }
      // Blockquotes
      else if (trimmedLine.startsWith('> ')) {
        const quoteLines = [];
        let j = i;
        
        while (j < lines.length && lines[j].trim().startsWith('> ')) {
          quoteLines.push(lines[j].trim().substring(2));
          j++;
        }
        
        elements.push(
          <blockquote key={`quote-${currentIndex++}`} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 mb-4 italic text-gray-700 dark:text-gray-300">
            {quoteLines.map((quoteLine, idx) => (
              <div key={idx}>{parseInlineMarkdown(quoteLine)}</div>
            ))}
          </blockquote>
        );
        i = j - 1; // Skip processed lines
      }
      // Horizontal rule
      else if (trimmedLine.match(/^[-*_]{3,}$/)) {
        elements.push(
          <hr key={`hr-${currentIndex++}`} className="border-gray-300 dark:border-gray-600 my-6" />
        );
      }
      // Regular paragraphs
      else {
        elements.push(
          <p key={`p-${currentIndex++}`} className="mb-4 leading-7 text-gray-900 dark:text-gray-100">
            {parseInlineMarkdown(line)}
          </p>
        );
      }
    }

    return elements;
  };

  // Parse inline markdown (bold, italic, code, links)
  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let currentIndex = 0;
    let remaining = text;

    while (remaining.length > 0) {
      // Bold text **text**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        // Add text before bold
        if (boldMatch.index > 0) {
          elements.push(remaining.substring(0, boldMatch.index));
        }
        // Add bold text
        elements.push(
          <strong key={`bold-${currentIndex++}`} className="font-semibold">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // Italic text *text*
      const italicMatch = remaining.match(/\*(.*?)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        // Add text before italic
        if (italicMatch.index > 0) {
          elements.push(remaining.substring(0, italicMatch.index));
        }
        // Add italic text
        elements.push(
          <em key={`italic-${currentIndex++}`} className="italic">
            {italicMatch[1]}
          </em>
        );
        remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
        continue;
      }

      // Inline code `code`
      const codeMatch = remaining.match(/`(.*?)`/);
      if (codeMatch && codeMatch.index !== undefined) {
        // Add text before code
        if (codeMatch.index > 0) {
          elements.push(remaining.substring(0, codeMatch.index));
        }
        // Add code
        elements.push(
          <code key={`code-${currentIndex++}`} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-red-600 dark:text-red-400">
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
        continue;
      }

      // Links [text](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch && linkMatch.index !== undefined) {
        // Add text before link
        if (linkMatch.index > 0) {
          elements.push(remaining.substring(0, linkMatch.index));
        }
        // Add link
        elements.push(
          <a
            key={`link-${currentIndex++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {linkMatch[1]}
          </a>
        );
        remaining = remaining.substring(linkMatch.index + linkMatch[0].length);
        continue;
      }

      // No more markdown found, add remaining text
      elements.push(remaining);
      break;
    }

    return elements;
  };

  return (
    <div className={`markdown-content ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
}