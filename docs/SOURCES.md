# Authoritative Medication Reference Sources

All medication names, strengths, dosage forms, therapeutic classes, general uses, and general safety warnings in `src/data/drugs.json` are compiled for **educational simulation only** from established, publicly available clinical formularies:

1. **World Health Organization (WHO) — Model List of Essential Medicines (23rd List, 2023)**
   - Used to verify INN generic names, core dosage forms, and AWaRe / therapeutic classifications (e.g., analgesics, Access/Watch/Reserve antibiotics, insulins, bronchodilators, neonatal essential medicines).
   - Reference: https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists

2. **NIH / National Library of Medicine — DailyMed**
   - Used to verify U.S. Adopted Names, standard strengths, storage conditions, and general boxed/class warnings (e.g., paracetamol hepatotoxicity, metformin lactic acidosis, omeprazole long-term risks, ondansetron QTc prolongation).
   - Reference: https://dailymed.nlm.nih.gov/

3. **British National Formulary (BNF) / NHS Medicines A–Z**
   - Used as a cross-check for common UK/international brand examples, controlled-drug scheduling concepts, and cold-chain biologics/vaccine storage (`2–8 °C`).

> **Disclaimer:** This application is an educational 3D hospital simulation. It does not provide personalized dosing regimens, patient-specific medical advice, or clinical decision support.
