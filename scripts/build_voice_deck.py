#!/usr/bin/env python
"""Build the voice-agent client deck (FR/EN) from the Gate 0 docs.

Run:  dekenv/Scripts/python.exe scripts/build_voice_deck.py
Out:  docs/voice/client/VOICE-AGENT-DECK.pptx
"""
from __future__ import annotations

import pathlib

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Inches, Pt

# ── Palette ────────────────────────────────────────────────────────────────
INK = RGBColor(0x0E, 0x14, 0x1F)      # near-black, main text
SLATE = RGBColor(0x53, 0x5E, 0x6E)     # secondary text
LINE = RGBColor(0xD9, 0xDF, 0xE7)      # hairlines
BG = RGBColor(0xFF, 0xFF, 0xFF)       # slide
WASH = RGBColor(0xF5, 0xF7, 0xFA)     # panel fill
ACCENT = RGBColor(0x1B, 0x5C, 0xFF)   # blue
GOOD = RGBColor(0x0B, 0x7A, 0x53)     # green
WARN = RGBColor(0xB4, 0x5A, 0x09)     # amber
STOP = RGBColor(0xB4, 0x26, 0x26)     # red
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

W, H = Inches(13.333), Inches(7.5)
M = Inches(0.85)                        # side margin
BODY_TOP = Inches(1.72)                 # first content baseline


def deck() -> Presentation:
    p = Presentation()
    p.slide_width, p.slide_height = W, H
    return p


def blank(prs: Presentation):
    return prs.slides.add_slide(prs.slide_layouts[6])


def rect(slide, x, y, w, h, fill=None, line=None, lw=Pt(1)):
    from pptx.enum.shapes import MSO_SHAPE
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = lw
    s.shadow.inherit = False
    return s


def text(slide, x, y, w, h, runs, size=18, color=INK, bold=False,
         align=PP_ALIGN.LEFT, space=1.0, anchor=MSO_ANCHOR.TOP):
    """runs: str, or list of paragraphs; a paragraph is str or list of (txt, kw)."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    paras = [runs] if isinstance(runs, str) else runs
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = space
        chunks = [(para, {})] if isinstance(para, str) else para
        for txt, kw in chunks:
            r = p.add_run()
            r.text = txt
            f = r.font
            f.size = Pt(kw.get("size", size))
            f.bold = kw.get("bold", bold)
            f.color.rgb = kw.get("color", color)
            f.name = kw.get("font", "Segoe UI")
    return tb


def slide_frame(slide, kicker, title, sub=None, n=None, total=None):
    """Kicker + rule + title, then an optional deck line under the title."""
    rect(slide, Emu(0), Emu(0), W, Inches(0.14), fill=ACCENT)
    text(slide, M, Inches(0.52), W - 2 * M, Inches(0.26), kicker.upper(),
         size=11.5, color=ACCENT, bold=True)
    text(slide, M, Inches(0.86), W - 2 * M, Inches(0.6), title,
         size=30, color=INK, bold=True)
    rect(slide, M, Inches(1.52), Inches(0.62), Pt(2.4), fill=ACCENT)
    if sub:
        text(slide, M, Inches(1.66), W - 2 * M, Inches(0.4), sub,
             size=14.5, color=SLATE, space=1.18)
    if n is not None:
        text(slide, W - M - Inches(1.2), H - Inches(0.52), Inches(1.2), Inches(0.3),
             f"{n} / {total}", size=10, color=SLATE, align=PP_ALIGN.RIGHT)


def table(slide, x, y, w, cols, rows, col_w, head_fill=INK, size=12.5,
          head_size=11.5, row_h=Inches(0.42), head_h=Inches(0.4)):
    """rows: list of list of str OR (str, color) tuples for the first cell."""
    n = len(cols)
    widths = [Emu(int(w * c)) for c in col_w]
    rect(slide, x, y, w, head_h, fill=head_fill)
    cx = x
    for i, c in enumerate(cols):
        text(slide, cx + Inches(0.12), y + Inches(0.09), widths[i] - Inches(0.2),
             head_h, c.upper(), size=head_size, color=WHITE, bold=True)
        cx += widths[i]
    ry = y + head_h
    for ri, row in enumerate(rows):
        if ri % 2 == 1:
            rect(slide, x, ry, w, row_h, fill=WASH)
        cx = x
        for ci, cell in enumerate(row):
            if isinstance(cell, tuple):
                val, col, *rest = cell
                bold = rest[0] if rest else (ci == 0)
            else:
                val, col, bold = cell, INK, ci == 0
            text(slide, cx + Inches(0.12), ry + Inches(0.1), widths[ci] - Inches(0.2),
                 row_h, str(val), size=size, color=col, bold=bold)
            cx += widths[ci]
        rect(slide, x, ry + row_h, w, Pt(0.75), fill=LINE)
        ry += row_h
    return ry


def bullets(slide, x, y, w, items, size=15, gap=Inches(0.46), dot=ACCENT,
            dot_size=Pt(6.5)):
    cy = y
    for it in items:
        if isinstance(it, tuple):
            head, tail = it
        else:
            head, tail = None, it
        rect(slide, x, cy + Inches(0.115), dot_size, dot_size, fill=dot)
        chunks = [("▪  ", {"color": dot, "bold": True})]
        if head:
            chunks.append((head, {"bold": True, "color": INK}))
            chunks.append(("  ", {}))
        chunks.append((tail, {"color": SLATE}))
        text(slide, x + Inches(0.3), cy - Inches(0.03), w - Inches(0.3),
             Inches(0.4), [chunks], size=size, space=1.1)
        cy += gap
    return cy


def card(slide, x, y, w, h, title, body, accent=ACCENT, tsize=15, bsize=12.5):
    rect(slide, x, y, w, h, fill=BG, line=LINE)
    rect(slide, x, y, w, Pt(3), fill=accent)
    text(slide, x + Inches(0.24), y + Inches(0.26), w - Inches(0.48),
         Inches(0.34), title, size=tsize, color=INK, bold=True)
    text(slide, x + Inches(0.24), y + Inches(0.68), w - Inches(0.48),
         h - Inches(0.9), body, size=bsize, color=SLATE, space=1.24)


def stat(slide, x, y, w, value, label, color=ACCENT, vsize=34, lsize=11.5):
    text(slide, x, y, w, Inches(0.6), value, size=vsize, color=color, bold=True)
    text(slide, x, y + Inches(0.62), w, Inches(0.5), label, size=lsize,
         color=SLATE, space=1.15)


# ── Deck ────────────────────────────────────────────────────────────────────
prs = deck()
T = 14


def s_title():
    s = blank(prs)
    rect(s, Emu(0), Emu(0), W, H, fill=INK)
    rect(s, M, Inches(2.32), Inches(0.9), Pt(3.5), fill=ACCENT)
    text(s, M, Inches(1.72), W - 2 * M, Inches(0.3),
         "SMEMASTER · PROPOSITION COMMERCIALE", size=12, color=RGBColor(0x8F, 0xB4, 0xFF),
         bold=True)
    text(s, M, Inches(2.7), W - 2 * M, Inches(1.9),
         [[("Un assistant téléphonique", {"color": WHITE})],
          [("qui ne dort jamais", {"color": WHITE})]],
         size=42, bold=True, space=1.06)
    text(s, M, Inches(4.62), Inches(8.4), Inches(1.0),
         "WhatsApp et appels entrants · Français et Anglais · pour votre entreprise",
         size=17, color=RGBColor(0xB9, 0xC4, 0xD4), space=1.24)
    rect(s, M, Inches(5.9), Inches(11.6), Pt(0.75), fill=RGBColor(0x2C, 0x36, 0x48))
    text(s, M, Inches(6.1), Inches(11.6), Inches(0.4),
         "Document de cadrage · 28 septembre 2026 · aucune prestation n'est engagée à ce stade",
         size=11.5, color=RGBColor(0x76, 0x84, 0x96))


def s_problem():
    s = blank(prs)
    slide_frame(s, "Le constat", "Ce que vous perdez aujourd'hui",
                "Trois pertes silencieuses, que l'on ne voit pas dans les chiffres.",
                2, T)
    cy = BODY_TOP + Inches(0.24)
    card(s, M, cy, Inches(3.72), Inches(2.28), "Les appels manqués",
         "Un client appelle, vous êtes occupé, il raccroche.\n\nIl ne rappelle pas : il prend le concurrent "
         "qui, lui, a répondu.", WARN)
    card(s, M + Inches(3.98), cy, Inches(3.72), Inches(2.28), "Les questions répétitives",
         "Vos horaires, vos tarifs, la disponibilité : les mêmes questions, "
         "à chaque appel.\n\nElles ne nécessitent aucun jugement humain.", WARN)
    card(s, M + Inches(7.96), cy, Inches(3.66), Inches(2.28), "Le temps après-vente",
         "Le temps du quadrillage, du transfert, de la prise de message : "
         "ce n'est pas du chiffre d'affaires.\n\nC'est le coût invisible.", WARN)

    y2 = cy + Inches(2.72)
    rect(s, M, y2, W - 2 * M, Inches(1.14), fill=WASH)
    rect(s, M, y2, Pt(3.5), Inches(1.14), fill=ACCENT)
    text(s, M + Inches(0.34), y2 + Inches(0.22), W - 2 * M - Inches(0.7), Inches(0.8),
         [[("Le point commun : ", {"bold": True, "color": INK}),
           ("aucun de ces appels ne demande un humain. Ils demandent une réponse. "
            "C'est exactement ce qu'un assistant traite mieux et moins cher qu'une personne.", {"color": SLATE})]],
         size=14.5, space=1.26)


def s_solution():
    s = blank(prs)
    slide_frame(s, "La solution", "Ce que nous construisons",
                "Deux canaux, un seul agent. L'agent répond, il ne remplace personne.",
                3, T)
    cy = BODY_TOP + Inches(0.2)
    card(s, M, cy, Inches(5.68), Inches(2.5), "Canal 1 — WhatsApp (écrit)",
         "Le client écrit. L'agent répond dans la seconde.\n\n"
         "Coût Meta : 0 € pour une conversation initiée par le client.",
         GOOD, tsize=16, bsize=13.5)
    card(s, M + Inches(5.94), cy, Inches(5.68), Inches(2.5),
         "Canal 2 — Ligne dédiée (vocal)",
         "Le client appelle votre numéro. L'agent décroche et converse.\n\n"
         "En français, en anglais, et il bascule si vous changez de langue.",
         GOOD, tsize=16, bsize=13.5)

    y2 = cy + Inches(2.94)
    text(s, M, y2, W - 2 * M, Inches(0.3), "CE QUE L'AGENT FAIT — ET NE FAIT PAS",
         size=11.5, color=SLATE, bold=True)
    table(s, M, y2 + Inches(0.36), W - 2 * M,
          ["Il fait", "Il ne fait pas"],
          [[("Répond, qualifie, informe", GOOD),
            "Écrit dans votre CRM ou votre agenda (v1)"],
           [("Transfère à un humain, à la demande", GOOD),
            "Remplace un humain sur une urgence médicale"],
           [("Prend un message après heures", GOOD),
            "Rappelle tout seul, à froid (v1)"],
           [("Détecte un message vocal et vous le résume", GOOD),
            "Enregistre l'audio des appels (v1)"]],
          [0.5, 0.5], size=13)


def s_constraint():
    s = blank(prs)
    slide_frame(s, "À lire avant tout", "Une limite de la plateforme, pas de notre technologie",
                "Nous préférons vous le dire maintenant plutôt qu'en cours de projet.",
                4, T)
    y = BODY_TOP + Inches(0.3)
    rect(s, M, y, W - 2 * M, Inches(1.5), fill=RGBColor(0xFD, 0xF1, 0xF1))
    rect(s, M, y, Pt(3.5), Inches(1.5), fill=STOP)
    text(s, M + Inches(0.34), y + Inches(0.26), W - 2 * M - Inches(0.7), Inches(0.4),
         "WhatsApp ne permet pas à un logiciel de passer ou de recevoir des appels vocaux.",
         size=17, color=STOP, bold=True)
    text(s, M + Inches(0.34), y + Inches(0.78), W - 2 * M - Inches(0.7), Inches(0.6),
         "Aucune API, ni officielle ni non officielle, ne le permet. C'est une contrainte de WhatsApp.",
         size=13.5, color=SLATE, space=1.2)

    y2 = y + Inches(1.92)
    table(s, M, y2, W - 2 * M,
          ["", "WhatsApp", "Ligne dédiée"],
          [[("L'agent répond", INK, True), ("Oui, par messages", GOOD), ("Oui, en direct", GOOD)],
           [("Appels vocaux via WhatsApp", INK, True), ("Non", STOP), ("Sans objet", SLATE)],
           [("Ce qu'il vous faut", INK, True), ("Votre numéro WhatsApp", INK), ("Un numéro dédié", INK)]],
          [0.34, 0.33, 0.33], size=13.5, row_h=Inches(0.48))

    y3 = y2 + Inches(1.94)
    rect(s, M, y3, W - 2 * M, Inches(0.94), fill=WASH)
    text(s, M + Inches(0.34), y3 + Inches(0.2), W - 2 * M - Inches(0.7), Inches(0.6),
         [[("À valider : ", {"bold": True, "color": INK}),
           ("« L'agent répond sur WhatsApp (par messages) et sur une ligne dédiée "
            "(appels vocaux). »", {"color": SLATE, "italic": True})]],
         size=14, space=1.22)


def s_how():
    s = blank(prs)
    slide_frame(s, "Le fonctionnement", "Ce qui se passe quand le téléphone sonne",
                "De la sonnerie au transfert : les étapes que l'agent parcourt.",
                5, T)
    steps = [
        ("1", "L'appel arrive", "L'agent décroche en moins de 2 secondes."),
        ("2", "Il se présente", "« Cet appel est pris en charge par un assistant IA. »"),
        ("3", "Il écoute", "Il détecte la langue et la fige pour la durée de l'appel."),
        ("4", "Il répond", "Environ 1 seconde entre votre fin de parole et sa réponse."),
        ("5", "Il vous passe l'humain", "Sur demande, en disant simplement « agent »."),
    ]
    y = BODY_TOP + Inches(0.28)
    bw, gap = Inches(2.14), Inches(0.28)
    for i, (num, ttl, body) in enumerate(steps):
        x = M + i * (bw + gap)
        rect(s, x, y, bw, Inches(2.0), fill=BG, line=LINE)
        rect(s, x, y, bw, Pt(3), fill=ACCENT)
        rect(s, x + Inches(0.24), y + Inches(0.3), Inches(0.34), Inches(0.34), fill=ACCENT)
        text(s, x + Inches(0.24), y + Inches(0.35), Inches(0.34), Inches(0.3), num,
             size=13, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
        text(s, x + Inches(0.24), y + Inches(0.8), bw - Inches(0.48), Inches(0.34),
             ttl, size=13.5, color=INK, bold=True)
        text(s, x + Inches(0.24), y + Inches(1.18), bw - Inches(0.48), Inches(0.7),
             body, size=11.5, color=SLATE, space=1.2)
        if i < len(steps) - 1:
            text(s, x + bw, y + Inches(0.86), gap, Inches(0.3), "›",
                 size=20, color=LINE, align=PP_ALIGN.CENTER)

    y2 = y + Inches(2.44)
    text(s, M, y2, W - 2 * M, Inches(0.3),
         "ET SI VOUS NE POUVEZ PAS JOINDRE L'HUMAIN ?", size=11.5, color=SLATE, bold=True)
    bullets(s, M, y2 + Inches(0.36), W - 2 * M, [
        ("Vous l'entendez.", "L'agent le signale et vous le rappelle tout de suite."),
        ("Le message est transcrit.", "Vous recevez un résumé écrit sur WhatsApp — gratuit."),
        ("Vous récupérez l'information.", "Le nom, l'objet, l'urgence, le meilleur moment pour rappeler."),
    ], size=13.5, gap=Inches(0.42))


def s_languages():
    s = blank(prs)
    slide_frame(s, "Les langues", "Français et anglais, sans effort supplémentaire",
                "Une seule base de connaissances, deux langues. Vous l'écrivez une fois.",
                6, T)
    y = BODY_TOP + Inches(0.26)
    card(s, M, y, Inches(5.68), Inches(2.06), "La langue est détectée, pas demandée",
         "L'agent identifie la langue dès la première phrase et la garde pour tout "
         "l'appel.\n\nSi votre interlocuteur bascule en cours de conversation, l'agent "
         "suit — voix et formulation comprises.", ACCENT, tsize=15.5, bsize=13)
    card(s, M + Inches(5.94), y, Inches(5.68), Inches(2.06),
         "Votre documentation en une seule langue",
         "Une question en français retrouve un document rédigé en anglais.\n\n"
         "Vous n'écrivez pas deux versions de vos informations.", GOOD, tsize=15.5, bsize=13)

    y2 = y + Inches(2.5)
    text(s, M, y2, W - 2 * M, Inches(0.3), "CE QUI N'EST PAS PRIS EN CHARGE EN V1",
         size=11.5, color=SLATE, bold=True)
    rect(s, M, y2 + Inches(0.36), W - 2 * M, Inches(1.24), fill=WASH)
    text(s, M + Inches(0.34), y2 + Inches(0.56), W - 2 * M - Inches(0.7), Inches(0.9),
         [[("L'arabe et le darija (marocain) ne sont pas inclus.", {"bold": True, "color": INK})],
          [("La reconnaissance vocale est peu fiable sur le darija, et une voix arabe standard "
            "s'entend immédiatement comme une voix d'ordinateur. Préférons vous le dire "
            "plutôt que de vous le livrer à la production. Si vous en avez besoin, "
            "c'est un projet séparé, avec ses propres tests.", {"color": SLATE})]],
         size=12.5, space=1.24)


def s_privacy():
    s = blank(prs)
    slide_frame(s, "Conformité", "Ce que l'agent dit, et ce que nous conservons",
                "La transparence est intégrée à la conversation, pas ajoutée après coup.",
                7, T)
    y = BODY_TOP + Inches(0.26)
    rect(s, M, y, W - 2 * M, Inches(1.42), fill=RGBColor(0xEF, 0xF6, 0xF2))
    rect(s, M, y, Pt(3.5), Inches(1.42), fill=GOOD)
    text(s, M + Inches(0.34), y + Inches(0.22), Inches(1.4), Inches(0.3),
         "LA MENTION IA", size=11, color=GOOD, bold=True)
    text(s, M + Inches(0.34), y + Inches(0.56), W - 2 * M - Inches(0.7), Inches(0.7),
         "« Cet appel est pris en charge par un assistant IA. Dites « agent » à tout "
         "moment pour être transféré à un humain. »",
         size=15, color=INK, space=1.24)

    y2 = y + Inches(1.84)
    table(s, M, y2, W - 2 * M,
          ["", "Recommandé (v1)", "Si vous insistez"],
          [[("Audio de l'appel", INK, True), ("Aucun enregistrement", GOOD),
            "Enregistrement, avec information et droit d'opposition"],
           [("Ce qui est conservé", INK, True), ("La transcription", GOOD),
            "Audio + transcription"],
           [("Vérification de conformité", INK, True), ("RGPD classique", GOOD),
            "Régime CNIL de l'enregistrement d'appels"],
           [("Infrastructure nécessaire", INK, True), ("Aucune", GOOD),
            "Chaîne de conservation audio + mise à jour des accords"]],
          [0.28, 0.34, 0.38], size=12.5, row_h=Inches(0.5))

    y3 = y2 + Inches(2.44)
    rect(s, M, y3, W - 2 * M, Inches(0.9), fill=RGBColor(0xFD, 0xF6, 0xEC))
    rect(s, M, y3, Pt(3.5), Inches(0.9), fill=WARN)
    text(s, M + Inches(0.34), y3 + Inches(0.16), W - 2 * M - Inches(0.7), Inches(0.6),
         [[("À faire confirmer par votre conseil : ", {"bold": True, "color": INK}),
           ("les obligations de l'AI Act (art. 50) et la loi française de 2025 sur l'IA "
            "dans les relations avec les consommateurs. Nous ne pouvons pas nous y substituer.",
            {"color": SLATE})]],
         size=12.5, space=1.22)


def s_pricing():
    s = blank(prs)
    slide_frame(s, "L'investissement", "Trois formules",
                "Nos coûts comportent une part fixe importante : la formule C est notre recommandation.",
                8, T)
    y = BODY_TOP + Inches(0.26)
    cw, gap = Inches(3.72), Inches(0.3)
    opts = [
        ("A", "150 €", "/mois + 0,25 €/min", "Tout enrofé", None),
        ("B", "350 €", "/mois, 400 min incluses", "puis 0,20 €/min", None),
        ("C", "180 €", "/mois + 0,22 €/min",
         "0,12 €/min la nuit et le week-end", GOOD),
    ]
    for i, (letter, price, unit, tail, accent) in enumerate(opts):
        x = M + i * (cw + gap)
        h = Inches(2.62)
        rect(s, x, y, cw, h, fill=BG if not accent else RGBColor(0xF2, 0xF8, 0xFF),
             line=accent or LINE, lw=Pt(1.6) if accent else Pt(1))
        rect(s, x, y, cw, Pt(3), fill=accent or LINE)
        text(s, x + Inches(0.26), y + Inches(0.24), cw - Inches(0.5), Inches(0.3),
             f"FORMULE {letter}", size=11, color=accent or SLATE, bold=True)
        text(s, x + Inches(0.26), y + Inches(0.62), cw - Inches(0.5), Inches(0.6),
             price, size=30, color=INK, bold=True)
        text(s, x + Inches(0.26), y + Inches(1.24), cw - Inches(0.5), Inches(0.5),
             unit, size=12.5, color=SLATE, space=1.16)
        rect(s, x + Inches(0.26), y + Inches(1.9), cw - Inches(0.52), Pt(0.75), fill=LINE)
        text(s, x + Inches(0.26), y + Inches(2.04), cw - Inches(0.5), Inches(0.5),
             tail, size=12, color=accent or SLATE, bold=bool(accent), space=1.16)
        if accent:
            rect(s, x + cw - Inches(1.1), y + Inches(0.2), Inches(0.9), Inches(0.26),
                 fill=accent)
            text(s, x + cw - Inches(1.1), y + Inches(0.255), Inches(0.9), Inches(0.24),
                 "RECOMMANDÉE", size=8.5, color=WHITE, bold=True,
                 align=PP_ALIGN.CENTER)

    y2 = y + Inches(3.02)
    rect(s, M, y2, W - 2 * M, Inches(0.94), fill=WASH)
    text(s, M + Inches(0.34), y2 + Inches(0.18), W - 2 * M - Inches(0.7), Inches(0.62),
         [[("Pourquoi la C : ", {"bold": True, "color": INK}),
           ("la nuit et le week-end coûtent moins cher à servir. Vous pouvez vendre un "
            "standard de nuit à vos clients pour moins cher, sans perdre votre marge. "
            "La synthèse des messages vocaux reste active en permanence.", {"color": SLATE})]],
         size=13, space=1.22)

    y3 = y2 + Inches(1.16)
    text(s, M, y3, W - 2 * M, Inches(0.6),
         "Ces tarifs sont donnés à titre indicatif. Les tarifs fournisseurs seront "
         "vérifiés et datés avant signature. Ils ne sont pas engagés à ce stade.",
         size=11.5, color=SLATE, space=1.2)


def s_pilot():
    s = blank(prs)
    slide_frame(s, "Le pilote", "Deux semaines, et des chiffres decides",
                "Nous ne demandons pas de foi. Nous fixons les critères avant de commencer.",
                9, T)
    y = BODY_TOP + Inches(0.24)
    stats = [
        ("2 semaines", "de pilote", INK),
        ("100+ appels", "réels, chez vous", INK),
        ("< 2 s", "pour décrocher (p95)", ACCENT),
        ("< 1,6 s", "silence perçu (p95)", ACCENT),
        ("≥ 60 %", "résolus sans humain", GOOD),
        ("100 %", "transferts réussis", GOOD),
    ]
    bw, gap = Inches(1.86), Inches(0.19)
    for i, (v, l, c) in enumerate(stats):
        x = M + i * (bw + gap)
        rect(s, x, y, bw, Inches(1.34), fill=WASH)
        rect(s, x, y, bw, Pt(2.5), fill=c)
        text(s, x, y + Inches(0.3), bw, Inches(0.44), v, size=17, color=c, bold=True,
             align=PP_ALIGN.CENTER)
        text(s, x, y + Inches(0.82), bw, Inches(0.4), l, size=10, color=SLATE,
             align=PP_ALIGN.CENTER, space=1.1)

    y2 = y + Inches(1.76)
    text(s, M, y2, W - 2 * M, Inches(0.3), "CRITÈRES QUI NE SE NÉGOCIENT PAS",
         size=11.5, color=SLATE, bold=True)
    bullets(s, M, y2 + Inches(0.36), W - 2 * M, [
        ("La mention IA est prononcée sur 100 % des appels.", "Un point de non-conformité suffit à arrêter le pilote."),
        ("Un seul transfert échoué en silence est un échec.", "Un client qui attend un humain qui ne viendra pas : pire qu'un mauvais robot."),
    ], size=13, gap=Inches(0.46))

    y3 = y2 + Inches(1.44)
    rect(s, M, y3, W - 2 * M, Inches(1.1), fill=BG, line=LINE)
    rect(s, M, y3, Pt(3.5), Inches(1.1), fill=ACCENT)
    text(s, M + Inches(0.34), y3 + Inches(0.2), W - 2 * M - Inches(0.7), Inches(0.76),
         [[("Une semaine de référence avant le pilote. ", {"bold": True, "color": INK}),
           ("Sans mesure de votre situation actuelle, « 60 % de résolution » n'a rien contre quoi "
            "être comparé. Nous relevons d'abord : appels manqués, temps de traitement, "
            "taux de transfert actuel.", {"color": SLATE})]],
         size=13, space=1.24)


def s_phases():
    s = blank(prs)
    slide_frame(s, "Le calendrier", "Ce que nous faisons, dans quel ordre",
                "Les délais qui dépendent de vous ou de Meta commencent en premier.",
                10, T)
    y = BODY_TOP + Inches(0.24)
    rows = [
        [("Maintenant", INK, True), "Vous", "Vos 4 réponses + vérification Meta",
         ("C'est le vrai délai — il ne dépend pas de nous", WARN)],
        [("Semaine 1–2", INK, True), "Nous", "Agent WhatsApp",
         ("Le canal le moins cher à lancer, Meta facture 0 €", ACCENT)],
        [("Semaine 3–4", INK, True), "Nous", "Ligne vocale dédiée",
         ("Nécessite votre numéro et l'accord sur l'enregistrement", ACCENT)],
        [("Semaine 5–6", INK, True), "Nous", "Supervision, alertes, tableaux de bord",
         ("Une fois les appels réels en place", ACCENT)],
        [("Semaine 7–8", INK, True), "Ensemble", "Pilote de 2 semaines",
         ("≥ 100 appels, critères publiés à l'avance", GOOD)],
    ]
    table(s, M, y, W - 2 * M, ["Quand", "Qui", "Quoi", "Pourquoi cet ordre"],
          rows, [0.13, 0.11, 0.3, 0.46], size=12.5, row_h=Inches(0.62))

    y2 = y + Inches(3.6)
    rect(s, M, y2, W - 2 * M, Inches(0.86), fill=RGBColor(0xFD, 0xF6, 0xEC))
    rect(s, M, y2, Pt(3.5), Inches(0.86), fill=WARN)
    text(s, M + Inches(0.34), y2 + Inches(0.16), W - 2 * M - Inches(0.7), Inches(0.6),
         [[("Le délai qui nous échappe : ", {"bold": True, "color": INK}),
           ("la validation du compte Meta prend plusieurs semaines. C'est pourquoi nous la "
            "lançons dès aujourd'hui, en parallèle du reste.", {"color": SLATE})]],
         size=12.5, space=1.2)


def s_questions():
    s = blank(prs)
    rect(s, Emu(0), Emu(0), W, H, fill=INK)
    rect(s, M, Inches(0.94), Inches(0.9), Pt(3.5), fill=ACCENT)
    text(s, M, Inches(0.56), W - 2 * M, Inches(0.3), "AVANT DE COMMENCER",
         size=11.5, color=RGBColor(0x8F, 0xB4, 0xFF), bold=True)
    text(s, M, Inches(1.3), W - 2 * M, Inches(0.6),
         "Quatre questions, et nous partons.", size=31, color=WHITE, bold=True)

    qs = [
        ("1", "Quel appel vous coûte le plus de temps aujourd'hui ?",
         "Une seule réponse suffit. L'agent sera optimisé pour elle."),
        ("2", "Le périmètre vous convient-il ?",
         "WhatsApp pour l'écrit, une ligne dédiée pour la voix."),
        ("3", "Quelle formule retenez-vous ? A, B ou C ?",
         "Nous recommandons la formule C."),
        ("4", "Confirmez-vous : aucun enregistrement audio en v1 ?",
         "Recommandé — cela évite le régime d'enregistrement d'appels."),
    ]
    y = Inches(2.24)
    for num, q, sub in qs:
        rect(s, M, y, W - 2 * M, Inches(0.92), fill=RGBColor(0x1A, 0x22, 0x30))
        rect(s, M, y, Pt(3.5), Inches(0.92), fill=ACCENT)
        text(s, M + Inches(0.32), y + Inches(0.26), Inches(0.4), Inches(0.4), num,
             size=17, color=RGBColor(0x8F, 0xB4, 0xFF), bold=True)
        text(s, M + Inches(0.92), y + Inches(0.18), W - 2 * M - Inches(1.3), Inches(0.34),
             q, size=15, color=WHITE, bold=True)
        text(s, M + Inches(0.92), y + Inches(0.54), W - 2 * M - Inches(1.3), Inches(0.3),
             sub, size=12, color=RGBColor(0x8E, 0x9C, 0xB0))
        y += Inches(1.06)

    rect(s, M, y + Inches(0.16), W - 2 * M, Pt(0.75), fill=RGBColor(0x2C, 0x36, 0x48))
    text(s, M, y + Inches(0.42), W - 2 * M, Inches(0.4),
         "Le cahier des charges technique complet et le détail des coûts sont disponibles "
         "sur demande — nous vous les envoyons avec ce document.",
         size=12.5, color=RGBColor(0x76, 0x84, 0x96))


def s_close():
    s = blank(prs)
    rect(s, Emu(0), Emu(0), W, H, fill=INK)
    rect(s, M, Inches(2.5), Inches(0.9), Pt(3.5), fill=ACCENT)
    text(s, M, Inches(1.9), W - 2 * M, Inches(0.3), "SMEMASTER", size=12,
         color=RGBColor(0x8F, 0xB4, 0xFF), bold=True)
    text(s, M, Inches(2.88), Inches(9.4), Inches(1.4),
         [[("Votre téléphone ne sonne", {"color": WHITE})],
          [("plus jamais dans le vide.", {"color": WHITE})]],
         size=36, bold=True, space=1.1)
    text(s, M, Inches(4.6), Inches(8.6), Inches(1.0),
         "Réponse immédiate, français et anglais, 24h/24 et 7j/7 — avec un humain "
         "toujours à portée de voix.",
         size=16, color=RGBColor(0xB9, 0xC4, 0xD4), space=1.26)
    rect(s, M, Inches(5.9), Inches(11.6), Pt(0.75), fill=RGBColor(0x2C, 0x36, 0x48))
    text(s, M, Inches(6.1), Inches(11.6), Inches(0.4),
         "Document de cadrage · 28 septembre 2026 · aucune prestation n'est engagée à ce stade",
         size=11, color=RGBColor(0x76, 0x84, 0x96))


for fn in (s_title, s_problem, s_solution, s_constraint, s_how, s_languages,
           s_privacy, s_pricing, s_pilot, s_phases, s_questions, s_close):
    fn()

out = pathlib.Path(__file__).resolve().parents[1] / "docs" / "voice" / "VOICE-AGENT-DECK.pptx"
out.parent.mkdir(parents=True, exist_ok=True)
prs.save(out)
print(f"OK {len(prs.slides.__iter__.__self__._sldIdLst)} slides -> {out}")
