import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-white text-lg font-black mt-6 mb-3 leading-snug">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-white text-base font-black mt-5 mb-2.5 leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-white text-sm font-black mt-4 mb-2 leading-snug">{children}</h3>
  ),

  // Paragraph
  p: ({ children }) => (
    <p className="text-neutral-300 text-sm leading-7 mb-3">{children}</p>
  ),

  // Bold / Italic
  strong: ({ children }) => (
    <strong className="text-white font-bold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-neutral-200 italic">{children}</em>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-3 text-neutral-300 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-3 text-neutral-300 text-sm">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-6">{children}</li>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/50 pl-4 my-3 text-neutral-400 italic">{children}</blockquote>
  ),

  // Code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code className="block bg-[#111] border border-white/8 rounded-lg px-4 py-3 text-xs font-mono text-green-400 overflow-x-auto my-3 whitespace-pre">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[#111] border border-white/8 rounded px-1.5 py-0.5 text-xs font-mono text-orange-300">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,

  // Horizontal rule
  hr: () => <hr className="border-white/8 my-6" />,

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-orange-300 transition-colors"
    >
      {children}
    </a>
  ),

  // Tables (GFM)
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-white/10">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-neutral-300">{children}</td>
  ),
};

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) {
    return <span className="text-neutral-700 italic text-sm">Bài viết chưa có nội dung.</span>;
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
