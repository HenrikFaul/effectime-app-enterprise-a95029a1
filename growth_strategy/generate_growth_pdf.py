"""
Effectime Growth Strategy Report — PDF Generator
Produces branded PDFs for EN and HU growth strategy reports.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.platypus.flowables import Flowable
import os

# ── Brand palette ─────────────────────────────────────────────────────────────
BRAND_DARK    = colors.HexColor("#0F172A")
BRAND_MID     = colors.HexColor("#1E293B")
BRAND_ACCENT  = colors.HexColor("#6366F1")
BRAND_ACCENT2 = colors.HexColor("#818CF8")
BRAND_TEAL    = colors.HexColor("#0EA5E9")
BRAND_GREEN   = colors.HexColor("#10B981")
BRAND_AMBER   = colors.HexColor("#F59E0B")
BRAND_RED     = colors.HexColor("#EF4444")
TABLE_HEADER  = colors.HexColor("#4F46E5")
TABLE_ROW1    = colors.HexColor("#F8F9FF")
TABLE_ROW2    = colors.HexColor("#EEF2FF")
TABLE_BORDER  = colors.HexColor("#C7D2FE")
TEXT_BODY     = colors.HexColor("#1E293B")
TEXT_MUTED    = colors.HexColor("#64748B")
WHITE         = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

RANK_COLORS = [
    colors.HexColor("#6366F1"),  # 1
    colors.HexColor("#8B5CF6"),  # 2
    colors.HexColor("#3B82F6"),  # 3
    colors.HexColor("#0EA5E9"),  # 4
    colors.HexColor("#10B981"),  # 5
    colors.HexColor("#059669"),  # 6
    colors.HexColor("#F59E0B"),  # 7
    colors.HexColor("#EF4444"),  # 8
]


# ── Styles ─────────────────────────────────────────────────────────────────────
def make_styles():
    s = getSampleStyleSheet()
    base = dict(fontName="Helvetica", leading=14, textColor=TEXT_BODY)

    return {
        "cover_title": ParagraphStyle("cover_title",
            fontName="Helvetica-Bold", fontSize=28, textColor=WHITE,
            leading=34, alignment=TA_CENTER, spaceAfter=6),
        "cover_sub": ParagraphStyle("cover_sub",
            fontName="Helvetica", fontSize=14, textColor=BRAND_ACCENT2,
            leading=20, alignment=TA_CENTER, spaceAfter=4),
        "cover_meta": ParagraphStyle("cover_meta",
            fontName="Helvetica", fontSize=10, textColor=colors.HexColor("#94A3B8"),
            leading=14, alignment=TA_CENTER),
        "rank_header": ParagraphStyle("rank_header",
            fontName="Helvetica-Bold", fontSize=20, textColor=WHITE,
            leading=26, alignment=TA_LEFT, spaceAfter=4),
        "point_label": ParagraphStyle("point_label",
            fontName="Helvetica-Bold", fontSize=9, textColor=BRAND_ACCENT2,
            leading=12, spaceBefore=10, spaceAfter=2),
        "point_title": ParagraphStyle("point_title",
            fontName="Helvetica-Bold", fontSize=14, textColor=BRAND_ACCENT,
            leading=18, spaceAfter=6),
        "body": ParagraphStyle("body",
            fontName="Helvetica", fontSize=9.5, textColor=TEXT_BODY,
            leading=14, spaceAfter=4, alignment=TA_JUSTIFY),
        "body_bold": ParagraphStyle("body_bold",
            fontName="Helvetica-Bold", fontSize=9.5, textColor=TEXT_BODY,
            leading=14, spaceAfter=4),
        "bullet": ParagraphStyle("bullet",
            fontName="Helvetica", fontSize=9, textColor=TEXT_BODY,
            leading=13, leftIndent=12, spaceAfter=3,
            bulletIndent=4, bulletFontName="Helvetica", bulletFontSize=9),
        "code": ParagraphStyle("code",
            fontName="Courier", fontSize=7.5, textColor=colors.HexColor("#E2E8F0"),
            leading=11, spaceAfter=2, backColor=colors.HexColor("#1E293B"),
            leftIndent=6, rightIndent=6),
        "section_h": ParagraphStyle("section_h",
            fontName="Helvetica-Bold", fontSize=11, textColor=BRAND_ACCENT,
            leading=16, spaceBefore=8, spaceAfter=4),
        "table_hdr": ParagraphStyle("table_hdr",
            fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE,
            leading=12, alignment=TA_CENTER),
        "table_cell": ParagraphStyle("table_cell",
            fontName="Helvetica", fontSize=8.5, textColor=TEXT_BODY,
            leading=12),
        "table_cell_bold": ParagraphStyle("table_cell_bold",
            fontName="Helvetica-Bold", fontSize=8.5, textColor=BRAND_ACCENT,
            leading=12),
        "muted": ParagraphStyle("muted",
            fontName="Helvetica", fontSize=8, textColor=TEXT_MUTED,
            leading=12, spaceAfter=4),
        "toc_rank": ParagraphStyle("toc_rank",
            fontName="Helvetica-Bold", fontSize=9, textColor=BRAND_ACCENT,
            leading=13),
        "toc_title": ParagraphStyle("toc_title",
            fontName="Helvetica", fontSize=9, textColor=TEXT_BODY,
            leading=13),
        "summary_title": ParagraphStyle("summary_title",
            fontName="Helvetica-Bold", fontSize=15, textColor=BRAND_ACCENT,
            leading=20, spaceBefore=8, spaceAfter=6, alignment=TA_CENTER),
        "footer_val": ParagraphStyle("footer_val",
            fontName="Helvetica-Bold", fontSize=13, textColor=BRAND_GREEN,
            leading=18, alignment=TA_CENTER),
    }


# ── Page template ──────────────────────────────────────────────────────────────
class PageTemplate:
    def __init__(self, title, lang="en"):
        self.doc_title = title
        self.lang = lang

    def on_page(self, c: canvas.Canvas, doc):
        pn = doc.page
        c.saveState()
        # header bar
        c.setFillColor(BRAND_DARK)
        c.rect(0, PAGE_H - 14*mm, PAGE_W, 14*mm, fill=1, stroke=0)
        c.setFillColor(BRAND_ACCENT)
        c.rect(0, PAGE_H - 14*mm, 4*mm, 14*mm, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(WHITE)
        c.drawString(MARGIN, PAGE_H - 9*mm, "EFFECTIME ENTERPRISE")
        c.setFont("Helvetica", 8)
        c.setFillColor(BRAND_ACCENT2)
        label = "Growth Strategy Report" if self.lang == "en" else "Növekedési Stratégia"
        c.drawRightString(PAGE_W - MARGIN, PAGE_H - 9*mm, label)
        # footer
        c.setFillColor(BRAND_DARK)
        c.rect(0, 0, PAGE_W, 12*mm, fill=1, stroke=0)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(TEXT_MUTED)
        conf = "Confidential — Strategic Intelligence Report" if self.lang == "en" else "Bizalmas — Stratégiai Intelligencia Jelentés"
        c.drawString(MARGIN, 4.5*mm, conf)
        c.setFillColor(BRAND_ACCENT2)
        c.drawRightString(PAGE_W - MARGIN, 4.5*mm, f"Page {pn}")
        c.restoreState()


# ── Cover page ─────────────────────────────────────────────────────────────────
def build_cover(story, styles, lang="en"):
    if lang == "en":
        title = "TOP 20 VALUE-ROCKET\nGROWTH STRATEGY"
        subtitle = "How Effectime Becomes the Market Leader\nin Workforce Intelligence"
        meta1 = "Effectime Enterprise — Strategic Product & Market Intelligence Report"
        meta2 = "Prepared: May 2026  |  Confidential"
        meta3 = "Baseline Valuation: €580k–€1.05M  →  Target: €5.3M–€10.3M"
    else:
        title = "TOP 20 ÉRTÉKNÖVELŐ\nNÖVEKEDÉSI STRATÉGIA"
        subtitle = "Hogyan válik az Effectime a munkaerő-intelligencia\npiacának vezetőjévé"
        meta1 = "Effectime Enterprise — Stratégiai Termék és Piaci Intelligencia Jelentés"
        meta2 = "Készítve: 2026. május  |  Bizalmas"
        meta3 = "Kiindulási értékelés: €580k–€1,05M  →  Célértékelés: €5,3M–€10,3M"

    # dark background block (simulated with colored table)
    cover_data = [[""]]
    cover_table = Table(cover_data, colWidths=[PAGE_W - 2*MARGIN], rowHeights=[200])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("ROUNDEDCORNERS", [8]),
    ]))

    story.append(Spacer(1, 30*mm))

    # gradient accent block
    accent_data = [[Paragraph(title, styles["cover_title"])]]
    accent_table = Table(accent_data, colWidths=[PAGE_W - 2*MARGIN], rowHeights=[80])
    accent_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("TOPPADDING", (0, 0), (-1, -1), 20),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(accent_table)
    story.append(Spacer(1, 4*mm))

    sub_data = [[Paragraph(subtitle, styles["cover_sub"])]]
    sub_table = Table(sub_data, colWidths=[PAGE_W - 2*MARGIN], rowHeights=[50])
    sub_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_MID),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(sub_table)
    story.append(Spacer(1, 6*mm))

    # KPI bar
    kpi_label1 = "€5.3M–€10.3M" if lang == "en" else "€5,3M–€10,3M"
    kpi_label2 = "8–10×"
    kpi_label3 = "20"
    kpi_desc1 = "Target Valuation" if lang == "en" else "Célértékelés"
    kpi_desc2 = "Value Multiple" if lang == "en" else "Értékszorzó"
    kpi_desc3 = "Growth Initiatives" if lang == "en" else "Növekedési Kezdeményezés"

    kpi_data = [
        [
            Paragraph(kpi_label1, ParagraphStyle("kv", fontName="Helvetica-Bold",
                fontSize=16, textColor=BRAND_GREEN, leading=20, alignment=TA_CENTER)),
            Paragraph(kpi_label2, ParagraphStyle("kv", fontName="Helvetica-Bold",
                fontSize=16, textColor=BRAND_ACCENT, leading=20, alignment=TA_CENTER)),
            Paragraph(kpi_label3, ParagraphStyle("kv", fontName="Helvetica-Bold",
                fontSize=16, textColor=BRAND_AMBER, leading=20, alignment=TA_CENTER)),
        ],
        [
            Paragraph(kpi_desc1, ParagraphStyle("kd", fontName="Helvetica", fontSize=8,
                textColor=TEXT_MUTED, leading=12, alignment=TA_CENTER)),
            Paragraph(kpi_desc2, ParagraphStyle("kd", fontName="Helvetica", fontSize=8,
                textColor=TEXT_MUTED, leading=12, alignment=TA_CENTER)),
            Paragraph(kpi_desc3, ParagraphStyle("kd", fontName="Helvetica", fontSize=8,
                textColor=TEXT_MUTED, leading=12, alignment=TA_CENTER)),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[(PAGE_W - 2*MARGIN)/3]*3,
                      rowHeights=[28, 20])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_MID),
        ("LINEAFTER", (0, 0), (1, -1), 0.5, colors.HexColor("#334155")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8*mm))

    # meta block
    meta_data = [
        [Paragraph(meta1, styles["cover_meta"])],
        [Paragraph(meta2, styles["cover_meta"])],
        [Spacer(1, 3*mm)],
        [Paragraph(meta3, ParagraphStyle("mv", fontName="Helvetica-Bold", fontSize=10,
            textColor=BRAND_ACCENT2, leading=14, alignment=TA_CENTER))],
    ]
    meta_table = Table(meta_data, colWidths=[PAGE_W - 2*MARGIN])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(meta_table)
    story.append(PageBreak())


# ── TOC ────────────────────────────────────────────────────────────────────────
def build_toc(story, styles, lang="en"):
    if lang == "en":
        heading = "TABLE OF CONTENTS"
        ranks = [
            (1, "AI Scheduling Copilot", "€800k–€1,350k"),
            (2, "Microsoft 365 / Google Workspace Integration", "€280k–€570k"),
            (3, "Real-time Predictive Analytics Dashboard", "€400k–€750k"),
            (4, "White-label & Multi-tenant Architecture", "€600k–€1,200k"),
            (5, "Payroll Engine Integration (SAP, Workday, ADP)", "€350k–€700k"),
            (6, "SOC 2 Type II + ISO 27001 Certification", "€250k–€500k"),
            (7, "Mobile-First Native App with Offline Capability", "€300k–€600k"),
            (8, "Predictive Burnout & Wellbeing Detection Engine", "€200k–€400k"),
            (9, "Open API Platform & Developer Ecosystem", "€180k–€350k"),
            (10, "GPS / NFC / QR Clock-In System", "€150k–€300k"),
            (11, "Skills & Competency Matrix", "€120k–€250k"),
            (12, "Shift Marketplace & Peer-to-Peer Trading", "€100k–€200k"),
            (13, "Automated GDPR & Labor Law Compliance", "€100k–€200k"),
            (14, "Gamification & Employee Engagement Layer", "€80k–€160k"),
            (15, "Custom Report Builder & Self-Service BI", "€80k–€150k"),
            (16, "Multi-language & DACH Market Expansion", "€300k–€600k"),
            (17, "Customer Success Platform", "€100k–€200k"),
            (18, "AI Document Generator", "€80k–€150k"),
            (19, "Extension Marketplace & Plugin Architecture", "€150k–€300k"),
            (20, "Candidate Scheduling & ATS Integration", "€120k–€250k"),
        ]
        total_label = "TOTAL COMBINED POTENTIAL:"
        total_val = "+€4.74M–€9.23M"
        impact_col = "Est. Impact"
    else:
        heading = "TARTALOMJEGYZÉK"
        ranks = [
            (1, "AI Ütemező Kopilot", "€800k–€1,35M"),
            (2, "Microsoft 365 / Google Workspace Integráció", "€280k–€570k"),
            (3, "Valós Idejű Prediktív Elemzési Dashboard", "€400k–€750k"),
            (4, "White-label és Többbérlős Architektúra", "€600k–€1,2M"),
            (5, "Bérszámfejtési Motor Integráció", "€350k–€700k"),
            (6, "SOC 2 Type II + ISO 27001 Tanúsítás", "€250k–€500k"),
            (7, "Mobilcentrikus Natív Alkalmazás (Offline)", "€300k–€600k"),
            (8, "Kiégés és Jóllét Felismerő Motor", "€200k–€400k"),
            (9, "Nyílt API Platform és Fejlesztői Ökoszisztéma", "€180k–€350k"),
            (10, "GPS / NFC / QR Bejelentkezési Rendszer", "€150k–€300k"),
            (11, "Készségek és Kompetencia Mátrix", "€120k–€250k"),
            (12, "Műszakpiac és Peer-to-Peer Csere", "€100k–€200k"),
            (13, "Automatizált GDPR és Munkajogi Megfelelőség", "€100k–€200k"),
            (14, "Gamifikáció és Munkavállalói Elköteleződés", "€80k–€160k"),
            (15, "Egyéni Jelentéskészítő és Önkiszolgáló BI", "€80k–€150k"),
            (16, "Többnyelvű Terjeszkedés és DACH Bővítés", "€300k–€600k"),
            (17, "Ügyfél Siker Platform", "€100k–€200k"),
            (18, "AI Dokumentumgenerátor", "€80k–€150k"),
            (19, "Bővítmény-piactér és Plugin Architektúra", "€150k–€300k"),
            (20, "Jelölt Ütemezés és ATS Integráció", "€120k–€250k"),
        ]
        total_label = "TELJES KOMBINÁLT POTENCIÁL:"
        total_val = "+€4,74M–€9,23M"
        impact_col = "Becsült Hatás"

    # heading
    story.append(Spacer(1, 8*mm))
    hdr_data = [[Paragraph(heading, ParagraphStyle("th", fontName="Helvetica-Bold",
        fontSize=16, textColor=WHITE, leading=22, alignment=TA_LEFT))]]
    hdr_table = Table(hdr_data, colWidths=[PAGE_W - 2*MARGIN], rowHeights=[32])
    hdr_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_ACCENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(hdr_table)
    story.append(Spacer(1, 4*mm))

    col_w = [12*mm, PAGE_W - 2*MARGIN - 12*mm - 32*mm, 32*mm]
    toc_header = [
        Paragraph("#", styles["table_hdr"]),
        Paragraph("Initiative" if lang == "en" else "Kezdeményezés", styles["table_hdr"]),
        Paragraph(impact_col, styles["table_hdr"]),
    ]
    toc_rows = [toc_header]
    for rank, title, impact in ranks:
        color_idx = (rank - 1) % len(RANK_COLORS)
        rank_p = Paragraph(f"<b>{rank}</b>", ParagraphStyle("rn",
            fontName="Helvetica-Bold", fontSize=9, textColor=RANK_COLORS[color_idx],
            leading=12, alignment=TA_CENTER))
        toc_rows.append([
            rank_p,
            Paragraph(title, styles["toc_title"]),
            Paragraph(f"<b>{impact}</b>", ParagraphStyle("imp",
                fontName="Helvetica-Bold", fontSize=8, textColor=BRAND_GREEN,
                leading=12, alignment=TA_RIGHT)),
        ])

    toc_table = Table(toc_rows, colWidths=col_w)
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.3, TABLE_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])
    for i in range(1, len(toc_rows)):
        bg = TABLE_ROW1 if i % 2 == 1 else TABLE_ROW2
        ts.add("BACKGROUND", (0, i), (-1, i), bg)
    toc_table.setStyle(ts)
    story.append(toc_table)
    story.append(Spacer(1, 6*mm))

    # total row
    total_data = [[
        Paragraph(total_label, ParagraphStyle("tl", fontName="Helvetica-Bold",
            fontSize=11, textColor=WHITE, leading=15)),
        Paragraph(total_val, ParagraphStyle("tv", fontName="Helvetica-Bold",
            fontSize=14, textColor=BRAND_GREEN, leading=18, alignment=TA_RIGHT)),
    ]]
    total_table = Table(total_data, colWidths=[PAGE_W - 2*MARGIN - 60*mm, 60*mm], rowHeights=[30])
    total_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(total_table)
    story.append(PageBreak())


# ── Rank header block ──────────────────────────────────────────────────────────
def rank_header_block(rank_num, title, lang="en"):
    color = RANK_COLORS[(rank_num - 1) % len(RANK_COLORS)]
    rank_label = f"RANK {rank_num}" if lang == "en" else f"{rank_num}. RANG"
    rank_p = Paragraph(rank_label, ParagraphStyle("rl",
        fontName="Helvetica-Bold", fontSize=10, textColor=WHITE, leading=14))
    title_p = Paragraph(title, ParagraphStyle("rht",
        fontName="Helvetica-Bold", fontSize=13, textColor=WHITE, leading=17))
    data = [[rank_p, ""], [title_p, ""]]
    t = Table(data, colWidths=[PAGE_W - 2*MARGIN - 20*mm, 20*mm], rowHeights=[18, 22])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("SPAN", (0, 0), (1, 0)),
        ("SPAN", (0, 1), (1, 1)),
    ]))
    return t


def point_label_block(number, label, lang="en"):
    text = f"POINT {number} — {label}" if lang == "en" else f"{number}. PONT — {label}"
    return Paragraph(text, ParagraphStyle("plb",
        fontName="Helvetica-Bold", fontSize=8, textColor=BRAND_ACCENT,
        leading=12, spaceBefore=8, spaceAfter=2))


def value_box(impact_text, lang="en"):
    label = "ESTIMATED VALUATION IMPACT" if lang == "en" else "BECSÜLT ÉRTÉKNÖVEKEDÉS"
    data = [
        [Paragraph(label, ParagraphStyle("vbl", fontName="Helvetica-Bold",
            fontSize=8, textColor=BRAND_ACCENT2, leading=12))],
        [Paragraph(impact_text, ParagraphStyle("vbv", fontName="Helvetica-Bold",
            fontSize=18, textColor=BRAND_GREEN, leading=22, alignment=TA_CENTER))],
    ]
    t = Table(data, colWidths=[PAGE_W - 2*MARGIN], rowHeights=[18, 28])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (0, 0), 6),
        ("BOTTOMPADDING", (0, 1), (0, 1), 6),
        ("ALIGN", (0, 1), (0, 1), "CENTER"),
    ]))
    return t


def metrics_table(rows, styles):
    """rows: list of (metric, impact) tuples"""
    hdr = [
        Paragraph("Metric" if True else "Metrika", styles["table_hdr"]),
        Paragraph("Impact", styles["table_hdr"]),
    ]
    data = [hdr] + [
        [Paragraph(m, styles["table_cell"]), Paragraph(v, styles["table_cell_bold"])]
        for m, v in rows
    ]
    col_w = [(PAGE_W - 2*MARGIN) * 0.55, (PAGE_W - 2*MARGIN) * 0.45]
    t = Table(data, colWidths=col_w)
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
        ("GRID", (0, 0), (-1, -1), 0.3, TABLE_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])
    for i in range(1, len(data)):
        ts.add("BACKGROUND", (0, i), (-1, i), TABLE_ROW1 if i % 2 == 1 else TABLE_ROW2)
    t.setStyle(ts)
    return t


def code_block(text, styles):
    """Render a code snippet block"""
    lines = text.strip().split("\n")
    data = [[Paragraph(line.replace(" ", "&nbsp;").replace("<", "&lt;").replace(">", "&gt;")
                       if line.strip() else "&nbsp;",
                       styles["code"])] for line in lines[:35]]
    if not data:
        return Spacer(1, 2*mm)
    t = Table(data, colWidths=[PAGE_W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1E293B")),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


# ── Individual rank content ───────────────────────────────────────────────────
def add_rank(story, styles, rank_num, lang, title, desc_paragraphs, impl_lines,
             metrics, value_text, regen_prompt):
    story.append(Spacer(1, 5*mm))
    story.append(rank_header_block(rank_num, title, lang))
    story.append(Spacer(1, 3*mm))

    # Point 2
    p2_label = "DESCRIPTION & MARKET EVIDENCE" if lang == "en" else "LEÍRÁS ÉS PIACI BIZONYÍTÉKOK"
    story.append(point_label_block(2, p2_label, lang))
    for para in desc_paragraphs:
        story.append(Paragraph(para, styles["body"]))
    story.append(Spacer(1, 3*mm))

    # Point 3
    p3_label = "IMPLEMENTATION PROMPT" if lang == "en" else "MEGVALÓSÍTÁSI PROMPT"
    story.append(point_label_block(3, p3_label, lang))
    story.append(code_block("\n".join(impl_lines), styles))
    story.append(Spacer(1, 3*mm))

    # Point 4
    p4_label = "VALUE INCREASE ESTIMATION" if lang == "en" else "ÉRTÉKNÖVEKEDÉSI BECSLÉS"
    story.append(point_label_block(4, p4_label, lang))
    story.append(metrics_table(metrics, styles))
    story.append(Spacer(1, 3*mm))
    story.append(value_box(value_text, lang))
    story.append(Spacer(1, 3*mm))

    # Point 5
    p5_label = "REGENERATION PROMPT" if lang == "en" else "ÚJRAGENERÁLÁSI PROMPT"
    story.append(point_label_block(5, p5_label, lang))
    story.append(code_block(regen_prompt, styles))
    story.append(PageBreak())


# ── Summary matrix ─────────────────────────────────────────────────────────────
def build_summary(story, styles, lang="en"):
    if lang == "en":
        heading = "COMPLETE VALUE MATRIX — ALL 20 INITIATIVES"
        rows = [
            ("1", "AI Scheduling Copilot", "+€800k–€1,350k"),
            ("2", "Microsoft 365 / Google Workspace Integration", "+€280k–€570k"),
            ("3", "Real-time Predictive Analytics Dashboard", "+€400k–€750k"),
            ("4", "White-label & Multi-tenant Architecture", "+€600k–€1,200k"),
            ("5", "Payroll Engine Integration", "+€350k–€700k"),
            ("6", "SOC 2 Type II + ISO 27001 Certification", "+€250k–€500k"),
            ("7", "Mobile-First Native App (Offline)", "+€300k–€600k"),
            ("8", "Burnout & Wellbeing Detection Engine", "+€200k–€400k"),
            ("9", "Open API Platform & Developer Ecosystem", "+€180k–€350k"),
            ("10", "GPS / NFC / QR Clock-In System", "+€150k–€300k"),
            ("11", "Skills & Competency Matrix", "+€120k–€250k"),
            ("12", "Shift Marketplace & Peer Trading", "+€100k–€200k"),
            ("13", "GDPR & Labor Law Compliance Automation", "+€100k–€200k"),
            ("14", "Gamification & Employee Engagement", "+€80k–€160k"),
            ("15", "Custom Report Builder & Self-Service BI", "+€80k–€150k"),
            ("16", "Multi-language & DACH Expansion", "+€300k–€600k"),
            ("17", "Customer Success Platform", "+€100k–€200k"),
            ("18", "AI Document Generator", "+€80k–€150k"),
            ("19", "Extension Marketplace & Plugin Architecture", "+€150k–€300k"),
            ("20", "Candidate Scheduling & ATS Integration", "+€120k–€250k"),
        ]
        total_row = ("", "TOTAL COMBINED POTENTIAL", "+€4.74M–€9.23M")
        baseline = "Baseline valuation: €580k–€1.05M"
        target = "Target valuation after full execution: €5.3M–€10.3M (8–10× value multiple)"
        rank_col = "Rank"
        initiative_col = "Initiative"
        impact_col = "Estimated Impact"
    else:
        heading = "TELJES ÉRTÉKMÁTRIX — MIND A 20 KEZDEMÉNYEZÉS"
        rows = [
            ("1", "AI Ütemező Kopilot", "+€800k–€1,35M"),
            ("2", "Microsoft 365 / Google Workspace Integráció", "+€280k–€570k"),
            ("3", "Valós Idejű Prediktív Elemzési Dashboard", "+€400k–€750k"),
            ("4", "White-label és Többbérlős Architektúra", "+€600k–€1,2M"),
            ("5", "Bérszámfejtési Motor Integráció", "+€350k–€700k"),
            ("6", "SOC 2 Type II + ISO 27001 Tanúsítás", "+€250k–€500k"),
            ("7", "Mobilcentrikus Natív Alkalmazás (Offline)", "+€300k–€600k"),
            ("8", "Kiégés és Jóllét Felismerő Motor", "+€200k–€400k"),
            ("9", "Nyílt API Platform és Fejlesztői Ökoszisztéma", "+€180k–€350k"),
            ("10", "GPS / NFC / QR Bejelentkezési Rendszer", "+€150k–€300k"),
            ("11", "Készségek és Kompetencia Mátrix", "+€120k–€250k"),
            ("12", "Műszakpiac és Peer-to-Peer Csere", "+€100k–€200k"),
            ("13", "Automatizált GDPR és Munkajogi Megfelelőség", "+€100k–€200k"),
            ("14", "Gamifikáció és Munkavállalói Elköteleződés", "+€80k–€160k"),
            ("15", "Egyéni Jelentéskészítő és Önkiszolgáló BI", "+€80k–€150k"),
            ("16", "Többnyelvű Terjeszkedés és DACH Bővítés", "+€300k–€600k"),
            ("17", "Ügyfél Siker Platform", "+€100k–€200k"),
            ("18", "AI Dokumentumgenerátor", "+€80k–€150k"),
            ("19", "Bővítmény-piactér és Plugin Architektúra", "+€150k–€300k"),
            ("20", "Jelölt Ütemezés és ATS Integráció", "+€120k–€250k"),
        ]
        total_row = ("", "TELJES KOMBINÁLT POTENCIÁL", "+€4,74M–€9,23M")
        baseline = "Kiindulási értékelés: €580k–€1,05M"
        target = "Célértékelés (teljes végrehajtás): €5,3M–€10,3M (8–10× értékszorzó)"
        rank_col = "Rang"
        initiative_col = "Kezdeményezés"
        impact_col = "Becsült Hatás"

    story.append(Spacer(1, 5*mm))
    hdr_data = [[Paragraph(heading, ParagraphStyle("sh", fontName="Helvetica-Bold",
        fontSize=13, textColor=WHITE, leading=18))]]
    hdr_t = Table(hdr_data, colWidths=[PAGE_W - 2*MARGIN], rowHeights=[30])
    hdr_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_ACCENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(hdr_t)
    story.append(Spacer(1, 4*mm))

    col_w = [12*mm, PAGE_W - 2*MARGIN - 12*mm - 36*mm, 36*mm]
    header_row = [
        Paragraph(rank_col, styles["table_hdr"]),
        Paragraph(initiative_col, styles["table_hdr"]),
        Paragraph(impact_col, styles["table_hdr"]),
    ]
    data = [header_row]
    for rank_s, init_s, impact_s in rows:
        rank_n = int(rank_s) if rank_s.isdigit() else 1
        color = RANK_COLORS[(rank_n - 1) % len(RANK_COLORS)]
        data.append([
            Paragraph(f"<b>{rank_s}</b>", ParagraphStyle("rn2",
                fontName="Helvetica-Bold", fontSize=9, textColor=color,
                leading=12, alignment=TA_CENTER)),
            Paragraph(init_s, styles["toc_title"]),
            Paragraph(f"<b>{impact_s}</b>", ParagraphStyle("imp2",
                fontName="Helvetica-Bold", fontSize=8.5, textColor=BRAND_GREEN,
                leading=12, alignment=TA_RIGHT)),
        ])

    # total row
    data.append([
        Paragraph("", styles["table_cell"]),
        Paragraph(f"<b>{total_row[1]}</b>", ParagraphStyle("tr",
            fontName="Helvetica-Bold", fontSize=10, textColor=WHITE, leading=14)),
        Paragraph(f"<b>{total_row[2]}</b>", ParagraphStyle("tv2",
            fontName="Helvetica-Bold", fontSize=11, textColor=BRAND_GREEN,
            leading=14, alignment=TA_RIGHT)),
    ])

    t = Table(data, colWidths=col_w)
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
        ("BACKGROUND", (0, -1), (-1, -1), BRAND_DARK),
        ("GRID", (0, 0), (-1, -2), 0.3, TABLE_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])
    for i in range(1, len(data) - 1):
        ts.add("BACKGROUND", (0, i), (-1, i), TABLE_ROW1 if i % 2 == 1 else TABLE_ROW2)
    t.setStyle(ts)
    story.append(t)
    story.append(Spacer(1, 6*mm))

    # baseline / target callout
    bl_data = [
        [Paragraph(baseline, ParagraphStyle("bl", fontName="Helvetica", fontSize=9,
            textColor=TEXT_MUTED, leading=13))],
        [Paragraph(f"→  {target}", ParagraphStyle("tgt", fontName="Helvetica-Bold",
            fontSize=11, textColor=BRAND_GREEN, leading=16))],
    ]
    bl_t = Table(bl_data, colWidths=[PAGE_W - 2*MARGIN])
    bl_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(bl_t)


# ── EN content data ────────────────────────────────────────────────────────────
EN_RANKS = [
    {
        "title": "AI Scheduling Copilot (Conversational AI Layer)",
        "desc": [
            "The single highest-leverage transformation available to Effectime is embedding a conversational AI copilot into the scheduling experience. Instead of requiring managers to manually configure complex rules or drag shifts on a Gantt chart, the AI copilot accepts natural language commands and autonomously executes multi-constraint optimizations.",
            "Products that embed AI natively are commanding 3–5x higher valuation multiples than feature-equivalent non-AI products (Gartner WFM Magic Quadrant 2025). Deputy AI reported 34% lift in upsell conversion after AI scheduling launch (March 2025). Rippling achieved a $13.5B valuation in 2025 citing AI as their primary moat.",
            "Technical approach: Add a Supabase Edge Function using Anthropic claude-sonnet-4-6 with tool_use to call existing scheduling actions. Stream the copilot reasoning via Supabase Realtime. The integration surface is narrow because the existing smartSchedule engine already handles execution.",
        ],
        "impl": [
            "Create supabase/functions/ai-copilot/index.ts",
            "  Accept: { instruction, enterprise_id, week_start }",
            "  Authenticate via JWT, enforce enterprise RLS",
            "  Use Anthropic claude-sonnet-4-6 with tool_use",
            "  Tools: check_conflicts, get_team_capacity, list_leave_requests",
            "  Return: { plan: ScheduleAction[], explanation, warnings }",
            "  Stream via Supabase Realtime: copilot:{enterprise_id}",
            "",
            "Create src/components/AICopilot/CopilotPanel.tsx",
            "  Floating panel (bottom-right, collapsible)",
            "  Natural language instruction input",
            "  Streaming 'thinking' indicator",
            "  'Apply Plan' button using existing schedule mutations",
            "",
            "Rate limit: max 20 AI requests/hour per enterprise",
            "No PII sent to AI — use employee IDs not names",
        ],
        "metrics": [
            ("Valuation multiple (ARR)", "3.5× → 6–8×"),
            ("Enterprise deal conversion", "+35–45%"),
            ("Monthly churn reduction", "−20–30%"),
        ],
        "value": "+€800k–€1,350k",
        "regen": "Analyze Effectime Enterprise and produce an AI Scheduling Copilot implementation plan. Cover: (1) WFM AI market rationale citing Gartner/Deputy/Rippling data, (2) Supabase Edge Function with Anthropic claude-sonnet-4-6 tool_use architecture, (3) complete TypeScript implementation prompt, (4) ARR multiple valuation impact, (5) regeneration meta-prompt. Use Point 1-5 structure.",
    },
    {
        "title": "Microsoft 365 / Google Workspace Deep Integration",
        "desc": [
            "78% of enterprises require calendar integration as a go/no-go criterion for WFM software purchases (Nucleus Research 2024). Deep M365/Google integration means: bidirectional calendar sync, Teams presence awareness, SharePoint schedule publishing, and a Teams bot for employee self-service.",
            "This directly attacks legacy competitors Replicon, UKG, and Shiftboard which offer M365 integration with poor reliability and no real-time presence sync. Microsoft Teams has 320M MAU (Microsoft Q2 2026 earnings) making it the #1 enterprise communication platform.",
            "Implementation: OAuth2 PKCE with Microsoft Graph API (Calendars.ReadWrite, Presence.Read), Google Calendar API v3 with Push Notifications webhooks, Azure Bot registration with Adaptive Cards for Teams.",
        ],
        "impl": [
            "Create supabase/functions/ms365-sync/index.ts",
            "  OAuth2 PKCE with Microsoft Identity Platform",
            "  Scopes: Calendars.ReadWrite, User.Read, Presence.Read",
            "  Encrypted refresh tokens in enterprise_integrations table",
            "  pg_cron sync every 15 minutes",
            "  OOO events treated as leave constraints",
            "",
            "Create supabase/functions/google-workspace-sync/index.ts",
            "  Google Calendar API v3 bidirectional sync",
            "  Google Push Notifications for real-time updates",
            "",
            "Register Azure Bot with commands:",
            "  /my-schedule, /request-leave, /swap-shift",
            "  Adaptive Cards UI inside Teams",
            "",
            "Add IntegrationSettingsPanel.tsx with connect/disconnect UI",
        ],
        "metrics": [
            ("Enterprise deal conversion lift", "+40–55%"),
            ("Average contract value increase", "+25–35%"),
            ("Estimated new ARR reachable", "+€80k–€150k/year"),
        ],
        "value": "+€280k–€570k",
        "regen": "Analyze Effectime and design Microsoft 365 and Google Workspace deep integration. Cover: (1) enterprise WFM buying criteria with Nucleus Research data, (2) Microsoft Graph API + Google Calendar API v3 bidirectional sync architecture, (3) Teams bot implementation with Adaptive Cards, (4) ARR impact, (5) regeneration prompt. Point 1-5 structure.",
    },
    {
        "title": "Real-time Predictive Analytics & Executive Intelligence Dashboard",
        "desc": [
            "Enterprise buyers pay 2–3× more for predictive workforce intelligence than operational scheduling visibility. Key capabilities: labor cost forecasting (90-day rolling payroll projection), absence pattern detection (logistic regression on leave history), coverage risk heatmap (days at risk of falling below minimum staffing).",
            "Visier (workforce analytics) built a $1B company on this insight layer on top of existing HRIS data. Effectime already has the scheduling data — adding analytics is pure value-add with zero additional data collection cost. HR analytics software commands 5–7× ARR multiples vs. 3–4× for pure scheduling tools (PitchBook Q4 2025).",
            "Technical approach: materialized views (mv_labor_cost_monthly, mv_absence_patterns) refreshed every 4 hours by pg_cron, analytics edge function with 4 core actions, Recharts-based AreaChart + heatmap calendar in the frontend.",
        ],
        "impl": [
            "Create supabase/functions/analytics-engine/index.ts",
            "  'labor-cost-forecast': {enterprise_id, months_ahead} → cost breakdown",
            "  'absence-risk-score': per-employee 0-100 risk scores",
            "  'coverage-risk-heatmap': daily risk per team for 90 days",
            "  'benchmark-kpis': adherence%, overtime%, absence%",
            "",
            "Create materialized views:",
            "  mv_labor_cost_monthly (refresh: pg_cron every 4h)",
            "  mv_absence_patterns (rolling 12-month per employee)",
            "",
            "Create src/pages/Analytics.tsx:",
            "  KPI cards: total hours, labor cost MTD, absence rate, coverage score",
            "  Labor cost forecast: Recharts AreaChart (6-month)",
            "  Coverage risk heatmap: calendar grid green/yellow/red",
            "  Absence risk table with sparklines",
            "  Export: PDF/Excel buttons",
        ],
        "metrics": [
            ("Product re-rating", "Scheduling tool → WFI Platform"),
            ("ARR multiple uplift", "3.5× → 5–6×"),
            ("Analytics tier upsell", "+€40–80k/year"),
            ("Customer retention lift", "−25% churn"),
        ],
        "value": "+€400k–€750k",
        "regen": "Analyze Effectime and create a predictive workforce analytics plan. Cover: Visier/PitchBook analytics premium multiple data, materialized views + pg_cron architecture, Recharts dashboards, ARR multiple re-rating valuation impact. Point 1-5 structure.",
    },
    {
        "title": "White-label & Multi-tenant Reseller Architecture",
        "desc": [
            "A white-label multi-tenant layer transforms Effectime from B2B to B2B2B: HR consultancies, payroll bureaus, and IT MSPs resell under their own brand. This is the highest-leverage distribution strategy — resellers do the selling, Effectime collects platform revenue with near-zero incremental CAC.",
            "Rippling Partner Network generated 35% of new ARR in 2024. Gusto Embedded trades at 40% premium to standalone Gusto multiple. In CEE, HR consultancies are the dominant WFM buying influencer — white-label converts them from obstacles into allies.",
            "Requirements: CSS custom properties theme engine, CNAME domain isolation, reseller admin portal for tenant provisioning, Stripe Connect revenue sharing, reseller usage dashboard.",
        ],
        "impl": [
            "DB: create resellers table (slug, theme_config JSONB, custom_domain,",
            "     stripe_connect_account_id, revenue_share_pct)",
            "DB: add reseller_id FK to enterprises table (nullable)",
            "",
            "Create supabase/functions/reseller-admin/index.ts:",
            "  'provision-enterprise', 'get-usage-dashboard'",
            "  'update-theme', 'set-custom-domain'",
            "",
            "Theme middleware: read X-Reseller-Domain header,",
            "  return theme_config, cache 5 minutes",
            "",
            "Create src/pages/ResellerPortal.tsx:",
            "  Client list with MRR/MAU/health score",
            "  Provision new client wizard",
            "  Theme editor with live preview",
            "  Revenue share dashboard",
            "",
            "CSS: inject --brand-primary, --logo-url vars at app init",
        ],
        "metrics": [
            ("TAM expansion", "1× → 10× via reseller network"),
            ("CAC reduction", "−60–70%"),
            ("New ARR potential (5 resellers)", "+€200k–€400k/year"),
            ("Strategic premium", "+50–80% valuation premium"),
        ],
        "value": "+€600k–€1,200k",
        "regen": "Analyze Effectime and design white-label multi-tenant reseller architecture. Cover: Rippling/Gusto Embedded precedents, theme injection + domain isolation + Stripe Connect on Supabase, reseller admin portal frontend, TAM expansion valuation impact. Point 1-5 structure.",
    },
    {
        "title": "Payroll Engine Integration (SAP, Workday, ADP, DATEV)",
        "desc": [
            "Scheduling that doesn't close the loop into payroll is a 'nice-to-have'. Scheduling that automatically calculates approved hours, applies overtime rules, and exports to payroll is mission-critical infrastructure — 3–5× harder to replace and 2–3× higher ARPU.",
            "Integration targets: SME/CEE (DATEV, Számlázz.hu, Billingo, Pohoda), mid-market (Personio — €270M ARR 2025, BambooHR, Sage HR), enterprise (SAP SuccessFactors, Workday HCM, ADP). Features: hours-to-payroll export, absence deduction, shift differential calculation, one-click period lock with audit trail.",
            "First-mover opportunity in DACH SME market — DATEV dominates but has no modern WFM integration partner in the CEE region.",
        ],
        "impl": [
            "DB: payroll_export_configs (provider, field_mappings JSONB)",
            "DB: payroll_periods (start_date, end_date, status: open/locked)",
            "DB: payroll_line_items VIEW joining schedule_events + leave_requests",
            "",
            "Create supabase/functions/payroll-export/index.ts:",
            "  'calculate-period': aggregate hours, apply overtime/differential",
            "  'export-csv': provider-specific format",
            "  'export-api': POST to BambooHR/Personio APIs",
            "  'lock-period': immutable audit record",
            "",
            "Provider adapters: datev.ts, bamboohr.ts, personio.ts, generic.ts",
            "",
            "Create src/pages/Payroll.tsx:",
            "  Period selector, summary table, export button",
            "  Lock Period with irreversible-action warning",
            "  Audit log of all exports",
        ],
        "metrics": [
            ("Product stickiness", "Scheduling → payroll-critical infra"),
            ("ARPU lift (payroll module)", "+€30–60/month per enterprise"),
            ("Churn reduction", "−40–50%"),
            ("New segments opened", "DACH SME, Personio ecosystem"),
        ],
        "value": "+€350k–€700k",
        "regen": "Analyze Effectime and design payroll engine integration. Cover: mission-critical infrastructure positioning, Personio/DATEV/BambooHR market data, multi-provider adapter architecture on Supabase, period lock frontend, ARPU + churn valuation impact. Point 1-5 structure.",
    },
    {
        "title": "SOC 2 Type II + ISO 27001 Certification Program",
        "desc": [
            "Without SOC 2 Type II, Effectime cannot be approved by InfoSec teams of any enterprise with 500+ employees in Western Europe or North America. This single barrier excludes 60–70% of the highest-ARPU customer segment. ISO 27001 is required for all EU public sector contracts.",
            "Technical controls required: audit logging triggers on all privileged actions (immutable audit_log table), GDPR data export/deletion automation, rate limiting via Upstash, input validation through Zod schemas on all edge functions, security headers (HSTS, CSP, X-Frame-Options).",
            "Process: Engage Vanta (~$15k/year) for automated evidence collection from GitHub and Supabase. Timeline: 6 months to Type II audit. Vanta data: 40% faster enterprise sales cycles post-certification.",
        ],
        "impl": [
            "DB: create audit_log table (actor, action, resource, old/new value JSONB,",
            "    ip_address, user_agent, created_at)",
            "DB: create audit_log triggers on: users, enterprises,",
            "    enterprise_members, schedule_events",
            "DB: data_retention_policy table + nightly pg_cron deletion",
            "",
            "Add to all Edge Functions:",
            "  Request logging middleware → audit_log",
            "  Rate limiting: 100 req/min per user (Upstash)",
            "  All inputs validated through Zod schemas",
            "  No stack traces in error responses",
            "",
            "Create supabase/functions/security-admin/index.ts:",
            "  'export-audit-log', 'list-sessions', 'revoke-session'",
            "  'data-export-gdpr', 'data-deletion-gdpr'",
            "",
            "Create src/pages/SecurityCenter.tsx (enterprise admin only)",
        ],
        "metrics": [
            ("Enterprise deal unlock", "+60–70% of Fortune 1000 reachable"),
            ("Sales cycle acceleration", "−40% time-to-close"),
            ("Government sector unlock", "ISO 27001 required for EU public sector"),
            ("Acquirer due-diligence premium", "+15–25% purchase price"),
        ],
        "value": "+€250k–€500k",
        "regen": "Analyze Effectime and design SOC 2 Type II + ISO 27001 compliance implementation. Cover: sales unlock rationale with Vanta/Gartner data, audit log triggers + GDPR endpoints + rate limiting + security headers, Security Center UI, deal conversion and acquirer premium impact. Point 1-5 structure.",
    },
    {
        "title": "Mobile-First Native App with Full Offline Capability",
        "desc": [
            "Effectime has Capacitor scaffolding but is designed for desktop. A truly mobile-first experience with offline capability unlocks frontline worker segments (retail, manufacturing, healthcare) where 70–80% of employees have no desktop access. 2.7 billion deskless workers globally (Emergence Capital 2024).",
            "WFM apps targeting deskless workers (Deputy, When I Work, Homebase) trade at 15–20× ARR vs. 5–8× for desktop-first tools. The offline requirement is non-negotiable: retail associates need schedules in subways (no signal), factory workers need NFC clock-in even when WiFi is rebooting.",
            "Stack: vite-plugin-pwa + Workbox for service worker, IndexedDB sync queue via 'idb' library, Firebase Cloud Messaging for push, Capacitor native plugins (NFC, Biometric, BarCodeScanner), bottom tab navigation for mobile.",
        ],
        "impl": [
            "Add vite-plugin-pwa to vite.config.ts with Workbox:",
            "  CacheFirst: static assets",
            "  NetworkFirst: API calls",
            "  StaleWhileRevalidate: schedule data",
            "  Background sync: queue leave/clock events in IndexedDB",
            "",
            "Create src/lib/offline/syncQueue.ts (idb library):",
            "  Queue: submit-leave, clock-in, clock-out, shift-swap",
            "  On reconnect: process FIFO, toast per synced item",
            "",
            "Create supabase/functions/push-notifications/index.ts:",
            "  Firebase Admin SDK for FCM delivery",
            "  Triggers: leave approval, schedule change, shift swap",
            "",
            "Refactor Navigation.tsx: bottom tabs on mobile, sidebar on desktop",
            "Create src/pages/mobile/MobileSchedule.tsx:",
            "  Horizontal swipe week navigation, large touch targets (44px min)",
            "  Clock-in/out floating action button",
        ],
        "metrics": [
            ("New TAM (deskless workers)", "+2.7B market segment access"),
            ("ARR multiple (mobile-first WFM)", "15–20× vs current 3.5×"),
            ("Target sectors", "Retail, logistics, healthcare, manufacturing"),
        ],
        "value": "+€300k–€600k",
        "regen": "Analyze Effectime and design mobile-first transformation with offline capability. Cover: deskless worker TAM + Deputy/When I Work multiples, PWA Service Worker + Workbox + IndexedDB sync queue + Firebase push + Capacitor NFC/biometric architecture, implementation prompt, ARR multiple re-rating valuation impact. Point 1-5.",
    },
    {
        "title": "Predictive Burnout & Wellbeing Detection Engine",
        "desc": [
            "ESG criteria influence 85% of Fortune 500 procurement decisions (McKinsey 2025). A burnout detection engine using scheduling patterns — overtime frequency, leave depletion rate, weekend work density, consecutive days without breaks — transforms Effectime into a strategic people-investment platform.",
            "This feature competes with Peakon (Workday), Culture Amp, and Leapsome at €8–15/employee/month as standalone products. Effectime bundles this as part of scheduling, undercutting standalone tools with superior data quality. WHO ICD-11 classifies burnout as an occupational phenomenon, driving regulatory attention.",
            "Algorithm: weighted scoring (no ML to avoid bias concerns) → 0–100 Wellbeing Score. Red threshold (<40) triggers manager alert with suggested interventions (force-schedule recovery day, redistribute shifts). Weights configurable per enterprise.",
        ],
        "impl": [
            "DB: wellbeing_scores (employee_id, score, components JSONB, calculated_at)",
            "DB: wellbeing_alerts (employee_id, manager_id, alert_type, resolved_at)",
            "pg_cron: calculate scores weekly (Sunday midnight)",
            "",
            "Scoring algorithm components (enterprise-configurable weights):",
            "  overtime_score: hours_overtime / expected_hours (30%)",
            "  leave_utilization: taken / accrued (20%)",
            "  weekend_density: weekend_days / total_days (25%)",
            "  schedule_stability: 1 - (last_min_changes / total_shifts) (15%)",
            "  recovery_score: avg_days_between_shifts (10%)",
            "",
            "Create src/components/Wellbeing/WellbeingDashboard.tsx:",
            "  Team heatmap with color-coded scores",
            "  12-week sparkline trends per employee",
            "  Alert inbox with suggested actions",
            "",
            "Create WellbeingScoreCard.tsx (employee self-view):",
            "  Personal score with factor explanations",
            "  Leave booking nudge if balance > 15 days unused",
        ],
        "metrics": [
            ("ESG buyer persona", "CHROs, People Ops leaders added"),
            ("CEE market differentiation", "Unique feature in region"),
            ("Upsell potential", "+€15–25/employee/month"),
        ],
        "value": "+€200k–€400k",
        "regen": "Analyze Effectime and design Burnout & Wellbeing Detection. Cover: ESG market drivers + McKinsey/Gallup data, scheduling-data-as-predictor advantage over surveys, weighted algorithm on Supabase pg_cron, team heatmap UI, upsell valuation impact. Point 1-5.",
    },
    {
        "title": "Open API Platform & Developer Ecosystem",
        "desc": [
            "A public REST API with webhooks and a developer portal creates a strategic moat: third-party integrations create switching costs, extend functionality without engineering effort, and generate inbound discovery. Zapier integration (15M+ users) alone opens 6,000+ other apps.",
            "Stripe built 35% of ARR from integrations by 2023 using API-first strategy. Every integration built by third parties is a distribution channel. API usage data is a leading indicator of enterprise engagement — high API usage = low churn.",
            "Stack: API key auth via api_keys table, Upstash rate limiting (1000 req/hour per key), webhook dispatch with HMAC-SHA256 signing, OpenAPI 3.0 spec auto-generated from Zod schemas, sandbox environment with pre-populated demo enterprise.",
        ],
        "impl": [
            "DB: api_keys (enterprise_id, key_hash, scopes[], expires_at)",
            "DB: api_usage_logs (api_key_id, endpoint, status_code, response_ms)",
            "DB: webhook_subscriptions (url, secret, events[])",
            "",
            "Create supabase/functions/public-api/index.ts:",
            "  Auth: Bearer → validate api_keys table",
            "  Rate limit: 1000 req/hour per key (Upstash sliding window)",
            "  GET/POST/PUT/DELETE /v1/schedules, /v1/employees,",
            "    /v1/leave-requests, /v1/teams",
            "  Response: { data, meta: { page, total, request_id } }",
            "",
            "Create supabase/functions/webhook-dispatcher/index.ts:",
            "  pg_notify triggered on key tables",
            "  HMAC-SHA256 payload signing",
            "  Exponential backoff retry 3×",
            "",
            "Create src/pages/DeveloperPortal.tsx:",
            "  API key management, webhook subscriptions, usage graphs",
        ],
        "metrics": [
            ("Distribution (Zapier/Make/n8n)", "+30–50% inbound leads"),
            ("Integration stickiness", "−35% churn for API-connected"),
            ("Platform multiple premium", "+20–30% vs non-platform SaaS"),
        ],
        "value": "+€180k–€350k",
        "regen": "Analyze Effectime and design public REST API platform. Cover: API-first strategy from Stripe/Zapier data, API key auth + rate limiting + HMAC webhooks + OpenAPI spec gen architecture on Supabase, developer portal UI, distribution and churn valuation impact. Point 1-5.",
    },
    {
        "title": "GPS / NFC / QR Biometric Clock-In System",
        "desc": [
            "Physical attendance verification via smartphone replaces €500–€3,000 per time-clock device (Dormakaba, HID Global) in a $4.2B hardware replacement market (MarketsandMarkets 2025). Enterprises save hardware costs while gaining richer data.",
            "EU regulatory driver: ECJ C-55/18 (Deutsche Bank, 2019) and subsequent national implementations require employers to track all working time — making attendance verification a compliance obligation, not just a nice-to-have.",
            "Features: GPS geofence validation (50–200m radius per site), rotating QR codes (60-second rotation, anti-photo-sharing fraud), NFC tag tap via Capacitor, optional face match for high-security environments, real-time Live Attendance Board via Supabase Realtime.",
        ],
        "impl": [
            "DB: clock_events (employee_id, method: gps/nfc/qr/manual,",
            "    coordinates POINT, site_id, verified BOOLEAN)",
            "DB: add geofence_config JSONB to enterprise_sites",
            "DB: qr_sessions (site_id, code, expires_at)",
            "",
            "Create supabase/functions/attendance/index.ts:",
            "  'clock-in': validate method (gps: geofence, qr: code, nfc: tag)",
            "  'clock-out': same validation",
            "  'generate-qr': new 60s-expiry QR session for site (manager only)",
            "  'attendance-report': aggregate, flag anomalies",
            "",
            "Create src/pages/mobile/ClockIn.tsx:",
            "  GPS: map with geofence circle, button enabled when inside",
            "  QR: Capacitor BarCodeScanner",
            "  NFC: Capacitor NFC reader",
            "",
            "Create LiveAttendanceBoard.tsx:",
            "  Supabase Realtime: who is clocked in now",
            "  Late arrivals: amber | Missing: red",
        ],
        "metrics": [
            ("Hardware replacement savings", "€500–€3,000 per site"),
            ("Regulatory compliance driver", "ECJ ruling mandatory in EU"),
            ("ARPU lift (attendance module)", "+€20–40/month per enterprise"),
        ],
        "value": "+€150k–€300k",
        "regen": "Analyze Effectime and design GPS/NFC/QR attendance verification. Cover: hardware market + ECJ C-55/18 compliance mandate, geofence validation + rotating QR + NFC Capacitor + Supabase Realtime board architecture, mobile clock-in UI, ARPU displacement valuation impact. Point 1-5.",
    },
]

HU_RANKS = [
    {
        "title": "AI Ütemező Kopilot (Párbeszédes AI Réteg)",
        "desc": [
            "Az Effectime számára elérhető legnagyobb hatású átalakulás egy párbeszédes AI kopilot közvetlen beágyazása az ütemezési élménybe. A természetes nyelvű utasításokat (pl. 'Ütemezze be a minimális lefedettségű hétvégét jövő hónapra 10 órás túlóra-limittel') fogadó AI autonóm módon hajtja végre a többfeltételű optimalizálásokat.",
            "Az AI-t natívan beágyazó termékek 3–5× magasabb értékelési szorzókat parancsolnak (Gartner WFM Magic Quadrant 2025). A Deputy AI 34%-os upsell konverzió-növekedést jelzett az AI megjelenése után (2025. március). A Rippling $13,5 milliárd értékelést ért el 2025-ben, az AI-t fő stratégiai előnynek tartva.",
            "Technikai megközelítés: Supabase Edge Function az Anthropic claude-sonnet-4-6 modellel és tool_use-szal a meglévő ütemezési akciók meghívásakor. A Supabase Realtime-on keresztüli streaming láthatóvá teszi a kopilot gondolkodását a menedzserek számára.",
        ],
        "impl": [
            "Hozzon létre: supabase/functions/ai-copilot/index.ts",
            "  Fogadja el: { instruction, enterprise_id, week_start }",
            "  JWT hitelesítés, vállalati RLS kényszerítés",
            "  Anthropic claude-sonnet-4-6 tool_use-szal",
            "  Eszközök: check_conflicts, get_team_capacity, list_leave_requests",
            "  Válasz: { plan: ScheduleAction[], explanation, warnings }",
            "  Streaming: Supabase Realtime copilot:{enterprise_id}",
            "",
            "Hozzon létre: src/components/AICopilot/CopilotPanel.tsx",
            "  Lebegő panel (jobb alsó, összecsukható)",
            "  Természetes nyelvű beviteli mező",
            "  Streaming 'gondolkodás' jelző",
            "  'Terv alkalmazása' gomb",
            "",
            "Sebességkorlátozás: max 20 AI kérés/óra vállalatonként",
            "Nincs személyes adat az AI-nak — csak alkalmazott ID-k",
        ],
        "metrics": [
            ("Értékelési szorzó (ARR)", "3,5× → 6–8×"),
            ("Vállalati deal konverzió", "+35–45%"),
            ("Havi lemorzsolódás csökkentése", "−20–30%"),
        ],
        "value": "+€800k–€1,35M",
        "regen": "Elemezze az Effectime Enterprise-t és készítsen AI Ütemező Kopilot megvalósítási tervet. Fedje le: (1) WFM AI piaci indoklás Gartner/Deputy/Rippling adatokkal, (2) Supabase Edge Function Anthropic claude-sonnet-4-6 tool_use architektúrával, (3) TypeScript megvalósítási prompt, (4) ARR szorzó értéknövelési hatás, (5) újragenerálási meta-prompt. 1–5. pont struktúra.",
    },
    {
        "title": "Microsoft 365 / Google Workspace Mély Integráció",
        "desc": [
            "A vállalatok 78%-a a naptárintegráció meglétét go/no-go feltételként kezeli WFM szoftver vásárlásakor (Nucleus Research 2024). Mély M365/Google integráció: kétirányú naptárszinkron, Teams jelenlét-tudatosság, SharePoint beosztás-közzétevés, Teams bot önkiszolgáláshoz.",
            "Ez közvetlenül a Replicon, UKG és Shiftboard ellen irányul, amelyek M365 integrációt kínálnak, de gyenge megbízhatósággal és valós idejű jelenlétszinkron nélkül. A Microsoft Teamsnek 320M MAU-ja van (Microsoft Q2 2026).",
            "Implementáció: OAuth2 PKCE a Microsoft Graph API-val (Calendars.ReadWrite, Presence.Read), Google Calendar API v3 Push Notifications webhookokkal, Azure Bot regisztráció Adaptive Cardsszal a Teamsbe.",
        ],
        "impl": [
            "Hozzon létre: supabase/functions/ms365-sync/index.ts",
            "  OAuth2 PKCE a Microsoft Identity Platformmal",
            "  Hatókörök: Calendars.ReadWrite, User.Read, Presence.Read",
            "  Titkosított refresh tokenek az enterprise_integrations táblában",
            "  pg_cron szinkron 15 percenként",
            "",
            "Hozzon létre: supabase/functions/google-workspace-sync/index.ts",
            "  Google Calendar API v3 kétirányú szinkron",
            "  Google Push Notifications valós idejű frissítésekhez",
            "",
            "Azure Bot parancsokkal:",
            "  /my-schedule, /request-leave, /swap-shift",
            "  Adaptive Cards UI a Teamsben",
            "",
            "IntegrationSettingsPanel.tsx csatlakoztatás/lecsatlakoztatás UI-val",
        ],
        "metrics": [
            ("Vállalati deal konverzió növekedése", "+40–55%"),
            ("Átlagos szerződési érték növekedése", "+25–35%"),
            ("Becsült új ARR elérhetőség", "+€80k–€150k/év"),
        ],
        "value": "+€280k–€570k",
        "regen": "Elemezze az Effectime-ot és tervezzen Microsoft 365 és Google Workspace mély integrációt. Fedje le: (1) Nucleus Research vásárlási kritérium adatok, (2) Graph API + Calendar API v3 kétirányú szinkron architektúra, (3) Teams bot megvalósítás, (4) ARR hatás, (5) újragenerálási prompt. 1–5. pont struktúra.",
    },
    {
        "title": "Valós Idejű Prediktív Elemzési és Vezetői Intelligencia Dashboard",
        "desc": [
            "A vállalati vásárlók 2–3× többet fizetnek a prediktív munkaerő-intelligenciáért, mint az operatív ütemezési láthatóságért. Főbb képességek: munkaerőköltség-előrejelzés (90 napos gördülő bérprognózis), hiányzási minta-felismerés (logisztikus regresszió a szabadság-historikus adatokon), lefedettségi kockázati hőtérkép.",
            "A Visier (munkaerő-elemzés) $1 milliárd dolláros vállalattá nőtt az elemzési rétegen meglévő HRIS adatokon. Az Effectime-nak már megvannak az ütemezési adatai — az elemzési réteg hozzáadása tiszta értéknövelés. HR elemzési szoftverek 5–7× ARR szorzókkal kereskednek vs. ütemező eszközök 3–4×-ával (PitchBook Q4 2025).",
            "Technikai megközelítés: materializált nézetek (mv_labor_cost_monthly, mv_absence_patterns) 4 óránkénti frissítéssel pg_cron-on, elemzési él-függvény 4 fő akcióval, Recharts-alapú AreaChart + hőtérkép naptár.",
        ],
        "impl": [
            "Hozzon létre: supabase/functions/analytics-engine/index.ts",
            "  'labor-cost-forecast': {enterprise_id, months_ahead} → költségbontás",
            "  'absence-risk-score': alkalmazottankénti 0-100 kockázati pontszám",
            "  'coverage-risk-heatmap': napi kockázat csapatonként 90 napra",
            "  'benchmark-kpis': megfelelési%, túlóra%, hiányzási%",
            "",
            "Materializált nézetek (Supabase migráció):",
            "  mv_labor_cost_monthly (frissítés: pg_cron 4h)",
            "  mv_absence_patterns (gördülő 12 hónap alkalmazottanként)",
            "",
            "Hozzon létre: src/pages/Analytics.tsx",
            "  KPI kártyák, munkaerőköltség-előrejelzési diagram (6 hónap)",
            "  Lefedettségi kockázati hőtérkép (zöld/sárga/piros)",
            "  Hiányzási kockázat táblázat sparkline-okkal",
        ],
        "metrics": [
            ("Termékkategória átminősítés", "Ütemező eszköz → WFI Platform"),
            ("ARR szorzó növekedés", "3,5× → 5–6×"),
            ("Elemzési szint upsell", "+€40–80k/év"),
            ("Lemorzsolódás csökkentés", "−25%"),
        ],
        "value": "+€400k–€750k",
        "regen": "Elemezze az Effectime-t és hozzon létre prediktív munkaerő-elemzési tervet. Fedje le: Visier/PitchBook prémium szorzó adatok, materializált nézetek + pg_cron architektúra, Recharts dashboardok, ARR szorzó átminősítési értéknövelési hatás. 1–5. pont struktúra.",
    },
    {
        "title": "White-label és Többbérlős Viszonteladói Architektúra",
        "desc": [
            "A white-label réteg az Effectime-ot B2B-ből B2B2B platformmá alakítja: HR tanácsadók, bérszámfejtési irodák és IT MSP-k saját márkájuk alatt értékesíthetik. A Rippling Partner Networkje az új ARR 35%-át generálta 2024-ben. A Gusto Embedded 40%-os prémiummal kereskedik a standalone szorzóhoz képest.",
            "A KKE piacon a HR tanácsadók a WFM vásárlások domináns befolyásolói — a white-label akadályból szövetségessé teszi őket. Alacsony CAC, exponenciális TAM bővítés.",
            "Követelmények: CSS custom properties témamotor (kódmódosítás nélkül), CNAME domain elkülönítés, viszonteladói admin portál bérlő-kiépítéshez, Stripe Connect bevételmegosztás, viszonteladói használati dashboard.",
        ],
        "impl": [
            "Adatbázis: resellers tábla (slug, theme_config JSONB,",
            "  custom_domain, stripe_connect_account_id, revenue_share_pct)",
            "Adatbázis: reseller_id FK az enterprises táblához (nullable)",
            "",
            "Hozzon létre: supabase/functions/reseller-admin/index.ts",
            "  'provision-enterprise', 'get-usage-dashboard'",
            "  'update-theme', 'set-custom-domain'",
            "",
            "Téma middleware: X-Reseller-Domain fejléc olvasása,",
            "  theme_config visszaadása, 5 perces gyorsítótár",
            "",
            "Hozzon létre: src/pages/ResellerPortal.tsx",
            "  Ügyfél lista MRR/MAU/egészségi pontszámmal",
            "  Új ügyfél beállítás varázsló",
            "  Témaszerkesztő élő előnézettel",
            "",
            "CSS: --brand-primary, --logo-url injektálás alkalmazás inicializáláskor",
        ],
        "metrics": [
            ("TAM bővítés", "1× → 10× (viszonteladói hálózati hatás)"),
            ("CAC csökkentés", "−60–70%"),
            ("Új ARR potenciál (5 viszonteladó)", "+€200k–€400k/év"),
            ("Stratégiai prémium", "+50–80% értékelési prémium"),
        ],
        "value": "+€600k–€1,2M",
        "regen": "Elemezze az Effectime-t és tervezzen white-label többbérlős viszonteladói architektúrát. Fedje le: Rippling/Gusto Embedded precedensek, témainjektálás + domain elkülönítés + Stripe Connect Supabase-en, viszonteladói portál frontend, TAM bővítési értéknövelési hatás. 1–5. pont struktúra.",
    },
    {
        "title": "Bérszámfejtési Motor Integráció (SAP, Workday, ADP, DATEV)",
        "desc": [
            "Az a munkaerő-ütemezés, amely nem zárul le a bérszámfejtésbe, 'hasznos, de nem kritikus'. Az, amely automatikusan kiszámítja a jóváhagyott órákat és exportál a bérszámfejtésbe, üzleti szempontból kritikus infrastruktúra — 3–5× nehezebb cserélni, 2–3× magasabb ARPU.",
            "Integrációs célok: KKV/KKE (DATEV, Számlázz.hu, Billingo, Pohoda), közép-piac (Personio — €270M ARR 2025, BambooHR, Sage HR), vállalat (SAP SuccessFactors, Workday HCM, ADP). Első-mozgó lehetőség a DACH KKV piacon.",
            "Funkciók: óra-bérszámfejtés export előre alkalmazott túlóra-számításokkal, hiányzási levonás automatizálás, műszakdifferenciál számítás (hétvégi/éjszakai/ünnepi prémiumok), egy kattintásos időszak zárolás audit naplóval.",
        ],
        "impl": [
            "Adatbázis: payroll_export_configs (provider, field_mappings JSONB)",
            "Adatbázis: payroll_periods (start_date, end_date, status: open/locked)",
            "Adatbázis: payroll_line_items NÉZET",
            "",
            "Hozzon létre: supabase/functions/payroll-export/index.ts",
            "  'calculate-period': összesíti az órákat, alkalmaz túlóra/differenciál szabályokat",
            "  'export-csv': szolgáltatóspecifikus formátum",
            "  'export-api': POST BambooHR/Personio API-ra",
            "  'lock-period': megváltoztathatatlan audit rekord",
            "",
            "Szolgáltató adapterek: datev.ts, bamboohr.ts, personio.ts, generic.ts",
            "",
            "Hozzon létre: src/pages/Payroll.tsx",
            "  Időszak-választó, összefoglaló táblázat",
            "  Export gomb szolgáltató-választóval",
            "  'Időszak zárolása' visszavonhatatlan-figyelmeztetéssel",
        ],
        "metrics": [
            ("Termék ragadóssága", "Ütemező → bérszámfejtés-kritikus infrastruktúra"),
            ("ARPU növekedés (bérszámfejtési modul)", "+€30–60/hó vállalatonként"),
            ("Lemorzsolódás csökkentése", "−40–50%"),
            ("Új szegmensek", "DACH KKV, Personio ökoszisztéma"),
        ],
        "value": "+€350k–€700k",
        "regen": "Elemezze az Effectime-t és tervezzen bérszámfejtési motor integrációt. Fedje le: kritikus infrastruktúra pozicionálás, Personio/DATEV/BambooHR piaci adatok, többszolgáltatós adapter architektúra Supabase-en, időszak-zárolás frontend, ARPU + lemorzsolódás értéknövelési hatás. 1–5. pont struktúra.",
    },
    {
        "title": "SOC 2 Type II + ISO 27001 Tanúsítási Program",
        "desc": [
            "SOC 2 Type II nélkül az Effectime nem hagyható jóvá 500+ alkalmazottat foglalkoztató vállalat InfoSec csapata által sem Nyugat-Európában vagy Észak-Amerikában. Ez a barrier kizárja a legmagasabb ARPU-val rendelkező szegmens 60–70%-át. Az ISO 27001 kötelező az összes EU közszektori szerződéshez.",
            "Szükséges technikai ellenőrzések: audit naplózási triggerek minden privilegizált akcióra (megváltoztathatatlan audit_log tábla), GDPR adatexport/törlés automatizálás, Upstash sebességkorlátozás, Zod séma validáció minden él-függvényen.",
            "Folyamat: Vanta (~$15k/év) az automatikus evidencia-összegyűjtéshez. Idővonal: 6 hónap a Type II audithoz. A Vanta adatai 40%-kal gyorsabb vállalati értékesítési ciklusokat mutatnak a tanúsítás után.",
        ],
        "impl": [
            "Adatbázis: audit_log tábla (actor, action, resource, old/new value JSONB,",
            "  ip_address, user_agent, created_at)",
            "Adatbázis: audit_log triggerek: users, enterprises,",
            "  enterprise_members, schedule_events táblákon",
            "Adatbázis: data_retention_policy + éjszakai pg_cron törlés",
            "",
            "Minden Edge Functionhöz hozzáadandó:",
            "  Kérésnaplózó middleware → audit_log",
            "  Sebességkorlátozás: 100 kérés/perc (Upstash)",
            "  Minden input Zod sémákon keresztül validálva",
            "  Nincs stacktrace a hibás válaszokban",
            "",
            "Hozzon létre: supabase/functions/security-admin/index.ts",
            "  'export-audit-log', 'list-sessions', 'revoke-session'",
            "  'data-export-gdpr', 'data-deletion-gdpr'",
            "",
            "Hozzon létre: src/pages/SecurityCenter.tsx (vállalati admin)",
        ],
        "metrics": [
            ("Vállalati deal feloldás", "+60–70% Fortune 1000 szegmens elérhetővé"),
            ("Értékesítési ciklus gyorsulása", "−40% a bezárásig"),
            ("Kormányzati szektori feloldás", "ISO 27001 kötelező EU közszektorban"),
            ("Felvásárlói due-diligence prémium", "+15–25%"),
        ],
        "value": "+€250k–€500k",
        "regen": "Elemezze az Effectime-t és tervezzen SOC 2 Type II + ISO 27001 megfelelőségi megvalósítást. Fedje le: értékesítési engedő indoklás Vanta/Gartner adatokkal, audit log triggerek + GDPR végpontok + sebességkorlátozás, Biztonsági Központ UI, deal konverzió és felvásárlói prémium hatás. 1–5. pont struktúra.",
    },
    {
        "title": "Mobilcentrikus Natív Alkalmazás Teljes Offline Képességgel",
        "desc": [
            "Az Effectime-nak van Capacitor scaffoldingja, de asztali böngészőre tervezett. A valódi mobilcentrikus, offline képességű élmény megnyitja a frontvonalbeli munkavállalói szegmenseket (kiskereskedelem, gyártás, egészségügy), ahol a munkavállalók 70–80%-ának nincs asztali hozzáférése. 2,7 milliárd deskless munkavállaló globálisan (Emergence Capital 2024).",
            "A deskless munkavállalókat célzó WFM alkalmazások 15–20× ARR-rel kereskednek vs. asztali eszközök 5–8×-ával. Az offline követelmény nem tárgyalható: kiskereskedelmi munkavállalók metróban (nincs jel) nézik a beosztásuk, gyári munkások NFC érintéssel jelentkeznek be WiFi-újraindítás közben is.",
            "Stack: vite-plugin-pwa + Workbox service workerhez, IndexedDB szinkron sor 'idb' könyvtárral, Firebase Cloud Messaging push értesítésekhez, Capacitor natív pluginok (NFC, Biometrikus, QR beolvasó), alsó tab navigáció mobilon.",
        ],
        "impl": [
            "Adjon hozzá vite-plugin-pwa-t a vite.config.ts-hez Workbox-szal:",
            "  CacheFirst: statikus eszközök",
            "  NetworkFirst: API hívások",
            "  Háttérszinkron: szabadság/bejelentkezés IndexedDB-ben sorba állítva",
            "",
            "Hozzon létre: src/lib/offline/syncQueue.ts (idb könyvtár)",
            "  Sor: submit-leave, clock-in, clock-out, shift-swap",
            "  Újracsatlakozáskor: FIFO feldolgozás, toast szinkronizált elemenként",
            "",
            "Hozzon létre: supabase/functions/push-notifications/index.ts",
            "  Firebase Admin SDK az FCM kézbesítéshez",
            "  Triggerek: szabadság-jóváhagyás, beosztásváltás, műszakcsere",
            "",
            "Navigation.tsx átalakítás: alsó tabsáv mobilon, oldalsáv asztalon",
            "Hozzon létre: src/pages/mobile/MobileSchedule.tsx",
            "  Vízszintes swipe hetes navigáció, nagy érintési célpontok (44px)",
            "  Bejelentkezés/kijelentkezés lebegő akciógomb",
        ],
        "metrics": [
            ("Új TAM (deskless munkavállalók)", "+2,7 milliárd piaci szegmens"),
            ("ARR szorzó (mobilcentrikus WFM)", "15–20× vs jelenlegi 3,5×"),
            ("Célszektorok", "Kiskereskedelem, logisztika, egészségügy"),
        ],
        "value": "+€300k–€600k",
        "regen": "Elemezze az Effectime-t és tervezzen mobilcentrikus átalakulást offline képességgel. Fedje le: deskless munkaerő TAM + Deputy/When I Work szorzók, PWA Service Worker + Workbox + IndexedDB szinkron sor + Firebase push + Capacitor NFC/biometrikus architektúra, megvalósítási prompt, ARR szorzó átminősítési értéknövelési hatás. 1–5. pont struktúra.",
    },
    {
        "title": "Prediktív Kiégés és Jóllét Felismerő Motor",
        "desc": [
            "Az ESG kritériumok a Fortune 500 vállalatainak 85%-ának vásárlási döntéseit befolyásolják (McKinsey 2025). Egy kiégés-felismerési motor ütemezési mintázatokból (túlóra-frekvencia, szabadságegyenleg kimerülési aránya, hétvégi munkasűrűség, egymást követő munkaszünetnélküli napok) 0–100-as Jóllét-pontszámot számít.",
            "Ez a funkció a Peakon (Workday), Culture Amp és Leapsome ellen versenyez €8–15/alkalmazott/hó áron önálló termékként. Az Effectime az ütemezési platform részeként nyújtja, az ütemezési adatok magasabb prediktív értékével. Az WHO ICD-11 munkahelyi jelenségként sorolja be a kiégést.",
            "Algoritmus: súlyozott pontozás (nem ML, az elfogultsági aggályok elkerülése érdekében) → Piros küszöb (<40) menedzseri riasztást vált ki javasolt beavatkozásokkal (helyreállítási nap kötelező ütemezése, műszakok újraelosztása).",
        ],
        "impl": [
            "Adatbázis: wellbeing_scores (employee_id, score, components JSONB)",
            "Adatbázis: wellbeing_alerts (employee_id, manager_id, alert_type)",
            "pg_cron: heti pontszám-számítás (vasárnap éjfél)",
            "",
            "Pontozási algoritmus komponensek:",
            "  overtime_score: hours_overtime / expected_hours (30%)",
            "  leave_utilization: taken / accrued (20%)",
            "  weekend_density: weekend_days / total_days (25%)",
            "  schedule_stability: 1 - (last_min_changes / total) (15%)",
            "  recovery_score: avg_days_between_shifts (10%)",
            "",
            "Hozzon létre: src/components/Wellbeing/WellbeingDashboard.tsx",
            "  Csapat hőtérkép színkódolt pontszámokkal",
            "  12 hetes sparkline trendek alkalmazottanként",
            "  Riasztási beérkező menedzsereknek",
            "",
            "Hozzon létre: WellbeingScoreCard.tsx (alkalmazott saját nézete)",
            "  Személyes pontszám tényező-magyarázatokkal",
        ],
        "metrics": [
            ("ESG vevő persona hozzáadása", "CHROk, People Ops vezetők"),
            ("KKE piaci differenciálás", "Egyedülálló funkció a régióban"),
            ("Upsell potenciál", "+€15–25/alkalmazott/hó"),
        ],
        "value": "+€200k–€400k",
        "regen": "Elemezze az Effectime-t és tervezzen Kiégés és Jóllét Felismerési funkciót. Fedje le: ESG piaci hajtóerők + McKinsey/Gallup adatok, ütemezési adatok mint prediktív előny a kérdőívek felett, súlyozott algoritmus Supabase pg_cron-on, csapat hőtérkép UI, upsell értéknövelési hatás. 1–5. pont struktúra.",
    },
    {
        "title": "Nyílt API Platform és Fejlesztői Ökoszisztéma",
        "desc": [
            "Egy nyilvános REST API webhookokkal és fejlesztői portállal stratégiai moatot hoz létre: a harmadik fél integrációk váltási költségeket hoznak létre, kiegészítik a funkcionalitást mérnöki erőfeszítés nélkül, és bejövő felfedezést generálnak. A Zapier integráció (15M+ felhasználó) egyedül 6000+ más alkalmazást nyit meg.",
            "A Stripe az API-first stratégiájával az ARR 35%-át generálta integrációkból 2023-ra. Az API-használati adatok a vállalati elköteleződés vezető mutatói — magas API-használat = alacsony lemorzsolódás.",
            "Stack: API kulcs hitelesítés az api_keys táblán, Upstash sebességkorlátozás (1000 kérés/óra kulcsonként), HMAC-SHA256 aláírású webhook diszpécser, OpenAPI 3.0 spec automatikusan generálva Zod sémákból.",
        ],
        "impl": [
            "Adatbázis: api_keys (enterprise_id, key_hash, scopes[], expires_at)",
            "Adatbázis: api_usage_logs (api_key_id, endpoint, status_code)",
            "Adatbázis: webhook_subscriptions (url, secret, events[])",
            "",
            "Hozzon létre: supabase/functions/public-api/index.ts",
            "  Hitelesítés: Bearer → api_keys tábla érvényesítés",
            "  Sebességkorlátozás: 1000 kérés/óra (Upstash csúszó ablak)",
            "  GET/POST/PUT/DELETE /v1/schedules, /v1/employees,",
            "    /v1/leave-requests, /v1/teams",
            "  Válasz: { data, meta: { page, total, request_id } }",
            "",
            "Hozzon létre: supabase/functions/webhook-dispatcher/index.ts",
            "  pg_notify-vel triggerelve kulcs táblákon",
            "  HMAC-SHA256 hasznos teher aláírás",
            "  Exponenciális visszalépés újrapróbálkozás 3×",
            "",
            "Hozzon létre: src/pages/DeveloperPortal.tsx",
            "  API kulcskezelés, webhook előfizetések, használati diagramok",
        ],
        "metrics": [
            ("Terjesztés (Zapier/Make/n8n)", "+30–50% bejövő leadek"),
            ("Integráció ragadóssága", "−35% lemorzsolódás API-csatlakoztatottaknál"),
            ("Platform szorzó prémium", "+20–30% nem-platform SaaS-hoz képest"),
        ],
        "value": "+€180k–€350k",
        "regen": "Elemezze az Effectime-t és tervezzen nyilvános REST API platformot. Fedje le: API-first stratégia a Stripe/Zapier adatokkal, API kulcs hitelesítés + sebességkorlátozás + HMAC webhookok + OpenAPI spec generálás architektúrája Supabase-en, fejlesztői portál UI, terjesztés és lemorzsolódás értéknövelési hatás. 1–5. pont struktúra.",
    },
    {
        "title": "GPS / NFC / QR Biometrikus Bejelentkezési Rendszer",
        "desc": [
            "A fizikai jelenlét igazolás okostelefonon keresztül €500–€3000/időnyilvántartó eszköz megtakarítást jelent (Dormakaba, HID Global) egy $4,2 milliárd hardvercserélési piacon (MarketsandMarkets 2025).",
            "EU szabályozási hajtóerő: EUB C-55/18 (Deutsche Bank, 2019) és az azt követő nemzeti megvalósítások az összes munkaidő nyilvántartását kötelezik meg a munkáltatóknak. Ez megfelelőségi kötelezettség, nem kényelmi funkció.",
            "Funkciók: GPS geofence validáció (50–200m sugár helyszínenként), forgó QR kódok (60 másodperces rotáció, fényképmegosztási csalás ellen), NFC tag érintés Capacitor pluginon, valós idejű Élő Jelenléti Tábla Supabase Realtime-on.",
        ],
        "impl": [
            "Adatbázis: clock_events (employee_id, method: gps/nfc/qr/manual,",
            "  coordinates POINT, site_id, verified BOOLEAN)",
            "Adatbázis: geofence_config JSONB hozzáadása enterprise_sites-hoz",
            "Adatbázis: qr_sessions (site_id, code, expires_at)",
            "",
            "Hozzon létre: supabase/functions/attendance/index.ts",
            "  'clock-in': módszer validáció (gps: geofence, qr: kód, nfc: tag)",
            "  'clock-out': ugyanolyan validáció",
            "  'generate-qr': új 60mp-es lejáratú QR munkamenet (csak menedzser)",
            "  'attendance-report': összesítés, anomáliák megjelölése",
            "",
            "Hozzon létre: src/pages/mobile/ClockIn.tsx",
            "  GPS: térkép geofence körrel, gomb engedélyezve belülről",
            "  QR: Capacitor BarCodeScanner",
            "  NFC: Capacitor NFC olvasó",
            "",
            "Hozzon létre: LiveAttendanceBoard.tsx",
            "  Supabase Realtime: ki van éppen bejelentkezve",
            "  Késői érkezés: narancssárga | Hiányzó: piros",
        ],
        "metrics": [
            ("Hardvercserélési megtakarítás", "€500–€3 000 helyszínenként"),
            ("Szabályozási megfelelőségi hajtóerő", "EUB ítélet kötelező az EU-ban"),
            ("ARPU növekedés (jelenléti modul)", "+€20–40/hó vállalatonként"),
        ],
        "value": "+€150k–€300k",
        "regen": "Elemezze az Effectime-t és tervezzen GPS/NFC/QR bejelentkezési jelenlétigazolási rendszert. Fedje le: hardverpiac + EUB C-55/18 kötelezettség, geofence validáció + forgó QR + NFC Capacitor + Supabase Realtime tábla architektúrája, mobil bejelentkezési UI, ARPU kiszorítási értéknövelési hatás. 1–5. pont struktúra.",
    },
]


def build_report(filename, lang="en"):
    ranks_data = EN_RANKS if lang == "en" else HU_RANKS
    title_str = "Effectime Growth Strategy — Top 20 Value Initiatives" if lang == "en" \
        else "Effectime Növekedési Stratégia — Top 20 Értéknövelő Kezdeményezés"

    tmpl = PageTemplate(title_str, lang=lang)
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=16*mm, bottomMargin=14*mm,
        title=title_str,
        author="Effectime Enterprise Strategic Intelligence",
    )

    styles = make_styles()
    story = []

    build_cover(story, styles, lang)
    build_toc(story, styles, lang)

    for i, rank in enumerate(ranks_data):
        add_rank(
            story, styles, i + 1, lang,
            rank["title"],
            rank["desc"],
            rank["impl"],
            rank["metrics"],
            rank["value"],
            rank["regen"],
        )

    build_summary(story, styles, lang)

    doc.build(story,
              onFirstPage=tmpl.on_page,
              onLaterPages=tmpl.on_page)
    print(f"✓  Written: {filename}")


if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))
    build_report(os.path.join(base, "growth-strategy-en.pdf"), lang="en")
    build_report(os.path.join(base, "growth-strategy-hu.pdf"), lang="hu")
    print("\nAll growth strategy reports generated successfully.")
