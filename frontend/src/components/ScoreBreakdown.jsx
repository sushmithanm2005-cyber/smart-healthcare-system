import { motion } from "framer-motion";
import { Calculator, Image as ImageIcon, Camera } from "lucide-react";

const MODALITY_COLORS = {
  "Clinical assessment": "#0F766E",
  "Hand image analysis": "#3B82F6",
  "Foot image analysis": "#8B5CF6",
  "Thermal imaging": "#F59E0B",
};

export default function ScoreBreakdown({ contributions }) {
  if (!contributions) return null;
  const { clinical_factors = [], modalities = [], image_findings = [], final_score = 0 } = contributions;
  const maxFactorPts = Math.max(1, ...clinical_factors.map((c) => c.points));
  const sumClinical = clinical_factors.reduce((s, c) => s + c.points, 0);
  const sumWeighted = modalities.reduce((s, m) => s + m.contribution, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
      className="rounded-xl border border-border/60 bg-card p-6 mb-6"
      data-testid="score-breakdown-card"
    >
      <div className="flex items-center gap-2 mb-5">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="font-medium">Score Contribution Breakdown</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Transparent AI · every point traced
        </span>
      </div>

      {/* Section 1: Clinical factors */}
      {clinical_factors.length > 0 ? (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Clinical factors ({sumClinical} pts before weighting)
          </p>
          <div className="space-y-2">
            {clinical_factors.map((f, i) => (
              <div key={i}
                data-testid={`breakdown-factor-${i}`}
                className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm truncate">{f.name}</span>
                    <span className="text-xs font-medium text-primary tabular-nums shrink-0">
                      +{f.points}
                    </span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(f.points / maxFactorPts) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.03 }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-6">
          No clinical risk factors detected.
        </p>
      )}

      {/* Section 2: Modality contributions */}
      {modalities.length > 1 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Multimodal weighted contributions
          </p>
          <div className="space-y-2.5">
            {modalities.map((m, i) => {
              const color = MODALITY_COLORS[m.name] || "#64748B";
              return (
                <div key={m.name} data-testid={`breakdown-modality-${i}`}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="truncate">{m.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({m.raw_score} × {m.weight_pct}%)
                      </span>
                    </div>
                    <span className="font-medium tabular-nums shrink-0">
                      +{m.contribution.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 mt-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.contribution / 100) * 100}%` }}
                      transition={{ duration: 0.7, delay: i * 0.08 }}
                      className="h-full"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-baseline pt-3 mt-3 border-t border-border/40">
            <span className="text-sm font-medium">Final weighted score</span>
            <span className="text-lg font-medium tabular-nums text-primary">
              {Math.round(sumWeighted)}%
            </span>
          </div>
        </div>
      )}

      {/* Section 3: Image findings detail */}
      {image_findings.length > 0 && (
        <div className="pt-2">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Image AI findings detail
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {image_findings.map((g, idx) => (
              <div
                key={idx}
                data-testid={`breakdown-image-${idx}`}
                className="rounded-lg border border-border/40 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {g.modality.startsWith("Thermal") ? (
                      <ImageIcon className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Camera className="h-3.5 w-3.5 text-primary" />
                    )}
                    {g.modality}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {g.score}%
                  </span>
                </div>
                <ul className="space-y-1">
                  {g.findings.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/60 mt-1.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
