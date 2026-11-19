# Authoritative Medication Reference Sources

All medication names, strengths, dosage forms, therapeutic classes, general uses, and general safety warnings in `src/data/drugs.json` are compiled for **educational simulation only** from established, publicly available official formularies:

## Primary References
1. **World Health Organization (WHO) — Model List of Essential Medicines, 24th Edition (September 2025) & 10th EMLc for Children (2025)**
   - INN generic names, dosage forms, AWaRe antibiotic classifications (Access/Watch/Reserve), and pediatric/neonatal essential medicines.
   - https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists

2. **NIH / National Library of Medicine — DailyMed (FDA Structured Product Labeling)**
   - U.S. Adopted Names, standard strengths, storage conditions, and general boxed/class warnings.
   - https://dailymed.nlm.nih.gov/

3. **U.S. Drug Enforcement Administration (DEA) — Controlled Substances Act (CSA) Schedules**
   - Verified `scheduleByCountry.US` classifications for Cabinet K controlled medications:
     - Schedule II: Morphine, Fentanyl, Oxycodone, Methylphenidate
     - Schedule III: Ketamine
     - Schedule IV: Tramadol, Diazepam, Midazolam, Lorazepam
   - https://www.dea.gov/drug-information/drug-scheduling

4. **British National Formulary (BNF) / NHS Medicines A–Z**
   - Common international brand examples and cold-chain storage conventions (`2–8 °C`).
   - https://www.nhs.uk/medicines/

## Per-Group Reference Mapping
- **Cabinet A (Analgesics & Antipyretics):** WHO EML 24th Ed. §2 (Medicines for pain and palliative care); DailyMed.
- **Cabinet B (Antibiotics):** WHO EML 24th Ed. §6.2 (Antibacterials — AWaRe classification); DailyMed.
- **Cabinet C (Cardiovascular):** WHO EML 24th Ed. §12 (Cardiovascular medicines); DailyMed.
- **Cabinet D (Diabetes & Endocrine):** WHO EML 24th Ed. §18 (Medicines for endocrine disorders); DailyMed.
- **Cabinet E (Respiratory):** WHO EML 24th Ed. §25 (Medicines acting on the respiratory tract); DailyMed.
- **Cabinet F (Gastrointestinal):** WHO EML 24th Ed. §17 (Gastrointestinal medicines); DailyMed.
- **Cabinet G (Neuro & Psych):** WHO EML 24th Ed. §5 & §24 (Anticonvulsants & Mental/behavioral disorders); DailyMed.
- **Cabinet H (Oncology Support / Antiemetics):** WHO EML 24th Ed. §8 & §17.2 (Antineoplastic supportive care & Antiemetics); DailyMed.
- **Cabinet I (IV Fluids & Injectables):** WHO EML 24th Ed. §26 (Solutions correcting water, electrolyte and acid-base disturbances) & §10; DailyMed.
- **Cabinet J (Fridge — Insulin, Vaccines & Biologics):** WHO EML 24th Ed. §18.5 & §19.3 (Insulins & Vaccines); DailyMed.
- **Cabinet K (Controlled Drugs):** U.S. DEA CSA Schedules (II, III, IV); WHO EML 24th Ed. §1 & §2.
- **Cabinet L (Pediatric & Neonatal):** WHO 10th EMLc (2025) & §27 (Medicines for neonates); DailyMed.

> **Disclaimer:** Educational simulation only. Not medical advice. No personalized dosing regimens or patient-specific clinical guidance are provided.
