import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, API } from "../lib/api";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Trash2, Sparkles, AlertTriangle, ShieldCheck, Activity,
  CheckCircle2, Download, Camera, Thermometer, Loader2, Eye, X, ExternalLink
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import PdfViewer from "../components/PdfViewer";
import ScoreBreakdown from "../components/ScoreBreakdown";
import MarkdownText from "../components/MarkdownText";

const RISK_COLORS = { Low: "#10B981", Moderate: "#F59E0B", Medium: "#F59E0B", High: "#E11D48" };
const RISK_ICONS = { Low: ShieldCheck, Moderate: Activity, Medium: Activity, High: AlertTriangle };

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [imageBlobs, setImageBlobs] = useState({}); // url -> object URL (authenticated fetch)
  const [pdfBlob, setPdfBlob] = useState(null);     // Blob object for react-pdf
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null); // for download/new-tab
  const [pdfLoading, setPdfLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Clean up PDF blob URL on unmount
  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfBlobUrl]);

  const ensurePdf = async () => {
    if (pdfBlob && pdfBlobUrl) return { blob: pdfBlob, url: pdfBlobUrl };
    setPdfLoading(true);
    try {
      const res = await api.get(`/predictions/${id}/report`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfBlobUrl(url);
      return { blob, url };
    } catch {
      toast.error("Failed to generate PDF");
      return null;
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePreviewPDF = async () => {
    const res = await ensurePdf();
    if (res) setPreviewOpen(true);
  };

  const handleOpenInNewTab = async () => {
    const res = await ensurePdf();
    if (!res) return;
    const w = window.open(res.url, "_blank");
    if (!w) toast.error("Pop-up blocked — allow pop-ups for this site");
  };

  useEffect(() => {
    api.get(`/predictions/${id}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error("Could not load prediction"))
      .finally(() => setLoading(false));
  }, [id]);

  // Pre-fetch authenticated image URLs into blob URLs
  useEffect(() => {
    if (!data?.image_analyses) return;
    const urls = [];
    Object.values(data.image_analyses).forEach((a) => {
      if (a?.original_url) urls.push(a.original_url);
      if (a?.overlay_url) urls.push(a.overlay_url);
      if (a?.thermal_url) urls.push(a.thermal_url);
    });
    const unique = Array.from(new Set(urls));
    Promise.all(unique.map((u) =>
      api.get(u.replace("/api", ""), { responseType: "blob" })
        .then((r) => [u, URL.createObjectURL(r.data)])
        .catch(() => [u, null])
    )).then((pairs) => {
      const map = {};
      pairs.forEach(([u, b]) => { if (b) map[u] = b; });
      setImageBlobs(map);
    });
    return () => { Object.values(imageBlobs).forEach(URL.revokeObjectURL); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleDelete = async () => {
    if (!window.confirm("Delete this assessment?")) return;
    try {
      await api.delete(`/predictions/${id}`);
      toast.success("Assessment deleted");
      navigate("/patients");
    } catch { toast.error("Failed to delete"); }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const res = await ensurePdf();
      if (!res) return;
      const filename = `NeuroDetect_Report_${data.patient_name.replace(/\s+/g, "_")}.pdf`;
      const a = document.createElement("a");
      a.href = res.url; a.download = filename; a.rel = "noopener";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.success("Download started — check your Downloads folder");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center" data-testid="detail-loading">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const RiskIcon = RISK_ICONS[data.risk_level] || Activity;
  const color = RISK_COLORS[data.risk_level] || "#64748B";

  const ia = data.image_analyses || {};

  const imgPairs = [
    { key: "hand", label: "Hand", icon: Camera, kind: "standard" },
    { key: "foot", label: "Foot", icon: Camera, kind: "standard" },
    { key: "thermal_hand", label: "Thermal Hand", icon: Thermometer, kind: "thermal" },
    { key: "thermal_foot", label: "Thermal Foot", icon: Thermometer, kind: "thermal" },
  ].filter((p) => data.image_analyses?.[p.key]?.score !== undefined);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto" data-testid="patient-detail-page">
      <div className="flex items-center justify-between mb-6">
        <Link to="/patients" data-testid="back-to-patients"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All patients
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={handlePreviewPDF} disabled={pdfLoading}
            data-testid="preview-pdf-button"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60">
            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            Preview PDF
          </button>
          <button onClick={handleDownloadPDF} disabled={downloading || pdfLoading}
            data-testid="download-pdf-button"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PDF Report
          </button>
          <button onClick={handleDelete} data-testid="delete-button"
            className="inline-flex items-center gap-2 text-sm text-destructive hover:bg-destructive/10 px-3 py-2 rounded-md">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-card p-8 mb-6 relative overflow-hidden"
        data-testid="patient-hero"
      >
        <div className="grain absolute inset-0 opacity-30 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: `${color}22`, color }}>
            <RiskIcon className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">
              {new Date(data.created_at).toLocaleString()}
            </p>
            <h1 className="text-3xl font-light tracking-tight" data-testid="patient-name-display">
              {data.patient_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data.age} years • {data.gender} • BMI {data.bmi}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1" data-testid="risk-label">
              Risk
            </p>
            <p className="text-5xl font-light tracking-tight tabular-nums" data-testid="risk-score-display" style={{ color }}>
              {data.risk_score}<span className="text-xl text-muted-foreground">%</span>
            </p>
            <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                style={{ background: `${color}22`, color }}
                data-testid="risk-level-badge"
              >
                {data.risk_level} Risk
              </span>
          </div>
        </div>

        {/* Score breakdown bars */}
        {data.score_breakdown && Object.keys(data.score_breakdown).length > 1 && (
          <div className="relative mt-6 pt-6 border-t border-border/60">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">Multimodal breakdown</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.score_breakdown).map(([k, v]) => (
                <div key={k} data-testid={`breakdown-${k}`}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{k}</span>
                    <span className="font-medium tabular-nums">{Math.round(v)}</span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8 }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* AI Explanation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-6 relative overflow-hidden"
        data-testid="ai-explanation-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">AI Clinical Explanation</p>
        </div>
        <MarkdownText
          className="text-sm text-foreground/90"
        >
          {data.ai_explanation}
        </MarkdownText>
      </motion.div>

      {/* Score Breakdown */}
      <ScoreBreakdown contributions={data.score_contributions} />

      {/* Image gallery */}
      {imgPairs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-xl border border-border/60 bg-card p-6 mb-6"
          data-testid="image-gallery"
        >
          <div className="flex items-center gap-2 mb-4">
            <Camera className="h-4 w-4 text-primary" />
            <h3 className="font-medium">AI Image Analysis</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {imgPairs.length} image{imgPairs.length > 1 ? "s" : ""} analyzed
            </span>
          </div>
          <div className="space-y-6">
            {imgPairs.map(({ key, label, icon: Icon, kind }) => {
              const a = data.image_analyses[key];
              return (
                <div key={key} className="rounded-lg border border-border/40 p-4" data-testid={`image-block-${key}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${kind === "thermal" ? "text-amber-500" : "text-primary"}`} />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium tabular-nums">Score {a.score}%</span>
                      <span className="text-muted-foreground">· {a.confidence}% conf.</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    {a.original_url && (
                      <ImgCard label="Original" url={a.original_url} blobs={imageBlobs} testid={`img-${key}-original`} />
                    )}
                    {a.overlay_url && (
                      <ImgCard label="AI Overlay" url={a.overlay_url} blobs={imageBlobs} testid={`img-${key}-overlay`} />
                    )}
                    {a.thermal_url && (
                      <ImgCard label={kind === "thermal" ? "Hotspot Map" : "AI Thermal"} url={a.thermal_url} blobs={imageBlobs} testid={`img-${key}-thermal`} />
                    )}
                  </div>
                  {a.findings?.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {a.findings.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.metrics && (
                    <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                      {Object.entries(a.metrics).map(([k, v]) => (
                        <div key={k} className="rounded bg-muted/40 px-2 py-1">
                          <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                          <span className="ml-1 font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-xl border border-border/60 bg-card p-6"
          data-testid="factors-card"
        >
          <h3 className="font-medium mb-4">Contributing factors</h3>
          {data.contributing_factors?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No significant risk factors detected.</p>
          ) : (
            <ul className="space-y-2">
              {data.contributing_factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-xl border border-border/60 bg-card p-6"
          data-testid="recommendations-card"
        >
          <h3 className="font-medium mb-4">Recommendations</h3>
          <ul className="space-y-3">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-xl border border-border/60 bg-card p-6"
        data-testid="inputs-summary"
      >
        <h3 className="font-medium mb-4">Assessment data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          <Item label="Blood sugar" value={`${data.inputs.blood_sugar} mg/dL`} />
          <Item label="Cholesterol" value={`${data.inputs.cholesterol} mg/dL`} />
          <Item label="Systolic BP" value={`${data.inputs.blood_pressure_systolic} mmHg`} />
          <Item label="Activity" value={data.inputs.physical_activity} />
          <Item label="Diabetes" value={yes(data.inputs.diabetes)} />
          <Item label="Smoking" value={yes(data.inputs.smoking)} />
          <Item label="Alcohol" value={yes(data.inputs.alcohol)} />
          <Item label="Family history" value={yes(data.inputs.family_history)} />
          <Item label="Numbness" value={yes(data.inputs.numbness)} />
          <Item label="Tingling" value={yes(data.inputs.tingling)} />
          <Item label="Burning pain" value={yes(data.inputs.burning_pain)} />
          <Item label="Muscle weakness" value={yes(data.inputs.muscle_weakness)} />
          <Item label="Loss of balance" value={yes(data.inputs.loss_of_balance)} />
          <Item label="Foot ulcers" value={yes(data.inputs.foot_ulcers)} />
        </div>
      </motion.div>

      {/* PDF preview modal */}
      <AnimatePresence>
        {previewOpen && pdfBlob && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6"
            data-testid="pdf-preview-modal"
            onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97 }}
              className="relative w-full max-w-5xl h-[92vh] rounded-xl bg-card border border-border/60 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <Eye className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium truncate">
                    NeuroDetect Report — {data.patient_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenInNewTab}
                    data-testid="pdf-open-new-tab-button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> New tab
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    data-testid="pdf-modal-download-button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-3 w-3" /> Download
                  </button>
                  <button
                    onClick={() => setPreviewOpen(false)}
                    data-testid="pdf-close-button"
                    className="inline-flex items-center justify-center rounded-md hover:bg-muted h-8 w-8"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <PdfViewer fileBlob={pdfBlob} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ImgCard = ({ label, url, blobs, testid }) => {
  const src = blobs[url];
  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="aspect-video rounded-lg bg-muted overflow-hidden flex items-center justify-center">
        {src ? (
          <img src={src} alt={label} className="w-full h-full object-cover" />
        ) : (
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        )}
      </div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-center">{label}</p>
    </div>
  );
};

const yes = (b) => (b ? "Yes" : "No");
const Item = ({ label, value }) => (
  <div>
    <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    <p className="mt-1 font-medium">{value}</p>
  </div>
);
