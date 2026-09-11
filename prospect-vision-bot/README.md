# Prospect Vision Bot

Générateur de prospects qualifiés pour Ikabay Sourcing, Delikréol, Pack Ariane Digital, BTP/menuiseries et activités locales Martinique/Caraïbe.

## Fonctions

- Import CSV ou export WhatsApp `.txt` / `.zip`.
- Qualification automatique sur 100.
- Génération d'une fiche client qualifiée au format Markdown.
- Export CSV.
- Garde-fous RGPD : pas d'envoi automatique, prise en compte consentement/opposition, validation humaine.

## Démarrage

```bash
cd prospect-vision-bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## Colonnes CSV acceptées

```csv
company,full_name,email,phone,sector,need,city,website,has_google_profile,has_social_networks,source,consent_status
```

`consent_status` : `unknown`, `opt_in`, `legitimate_interest_b2b`, `opt_out`.

## Confidentialité

Ne mets pas tes vrais exports WhatsApp ou fichiers prospects dans un dépôt public. Garde-les en local ou dans un CRM privé.
