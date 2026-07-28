import { useState, useRef, useEffect } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ImageUploader({ label, hint, file, onChange, testid, accent = "primary" }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = "image/jpeg,image/jpg,image/png";
  const isThermal = accent === "thermal";

  const onPick = (f) => {
    if (!f) return;
    if (!/jpe?g|png/i.test(f.type)) {
      alert("Please upload a JPG or PNG image");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      alert("Image too large (max 8 MB)");
      return;
    }
    onChange(f);
  };

  return (
    <div className="space-y-2" data-testid={`uploader-${testid}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</label>
        {file && (
          <button
            type="button"
            onClick={() => onChange(null)}
            data-testid={`uploader-${testid}-remove`}
            className="text-xs text-destructive hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false);
          if (e.dataTransfer.files?.[0]) onPick(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all overflow-hidden ${
          drag ? "border-primary bg-primary/5" :
          file ? "border-border bg-card" : "border-border/60 bg-card hover:border-primary/50 hover:bg-primary/[0.02]"
        } ${isThermal ? "ring-1 ring-amber-500/20" : ""}`}
        style={{ minHeight: 160 }}
      >
        <input
          ref={inputRef} type="file" accept={accept}
          data-testid={`uploader-${testid}-input`}
          onChange={(e) => onPick(e.target.files?.[0])}
          className="hidden"
        />
        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div key="prev"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="relative w-full h-full"
            >
              <img src={preview} alt={label}
                className={`w-full h-40 object-cover ${isThermal ? "" : ""}`} />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-white text-xs font-medium truncate">{file.name}</p>
                <p className="text-white/70 text-[10px]">{(file.size / 1024).toFixed(0)} KB · Tap to replace</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 px-4 text-center"
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${
                isThermal ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
              }`}>
                {isThermal ? <ImageIcon className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
              </div>
              <p className="text-sm font-medium">{drag ? "Drop image here" : `Upload ${label}`}</p>
              <p className="text-xs text-muted-foreground mt-1">{hint || "JPG, PNG · max 8 MB"}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
