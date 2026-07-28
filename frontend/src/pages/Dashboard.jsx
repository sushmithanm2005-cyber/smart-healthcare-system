import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Users, AlertTriangle, ShieldCheck, Activity, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const RISK_COLORS = { Low: "#10B981", Moderate: "#F59E0B", High: "#E11D48" };

const StatCard = ({ icon: Icon, label, value, sub, accent, testid, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay: index * 0.08 }}
    whileHover={{ y: -2 }}
    data-testid={testid}
    className="rounded-xl border border-border/60 bg-card p-5 hover:shadow-md transition-all"
  >
    <div className="flex items-start justify-between mb-4">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
    </div>
    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    <p className="text-3xl font-light tracking-tight mt-2">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
  </motion.div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/stats")
      .then((r) => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]" data-testid="dashboard-loading">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const empty = stats?.total_patients === 0;

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight">
            Welcome back, <span className="font-medium text-primary">{user?.full_name?.split(" ")[0]}</span>
          </h1>
        </div>
        <Link
          to="/new"
          data-testid="dashboard-new-prediction-button"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors self-start md:self-auto"
        >
          <Plus className="h-4 w-4" /> New Prediction
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard testid="stat-total" index={0} icon={Users} label="Total Patients" value={stats.total_patients}
          sub="Lifetime assessments" accent="bg-primary/10 text-primary" />
        <StatCard testid="stat-high" index={1} icon={AlertTriangle} label="High Risk" value={stats.high_risk}
          sub={stats.total_patients ? `${Math.round(stats.high_risk * 100 / stats.total_patients)}% of cases` : "—"}
          accent="bg-rose-500/10 text-rose-500" />
        <StatCard testid="stat-moderate" index={2} icon={Activity} label="Moderate Risk" value={stats.moderate_risk}
          sub={stats.total_patients ? `${Math.round(stats.moderate_risk * 100 / stats.total_patients)}% of cases` : "—"}
          accent="bg-amber-500/10 text-amber-500" />
        <StatCard testid="stat-low" index={3} icon={ShieldCheck} label="Low Risk" value={stats.low_risk}
          sub={`Avg score: ${stats.average_score}`} accent="bg-emerald-500/10 text-emerald-500" />
      </div>

      {empty ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          data-testid="dashboard-empty-state"
          className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center"
        >
          <div className="h-14 w-14 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-medium mb-2">No assessments yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Run your first AI-powered neuropathy prediction to populate your dashboard with real patient analytics.
          </p>
          <Link to="/new" data-testid="empty-create-button"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Create your first prediction
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Monthly trend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="lg:col-span-8 rounded-xl border border-border/60 bg-card p-6"
            data-testid="chart-monthly"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Monthly Trend</p>
                <h3 className="text-lg font-medium mt-1">Assessments by risk level</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.monthly_trend}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{
                  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                  borderRadius: 8, fontSize: 12,
                }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="low" stackId="a" fill={RISK_COLORS.Low} radius={[0, 0, 0, 0]} />
                <Bar dataKey="moderate" stackId="a" fill={RISK_COLORS.Moderate} />
                <Bar dataKey="high" stackId="a" fill={RISK_COLORS.High} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Risk distribution */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="lg:col-span-4 rounded-xl border border-border/60 bg-card p-6"
            data-testid="chart-risk-distribution"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Risk Distribution</p>
            <h3 className="text-lg font-medium mt-1 mb-4">All patients</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.risk_distribution} dataKey="value" nameKey="name"
                     innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {stats.risk_distribution.map((e) => (
                    <Cell key={e.name} fill={RISK_COLORS[e.name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{
                  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                  borderRadius: 8, fontSize: 12,
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {stats.risk_distribution.map((e) => (
                <div key={e.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLORS[e.name] }} />
                    <span>{e.name}</span>
                  </div>
                  <span className="font-medium">{e.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent activity */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            className="lg:col-span-8 rounded-xl border border-border/60 bg-card p-6"
            data-testid="recent-activity"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Recent Activity</p>
                <h3 className="text-lg font-medium mt-1">Latest assessments</h3>
              </div>
              <Link to="/patients" className="text-xs text-primary hover:underline" data-testid="view-all-link">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-border/60">
              {stats.recent_activity.map((r) => (
                <Link
                  key={r.id} to={`/patients/${r.id}`}
                  data-testid={`activity-row-${r.id}`}
                  className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {r.patient_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">{r.risk_score}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase"
                      style={{
                        background: `${RISK_COLORS[r.risk_level]}22`,
                        color: RISK_COLORS[r.risk_level],
                      }}
                    >
                      {r.risk_level}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Age distribution */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
            className="lg:col-span-4 rounded-xl border border-border/60 bg-card p-6"
            data-testid="chart-age"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Age Distribution</p>
            <h3 className="text-lg font-medium mt-1 mb-4">Patients by age</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.age_distribution} layout="vertical">
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={11} width={50} />
                <Tooltip contentStyle={{
                  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                  borderRadius: 8, fontSize: 12,
                }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </div>
  );
}
