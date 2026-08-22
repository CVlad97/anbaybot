from __future__ import annotations

import re
import tempfile
import zipfile
from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Prospect Vision Bot", page_icon="🎯", layout="wide")

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:\+?596|\+?590|0)\s?6[0-9\s.\-]{7,}")

HIGH_VALUE = {
    "nuisible": 20, "dératisation": 20, "désinsectisation": 20, "termite": 20,
    "btp": 18, "menuiserie": 18, "charpente": 18, "couverture": 18,
    "restaurant": 18, "restauration": 18, "traiteur": 18, "hôtellerie": 16,
    "tourisme": 16, "excursion": 16, "croisiere": 16, "croisière": 16,
    "agriculteur": 16, "agriculture": 16, "producteur": 16, "commerce": 14,
}
NEEDS = {
    "site": 16, "création site": 18, "google": 16, "référencement": 16,
    "prospect": 18, "devis": 12, "intervention": 12, "réseaux": 14,
    "reseaux": 14, "flyer": 10, "photo": 10, "vidéo": 10, "video": 10,
    "conseil": 8, "commerce": 10, "tarif": 8, "urgent": 14,
}

ALIASES = {
    "full name": "full_name", "nom complet": "full_name", "first name": "full_name",
    "email": "email", "phone number": "phone", "whatsapp number": "phone",
    "secteur d'activité": "sector", "principal besoin": "need", "message": "need",
    "nom de l'entreprise": "company", "entreprise": "company", "site web existant ?": "website",
}

DEFAULT_COLUMNS = [
    "company", "full_name", "email", "phone", "sector", "need", "city", "website",
    "has_google_profile", "has_social_networks", "source", "consent_status", "notes"
]


def normalize(row: dict) -> dict:
    out = {c: "" for c in DEFAULT_COLUMNS}
    for key, val in row.items():
        target = ALIASES.get(str(key).lower().strip(), str(key).lower().strip())
        if target in out:
            out[target] = "" if pd.isna(val) else str(val).strip()
    out.setdefault("source", "manual")
    return out


def score(row: dict) -> int:
    text = " ".join(str(row.get(k, "")) for k in ["company", "full_name", "sector", "need", "city", "notes"]).lower()
    total = 0
    if row.get("phone"):
        total += 12
    if EMAIL_RE.search(str(row.get("email", ""))):
        total += 10
    if row.get("company") or row.get("full_name"):
        total += 8
    total += min(max([v for k, v in HIGH_VALUE.items() if k in text] or [0]), 20)
    total += min(max([v for k, v in NEEDS.items() if k in text] or [0]), 18)
    website = str(row.get("website", "")).lower()
    if website in {"", "non", "no", "aucun", "unknown"}:
        total += 12
    elif "inefficace" in website or "je ne sais pas" in website:
        total += 10
    else:
        total += 4
    if str(row.get("has_google_profile", "unknown")).lower() in {"no", "non", "unknown", ""}:
        total += 8
    if str(row.get("has_social_networks", "unknown")).lower() in {"no", "non", "unknown", ""}:
        total += 8
    if any(k in text for k in ["martinique", "972", "guadeloupe", "971", "caraïbe", "caraibe"]) or "+596" in str(row.get("phone", "")) or "0696" in str(row.get("phone", "")):
        total += 10
    consent = str(row.get("consent_status", "unknown")).lower()
    if consent == "opt_in":
        total += 8
    elif consent == "legitimate_interest_b2b":
        total += 5
    elif consent == "opt_out":
        total -= 40
    if "stop" in text or "désinscrire" in text or "desinscrire" in text:
        total -= 35
    return max(0, min(100, total))


def label(value: int) -> str:
    if value >= 80:
        return "⭐⭐⭐⭐⭐ Client très qualifié"
    if value >= 65:
        return "⭐⭐⭐⭐ Prospect chaud"
    if value >= 50:
        return "⭐⭐⭐ Prospect à travailler"
    if value >= 35:
        return "⭐⭐ Prospect froid"
    return "⭐ À enrichir"


def next_action(value: int) -> str:
    if value >= 80:
        return "Appel découverte + audit rapide + proposition sous 24 h"
    if value >= 65:
        return "Message personnalisé + rendez-vous court + preuve de résultat"
    if value >= 50:
        return "Enrichir le besoin, vérifier Google/réseaux, puis relancer"
    if value >= 35:
        return "Conserver en nurturing et collecter plus d'informations"
    return "Ne pas prospecter sans qualification ou consentement complémentaire"


def rgpd_advice(row: dict) -> str:
    consent = str(row.get("consent_status", "unknown")).lower()
    if consent == "opt_out":
        return "Ne pas contacter : opposition connue. Ajouter au fichier repoussoir."
    if consent == "opt_in":
        return "Contact possible selon le canal accepté, avec preuve du consentement et désinscription simple."
    if row.get("company"):
        return "B2B : message strictement lié à l'activité, expéditeur clair, opposition simple, validation humaine avant envoi."
    return "Consentement non vérifié : ne pas envoyer d'email/SMS/WhatsApp marketing automatisé."


def pack(row: dict) -> str:
    text = " ".join(str(row.get(k, "")) for k in ["sector", "need", "company"]).lower()
    if any(k in text for k in ["nuisible", "dératisation", "désinsectisation", "termite"]):
        return "Pack Ariane Digital : Google Business, site vitrine, formulaire d'intervention, tunnel devis, preuves avant/après."
    if any(k in text for k in ["restaurant", "traiteur", "hôtel", "hotel", "croisi", "excursion"]):
        return "Pack visibilité locale : fiche Google, mini-site, photos/vidéos, WhatsApp direct, offres et réservation."
    if any(k in text for k in ["btp", "menuiserie", "charpente", "couverture", "chantier"]):
        return "Pack chantiers : page devis, portfolio réalisations, avis clients, formulaire photo chantier, suivi prospects."
    return "Pack acquisition simple : audit, page de conversion, Google Business, formulaire et relance manuelle validée."


def fiche(row: dict, business_name: str) -> str:
    s = score(row)
    name = (row.get("company") or row.get("full_name") or "Prospect").upper()
    return f"""# FICHE CLIENT QUALIFIÉE – {name}

## Coordonnées
- **Entreprise :** {row.get('company') or 'À compléter'}
- **Contact :** {row.get('full_name') or 'À compléter'}
- **Téléphone :** {row.get('phone') or 'À compléter'}
- **Email :** {row.get('email') or 'À compléter'}
- **Ville / zone :** {row.get('city') or 'Martinique / Caraïbe à confirmer'}
- **Source :** {row.get('source') or 'manual'}

## Secteur d'activité
{row.get('sector') or 'À compléter'}

## Besoin identifié
{row.get('need') or 'À compléter'}

## Proposition commerciale adaptée
{pack(row)}

## Objectif business
Créer un flux régulier de demandes qualifiées, augmenter la visibilité locale et transformer les contacts entrants en rendez-vous ou devis.

## Niveau de qualification
**Score : {s}/100**  
**{label(s)}**

## Action suivante
{next_action(s)}

## Garde-fou conformité
{rgpd_advice(row)}

---
Généré par **{business_name} – Prospect Vision Bot**.
"""


def read_text_upload(uploaded) -> str:
    data = uploaded.getvalue()
    if uploaded.name.lower().endswith(".zip"):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)
        with zipfile.ZipFile(tmp_path) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith(".txt")]
            if not names:
                raise ValueError("Aucun .txt dans le zip")
            return zf.read(names[0]).decode("utf-8", errors="replace")
    return data.decode("utf-8", errors="replace")


def parse_whatsapp(text: str) -> list[dict]:
    chunks = re.split(r"\n(?=\d{1,2}/\d{1,2}/\d{4},)", text)
    rows = []
    for chunk in chunks:
        if not ("Email" in chunk or EMAIL_RE.search(chunk)):
            continue
        lines = [ln.strip().lstrip("\u200e") for ln in chunk.splitlines() if ln.strip()]
        if lines:
            lines[0] = re.sub(r"^\d{1,2}/\d{1,2}/\d{4},.*? - .*?:\s*", "", lines[0])
        data = {c: "" for c in DEFAULT_COLUMNS}
        i = 0
        while i < len(lines):
            key = ALIASES.get(lines[i].lower().strip())
            if key and i + 1 < len(lines):
                if data.get(key):
                    data[key] = f"{data[key]} | {lines[i+1]}"
                else:
                    data[key] = lines[i + 1]
                i += 2
            else:
                i += 1
        if not data["email"]:
            m = EMAIL_RE.search(chunk)
            data["email"] = m.group(0) if m else ""
        if not data["phone"]:
            m = PHONE_RE.search(chunk.replace(" ", ""))
            data["phone"] = m.group(0) if m else ""
        data["source"] = "whatsapp_export"
        rows.append(data)
    return rows


st.title("🎯 Prospect Vision Bot")
st.caption("Qualification commerciale sans publication de données privées et sans envoi automatique.")

if "rows" not in st.session_state:
    st.session_state.rows = []

business_name = st.sidebar.text_input("Nom commercial", "Ikabay Sourcing")
st.sidebar.warning("Ne publie jamais tes vrais exports clients dans un repo public.")

manual, upload, results = st.tabs(["➕ Manuel", "📥 Import", "📊 Résultats"])

with manual:
    with st.form("manual"):
        cols = st.columns(2)
        with cols[0]:
            company = st.text_input("Entreprise")
            full_name = st.text_input("Contact")
            email = st.text_input("Email")
            phone = st.text_input("Téléphone")
            city = st.text_input("Ville / zone", "Martinique")
        with cols[1]:
            sector = st.text_input("Secteur")
            need = st.text_area("Besoin", height=120)
            website = st.text_input("Site web", "unknown")
            consent_status = st.selectbox("Consentement", ["unknown", "opt_in", "legitimate_interest_b2b", "opt_out"])
        if st.form_submit_button("Qualifier"):
            row = normalize(locals())
            row.update({"company": company, "full_name": full_name, "email": email, "phone": phone, "city": city, "sector": sector, "need": need, "website": website, "consent_status": consent_status, "source": "manual"})
            st.session_state.rows.append(row)
            st.success(f"Ajouté : {score(row)}/100 — {label(score(row))}")
            st.markdown(fiche(row, business_name))

with upload:
    uploaded = st.file_uploader("CSV ou export WhatsApp .txt/.zip", type=["csv", "txt", "zip"])
    if uploaded:
        if uploaded.name.lower().endswith(".csv"):
            df = pd.read_csv(uploaded)
            rows = [normalize(row.dropna().to_dict()) for _, row in df.iterrows()]
        else:
            rows = parse_whatsapp(read_text_upload(uploaded))
        st.session_state.rows.extend(rows)
        st.success(f"{len(rows)} prospect(s) importé(s).")

with results:
    rows = st.session_state.rows
    if not rows:
        st.info("Ajoute ou importe des prospects.")
    else:
        out = []
        for row in rows:
            row = normalize(row)
            s = score(row)
            out.append({**row, "score": s, "qualification": label(s), "next_action": next_action(s)})
        df = pd.DataFrame(out).sort_values("score", ascending=False)
        st.dataframe(df, use_container_width=True)
        st.download_button("Télécharger CSV", df.to_csv(index=False).encode("utf-8-sig"), "prospects_qualifies.csv", "text/csv")
        idx = st.selectbox("Fiche à afficher", range(len(out)), format_func=lambda i: f"{out[i].get('company') or out[i].get('full_name') or 'Prospect'} — {out[i]['score']}/100")
        st.markdown(fiche(out[idx], business_name))
