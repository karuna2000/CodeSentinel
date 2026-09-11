'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileText,
  ChevronRight,
  ChevronDown,
  GitBranch,
  BookOpen,
  Search,
  X,
} from 'lucide-react';

interface WikiPageMeta {
  id: string;
  path: string;
  title: string;
  updated_at: string;
}

interface DiagramMeta {
  id: string;
  path: string | null;
  type: string;
  updated_at: string;
}

interface WikiSidebarProps {
  pages: WikiPageMeta[];
  diagrams: DiagramMeta[];
  selectedPath: string | null;
  onSelectPage: (path: string) => void;
  onSelectDiagram: (id: string) => void;
  selectedDiagramId: string | null;
}

interface TreeNode {
  name: string;
  path: string;
  title: string;
  children: TreeNode[];
  isPage: boolean;
}

function buildTree(pages: WikiPageMeta[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const page of pages) {
    const parts = page.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const path = parts.slice(0, i + 1).join('/');
      let node = current.find(n => n.name === part);

      if (!node) {
        const isLeaf = i === parts.length - 1;
        node = {
          name: part,
          path,
          title: isLeaf ? page.title : part,
          children: [],
          isPage: isLeaf,
        };
        current.push(node);
      }
      current = node.children;
    }
  }

  return root;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return true;
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function TreeNodeItem({
  node,
  depth,
  selectedPath,
  onSelectPage,
  searchActive,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectPage: (path: string) => void;
  searchActive: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPath === node.path && node.isPage;

  return (
    <div>
      <button
        onClick={() => {
          if (node.isPage) onSelectPage(node.path);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={`wiki-sidebar-item ${isSelected ? 'wiki-sidebar-item--active' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="wiki-icon wiki-icon--sm" />
          ) : (
            <ChevronRight className="wiki-icon wiki-icon--sm" />
          )
        ) : (
          <span className="wiki-icon wiki-icon--spacer" />
        )}
        <FileText className="wiki-icon wiki-icon--page" />
        <span className="wiki-sidebar-label">{node.title || node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectPage={onSelectPage}
              searchActive={searchActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function WikiSidebar({
  pages,
  diagrams,
  selectedPath,
  onSelectPage,
  onSelectDiagram,
  selectedDiagramId,
}: WikiSidebarProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const isSearching = query.trim().length > 0;

  const filteredPages = useMemo(() => {
    if (!isSearching) return pages;
    return pages.filter(p => fuzzyMatch(query.trim(), `${p.title} ${p.path}`));
  }, [pages, query, isSearching]);

  const filteredDiagrams = useMemo(() => {
    if (!isSearching) return diagrams;
    return diagrams.filter(d =>
      fuzzyMatch(query.trim(), `${d.type} ${d.path ?? ''}`)
    );
  }, [diagrams, query, isSearching]);

  const tree = useMemo(() => buildTree(filteredPages), [filteredPages]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && isSearching) {
        setQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearching]);

  return (
    <nav className="wiki-sidebar">
      {/* Search */}
      <div className="wiki-search">
        <Search className="wiki-search-icon" />
        <input
          ref={searchRef}
          className="wiki-search-input"
          type="text"
          placeholder="Search wiki… (⌘K)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search wiki pages and diagrams"
        />
        {isSearching && (
          <button
            className="wiki-search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Wiki Pages */}
      <div className="wiki-sidebar-section">
        <div className="wiki-sidebar-section-header">
          <BookOpen className="wiki-icon wiki-icon--section" />
          <span>Wiki Pages</span>
          <span className="wiki-sidebar-count">
            {isSearching ? filteredPages.length : pages.length}
          </span>
        </div>
        {filteredPages.length === 0 ? (
          <p className="wiki-sidebar-empty">
            {isSearching
              ? 'No pages match your search.'
              : 'No wiki pages yet. Generate the wiki to get started.'}
          </p>
        ) : (
          tree.map(node => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelectPage={onSelectPage}
              searchActive={isSearching}
            />
          ))
        )}
      </div>

      {/* Diagrams */}
      {filteredDiagrams.length > 0 && (
        <div className="wiki-sidebar-section">
          <div className="wiki-sidebar-section-header">
            <GitBranch className="wiki-icon wiki-icon--section" />
            <span>Diagrams</span>
            <span className="wiki-sidebar-count">{filteredDiagrams.length}</span>
          </div>
          {filteredDiagrams.map(diagram => (
            <button
              key={diagram.id}
              onClick={() => onSelectDiagram(diagram.id)}
              className={`wiki-sidebar-item ${selectedDiagramId === diagram.id ? 'wiki-sidebar-item--active' : ''}`}
              style={{ paddingLeft: '12px' }}
            >
              <GitBranch className="wiki-icon wiki-icon--diagram" />
              <span className="wiki-sidebar-label">
                {diagram.type.charAt(0) + diagram.type.slice(1).toLowerCase()} Diagram
                {diagram.path ? ` (${diagram.path.split('/').pop()})` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}