"""
Professional hospital-style PDF report generator (ReportLab).
"""
from __future__ import annotations
import io
import os
import re
from datetime import datetime
from typing import Optional, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, PageBreak, KeepTogether, Flowable
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.barcharts import HorizontalBarChart


TEAL = colors.HexColor("#0F766E")
TEAL_LIGHT = colors.HexColor("#CCFBF1")
SLATE = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
BORDER = colors.HexColor("#E2E8F0")
LOW = colors.HexColor("#10B981")
MOD = colors.HexColor("#F59E0B")
HIGH = colors.HexColor("#E11D48")

def _risk_color(level: str):
    return {"Low": LOW, "Moderate": MOD, "Medium": MOD, "High": HIGH}.get(level, MUTED)




def _md_inline(text: str) -> str:
    """Convert inline markdown (**bold**, *italic*) into ReportLab tags."""
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^\*]+?)\*(?!\*)", r"<i>\1</i>", text)
    text = text.replace("\u2022", "•")
    return text


def render_explanation(raw: str, styles) -> List[Flowable]:
    """Convert a markdown-formatted AI explanation into clean PDF flowables.
       Strips '#'/'##' headers, converts **bold** / *italic*, and renders
       lines starting with '-', '*' or '•' as proper bullet points."""
    flowables: List[Flowable] = []
    if not raw:
        return flowables

    # Normalise line endings
    raw = raw.replace("\r\n", "\n").strip()
    # Split on blank line for paragraphs
    blocks = re.split(r"\n\s*\n", raw)

    for block in blocks:
        block = block.strip()
        if not block:
            continue
        lines = [ln.rstrip() for ln in block.split("\n")]

        # Detect bullet list (most lines start with -, *, • or "1.")
        bullet_pat = re.compile(r"^\s*(?:[-*•]|\d+\.)\s+")
        bullets = [ln for ln in lines if bullet_pat.match(ln)]
        if bullets and len(bullets) >= max(1, len(lines) - 1):
            for ln in lines:
                if not ln.strip():
                    continue
                content = bullet_pat.sub("", ln).strip()
                content = _md_inline(content)
                flowables.append(Paragraph(f"•&nbsp;&nbsp;{content}", styles["bullet"]))
                flowables.append(Spacer(1, 2))
            flowables.append(Spacer(1, 4))
            continue

        # Headings: lines starting with # or ##
        if lines[0].lstrip().startswith("#"):
            heading = lines[0].lstrip("# ").strip()
            heading = _md_inline(heading)
            flowables.append(Paragraph(heading, styles["h3_inline"]))
            rest = "\n".join(lines[1:]).strip()
            if rest:
                flowables.append(Paragraph(_md_inline(rest.replace("\n", " ")), styles["body"]))
                flowables.append(Spacer(1, 4))
            else:
                flowables.append(Spacer(1, 2))
            continue

        # Regular paragraph — collapse newlines
        para_text = " ".join(ln.strip() for ln in lines if ln.strip())
        flowables.append(Paragraph(_md_inline(para_text), styles["body"]))
        flowables.append(Spacer(1, 4))

    return flowables


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Helvetica-Bold",
                                fontSize=18, textColor=SLATE, spaceAfter=4, alignment=0),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontName="Helvetica",
                                   fontSize=9, textColor=MUTED, spaceAfter=10),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold",
                             fontSize=12, textColor=TEAL, spaceBefore=12, spaceAfter=6),
        "h3_inline": ParagraphStyle("h3i", parent=base["Heading3"], fontName="Helvetica-Bold",
                                    fontSize=10.5, textColor=SLATE,
                                    spaceBefore=6, spaceAfter=3),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica",
                               fontSize=9.5, textColor=SLATE, leading=13),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontName="Helvetica",
                                 fontSize=9.5, textColor=SLATE, leading=13,
                                 leftIndent=10),
        "bodyMuted": ParagraphStyle("bm", parent=base["BodyText"], fontName="Helvetica",
                                    fontSize=8.5, textColor=MUTED, leading=12),
        "small": ParagraphStyle("small", parent=base["Normal"], fontName="Helvetica",
                                fontSize=8, textColor=MUTED),
        "caption": ParagraphStyle("caption", parent=base["Normal"], fontName="Helvetica",
                                  fontSize=8, textColor=MUTED, alignment=1),
    }


def _header_footer(canvas, doc):
    canvas.saveState()
    # Header band
    canvas.setFillColor(TEAL)
    canvas.rect(0, A4[1] - 18 * mm, A4[0], 18 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(15 * mm, A4[1] - 11 * mm, "NeuroDetect")
    canvas.setFont("Helvetica", 9)
    canvas.drawString(15 * mm, A4[1] - 15 * mm,
                      "Smart Healthcare — Peripheral Neuropathy Detection")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(A4[0] - 15 * mm, A4[1] - 11 * mm,
                           "AI-Assisted Clinical Report")
    canvas.drawRightString(A4[0] - 15 * mm, A4[1] - 15 * mm,
                           datetime.now().strftime("%d %b %Y · %H:%M"))
    # Footer
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(15 * mm, 10 * mm,
                      "Confidential medical document — for clinical use only. "
                      "AI predictions assist but do not replace professional medical advice.")
    canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _info_table(rows, col_widths):
    tbl = Table(rows, colWidths=col_widths, hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (1, 0), (1, -1), SLATE),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, BORDER),
    ]))
    return tbl


def _risk_bar(score: int, level: str):
    d = Drawing(170 * mm, 14 * mm)
    d.add(Rect(0, 2, 170 * mm, 8, fillColor=BORDER, strokeColor=None))
    fill_w = max(0, min(170 * mm * score / 100.0, 170 * mm))
    d.add(Rect(0, 2, fill_w, 8, fillColor=_risk_color(level), strokeColor=None))
    d.add(String(0, 14, "0", fontName="Helvetica", fontSize=7, fillColor=MUTED))
    d.add(String(170 * mm - 12, 14, "100", fontName="Helvetica", fontSize=7, fillColor=MUTED))
    d.add(String(fill_w - 8, -8, f"{score}", fontName="Helvetica-Bold",
                 fontSize=9, fillColor=_risk_color(level)))
    return d


def _component_chart(components: dict):
    """components keys: clinical, hand, foot, thermal — values are weighted score 0-100."""
    d = Drawing(170 * mm, 70)
    chart = HorizontalBarChart()
    chart.x = 70
    chart.y = 8
    chart.width = 170 * mm - 90
    chart.height = 55
    labels = list(components.keys())
    values = [[components[k] for k in labels]]
    chart.data = values
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontSize = 8
    chart.categoryAxis.labels.fillColor = SLATE
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = 100
    chart.valueAxis.labels.fontSize = 7
    chart.valueAxis.labels.fillColor = MUTED
    chart.bars[0].fillColor = TEAL
    chart.bars[0].strokeColor = None
    chart.bars.strokeColor = None
    d.add(chart)
    return d


def _image_from_bytes(img_bytes: bytes, max_w: float = 80 * mm, max_h: float = 60 * mm):
    if not img_bytes:
        return None
    try:
        img = RLImage(io.BytesIO(img_bytes))
        iw, ih = img.imageWidth, img.imageHeight
        ratio = min(max_w / iw, max_h / ih)
        img.drawWidth = iw * ratio
        img.drawHeight = ih * ratio
        return img
    except Exception:
        return None


def build_report(prediction: dict, uploads_dir: str) -> bytes:
    s = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=24 * mm, bottomMargin=18 * mm,
                            title=f"NeuroDetect Report — {prediction.get('patient_name', '')}")
    story = []

    inp = prediction.get("inputs", {})
    pname = prediction.get("patient_name", "Patient")
    level = prediction.get("risk_level", "Low")
    score = int(prediction.get("risk_score", 0))
    confidence = prediction.get("confidence", None)
    created = prediction.get("created_at")
    created_str = ""
    if isinstance(created, str):
        created_str = created.replace("T", " ")[:19]
    elif hasattr(created, "strftime"):
        created_str = created.strftime("%Y-%m-%d %H:%M")

    # Title
    story.append(Paragraph("Peripheral Neuropathy Risk Assessment", s["title"]))
    story.append(Paragraph(f"Generated: {created_str}", s["subtitle"]))

    # Patient summary
    story.append(Paragraph("Patient Information", s["h2"]))
    story.append(_info_table([
        ["Patient name", pname, "Date / time", created_str],
        ["Age", str(prediction.get("age", inp.get("age", "—"))),
         "Gender", str(prediction.get("gender", inp.get("gender", "—")))],
        ["BMI", str(prediction.get("bmi", inp.get("bmi", "—"))),
         "Physical activity", str(inp.get("physical_activity", "—"))],
    ], col_widths=[28 * mm, 55 * mm, 32 * mm, 55 * mm]))

    # Clinical values
    story.append(Paragraph("Clinical Values", s["h2"]))
    story.append(_info_table([
        ["Blood sugar (mg/dL)", str(inp.get("blood_sugar", "—")),
         "Cholesterol (mg/dL)", str(inp.get("cholesterol", "—"))],
        ["Systolic BP (mmHg)", str(inp.get("blood_pressure_systolic", "—")),
         "Diabetes", "Yes" if inp.get("diabetes") else "No"],
        ["Smoking", "Yes" if inp.get("smoking") else "No",
         "Alcohol", "Yes" if inp.get("alcohol") else "No"],
        ["Family history", "Yes" if inp.get("family_history") else "No",
         "", ""],
    ], col_widths=[40 * mm, 45 * mm, 40 * mm, 45 * mm]))

    # Symptoms
    sym_keys = ["numbness", "tingling", "burning_pain", "muscle_weakness",
                "loss_of_balance", "foot_ulcers"]
    selected = [k.replace("_", " ").title() for k in sym_keys if inp.get(k)]
    story.append(Paragraph("Reported Symptoms", s["h2"]))
    story.append(Paragraph(
        ", ".join(selected) if selected else "<i>No neurological symptoms reported.</i>",
        s["body"]))

    # Risk summary
    story.append(Paragraph("Final AI Prediction", s["h2"]))
    badge_color = _risk_color(level)
    summary_tbl = Table([[
        Paragraph(f"<font color='{badge_color.hexval()}'><b>{level.upper()} RISK</b></font>",
                  s["body"]),
        Paragraph(f"<b>Risk score:</b> {score}%", s["body"]),
        Paragraph(f"<b>Confidence:</b> {confidence if confidence is not None else '—'}%",
                  s["body"]),
    ]], colWidths=[55 * mm, 55 * mm, 55 * mm])
    summary_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 6))
    story.append(_risk_bar(score, level))

    # Component breakdown
    img_analyses = prediction.get("image_analyses") or {}
    components = {"Clinical (50%)": int(prediction.get("clinical_score", score))}
    if "hand" in img_analyses:
        components["Hand image (15%)"] = int(img_analyses["hand"]["score"])
    if "foot" in img_analyses:
        components["Foot image (15%)"] = int(img_analyses["foot"]["score"])
    if "thermal_hand" in img_analyses or "thermal_foot" in img_analyses:
        t_scores = [img_analyses[k]["score"]
                    for k in ("thermal_hand", "thermal_foot") if k in img_analyses]
        components["Thermal (20%)"] = int(sum(t_scores) / len(t_scores)) if t_scores else 0

    if len(components) > 1:
        story.append(Paragraph("Multimodal Component Scores", s["h2"]))
        story.append(_component_chart(components))

    # AI explanation — markdown-aware rendering with bullets and clean headings
    story.append(Paragraph("AI Clinical Explanation", s["h2"]))
    explanation = prediction.get("ai_explanation", "") or ""
    story.extend(render_explanation(explanation, s))

    # Image analyses with thumbnails — include ORIGINAL, OVERLAY, and THERMAL maps
    if img_analyses:
        story.append(PageBreak())
        story.append(Paragraph("Image Analysis", s["h2"]))
        for key, label in [
            ("hand", "Hand Image (Standard)"),
            ("foot", "Foot Image (Standard)"),
            ("thermal_hand", "Thermal Hand Image"),
            ("thermal_foot", "Thermal Foot Image"),
        ]:
            a = img_analyses.get(key)
            if not a:
                continue
            block = []
            block.append(Paragraph(f"<b>{label}</b>", s["body"]))
            block.append(Paragraph(
                f"AI score: <b>{a['score']}%</b> &nbsp;·&nbsp; Confidence: <b>{a['confidence']}%</b>",
                s["bodyMuted"]))
            block.append(Spacer(1, 4))

            # Findings as bullet list
            for finding in a.get("findings", []):
                block.append(Paragraph(f"•&nbsp;&nbsp;{finding}", s["bullet"]))
            block.append(Spacer(1, 4))

            # Image strip: ORIGINAL + OVERLAY + THERMAL MAP
            row_imgs = []
            for path_key, cap in [
                ("original_path", "Original Upload"),
                ("overlay_path", "AI Overlay"),
                ("thermal_path", "Thermal / Hotspot Map"),
            ]:
                p = a.get(path_key)
                if p and os.path.exists(p):
                    try:
                        with open(p, "rb") as f:
                            rli = _image_from_bytes(f.read(), 55 * mm, 45 * mm)
                        if rli is not None:
                            row_imgs.append((rli, cap))
                    except Exception:
                        pass

            if row_imgs:
                cols = len(row_imgs)
                col_w = (180 * mm) / cols
                imgs_row = [r[0] for r in row_imgs]
                caps_row = [Paragraph(r[1], s["caption"]) for r in row_imgs]
                tbl = Table([imgs_row, caps_row], colWidths=[col_w] * cols)
                tbl.setStyle(TableStyle([
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                    ("TOPPADDING", (0, 1), (-1, 1), 2),
                ]))
                block.append(tbl)
            block.append(Spacer(1, 12))
            story.append(KeepTogether(block))

    # Recommendations
    recs = prediction.get("recommendations", [])
    if recs:
        story.append(Paragraph("Medical Recommendations", s["h2"]))
        for r in recs:
            story.append(Paragraph(f"• {r}", s["body"]))
            story.append(Spacer(1, 2))

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "<i>This report was generated by an AI-assisted decision support system. "
        "It is intended to supplement, not replace, professional medical judgment. "
        "Please consult a qualified neurologist for diagnosis and treatment planning.</i>",
        s["small"]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()
