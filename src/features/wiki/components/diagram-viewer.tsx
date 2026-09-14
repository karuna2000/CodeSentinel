'use client';

import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';

interface DiagramViewerProps {
  mermaidSrc: string;
  className?: string;
}

export function DiagramViewer({ mermaidSrc, className = '' }: DiagramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        // Dynamically import mermaid to keep it client-only
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'dark',
          themeVariables: {
            primaryColor: '#15204a',
            primaryTextColor: '#fbfaf0',
            primaryBorderColor: '#0d6242',
            lineColor: '#2f4b7c',
            secondaryColor: '#0d6242',
            tertiaryColor: '#101b3e',
            edgeLabelBackground: '#101b3e',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
        });

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: renderedSvg } = await mermaid.render(id, mermaidSrc);
        if (!cancelled) setSvg(renderedSvg);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [mermaidSrc]);

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svg) return;
    if (!svgEl) {
      downloadSvg();
      return;
    }

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    const vb = svgEl.viewBox.baseVal;
    const width = vb.width || svgEl.clientWidth || 800;
    const height = vb.height || svgEl.clientHeight || 600;

    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(pngBlob => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `diagram-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  if (error) {
    return (
      <div className="diagram-error">
        <p className="diagram-error-title">⚠️ Diagram Error</p>
        <pre className="diagram-error-src">{mermaidSrc}</pre>
        <p className="diagram-error-msg">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="diagram-loading">
        <div className="diagram-spinner" />
        <span>Rendering diagram…</span>
      </div>
    );
  }

  return (
    <div className={`diagram-viewer ${isFullscreen ? 'diagram-viewer--fullscreen' : ''} ${className}`}>
      {/* Controls */}
      <div className="diagram-controls">
        <button
          className="diagram-ctrl-btn"
          onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="diagram-zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          className="diagram-ctrl-btn"
          onClick={() => setZoom(z => Math.min(3, z + 0.15))}
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="diagram-ctrl-btn"
          onClick={() => { setZoom(1); setIsFullscreen(f => !f); }}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <Maximize2 size={14} />
        </button>
        <span className="diagram-ctrl-sep" />
        <button
          className="diagram-ctrl-btn"
          onClick={downloadSvg}
          title="Download SVG"
          aria-label="Download SVG"
        >
          <Download size={14} />
        </button>
        <button
          className="diagram-ctrl-btn"
          onClick={downloadPng}
          title="Download PNG"
          aria-label="Download PNG"
        >
          <Download size={14} className="diagram-ctrl-png" />
        </button>
      </div>

      {/* SVG Canvas */}
      <div
        className="diagram-canvas"
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: svg }}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      />
    </div>
  );
}
