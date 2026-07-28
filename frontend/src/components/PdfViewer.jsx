import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";

// Use the matching pdfjs worker shipped with react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfViewer({ fileBlob }) {
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(1);
    setError(null);
  }, [fileBlob]);

  if (!fileBlob) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-card">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            data-testid="pdf-prev-page"
            className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums px-2" data-testid="pdf-page-indicator">
            {page} / {numPages ?? "…"}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(numPages || p, p + 1))}
            disabled={!numPages || page >= numPages}
            data-testid="pdf-next-page"
            className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            data-testid="pdf-zoom-out"
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.4, s + 0.15))}
            data-testid="pdf-zoom-in"
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto bg-muted/40 p-4 flex justify-center">
        {error ? (
          <div className="flex items-center justify-center text-sm text-destructive">
            Failed to render PDF — {error}
          </div>
        ) : (
          <Document
            file={fileBlob}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(e) => setError(e?.message || "load error")}
            loading={
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Rendering PDF…
              </div>
            }
          >
            <Page
              pageNumber={page}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-lg bg-white"
            />
          </Document>
        )}
      </div>
    </div>
  );
}
