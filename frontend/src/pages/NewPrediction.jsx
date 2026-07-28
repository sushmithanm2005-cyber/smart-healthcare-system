import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Sparkles, User, HeartPulse, Activity, FileText, Camera, Thermometer, Scan } from "lucide-react";
import ImageUploader from "../components/ImageUploader";

const symptomFields = [
  { key: "numbness", label: "Numbness" },
  { key: "tingling", label: "Tingling" },
  { key: "burning_pain", label: "Burning pain" },
  { key: "muscle_weakness", label: "Muscle weakness" },
  { key: "loss_of_balance", label: "Loss of balance" },
  { key: "foot_ulcers", label: "Foot ulcers" },
];

const lifestyleFields = [
  { key: "diabetes", label: "Diabetes" },
  { key: "smoking", label: "Smoking" },
  { key: "alcohol", label: "Alcohol consumption" },
  { key: "family_history", label: "Family history" },
];

const defaultForm = {
  patient_name: "", age: 45, gender: "Male", bmi: 24.5,
  blood_sugar: 110, cholesterol: 190, blood_pressure_systolic: 125,
  physical_activity: "Moderate",
  diabetes: false, smoking: false, alcohol: false, family_history: false,
  numbness: false, tingling: false, burning_pain: false,
  muscle_weakness: false, loss_of_balance: false, foot_ulcers: false,
};

const Section = ({ icon: Icon, title, subtitle, span = "md:col-span-12", children, testid }) => (
  <div className={`rounded-xl border border-border/60 bg-card p-6 ${span}`} data-testid={testid}>
    <div className="flex items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
    <div className="mt-2">{children}</div>
  </label>
);

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

const Toggle = ({ checked, onChange, label, testid }) => (
  <button
    type="button" onClick={() => onChange(!checked)} data-testid={testid}
    className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-sm transition-all ${
      checked ? "border-primary bg-primary/5 text-foreground" : "border-input bg-background text-muted-foreground hover:border-primary/40"
    }`}
  >
    <span>{label}</span>
    <span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${checked ? "bg-primary" : "bg-muted"}`}>
      <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${checked ? "translate-x-3" : ""}`} />
    </span>
  </button>
);

export default function NewPrediction() {
  const [form, setForm] = useState(defaultForm);
  const [images, setImages] = useState({
    hand: null, foot: null, thermal_hand: null, thermal_foot: null,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const navigate = useNavigate();

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setImg = (k) => (f) => setImages((s) => ({ ...s, [k]: f }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.patient_name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setLoading(true); setProgress(8); setStage("Uploading clinical data...");
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify(form));
      if (images.hand) fd.append("hand_image", images.hand);
      if (images.foot) fd.append("foot_image", images.foot);
      if (images.thermal_hand) fd.append("thermal_hand_image", images.thermal_hand);
      if (images.thermal_foot) fd.append("thermal_foot_image", images.thermal_foot);

      // Simulated multi-stage progress (real upload progress + AI inference)
      const stages = [
        [25, "Preprocessing images with OpenCV..."],
        [45, "Running AI image analysis..."],
        [70, "Generating thermal visualizations..."],
        [88, "Running Claude AI explanation..."],
      ];
      let idx = 0;
      const interval = setInterval(() => {
        if (idx < stages.length) {
          setProgress(stages[idx][0]); setStage(stages[idx][1]); idx++;
        }
      }, 1200);

      const { data } = await api.post("/predictions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.max(10, Math.min(22, (evt.loaded / evt.total) * 22)));
        },
      });
      clearInterval(interval);
      setProgress(100); setStage("Complete");
      toast.success("Multimodal prediction complete");
      navigate(`/patients/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const imageCount = Object.values(images).filter(Boolean).length;

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto" data-testid="new-prediction-page">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight">
          New <span className="font-medium text-primary">Neuropathy</span> Prediction
        </h1>
      </div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-12 gap-6"
      >
        <Section testid="section-demographics" icon={User} title="Demographics" subtitle="Basic patient information" span="md:col-span-6">
          <Field label="Patient name">
            <input type="text" required value={form.patient_name}
              onChange={(e) => set("patient_name")(e.target.value)}
              data-testid="patient-name-input" className={inputCls} placeholder="Full name" />
          </Field>
          <Field label="Age">
            <input type="number" min="1" max="120" required value={form.age}
              onChange={(e) => set("age")(parseInt(e.target.value) || 0)}
              data-testid="patient-age-input" className={inputCls} />
          </Field>
          <Field label="Gender">
            <select value={form.gender} onChange={(e) => set("gender")(e.target.value)}
              data-testid="patient-gender-select" className={inputCls}>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </Field>
          <Field label="BMI (kg/m²)">
            <input type="number" step="0.1" min="10" max="60" required value={form.bmi}
              onChange={(e) => set("bmi")(parseFloat(e.target.value) || 0)}
              data-testid="patient-bmi-input" className={inputCls} />
          </Field>
        </Section>

        <Section testid="section-vitals" icon={HeartPulse} title="Vitals & Labs" subtitle="Recent measurements" span="md:col-span-6">
          <Field label="Blood sugar (mg/dL)">
            <input type="number" min="40" max="600" required value={form.blood_sugar}
              onChange={(e) => set("blood_sugar")(parseFloat(e.target.value) || 0)}
              data-testid="patient-bloodsugar-input" className={inputCls} />
          </Field>
          <Field label="Cholesterol (mg/dL)">
            <input type="number" min="80" max="400" required value={form.cholesterol}
              onChange={(e) => set("cholesterol")(parseFloat(e.target.value) || 0)}
              data-testid="patient-cholesterol-input" className={inputCls} />
          </Field>
          <Field label="Systolic blood pressure (mmHg)">
            <input type="number" min="70" max="220" required value={form.blood_pressure_systolic}
              onChange={(e) => set("blood_pressure_systolic")(parseInt(e.target.value) || 0)}
              data-testid="patient-bp-input" className={inputCls} />
          </Field>
          <Field label="Physical activity">
            <select value={form.physical_activity} onChange={(e) => set("physical_activity")(e.target.value)}
              data-testid="patient-activity-select" className={inputCls}>
              <option>Low</option><option>Moderate</option><option>High</option>
            </select>
          </Field>
        </Section>

        <Section testid="section-lifestyle" icon={Activity} title="Medical & Lifestyle" subtitle="Tap to toggle" span="md:col-span-6">
          {lifestyleFields.map((f) => (
            <Toggle key={f.key} label={f.label}
              checked={form[f.key]} onChange={set(f.key)}
              testid={`toggle-${f.key}`} />
          ))}
        </Section>

        <Section testid="section-symptoms" icon={FileText} title="Neurological Symptoms" subtitle="Tap to toggle observed symptoms" span="md:col-span-6">
          {symptomFields.map((f) => (
            <Toggle key={f.key} label={f.label}
              checked={form[f.key]} onChange={set(f.key)}
              testid={`toggle-${f.key}`} />
          ))}
        </Section>

        {/* Standard images */}
        <div className="md:col-span-6 rounded-xl border border-border/60 bg-card p-6" data-testid="section-standard-images">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Camera className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-medium">Standard Images</h3>
              <p className="text-xs text-muted-foreground">Phone/camera photos. AI generates pseudo-thermal visualization.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploader label="Hand image" testid="hand"
              file={images.hand} onChange={setImg("hand")} hint="Palm or back of hand" />
            <ImageUploader label="Foot image" testid="foot"
              file={images.foot} onChange={setImg("foot")} hint="Sole or top of foot" />
          </div>
        </div>

        {/* Thermal images */}
        <div className="md:col-span-6 rounded-xl border border-border/60 bg-card p-6" data-testid="section-thermal-images">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Thermometer className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-medium">Thermal Images</h3>
              <p className="text-xs text-muted-foreground">Real FLIR / thermal camera images for hotspot & asymmetry analysis.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploader label="Thermal hand" testid="thermal-hand" accent="thermal"
              file={images.thermal_hand} onChange={setImg("thermal_hand")} hint="Real thermal image" />
            <ImageUploader label="Thermal foot" testid="thermal-foot" accent="thermal"
              file={images.thermal_foot} onChange={setImg("thermal_foot")} hint="Real thermal image" />
          </div>
        </div>

        <div className="md:col-span-12 flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-3 pt-2">
          {imageCount > 0 && (
            <p className="text-xs text-muted-foreground mr-auto" data-testid="image-count">
              <Scan className="inline h-3.5 w-3.5 mr-1 text-primary" />
              {imageCount} image{imageCount > 1 ? "s" : ""} attached — multimodal analysis enabled
            </p>
          )}
          <button type="button" onClick={() => { setForm(defaultForm); setImages({ hand: null, foot: null, thermal_hand: null, thermal_foot: null }); }}
            data-testid="reset-form-button"
            className="rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            Reset
          </button>
          <button type="submit" disabled={loading}
            data-testid="submit-prediction-button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyzing..." : "Run Multimodal AI Prediction"}
          </button>
        </div>
      </motion.form>

      {/* AI scanning overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-6"
            data-testid="ai-scanning-overlay"
          >
            <div className="max-w-md w-full text-center">
              <div className="relative h-32 w-32 mx-auto mb-6">
                <motion.div className="absolute inset-0 rounded-full border-2 border-primary/30" />
                <motion.div className="absolute inset-2 rounded-full border-2 border-primary/50"
                  animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
                <motion.div className="absolute inset-4 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
                  animate={{ rotate: -360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Scan className="h-10 w-10 text-primary" />
                </div>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">AI Scanning</p>
              <h3 className="text-2xl font-light tracking-tight mb-3">Multimodal Analysis</h3>
              <p className="text-sm text-muted-foreground mb-6">{stage}</p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
