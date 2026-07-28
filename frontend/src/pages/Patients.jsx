import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { motion } from "framer-motion";
import { Plus, Search, Users } from "lucide-react";

const RISK_COLORS = { Low: "#10B981", Moderate: "#F59E0B", High: "#E11D48" };

export default function Patients() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/predictions").then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(
    (r) => r.patient_name.toLowerCase().includes(q.toLowerCase()) ||
           r.risk_level.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto" data-testid="patients-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Records</p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight">
            Patient <span className="font-medium text-primary">Assessments</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {rows.length} total assessment{rows.length !== 1 && "s"}
          </p>
        </div>
        <Link to="/new" data-testid="patients-new-button"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Prediction
        </Link>
      </div>

      <div className="rounded-xl border border-border/60 bg-card">
        <div className="p-4 border-b border-border/60 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            data-testid="patients-search-input"
            placeholder="Search by name or risk level..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
        </div>

        {loading ? (
          <div className="p-12 flex justify-center" data-testid="patients-loading">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center" data-testid="patients-empty">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? "No assessments yet. Start with a new prediction." : "No results found."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.1em] text-muted-foreground border-b border-border/60">
                  <th className="px-6 py-3 font-medium">Patient</th>
                  <th className="px-6 py-3 font-medium">Age</th>
                  <th className="px-6 py-3 font-medium">Gender</th>
                  <th className="px-6 py-3 font-medium">BMI</th>
                  <th className="px-6 py-3 font-medium">Score</th>
                  <th className="px-6 py-3 font-medium">Risk</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <motion.tr key={r.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/40 hover:bg-muted/40 cursor-pointer">
                    <td className="px-6 py-4">
                      <Link to={`/patients/${r.id}`} data-testid={`patient-row-${r.id}`}
                        className="flex items-center gap-3 font-medium hover:text-primary">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {r.patient_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        {r.patient_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{r.age}</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.gender}</td>
                    <td className="px-6 py-4 text-muted-foreground tabular-nums">{r.bmi}</td>
                    <td className="px-6 py-4 font-medium tabular-nums">{r.risk_score}</td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          background: `${RISK_COLORS[r.risk_level]}22`,
                          color: RISK_COLORS[r.risk_level],
                        }}
                      >
                        {r.risk_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
