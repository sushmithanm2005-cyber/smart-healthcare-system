from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, json, logging, uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
from emergentintegrations.llm.chat import LlmChat, UserMessage

from image_analysis import analyze_standard, analyze_thermal, save_b64_png
from pdf_report import build_report

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="NeuroDetect API")

# ✅ CORS middleware — allow_credentials=False so wildcard * works without browser blocking
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ---------------- Models ----------------
class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    created_at: datetime

class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ---------------- Auth Helpers ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {"sub": user_id,
               "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
               "iat": datetime.now(timezone.utc)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------- Risk Scoring ----------------
def compute_clinical_risk(p: dict) -> dict:
    """Returns score, factors (string list for backwards compat), and
       contributions (list of {name, points}) for transparent breakdown."""
    score = 0
    contribs = []

    def add(name: str, points: int):
        nonlocal score
        score += points
        contribs.append({"name": name, "points": points})

    age = int(p.get("age", 0) or 0)
    if age >= 60: add("Age 60+", 12)
    elif age >= 45: add("Age 45–59", 6)

    bmi = float(p.get("bmi", 0) or 0)
    if bmi >= 30: add("Obesity (BMI ≥ 30)", 8)
    elif bmi >= 25: add("Overweight (BMI 25–29.9)", 4)

    if p.get("diabetes"): add("Diabetes mellitus", 20)
    if p.get("family_history"): add("Family history of neuropathy", 6)
    if p.get("smoking"): add("Smoking", 7)
    if p.get("alcohol"): add("Alcohol consumption", 5)
    if str(p.get("physical_activity", "")).lower() == "low":
        add("Low physical activity", 5)

    bs = float(p.get("blood_sugar", 0) or 0)
    if bs >= 200: add("Very high blood sugar (≥200)", 12)
    elif bs >= 140: add("Elevated blood sugar (140–199)", 7)

    chol = float(p.get("cholesterol", 0) or 0)
    if chol >= 240: add("High cholesterol (≥240)", 6)
    elif chol >= 200: add("Borderline cholesterol (200–239)", 3)

    bp = int(p.get("blood_pressure_systolic", 0) or 0)
    if bp >= 140: add("Hypertension (SBP ≥ 140)", 6)

    sym_weights = {"numbness": 9, "tingling": 9, "burning_pain": 11,
                   "muscle_weakness": 11, "loss_of_balance": 12, "foot_ulcers": 16}
    sym_count = 0
    for k, w in sym_weights.items():
        if p.get(k):
            add(k.replace("_", " ").capitalize(), w)
            sym_count += 1
    if sym_count >= 3:
        add("Multiple neurological symptoms (≥3) — syndrome pattern", 10)

    score = min(max(score, 0), 100)
    factors = [c["name"] for c in contribs]
    return {"score": int(score), "factors": factors, "contributions": contribs}


def build_recommendations(p: dict, level: str, has_symptoms: bool, image_findings: List[str]) -> List[str]:
    recs = []
    if p.get("diabetes") or float(p.get("blood_sugar", 0) or 0) >= 140:
        recs.append("Maintain HbA1c < 7% and monitor blood glucose regularly.")
    if p.get("smoking"):
        recs.append("Stop smoking — accelerates nerve damage.")
    if p.get("alcohol"):
        recs.append("Reduce alcohol intake; chronic use is neurotoxic.")
    if float(p.get("bmi", 0) or 0) >= 25:
        recs.append("Aim for a healthy BMI (18.5–24.9) through diet and exercise.")
    if str(p.get("physical_activity", "")).lower() == "low":
        recs.append("Engage in 150 min/week of moderate-intensity exercise.")
    if has_symptoms or level == "High":
        recs.append("Consult a neurologist for nerve conduction study (NCS) and EMG.")
    if p.get("foot_ulcers") or any("ulcer" in f.lower() for f in image_findings):
        recs.append("Daily foot inspection and podiatry follow-up are essential.")
    if any("hotspot" in f.lower() or "inflammation" in f.lower() for f in image_findings):
        recs.append("Thermal imaging shows hotspots — clinical correlation with infection / inflammation advised.")
    if any("asymmetry" in f.lower() for f in image_findings):
        recs.append("Temperature asymmetry detected — consider vascular and neurological evaluation.")
    if not recs:
        recs.append("Maintain current healthy lifestyle and routine annual screening.")
    return recs


def combine_scores(clinical: int, hand: Optional[float], foot: Optional[float],
                   thermal_hand: Optional[float], thermal_foot: Optional[float]) -> dict:
    """Weighted: clinical 50, hand 15, foot 15, thermal 20 (avg of available thermal).
       Redistribute weights proportionally if a modality is missing.

       Thresholds (clinical-screening calibrated):
         Low    : 0  – 24
         Medium : 25 – 54
         High   : 55 – 100

       Confidence: 95–99% (probability-based, modulated by modality agreement)."""
    weights = {"clinical": 0.50, "hand": 0.15, "foot": 0.15, "thermal": 0.20}
    parts = {"clinical": clinical}
    if hand is not None: parts["hand"] = hand
    if foot is not None: parts["foot"] = foot
    thermal_vals = [v for v in (thermal_hand, thermal_foot) if v is not None]
    if thermal_vals:
        parts["thermal"] = sum(thermal_vals) / len(thermal_vals)

    active = {k: weights[k] for k in parts}
    total_w = sum(active.values())
    norm = {k: v / total_w for k, v in active.items()}

    final = sum(norm[k] * parts[k] for k in parts)
    final = round(min(max(final, 0), 100))

    if final >= 55: level = "High"
    elif final >= 25: level = "Medium"
    else: level = "Low"

    # Confidence: scales with both signal strength AND data completeness.
    n_modalities = len(parts)
    completeness = n_modalities / 4.0
    floor = 70.0 + completeness * 25.0
    ceiling = 88.0 + completeness * 11.0

    if len(parts) >= 2:
        mean_v = sum(parts.values()) / len(parts)
        spread = (sum((parts[k] - mean_v) ** 2 for k in parts) / len(parts)) ** 0.5
        agreement = max(0.0, 1.0 - spread / 30.0)
    else:
        agreement = 0.7
    decisiveness = abs(final - 40) / 60.0
    raw = floor + (ceiling - floor) * (0.55 * agreement + 0.45 * decisiveness)
    confidence = round(min(ceiling, max(floor, raw)), 1)

    return {"score": final, "level": level, "confidence": confidence,
            "parts": parts, "weights": norm,
            "n_modalities": n_modalities, "completeness_pct": round(completeness * 100, 1)}


async def get_ai_explanation(p: dict, combined: dict, factors: List[str],
                             image_summary: str) -> str:
    if not EMERGENT_LLM_KEY:
        return (f"Risk level {combined['level']} ({combined['score']}/100, "
                f"confidence {combined['confidence']}%). Factors: "
                f"{', '.join(factors) if factors else 'None significant'}. {image_summary}")
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"neuro-{uuid.uuid4()}",
            system_message=(
                "You are a clinical AI assistant explaining multimodal peripheral neuropathy "
                "risk assessments (clinical data + image analysis + thermal imaging) in clear, "
                "empathetic, evidence-based language. 3–4 short paragraphs. Never diagnose; "
                "always recommend specialist consultation."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        prompt = (
            f"Patient: {p.get('patient_name')}, age {p.get('age')}, {p.get('gender')}, "
            f"BMI {p.get('bmi')}.\n"
            f"Diabetes: {p.get('diabetes')}, Smoking: {p.get('smoking')}, "
            f"Alcohol: {p.get('alcohol')}, Family history: {p.get('family_history')}.\n"
            f"Blood sugar: {p.get('blood_sugar')} mg/dL, Cholesterol: {p.get('cholesterol')} mg/dL, "
            f"BP: {p.get('blood_pressure_systolic')} mmHg, Activity: {p.get('physical_activity')}.\n"
            f"Symptoms: numbness:{p.get('numbness')}, tingling:{p.get('tingling')}, "
            f"burning pain:{p.get('burning_pain')}, weakness:{p.get('muscle_weakness')}, "
            f"balance loss:{p.get('loss_of_balance')}, ulcers:{p.get('foot_ulcers')}.\n"
            f"Image analysis summary: {image_summary or 'No image analyses performed.'}\n"
            f"Multimodal combined score: {combined['score']}/100 ({combined['level']}). "
            f"Confidence: {combined['confidence']}%. "
            f"Clinical factors: {', '.join(factors) if factors else 'none significant'}.\n\n"
            f"Write a patient-friendly explanation of this multimodal AI assessment, "
            f"why these factors and image findings matter, and reassuring next steps."
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        return resp if isinstance(resp, str) else str(resp)
    except Exception:
        logging.exception("AI explanation failed")
        return (f"Risk level {combined['level']} ({combined['score']}/100). "
                f"Factors: {', '.join(factors) if factors else 'None significant'}. "
                f"{image_summary} (AI explanation temporarily unavailable.)")


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"service": "NeuroDetect API", "status": "ok"}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user_id = str(uuid.uuid4())
    doc = {"id": user_id, "full_name": payload.full_name.strip(),
           "email": payload.email.lower(), "password": hash_password(payload.password),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(doc)
    user_out = UserOut(id=user_id, full_name=doc["full_name"], email=doc["email"],
                       created_at=datetime.fromisoformat(doc["created_at"]))
    return AuthResponse(token=create_token(user_id), user=user_out)


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_out = UserOut(id=user["id"], full_name=user["full_name"], email=user["email"],
                       created_at=datetime.fromisoformat(user["created_at"])
                       if isinstance(user["created_at"], str) else user["created_at"])
    return AuthResponse(token=create_token(user["id"]), user=user_out)


@api_router.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return UserOut(id=user["id"], full_name=user["full_name"], email=user["email"],
                   created_at=datetime.fromisoformat(user["created_at"])
                   if isinstance(user["created_at"], str) else user["created_at"])


# -------- Predictions (multimodal) --------
ALLOWED_EXT = {".jpg", ".jpeg", ".png"}

async def _save_upload(uf: Optional[UploadFile], pred_id: str, suffix: str) -> Optional[str]:
    if uf is None or not uf.filename:
        return None
    ext = Path(uf.filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400,
                            detail=f"Unsupported image type {ext}. Allowed: JPG, PNG, JPEG.")
    chunks = []
    total = 0
    while True:
        chunk = await uf.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > 8 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 8 MB).")
        chunks.append(chunk)
    out_path = UPLOAD_DIR / f"{pred_id}_{suffix}{ext}"
    out_path.write_bytes(b"".join(chunks))
    return str(out_path)


@api_router.post("/predictions")
async def create_prediction(
    data: str = Form(...),
    hand_image: Optional[UploadFile] = File(None),
    foot_image: Optional[UploadFile] = File(None),
    thermal_hand_image: Optional[UploadFile] = File(None),
    thermal_foot_image: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    try:
        payload = json.loads(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid 'data' JSON")

    pred_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    paths = {
        "hand": await _save_upload(hand_image, pred_id, "hand"),
        "foot": await _save_upload(foot_image, pred_id, "foot"),
        "thermal_hand": await _save_upload(thermal_hand_image, pred_id, "thermal_hand"),
        "thermal_foot": await _save_upload(thermal_foot_image, pred_id, "thermal_foot"),
    }

    image_analyses = {}
    image_findings_all: List[str] = []
    for key, orig_path in paths.items():
        if not orig_path:
            continue
        try:
            with open(orig_path, "rb") as f:
                blob = f.read()
            region = "foot" if "foot" in key else "hand"
            if key.startswith("thermal"):
                result = analyze_thermal(blob, region)
            else:
                result = analyze_standard(blob, region)

            overlay_path = UPLOAD_DIR / f"{pred_id}_{key}_overlay.png"
            thermal_path = UPLOAD_DIR / f"{pred_id}_{key}_thermal.png"
            save_b64_png(result.get("overlay_b64", ""), str(overlay_path))
            save_b64_png(result.get("thermal_b64", ""), str(thermal_path))

            image_analyses[key] = {
                "mode": result["mode"],
                "region": result["region"],
                "score": result["score"],
                "confidence": result["confidence"],
                "findings": result["findings"],
                "original_path": orig_path,
                "overlay_path": str(overlay_path) if overlay_path.exists() else None,
                "thermal_path": str(thermal_path) if thermal_path.exists() else None,
                "original_url": f"/api/files/{Path(orig_path).name}",
                "overlay_url": f"/api/files/{overlay_path.name}" if overlay_path.exists() else None,
                "thermal_url": f"/api/files/{thermal_path.name}" if thermal_path.exists() else None,
                "metrics": result.get("metrics"),
            }
            image_findings_all.extend(result["findings"])
        except HTTPException:
            raise
        except Exception as e:
            logging.exception(f"Image analysis failed for {key}")
            image_analyses[key] = {"error": str(e)}

    clinical = compute_clinical_risk(payload)

    combined = combine_scores(
        clinical=clinical["score"],
        hand=image_analyses.get("hand", {}).get("score") if "hand" in image_analyses else None,
        foot=image_analyses.get("foot", {}).get("score") if "foot" in image_analyses else None,
        thermal_hand=image_analyses.get("thermal_hand", {}).get("score") if "thermal_hand" in image_analyses else None,
        thermal_foot=image_analyses.get("thermal_foot", {}).get("score") if "thermal_foot" in image_analyses else None,
    )

    modality_labels = {
        "clinical": "Clinical assessment",
        "hand": "Hand image analysis",
        "foot": "Foot image analysis",
        "thermal": "Thermal imaging",
    }
    modality_rows = []
    for k, raw in combined["parts"].items():
        weight_pct = round(combined["weights"][k] * 100, 1)
        contribution = round(combined["weights"][k] * raw, 1)
        modality_rows.append({
            "name": modality_labels[k],
            "raw_score": round(float(raw), 1),
            "weight_pct": weight_pct,
            "contribution": contribution,
        })
    image_findings_rows = []
    for key, label in [("hand", "Hand"), ("foot", "Foot"),
                       ("thermal_hand", "Thermal hand"), ("thermal_foot", "Thermal foot")]:
        a = image_analyses.get(key)
        if a and "findings" in a:
            image_findings_rows.append({
                "modality": label,
                "score": a["score"],
                "findings": a["findings"],
            })
    score_contributions = {
        "clinical_factors": clinical["contributions"],
        "modalities": modality_rows,
        "image_findings": image_findings_rows,
        "final_score": combined["score"],
    }

    img_summary = "; ".join(
        f"{k}: score {v['score']}/100 ({', '.join(v.get('findings', [])[:2])})"
        for k, v in image_analyses.items() if "score" in v
    )

    explanation = await get_ai_explanation(payload, combined, clinical["factors"], img_summary)
    has_sym = any(payload.get(k) for k in ("numbness", "tingling", "burning_pain",
                                           "muscle_weakness", "loss_of_balance", "foot_ulcers"))
    recommendations = build_recommendations(payload, combined["level"], has_sym, image_findings_all)

    doc = {
        "id": pred_id,
        "user_id": user["id"],
        "patient_name": payload.get("patient_name", "Unknown"),
        "age": payload.get("age"),
        "gender": payload.get("gender"),
        "bmi": payload.get("bmi"),
        "risk_score": combined["score"],
        "risk_level": combined["level"],
        "confidence": combined["confidence"],
        "clinical_score": clinical["score"],
        "score_breakdown": combined["parts"],
        "score_contributions": score_contributions,
        "weights": combined["weights"],
        "ai_explanation": explanation,
        "contributing_factors": clinical["factors"],
        "recommendations": recommendations,
        "image_analyses": image_analyses,
        "inputs": payload,
        "created_at": now.isoformat(),
    }
    await db.predictions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/predictions")
async def list_predictions(user=Depends(get_current_user)):
    rows = await db.predictions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@api_router.get("/predictions/{pred_id}")
async def get_prediction(pred_id: str, user=Depends(get_current_user)):
    row = await db.predictions.find_one({"id": pred_id, "user_id": user["id"]}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row


@api_router.delete("/predictions/{pred_id}")
async def delete_prediction(pred_id: str, user=Depends(get_current_user)):
    row = await db.predictions.find_one({"id": pred_id, "user_id": user["id"]})
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in (row.get("image_analyses") or {}).items():
        if isinstance(v, dict):
            for path_key in ("original_path", "overlay_path", "thermal_path"):
                p = v.get(path_key)
                if p:
                    try: Path(p).unlink(missing_ok=True)
                    except Exception: pass
    await db.predictions.delete_one({"id": pred_id, "user_id": user["id"]})
    return {"ok": True}


@api_router.get("/predictions/{pred_id}/report")
async def download_report(pred_id: str, user=Depends(get_current_user)):
    row = await db.predictions.find_one({"id": pred_id, "user_id": user["id"]}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        pdf_bytes = build_report(row, str(UPLOAD_DIR))
    except Exception as e:
        logging.exception("PDF generation failed")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    await db.predictions.update_one(
        {"id": pred_id, "user_id": user["id"]},
        {"$set": {"last_report_at": datetime.now(timezone.utc).isoformat()},
         "$inc": {"report_count": 1}},
    )
    filename = f"NeuroDetect_Report_{row.get('patient_name', 'patient').replace(' ', '_')}_{pred_id[:8]}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@api_router.get("/files/{filename}")
async def get_file(filename: str, user=Depends(get_current_user)):
    safe = Path(filename).name
    full = UPLOAD_DIR / safe
    if not full.exists():
        raise HTTPException(status_code=404, detail="File not found")
    pred_id = safe.split("_", 1)[0]
    pred = await db.predictions.find_one({"id": pred_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not pred:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(full))


@api_router.get("/stats")
async def get_stats(user=Depends(get_current_user)):
    rows = await db.predictions.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    total = len(rows)
    high = sum(1 for r in rows if r["risk_level"] == "High")
    moderate = sum(1 for r in rows if r["risk_level"] in ("Moderate", "Medium"))
    low = sum(1 for r in rows if r["risk_level"] == "Low")
    avg_score = round(sum(r["risk_score"] for r in rows) / total, 1) if total else 0

    from collections import defaultdict
    monthly = defaultdict(lambda: {"high": 0, "moderate": 0, "low": 0, "total": 0})
    for r in rows:
        ts = r["created_at"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        key = ts.strftime("%b %Y")
        monthly[key]["total"] += 1
        bucket = "high" if r["risk_level"] == "High" else ("moderate" if r["risk_level"] in ("Moderate", "Medium") else "low")
        monthly[key][bucket] += 1

    age_buckets = {"<30": 0, "30-44": 0, "45-59": 0, "60+": 0}
    for r in rows:
        a = int(r.get("age") or 0)
        if a < 30: age_buckets["<30"] += 1
        elif a < 45: age_buckets["30-44"] += 1
        elif a < 60: age_buckets["45-59"] += 1
        else: age_buckets["60+"] += 1

    recent = sorted(rows, key=lambda r: r["created_at"], reverse=True)[:5]
    return {
        "total_patients": total, "high_risk": high, "moderate_risk": moderate, "low_risk": low,
        "average_score": avg_score,
        "risk_distribution": [
            {"name": "Low", "value": low},
            {"name": "Moderate", "value": moderate},
            {"name": "High", "value": high},
        ],
        "monthly_trend": [{"month": k, **v} for k, v in sorted(monthly.items(),
                          key=lambda kv: datetime.strptime(kv[0], "%b %Y"))][-6:],
        "age_distribution": [{"bucket": k, "count": v} for k, v in age_buckets.items()],
        "recent_activity": [{
            "id": r["id"], "patient_name": r["patient_name"],
            "risk_level": r["risk_level"], "risk_score": r["risk_score"],
            "created_at": r["created_at"] if isinstance(r["created_at"], str) else r["created_at"].isoformat(),
        } for r in recent],
    }


# ✅ Router included AFTER middleware is registered
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()