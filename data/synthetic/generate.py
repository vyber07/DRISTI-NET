"""Deterministic synthetic dataset generator for the DRISHTI-NET prototype.

Everything produced here is fictional. Phone numbers use the reserved-looking
+91 90000 xxxxx block, accounts use the ACC-DEMO-#### form, and all names,
organisations, places, and events are invented.

Planted scenarios (see truth-labels.json):
  * three communities (Riverside Traders, Hilltop Logistics, Lakeside Freight)
  * one bridge candidate (Manish Tiwari) linking all three
  * one alias with spelling variation  -> expected ACCEPT
  * one ambiguous name (two Rahul Vermas) -> expected REJECT
  * one shared phone (two people)        -> expected DEFER
  * one contradiction (vehicle owner)    -> expected CONTRADICTORY
  * one missing field (transaction amount)
  * one historical relationship (2019 call)
  * one communication burst and one transaction fan-in (rule candidates)
  * one tampered evidence copy for the hash-mismatch demonstration
  * one EICAR test file for the fail-closed scan gate demonstration
"""
from __future__ import annotations

import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "documents"
random.seed(20260911)

# --------------------------------------------------------------------------- cases
CASES = [
    {
        "case_id": "CASE-0001",
        "title": "River Bridge Supply Investigation",
        "jurisdiction": "Demo District A",
        "purpose": "Retrospective relationship review",
        "authority_reference": "FIR-DEMO-001",
        "classification": "SYNTHETIC_DEMO",
        "sensitivity": "RESTRICTED",
        "opened_at": "2025-06-01",
    },
    {
        "case_id": "CASE-0002",
        "title": "Lakeside Freight Invoice Review",
        "jurisdiction": "Demo District A",
        "purpose": "Financial pattern review",
        "authority_reference": "FIR-DEMO-002",
        "classification": "SYNTHETIC_DEMO",
        "sensitivity": "RESTRICTED",
        "opened_at": "2025-07-15",
    },
    {'case_id': 'CASE-0003', 'title': 'Cross-Group Zero Administration Installation Investigation', 'jurisdiction': 'District Himachal Pradesh', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-003', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-10-23'},
    {'case_id': 'CASE-0004', 'title': 'Automated Homogeneous Monitoring Investigation', 'jurisdiction': 'District Nagaland', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-004', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-12-02'},
    {'case_id': 'CASE-0005', 'title': 'Business-Focused Cohesive Challenge Investigation', 'jurisdiction': 'District Karnataka', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-005', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-05-15'},
    {'case_id': 'CASE-0006', 'title': 'Total Dynamic Complexity Investigation', 'jurisdiction': 'District Andhra Pradesh', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-006', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-10-30'},
    {'case_id': 'CASE-0007', 'title': 'Vision-Oriented Background Policy Investigation', 'jurisdiction': 'District Madhya Pradesh', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-007', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-07-09'},
    {'case_id': 'CASE-0008', 'title': 'Intuitive Upward-Trending Knowledge User Investigation', 'jurisdiction': 'District Bihar', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-008', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-11-05'},
    {'case_id': 'CASE-0009', 'title': 'Cross-Group Static Circuit Investigation', 'jurisdiction': 'District Chhattisgarh', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-009', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-07-08'},
    {'case_id': 'CASE-0010', 'title': 'Ameliorated Explicit Internet Solution Investigation', 'jurisdiction': 'District Odisha', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-010', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-04-15'},
    {'case_id': 'CASE-0011', 'title': 'Phased 5Thgeneration Throughput Investigation', 'jurisdiction': 'District Jharkhand', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-011', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-08-29'},
    {'case_id': 'CASE-0012', 'title': 'Polarized Demand-Driven Portal Investigation', 'jurisdiction': 'District Rajasthan', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-012', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-05-24'},
    {'case_id': 'CASE-0013', 'title': 'Intuitive 24/7 Infrastructure Investigation', 'jurisdiction': 'District Tripura', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-013', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-10-05'},
    {'case_id': 'CASE-0014', 'title': 'Optional Systemic Monitoring Investigation', 'jurisdiction': 'District Rajasthan', 'purpose': 'Retrospective relationship review', 'authority_reference': 'FIR-DEMO-014', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-12-31'},
    {'case_id': 'CASE-0015', 'title': 'Right-Sized Mobile Model Investigation', 'jurisdiction': 'District Sikkim', 'purpose': 'Retrospective relationship review', 'authority_reference': 'FIR-DEMO-015', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-04-20'},
    {'case_id': 'CASE-0016', 'title': 'Profound 5Thgeneration System Engine Investigation', 'jurisdiction': 'District Rajasthan', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-016', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-07-18'},
    {'case_id': 'CASE-0017', 'title': 'Configurable Mobile Protocol Investigation', 'jurisdiction': 'District Himachal Pradesh', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-017', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-01-25'},
    {'case_id': 'CASE-0018', 'title': 'Mandatory Neutral Infrastructure Investigation', 'jurisdiction': 'District Assam', 'purpose': 'Retrospective relationship review', 'authority_reference': 'FIR-DEMO-018', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-01-17'},
    {'case_id': 'CASE-0019', 'title': 'Networked Object-Oriented Time-Frame Investigation', 'jurisdiction': 'District Karnataka', 'purpose': 'Retrospective relationship review', 'authority_reference': 'FIR-DEMO-019', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-02-25'},
    {'case_id': 'CASE-0020', 'title': 'Reverse-Engineered Background Product Investigation', 'jurisdiction': 'District Kerala', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-020', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-09-26'},
    {'case_id': 'CASE-0021', 'title': 'Multi-Channeled Discrete Initiative Investigation', 'jurisdiction': 'District Nagaland', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-021', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-09-24'},
    {'case_id': 'CASE-0022', 'title': 'Centralized Scalable Forecast Investigation', 'jurisdiction': 'District Meghalaya', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-022', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-09-16'},
    {'case_id': 'CASE-0023', 'title': 'Self-Enabling Uniform Emulation Investigation', 'jurisdiction': 'District Nagaland', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-023', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-08-20'},
    {'case_id': 'CASE-0024', 'title': 'Enhanced Coherent Monitoring Investigation', 'jurisdiction': 'District Manipur', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-024', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-09-03'},
    {'case_id': 'CASE-0025', 'title': 'Persistent 6Thgeneration Access Investigation', 'jurisdiction': 'District Chhattisgarh', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-025', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-06-18'},
    {'case_id': 'CASE-0026', 'title': 'Ameliorated Eco-Centric Website Investigation', 'jurisdiction': 'District Kerala', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-026', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-08-14'},
    {'case_id': 'CASE-0027', 'title': 'Optional Scalable Instruction Set Investigation', 'jurisdiction': 'District Andhra Pradesh', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-027', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-01-28'},
    {'case_id': 'CASE-0028', 'title': 'Cloned Multimedia Help-Desk Investigation', 'jurisdiction': 'District Tamil Nadu', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-028', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-12-03'},
    {'case_id': 'CASE-0029', 'title': 'Optional 24/7 Utilization Investigation', 'jurisdiction': 'District Nagaland', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-029', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-11-18'},
    {'case_id': 'CASE-0030', 'title': 'Quality-Focused System-Worthy Productivity Investigation', 'jurisdiction': 'District Madhya Pradesh', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-030', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-06-17'},
    {'case_id': 'CASE-0031', 'title': 'Inverse Empowering Leverage Investigation', 'jurisdiction': 'District Arunachal Pradesh', 'purpose': 'Retrospective relationship review', 'authority_reference': 'FIR-DEMO-031', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-10-06'},
    {'case_id': 'CASE-0032', 'title': 'Managed Intangible Hardware Investigation', 'jurisdiction': 'District Andhra Pradesh', 'purpose': 'Retrospective relationship review', 'authority_reference': 'FIR-DEMO-032', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-03-17'},
    {'case_id': 'CASE-0033', 'title': 'Diverse Intangible Architecture Investigation', 'jurisdiction': 'District Tamil Nadu', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-033', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-12-26'},
    {'case_id': 'CASE-0034', 'title': 'Digitized Holistic Secured Line Investigation', 'jurisdiction': 'District Haryana', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-034', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-06-12'},
    {'case_id': 'CASE-0035', 'title': 'Self-Enabling Analyzing Task-Force Investigation', 'jurisdiction': 'District Mizoram', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-035', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-03-12'},
    {'case_id': 'CASE-0036', 'title': 'Integrated Client-Server Projection Investigation', 'jurisdiction': 'District Tripura', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-036', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-06-25'},
    {'case_id': 'CASE-0037', 'title': 'Vision-Oriented Human-Resource Hub Investigation', 'jurisdiction': 'District Chhattisgarh', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-037', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-07-16'},
    {'case_id': 'CASE-0038', 'title': 'Mandatory Multi-State Capability Investigation', 'jurisdiction': 'District Rajasthan', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-038', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-10-11'},
    {'case_id': 'CASE-0039', 'title': 'Reverse-Engineered Human-Resource Internet Solution Investigation', 'jurisdiction': 'District Arunachal Pradesh', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-039', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-01-14'},
    {'case_id': 'CASE-0040', 'title': 'Persevering Static Adapter Investigation', 'jurisdiction': 'District Kerala', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-040', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-03-10'},
    {'case_id': 'CASE-0041', 'title': 'User-Centric User-Facing Success Investigation', 'jurisdiction': 'District Tamil Nadu', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-041', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-08-09'},
    {'case_id': 'CASE-0042', 'title': 'Innovative Interactive Utilization Investigation', 'jurisdiction': 'District Tripura', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-042', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-01-16'},
    {'case_id': 'CASE-0043', 'title': 'Programmable Fresh-Thinking Model Investigation', 'jurisdiction': 'District Mizoram', 'purpose': 'Retrospective relationship review', 'authority_reference': 'FIR-DEMO-043', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2024-10-05'},
    {'case_id': 'CASE-0044', 'title': 'Mandatory Motivating Benchmark Investigation', 'jurisdiction': 'District Nagaland', 'purpose': 'Supply chain audit', 'authority_reference': 'FIR-DEMO-044', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-10-26'},
    {'case_id': 'CASE-0045', 'title': 'Face-To-Face Non-Volatile Graphical User Interface Investigation', 'jurisdiction': 'District Assam', 'purpose': 'Financial pattern review', 'authority_reference': 'FIR-DEMO-045', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2026-02-27'},
    {'case_id': 'CASE-0046', 'title': 'Profit-Focused Dynamic Database Investigation', 'jurisdiction': 'District Karnataka', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-046', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-04-01'},
    {'case_id': 'CASE-0047', 'title': 'Balanced Motivating Artificial Intelligence Investigation', 'jurisdiction': 'District Gujarat', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-047', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-03-27'},
    {'case_id': 'CASE-0048', 'title': 'Virtual 3Rdgeneration Core Investigation', 'jurisdiction': 'District Himachal Pradesh', 'purpose': 'Tax evasion inquiry', 'authority_reference': 'FIR-DEMO-048', 'classification': 'SYNTHETIC_DEMO', 'sensitivity': 'RESTRICTED', 'opened_at': '2025-09-19'},
]

# --------------------------------------------------------------------------- people
# phone / account are the *canonical* identifiers; aliases.json adds variants.
PEOPLE = [
    # community A — Riverside Traders
    {"person_id": "P-A1", "name": "Arjun Malhotra", "dob": "1985-03-12", "community": "A", "org": "Riverside Traders", "phone": "+91 90000 00101", "account": "ACC-DEMO-0101", "address": "14 Ghat Road, Demo District A"},
    {"person_id": "P-A2", "name": "Kavya Iyer", "dob": "1990-11-02", "community": "A", "org": "Riverside Traders", "phone": "+91 90000 00102", "account": "ACC-DEMO-0102", "address": "3 Mill Lane, Demo District A"},
    {"person_id": "P-A3", "name": "Rohan Deshpande", "dob": "1982-07-19", "community": "A", "org": "Riverside Traders", "phone": "+91 90000 00103", "account": "ACC-DEMO-0103", "address": "22 Ferry Street, Demo District A"},
    {"person_id": "P-A4", "name": "Neha Kulkarni", "dob": "1993-01-25", "community": "A", "org": "Riverside Traders", "phone": "+91 90000 00104", "account": "ACC-DEMO-0104", "address": "8 Bund Road, Demo District A"},
    # community B — Hilltop Logistics
    {"person_id": "P-B1", "name": "Devika Nair", "dob": "1987-09-09", "community": "B", "org": "Hilltop Logistics", "phone": "+91 90000 00201", "account": "ACC-DEMO-0201", "address": "51 Summit Avenue, Demo District B"},
    {"person_id": "P-B2", "name": "Sameer Qureshi", "dob": "1979-04-30", "community": "B", "org": "Hilltop Logistics", "phone": "+91 90000 00202", "account": "ACC-DEMO-0202", "address": "9 Ridge Row, Demo District B"},
    {"person_id": "P-B3", "name": "Tanvi Bhatt", "dob": "1995-12-14", "community": "B", "org": "Hilltop Logistics", "phone": "+91 90000 00203", "account": "ACC-DEMO-0203", "address": "17 Ridge Row, Demo District B"},
    {"person_id": "P-B4", "name": "Imran Shaikh", "dob": "1994-05-05", "community": "B", "org": "Hilltop Logistics", "phone": "+91 90000 00203", "account": "ACC-DEMO-0204", "address": "17 Ridge Row, Demo District B"},  # shares phone with P-B3
    # community C — Lakeside Freight
    {"person_id": "P-C1", "name": "Vikram Rao", "dob": "1975-08-21", "community": "C", "org": "Lakeside Freight", "phone": "+91 90000 00301", "account": "ACC-DEMO-0301", "address": "2 Shore Drive, Demo District A"},
    {"person_id": "P-C2", "name": "Pooja Menon", "dob": "1989-02-17", "community": "C", "org": "Lakeside Freight", "phone": "+91 90000 00302", "account": "ACC-DEMO-0302", "address": "6 Shore Drive, Demo District A"},
    {"person_id": "P-C3", "name": "Harsh Chauhan", "dob": "1991-10-03", "community": "C", "org": "Lakeside Freight", "phone": "+91 90000 00303", "account": "ACC-DEMO-0303", "address": "40 Pier Road, Demo District A"},
    # bridge candidate
    {"person_id": "P-BR", "name": "Manish Tiwari", "dob": "1983-06-28", "community": "BRIDGE", "org": None, "phone": "+91 90000 00901", "account": "ACC-DEMO-0901", "address": "1 Junction Square, Demo District A"},
    # ambiguous pair — same name, different people
    {"person_id": "P-X1", "name": "Rahul Verma", "dob": "1988-03-03", "community": "A", "org": "Riverside Traders", "phone": "+91 90000 00105", "account": "ACC-DEMO-0105", "address": "30 Ghat Road, Demo District A"},
    {"person_id": "P-X2", "name": "Rahul Verma", "dob": "1970-12-30", "community": "B", "org": "Hilltop Logistics", "phone": "+91 90000 00205", "account": "ACC-DEMO-0205", "address": "77 Summit Avenue, Demo District B"},
    {'person_id': 'P-NEW0', 'name': 'Aryan Maharaj', 'dob': '1968-09-06', 'community': 'NEW', 'org': 'Chaudry Ltd', 'phone': '+91 9786579303', 'account': 'ACC-NEW-2824', 'address': 'H.No. 013, Tiwari Ganj, Kishanganj 863794'},
    {'person_id': 'P-NEW1', 'name': 'Nathaniel Sami', 'dob': '1973-09-26', 'community': 'NEW', 'org': 'Kale LLC', 'phone': '+91 9126855092', 'account': 'ACC-NEW-5506', 'address': '15, Lalla Path, Jaunpur 618495'},
    {'person_id': 'P-NEW2', 'name': 'Ekaraj Bath', 'dob': '1990-10-02', 'community': 'NEW', 'org': 'Buch-Kaul', 'phone': '+91 9362950628', 'account': 'ACC-NEW-4657', 'address': 'H.No. 75, Prabhakar Street, Bhagalpur 192832'},
    {'person_id': 'P-NEW3', 'name': 'Ladli Madan', 'dob': '2008-02-25', 'community': 'NEW', 'org': 'Kanda, Nair and Bhalla', 'phone': '+91 9249827706', 'account': 'ACC-NEW-2679', 'address': 'H.No. 64, Kakar Zila, Rajpur Sonarpur-672423'},
    {'person_id': 'P-NEW4', 'name': 'Priya Rastogi', 'dob': '1974-11-21', 'community': 'NEW', 'org': 'Upadhyay Group', 'phone': '+91 9826600539', 'account': 'ACC-NEW-9935', 'address': 'H.No. 226, Bhatt, Eluru 848018'},
    {'person_id': 'P-NEW5', 'name': 'Harini Choudhury', 'dob': '1971-04-05', 'community': 'NEW', 'org': 'Setty Inc', 'phone': '+91 9193349856', 'account': 'ACC-NEW-7912', 'address': '14/89, Dua Ganj, Nanded 957015'},
    {'person_id': 'P-NEW6', 'name': 'Wriddhish Bhardwaj', 'dob': '1968-06-21', 'community': 'NEW', 'org': 'Brar, Chada and Sunder', 'phone': '+91 9134126396', 'account': 'ACC-NEW-1488', 'address': '782, Wable Road, Rajpur Sonarpur 465787'},
    {'person_id': 'P-NEW7', 'name': 'Yug Kar', 'dob': '1959-02-05', 'community': 'NEW', 'org': 'Karpe PLC', 'phone': '+91 9200604502', 'account': 'ACC-NEW-4582', 'address': 'H.No. 031, Narayanan Nagar, Kottayam-473829'},
    {'person_id': 'P-NEW8', 'name': 'Xavier Solanki', 'dob': '1998-07-03', 'community': 'NEW', 'org': 'Chandra Inc', 'phone': '+91 9349817734', 'account': 'ACC-NEW-9279', 'address': '67, Chaudhari Nagar, Sambhal-133387'},
    {'person_id': 'P-NEW9', 'name': 'Pahal Goswami', 'dob': '1970-06-20', 'community': 'NEW', 'org': 'Borra Group', 'phone': '+91 9746412689', 'account': 'ACC-NEW-1434', 'address': '80/132, Sunder Marg, Kakinada 026064'},
    {'person_id': 'P-NEW10', 'name': 'Bhavika Sampath', 'dob': '1992-08-16', 'community': 'NEW', 'org': 'Sur, Dubey and Gupta', 'phone': '+91 9702632297', 'account': 'ACC-NEW-4257', 'address': 'H.No. 980, Bhandari Path, Bhimavaram 882081'},
    {'person_id': 'P-NEW11', 'name': 'Ekapad Bir', 'dob': '1991-06-29', 'community': 'NEW', 'org': 'Raval Inc', 'phone': '+91 9868820204', 'account': 'ACC-NEW-9928', 'address': '16/99, Mutti Circle, Kurnool-346247'},
    {'person_id': 'P-NEW12', 'name': 'Elijah Andra', 'dob': '1979-12-29', 'community': 'NEW', 'org': 'Chaudhry, Borah and Yogi', 'phone': '+91 9550455977', 'account': 'ACC-NEW-4611', 'address': '513, Mane Path, Bahraich-980841'},
    {'person_id': 'P-NEW13', 'name': 'Aishani D’Alia', 'dob': '2002-11-10', 'community': 'NEW', 'org': 'Dugal, Magar and Manda', 'phone': '+91 9582334538', 'account': 'ACC-NEW-5557', 'address': '487, Behl Road, Bhusawal-005242'},
    {'person_id': 'P-NEW14', 'name': 'Prisha Andra', 'dob': '1961-08-19', 'community': 'NEW', 'org': 'Dixit, Banik and Pingle', 'phone': '+91 9969119330', 'account': 'ACC-NEW-1106', 'address': '045, Parmar Nagar, Kulti-586923'},
    {'person_id': 'P-NEW15', 'name': 'Peter Sachar', 'dob': '1957-01-06', 'community': 'NEW', 'org': 'Natarajan, Sabharwal and Kothari', 'phone': '+91 9914763202', 'account': 'ACC-NEW-3615', 'address': '16/073, Sharma Ganj, Farrukhabad 303654'},
    {'person_id': 'P-NEW16', 'name': 'Arya Panchal', 'dob': '1989-09-14', 'community': 'NEW', 'org': 'Yadav-Narula', 'phone': '+91 9849621470', 'account': 'ACC-NEW-7924', 'address': 'H.No. 29, Barad Road, Kavali 556981'},
    {'person_id': 'P-NEW17', 'name': 'Ranveer Kumar', 'dob': '1958-01-21', 'community': 'NEW', 'org': 'Agarwal-Venkatesh', 'phone': '+91 9465341213', 'account': 'ACC-NEW-5552', 'address': '15, Murthy, Dewas-656482'},
    {'person_id': 'P-NEW18', 'name': 'Osha Raghavan', 'dob': '1991-08-09', 'community': 'NEW', 'org': 'Mitra Group', 'phone': '+91 9266944844', 'account': 'ACC-NEW-4527', 'address': 'H.No. 36, Nagy, Mango 387214'},
    {'person_id': 'P-NEW19', 'name': 'Girik Keer', 'dob': '1991-05-13', 'community': 'NEW', 'org': 'Issac and Sons', 'phone': '+91 9919795579', 'account': 'ACC-NEW-6514', 'address': '791, Sachdeva Chowk, Yamunanagar 632016'},
    {'person_id': 'P-NEW20', 'name': 'Patrick Vasa', 'dob': '1980-04-29', 'community': 'NEW', 'org': 'Krish, Dara and Shan', 'phone': '+91 9209747451', 'account': 'ACC-NEW-2519', 'address': '88/957, Thaman, Motihari-277434'},
    {'person_id': 'P-NEW21', 'name': 'William Maharaj', 'dob': '1979-01-07', 'community': 'NEW', 'org': 'Mangal, Keer and Magar', 'phone': '+91 9507943839', 'account': 'ACC-NEW-2584', 'address': '12/23, Dua Marg, Rajkot 658760'},
    {'person_id': 'P-NEW22', 'name': 'Osha Ramachandran', 'dob': '2003-08-30', 'community': 'NEW', 'org': 'Bahri, Rai and Sood', 'phone': '+91 9485451171', 'account': 'ACC-NEW-6635', 'address': 'H.No. 66, Kannan Circle, Muzaffarnagar 670656'},
    {'person_id': 'P-NEW23', 'name': 'Unni Datta', 'dob': '2007-09-07', 'community': 'NEW', 'org': 'Bala, Ramesh and Bala', 'phone': '+91 9748245888', 'account': 'ACC-NEW-5333', 'address': '720, Raghavan Road, Rajpur Sonarpur 556464'},
    {'person_id': 'P-NEW24', 'name': 'Upma Bahl', 'dob': '1995-05-28', 'community': 'NEW', 'org': 'Palla and Sons', 'phone': '+91 9966647391', 'account': 'ACC-NEW-1711', 'address': 'H.No. 330, Dua, Cuttack 193745'},
    {'person_id': 'P-NEW25', 'name': 'Ishwar Gade', 'dob': '2006-11-02', 'community': 'NEW', 'org': 'Bal LLC', 'phone': '+91 9883543540', 'account': 'ACC-NEW-8527', 'address': '31/931, Dara Road, Sri Ganganagar-518506'},
    {'person_id': 'P-NEW26', 'name': 'Hitesh Sant', 'dob': '2006-08-17', 'community': 'NEW', 'org': 'Sharaf, Dua and Saran', 'phone': '+91 9675770529', 'account': 'ACC-NEW-3045', 'address': '87/76, Loyal, Sambalpur-473799'},
    {'person_id': 'P-NEW27', 'name': 'Gayathri Balakrishnan', 'dob': '1981-11-26', 'community': 'NEW', 'org': 'Gopal-Sura', 'phone': '+91 9506448196', 'account': 'ACC-NEW-2291', 'address': 'H.No. 54, Majumdar, Hazaribagh-136783'},
    {'person_id': 'P-NEW28', 'name': 'Vritti Sem', 'dob': '1997-09-24', 'community': 'NEW', 'org': 'Menon and Sons', 'phone': '+91 9692749116', 'account': 'ACC-NEW-5803', 'address': 'H.No. 95, Wali Chowk, Khandwa-574443'},
    {'person_id': 'P-NEW29', 'name': 'Reyansh Mutti', 'dob': '1962-01-15', 'community': 'NEW', 'org': 'Goyal, Handa and Kalita', 'phone': '+91 9990566476', 'account': 'ACC-NEW-6925', 'address': '98/941, Minhas Ganj, Karimnagar-408240'},
    {'person_id': 'P-NEW30', 'name': 'Brinda Date', 'dob': '1989-07-06', 'community': 'NEW', 'org': 'Chauhan-Arora', 'phone': '+91 9719927151', 'account': 'ACC-NEW-4150', 'address': '75, Behl Street, Morena 167190'},
    {'person_id': 'P-NEW31', 'name': 'Manthan Modi', 'dob': '1960-03-21', 'community': 'NEW', 'org': 'Dani PLC', 'phone': '+91 9856528252', 'account': 'ACC-NEW-2139', 'address': '67/74, Sanghvi, Jehanabad-913341'},
    {'person_id': 'P-NEW32', 'name': 'Wriddhish Ghose', 'dob': '1984-12-17', 'community': 'NEW', 'org': 'Agate Group', 'phone': '+91 9149203558', 'account': 'ACC-NEW-4733', 'address': 'H.No. 03, Mandal Road, Madurai-493618'},
    {'person_id': 'P-NEW33', 'name': 'Manthan Lata', 'dob': '1999-07-08', 'community': 'NEW', 'org': 'Bhasin and Sons', 'phone': '+91 9930075810', 'account': 'ACC-NEW-5741', 'address': '17, Rau Road, Orai 719065'},
    {'person_id': 'P-NEW34', 'name': 'Atharv Chand', 'dob': '1967-11-02', 'community': 'NEW', 'org': 'Bail, Luthra and Baria', 'phone': '+91 9185675980', 'account': 'ACC-NEW-4814', 'address': '74/29, Swamy Marg, Nandyal-655125'},
    {'person_id': 'P-NEW35', 'name': 'Warhi Mani', 'dob': '1990-10-27', 'community': 'NEW', 'org': 'Bansal-Sha', 'phone': '+91 9208449460', 'account': 'ACC-NEW-7227', 'address': 'H.No. 51, Varkey Marg, Hosur 603859'},
    {'person_id': 'P-NEW36', 'name': 'Riya Behl', 'dob': '1966-06-29', 'community': 'NEW', 'org': 'Deep, Mani and Sarma', 'phone': '+91 9398471886', 'account': 'ACC-NEW-8428', 'address': 'H.No. 932, Atwal Road, Tiruchirappalli-171274'},
    {'person_id': 'P-NEW37', 'name': 'Ojasvi Subramanian', 'dob': '2007-08-29', 'community': 'NEW', 'org': 'Shan PLC', 'phone': '+91 9782560971', 'account': 'ACC-NEW-6977', 'address': '982, Majumdar Zila, Mau-044997'},
    {'person_id': 'P-NEW38', 'name': 'Sanya Yohannan', 'dob': '1981-05-17', 'community': 'NEW', 'org': 'Purohit-Shah', 'phone': '+91 9274648506', 'account': 'ACC-NEW-7065', 'address': '39/636, Nadkarni Nagar, Eluru 270289'},
    {'person_id': 'P-NEW39', 'name': 'Harish Sarraf', 'dob': '1960-12-27', 'community': 'NEW', 'org': 'Aurora-Dhawan', 'phone': '+91 9481469012', 'account': 'ACC-NEW-4432', 'address': 'H.No. 745, Rao, Ozhukarai-578091'},
    {'person_id': 'P-NEW40', 'name': 'Bhavna Karan', 'dob': '1995-04-14', 'community': 'NEW', 'org': 'Chaudhari-Chaudhry', 'phone': '+91 9819595113', 'account': 'ACC-NEW-5374', 'address': '40/050, Parmer Road, Chinsurah-386922'},
    {'person_id': 'P-NEW41', 'name': 'Farhan Raja', 'dob': '1988-07-19', 'community': 'NEW', 'org': 'Tank PLC', 'phone': '+91 9853573823', 'account': 'ACC-NEW-2169', 'address': '47, Andra Road, Tumkur-175946'},
    {'person_id': 'P-NEW42', 'name': 'Tanmayi Mittal', 'dob': '1966-04-06', 'community': 'NEW', 'org': 'Subramanian-Chhabra', 'phone': '+91 9754049436', 'account': 'ACC-NEW-3803', 'address': '59/44, Randhawa Nagar, Bangalore-974395'},
    {'person_id': 'P-NEW43', 'name': 'Ranveer Krishna', 'dob': '1991-08-17', 'community': 'NEW', 'org': 'Devan, Chatterjee and Baral', 'phone': '+91 9673528321', 'account': 'ACC-NEW-5010', 'address': 'H.No. 952, Merchant Zila, Vijayanagaram 328588'},
    {'person_id': 'P-NEW44', 'name': 'Nitesh Kurian', 'dob': '2004-02-25', 'community': 'NEW', 'org': 'Merchant-Nigam', 'phone': '+91 9275452091', 'account': 'ACC-NEW-8573', 'address': 'H.No. 236, Pau Circle, Tenali 481754'},
    {'person_id': 'P-NEW45', 'name': 'Kamya Chokshi', 'dob': '1991-06-22', 'community': 'NEW', 'org': 'Bakshi-Narang', 'phone': '+91 9507437181', 'account': 'ACC-NEW-5422', 'address': '74/612, Barad Nagar, Kumbakonam-138267'},
    {'person_id': 'P-NEW46', 'name': 'Oni Dubey', 'dob': '2002-08-19', 'community': 'NEW', 'org': 'Chaudhary, Suri and Reddy', 'phone': '+91 9787194506', 'account': 'ACC-NEW-4598', 'address': '53/773, Chaudhary Path, Tinsukia 064317'},
    {'person_id': 'P-NEW47', 'name': 'Simon Bail', 'dob': '1958-05-21', 'community': 'NEW', 'org': 'Kohli-Dass', 'phone': '+91 9835098955', 'account': 'ACC-NEW-6313', 'address': '39/33, Divan Path, Bally-284210'},
    {'person_id': 'P-NEW48', 'name': 'Alexander Parmar', 'dob': '1997-07-29', 'community': 'NEW', 'org': 'Naik Inc', 'phone': '+91 9924970419', 'account': 'ACC-NEW-1916', 'address': 'H.No. 268, Bhatt Zila, Sultan Pur Majra-891783'},
    {'person_id': 'P-NEW49', 'name': 'Charvi Shanker', 'dob': '1989-10-20', 'community': 'NEW', 'org': 'Bhat Group', 'phone': '+91 9345938494', 'account': 'ACC-NEW-1525', 'address': '17/711, Divan Path, Cuttack-998569'},
    {'person_id': 'P-NEW50', 'name': 'Sudiksha Tiwari', 'dob': '1987-10-17', 'community': 'NEW', 'org': 'Contractor Ltd', 'phone': '+91 9964411347', 'account': 'ACC-NEW-6168', 'address': '36, Setty Path, Vijayanagaram-565452'},
    {'person_id': 'P-NEW51', 'name': 'Ekalinga Chand', 'dob': '1999-10-16', 'community': 'NEW', 'org': 'Sankaran Inc', 'phone': '+91 9530747414', 'account': 'ACC-NEW-5386', 'address': '09/88, Das Path, Raichur 049451'},
    {'person_id': 'P-NEW52', 'name': 'Mohammed Subramaniam', 'dob': '1967-08-04', 'community': 'NEW', 'org': 'Palla PLC', 'phone': '+91 9171069472', 'account': 'ACC-NEW-4456', 'address': 'H.No. 93, Bal Marg, Bhopal 445502'},
    {'person_id': 'P-NEW53', 'name': 'Nandini Boase', 'dob': '1963-03-23', 'community': 'NEW', 'org': 'Balasubramanian, Chand and Wali', 'phone': '+91 9709004943', 'account': 'ACC-NEW-6155', 'address': '75, Pingle Street, Anantapur-022901'},
    {'person_id': 'P-NEW54', 'name': 'Saanvi Samra', 'dob': '1981-06-11', 'community': 'NEW', 'org': 'Sachdeva-Mahajan', 'phone': '+91 9328306011', 'account': 'ACC-NEW-9179', 'address': 'H.No. 61, Sur Road, Ranchi-690034'},
    {'person_id': 'P-NEW55', 'name': 'Laksh Kumer', 'dob': '1971-01-17', 'community': 'NEW', 'org': 'Amble Group', 'phone': '+91 9524806516', 'account': 'ACC-NEW-8517', 'address': '683, Pandya Circle, Sikar-607159'},
    {'person_id': 'P-NEW56', 'name': 'Nidhi Sahni', 'dob': '1971-01-18', 'community': 'NEW', 'org': 'Bail-Nair', 'phone': '+91 9253407200', 'account': 'ACC-NEW-5339', 'address': '51/613, Rattan Marg, Tenali-535218'},
    {'person_id': 'P-NEW57', 'name': 'Yashvi Hari', 'dob': '2003-09-20', 'community': 'NEW', 'org': 'Panchal-Divan', 'phone': '+91 9249926919', 'account': 'ACC-NEW-5040', 'address': '432, Dua, Belgaum-799799'},
    {'person_id': 'P-NEW58', 'name': 'Diya Dora', 'dob': '1979-01-05', 'community': 'NEW', 'org': 'Sathe-Mitter', 'phone': '+91 9899925830', 'account': 'ACC-NEW-9830', 'address': 'H.No. 81, Shenoy Road, Agra 541199'},
    {'person_id': 'P-NEW59', 'name': 'Turvi Barman', 'dob': '1979-07-17', 'community': 'NEW', 'org': 'Guha, Nagy and Soni', 'phone': '+91 9382116655', 'account': 'ACC-NEW-8019', 'address': '15, Thaman Zila, Thane-778892'},
    {'person_id': 'P-NEW60', 'name': 'Kashish Mandal', 'dob': '1976-03-27', 'community': 'NEW', 'org': 'Ben-Natt', 'phone': '+91 9726563708', 'account': 'ACC-NEW-7543', 'address': 'H.No. 864, Doctor Road, Jodhpur 546291'},
    {'person_id': 'P-NEW61', 'name': 'Krisha Narasimhan', 'dob': '1998-10-21', 'community': 'NEW', 'org': 'Vyas, Chander and Sampath', 'phone': '+91 9488690725', 'account': 'ACC-NEW-4593', 'address': 'H.No. 42, Om Ganj, Nellore 221418'},
    {'person_id': 'P-NEW62', 'name': 'Gayathri Deep', 'dob': '1987-05-12', 'community': 'NEW', 'org': 'Gaba and Sons', 'phone': '+91 9248532577', 'account': 'ACC-NEW-9348', 'address': 'H.No. 653, Mane Chowk, Muzaffarpur-473597'},
    {'person_id': 'P-NEW63', 'name': 'Baghyawati Raja', 'dob': '1982-05-11', 'community': 'NEW', 'org': 'Edwin-Iyengar', 'phone': '+91 9629908599', 'account': 'ACC-NEW-2489', 'address': 'H.No. 758, Varty Zila, Anantapuram-247826'},
    {'person_id': 'P-NEW64', 'name': 'Tristan Seshadri', 'dob': '2002-08-04', 'community': 'NEW', 'org': 'Sachdeva Inc', 'phone': '+91 9911514914', 'account': 'ACC-NEW-1771', 'address': '615, Bala Ganj, Navi Mumbai-220472'},
    {'person_id': 'P-NEW65', 'name': 'Saumya Ahluwalia', 'dob': '2003-09-19', 'community': 'NEW', 'org': 'Kunda and Sons', 'phone': '+91 9217734861', 'account': 'ACC-NEW-3504', 'address': 'H.No. 434, Batta Zila, Gurgaon-117980'},
    {'person_id': 'P-NEW66', 'name': 'Maanas Manne', 'dob': '1978-06-15', 'community': 'NEW', 'org': 'Pandit, Khosla and Saha', 'phone': '+91 9773715057', 'account': 'ACC-NEW-3621', 'address': '51/88, Tripathi Circle, Pali-065405'},
    {'person_id': 'P-NEW67', 'name': 'Hemani Khosla', 'dob': '1994-07-21', 'community': 'NEW', 'org': 'Chawla, Natarajan and Deol', 'phone': '+91 9950488739', 'account': 'ACC-NEW-7916', 'address': '52/77, Deshmukh Street, Berhampore 430305'},
    {'person_id': 'P-NEW68', 'name': 'Yutika Rao', 'dob': '2008-02-17', 'community': 'NEW', 'org': 'Solanki, Kulkarni and Bansal', 'phone': '+91 9740389325', 'account': 'ACC-NEW-2040', 'address': 'H.No. 05, Dash Road, Junagadh-765277'},
    {'person_id': 'P-NEW69', 'name': 'Zilmil Loke', 'dob': '1998-03-02', 'community': 'NEW', 'org': 'Samra, Brar and Sani', 'phone': '+91 9513140753', 'account': 'ACC-NEW-7252', 'address': 'H.No. 11, Merchant Path, Amroha-275705'},
    {'person_id': 'P-NEW70', 'name': 'Anvi Bhandari', 'dob': '1959-09-06', 'community': 'NEW', 'org': 'Ravi, Patla and Varghese', 'phone': '+91 9739830322', 'account': 'ACC-NEW-8668', 'address': '970, Bhavsar Street, Ambarnath-690927'},
    {'person_id': 'P-NEW71', 'name': 'Kamya Sawhney', 'dob': '1996-02-24', 'community': 'NEW', 'org': 'Devan, Wagle and Peri', 'phone': '+91 9668132202', 'account': 'ACC-NEW-5119', 'address': '43/102, Vasa Chowk, Kishanganj-447394'},
    {'person_id': 'P-NEW72', 'name': 'Ryan Das', 'dob': '1962-11-24', 'community': 'NEW', 'org': 'Seth and Sons', 'phone': '+91 9694021782', 'account': 'ACC-NEW-1188', 'address': '55/188, Mital Road, Akola-831323'},
    {'person_id': 'P-NEW73', 'name': 'Atharv Patel', 'dob': '1985-01-25', 'community': 'NEW', 'org': 'Sibal-Dayal', 'phone': '+91 9830448745', 'account': 'ACC-NEW-2876', 'address': 'H.No. 67, Roy Circle, Ramgarh 251778'},
    {'person_id': 'P-NEW74', 'name': 'Kabir Gopal', 'dob': '1996-05-25', 'community': 'NEW', 'org': 'Sant PLC', 'phone': '+91 9831980933', 'account': 'ACC-NEW-9797', 'address': '24/22, Kar Path, Kadapa 143842'},
    {'person_id': 'P-NEW75', 'name': 'Girik Thakkar', 'dob': '1989-09-04', 'community': 'NEW', 'org': 'Dube, Garg and Nazareth', 'phone': '+91 9906248900', 'account': 'ACC-NEW-5371', 'address': 'H.No. 094, Saha Ganj, Mehsana 473647'},
    {'person_id': 'P-NEW76', 'name': 'Darpan Dugar', 'dob': '1979-01-02', 'community': 'NEW', 'org': 'Shetty-Jani', 'phone': '+91 9925276600', 'account': 'ACC-NEW-6573', 'address': 'H.No. 55, De Marg, Kottayam 537147'},
    {'person_id': 'P-NEW77', 'name': 'Lohit Chatterjee', 'dob': '1958-05-21', 'community': 'NEW', 'org': 'Sahota-Kothari', 'phone': '+91 9219778234', 'account': 'ACC-NEW-5808', 'address': '53/27, Sibal Circle, Aizawl-016873'},
    {'person_id': 'P-NEW78', 'name': 'Ira Bava', 'dob': '1958-05-20', 'community': 'NEW', 'org': 'Singhal-Mangal', 'phone': '+91 9566825638', 'account': 'ACC-NEW-3591', 'address': '24, Rau Path, Ranchi 098358'},
    {'person_id': 'P-NEW79', 'name': 'Ethan Raju', 'dob': '1982-06-06', 'community': 'NEW', 'org': 'Mammen, Dani and Dave', 'phone': '+91 9587182120', 'account': 'ACC-NEW-1053', 'address': 'H.No. 58, Dhawan Path, Madanapalle 800025'},
    {'person_id': 'P-NEW80', 'name': 'Zilmil Shan', 'dob': '1963-08-07', 'community': 'NEW', 'org': 'Dey, Narang and Nagar', 'phone': '+91 9875340444', 'account': 'ACC-NEW-5315', 'address': '49/58, Walia Circle, Phusro-705516'},
    {'person_id': 'P-NEW81', 'name': 'Avi Som', 'dob': '1969-10-11', 'community': 'NEW', 'org': 'Kari, Behl and Srinivasan', 'phone': '+91 9637500247', 'account': 'ACC-NEW-3927', 'address': '309, Halder Zila, Gandhidham-626368'},
    {'person_id': 'P-NEW82', 'name': 'David Devi', 'dob': '1983-03-13', 'community': 'NEW', 'org': 'Nair, Sridhar and Vora', 'phone': '+91 9645119047', 'account': 'ACC-NEW-2743', 'address': '785, Pandya Circle, Phagwara-334843'},
    {'person_id': 'P-NEW83', 'name': 'Bhavya Johal', 'dob': '1992-04-15', 'community': 'NEW', 'org': 'Nadig-Srinivasan', 'phone': '+91 9771410971', 'account': 'ACC-NEW-5889', 'address': 'H.No. 19, Raghavan Circle, Hapur 404157'},
    {'person_id': 'P-NEW84', 'name': 'Varenya Kala', 'dob': '1966-05-31', 'community': 'NEW', 'org': 'Madan, Magar and Devan', 'phone': '+91 9786066793', 'account': 'ACC-NEW-9317', 'address': '083, Ben Ganj, Haridwar 712082'},
    {'person_id': 'P-NEW85', 'name': 'Vamakshi Sood', 'dob': '1990-03-08', 'community': 'NEW', 'org': 'Nagi-Mangal', 'phone': '+91 9753876785', 'account': 'ACC-NEW-4258', 'address': '93/802, Goda Marg, Sikar 240049'},
    {'person_id': 'P-NEW86', 'name': 'Gautami Mane', 'dob': '1979-10-14', 'community': 'NEW', 'org': 'Viswanathan, Tak and Desai', 'phone': '+91 9264109919', 'account': 'ACC-NEW-7126', 'address': '152, Kurian Chowk, Kanpur-493296'},
    {'person_id': 'P-NEW87', 'name': 'Yutika Narang', 'dob': '1960-04-20', 'community': 'NEW', 'org': 'Chandran, Goyal and Dey', 'phone': '+91 9918739736', 'account': 'ACC-NEW-3646', 'address': '046, Sekhon Ganj, Ozhukarai-990453'},
    {'person_id': 'P-NEW88', 'name': 'Jagat Shroff', 'dob': '1971-12-19', 'community': 'NEW', 'org': 'Thakkar-Mukhopadhyay', 'phone': '+91 9679153816', 'account': 'ACC-NEW-9689', 'address': 'H.No. 93, Deol Ganj, Jamnagar 956878'},
    {'person_id': 'P-NEW89', 'name': 'Yug Bumb', 'dob': '1983-07-23', 'community': 'NEW', 'org': 'Pathak, Brahmbhatt and Choudhury', 'phone': '+91 9100614068', 'account': 'ACC-NEW-6310', 'address': '82/25, Sathe Circle, Tiruppur 187072'},
    {'person_id': 'P-NEW90', 'name': 'Tanmayi Bhardwaj', 'dob': '1985-04-27', 'community': 'NEW', 'org': 'Morar, Bains and Randhawa', 'phone': '+91 9624636385', 'account': 'ACC-NEW-1319', 'address': '39/106, Bhatt Path, Coimbatore 046226'},
    {'person_id': 'P-NEW91', 'name': 'Lavanya Sen', 'dob': '2001-10-17', 'community': 'NEW', 'org': 'Prashad-Buch', 'phone': '+91 9220117054', 'account': 'ACC-NEW-6947', 'address': 'H.No. 286, Datta Circle, Delhi-478686'},
    {'person_id': 'P-NEW92', 'name': 'Yug Sharma', 'dob': '1974-01-19', 'community': 'NEW', 'org': 'Gulati-Chowdhury', 'phone': '+91 9992994062', 'account': 'ACC-NEW-6038', 'address': '03/31, Bandi Zila, Khora  306738'},
    {'person_id': 'P-NEW93', 'name': 'Daksh Dey', 'dob': '1982-05-30', 'community': 'NEW', 'org': 'Kaur-Nagar', 'phone': '+91 9357109965', 'account': 'ACC-NEW-1949', 'address': 'H.No. 28, Sachdev Ganj, Panipat 892687'},
    {'person_id': 'P-NEW94', 'name': 'Hemangini Raj', 'dob': '1997-05-09', 'community': 'NEW', 'org': 'Saha-Rege', 'phone': '+91 9358633898', 'account': 'ACC-NEW-2290', 'address': '28, Khosla Chowk, Dewas-708668'},
    {'person_id': 'P-NEW95', 'name': 'Lipika Kibe', 'dob': '1969-03-21', 'community': 'NEW', 'org': 'Brar-Sengupta', 'phone': '+91 9191969690', 'account': 'ACC-NEW-8962', 'address': '30/46, Baral, Maheshtala 735403'},
    {'person_id': 'P-NEW96', 'name': 'Jacob Srinivas', 'dob': '2004-03-03', 'community': 'NEW', 'org': 'Jayaraman, Ranganathan and Khatri', 'phone': '+91 9976198296', 'account': 'ACC-NEW-2133', 'address': '78, Morar Path, Karimnagar 717535'},
    {'person_id': 'P-NEW97', 'name': 'Odika Bath', 'dob': '1985-07-08', 'community': 'NEW', 'org': 'Dhingra Inc', 'phone': '+91 9916690353', 'account': 'ACC-NEW-9727', 'address': 'H.No. 23, Karpe Path, Jehanabad 785477'},
    {'person_id': 'P-NEW98', 'name': 'Om Pandey', 'dob': '1964-09-03', 'community': 'NEW', 'org': 'Suresh, Gour and Bhargava', 'phone': '+91 9922308461', 'account': 'ACC-NEW-3060', 'address': '00/623, Dora Zila, Bellary 509977'},
    {'person_id': 'P-NEW99', 'name': 'Abeer Wali', 'dob': '1984-12-10', 'community': 'NEW', 'org': 'Badal PLC', 'phone': '+91 9237859287', 'account': 'ACC-NEW-8787', 'address': 'H.No. 862, Char Zila, New Delhi 984546'},
]

ALIASES = [
    {"alias_id": "AL-001", "person_id": "P-A1", "alias": "A. Malhotra", "source": "people.json"},
    {"alias_id": "AL-002", "person_id": "P-BR", "alias": "M. Tiwari", "source": "people.json"},
    {"alias_id": "AL-003", "person_id": "P-C1", "alias": "V. Rao", "source": "people.json"},
]

PH = {p["person_id"]: p["phone"] for p in PEOPLE}
AC = {p["person_id"]: p["account"] for p in PEOPLE}
CELL = {"A": "TWR-A-01", "B": "TWR-B-01", "C": "TWR-C-01", "BRIDGE": "TWR-A-02"}
COMM = {p["person_id"]: p["community"] for p in PEOPLE}

# --------------------------------------------------------------------------- calls
def ts(base: datetime, **kw) -> str:
    return (base + timedelta(**kw)).strftime("%Y-%m-%d %H:%M:%S")

base = datetime(2025, 6, 10, 9, 0, 0)
calls: list[dict] = []
cid = 0

def add_call(a: str, b: str, when: str, dur: int, cell: str | None = None):
    global cid
    cid += 1
    calls.append({
        "call_id": f"CALL-{cid:04d}",
        "caller": PH[a],
        "callee": PH[b],
        "start_time": when,
        "duration_sec": dur,
        "cell_id": cell or CELL[COMM[a]],
    })

groups = {"A": ["P-A1", "P-A2", "P-A3", "P-A4", "P-X1"], "B": ["P-B1", "P-B2", "P-B3", "P-B4", "P-X2"], "C": ["P-C1", "P-C2", "P-C3"]}
for g, members in groups.items():
    for _ in range(18):
        a, b = random.sample(members, 2)
        add_call(a, b, ts(base, days=random.randint(0, 40), hours=random.randint(0, 12), minutes=random.randint(0, 59)), random.randint(20, 900))
# bridge candidate talks to every community (moderate volume)
for target in ["P-A1", "P-A3", "P-B2", "P-C1", "P-C2"]:
    for _ in range(3):
        add_call("P-BR", target, ts(base, days=random.randint(0, 40), hours=random.randint(0, 12)), random.randint(30, 400), "TWR-A-02")
# communication burst: P-BR → P-B1, 12 calls inside two hours on 2025-07-02
burst_base = datetime(2025, 7, 2, 21, 0, 0)
for i in range(12):
    add_call("P-BR", "P-B1", ts(burst_base, minutes=i * 9), random.randint(15, 90), "TWR-A-02")
# historical relationship: P-A1 ↔ P-C1 in 2019 only
for i in range(4):
    add_call("P-A1", "P-C1", ts(datetime(2019, 3, 4, 10, 0, 0), days=i * 7), random.randint(60, 300))
calls.sort(key=lambda c: c["start_time"])

# --------------------------------------------------------------------------- transactions
transactions: list[dict] = []
tid = 0

def add_tx(src: str, dst: str, when: str, amount, ref: str):
    global tid
    tid += 1
    transactions.append({
        "txn_id": f"TXN-{tid:04d}",
        "from_account": AC[src],
        "to_account": AC[dst],
        "amount_inr": amount,
        "timestamp": when,
        "reference": ref,
    })

for g, members in groups.items():
    for _ in range(8):
        a, b = random.sample(members, 2)
        add_tx(a, b, ts(base, days=random.randint(0, 45)), random.choice([1500, 2500, 4000, 7200, 12000]), "supply invoice")
# fan-in: five accounts pay P-C1 within three days
for src in ["P-A2", "P-B2", "P-B3", "P-BR", "P-C3"]:
    add_tx(src, "P-C1", ts(datetime(2025, 7, 20, 11, 0, 0), days=random.randint(0, 2)), 25000, "consolidated freight")
# bridge to community C
add_tx("P-BR", "P-C2", ts(base, days=12), 9800, "advance")
# missing amount field
add_tx("P-A4", "P-A1", ts(base, days=30), "", "amount missing in source")
transactions.sort(key=lambda t: t["timestamp"])

# a second case whose records mention the bridge candidate's account → cross-case appearance
transactions_case2 = [
    {"txn_id": "TXN2-0001", "from_account": AC["P-BR"], "to_account": AC["P-C3"], "amount_inr": 6100, "timestamp": ts(datetime(2025, 8, 3, 10, 0, 0)), "reference": "invoice 2207"},
    {"txn_id": "TXN2-0002", "from_account": AC["P-C3"], "to_account": AC["P-C1"], "amount_inr": 5900, "timestamp": ts(datetime(2025, 8, 4, 10, 0, 0)), "reference": "invoice 2207 settlement"},
    {"txn_id": "TXN2-0003", "from_account": AC["P-BR"], "to_account": AC["P-C1"], "amount_inr": 14000, "timestamp": ts(datetime(2025, 8, 9, 10, 0, 0)), "reference": "invoice 2231"},
]

# --------------------------------------------------------------------------- locations
locations = []
sites = {
    "TWR-A-01": ("Ghat Road Tower", 18.5201, 73.8563),
    "TWR-A-02": ("Junction Square Tower", 18.5290, 73.8610),
    "TWR-B-01": ("Summit Avenue Tower", 18.5601, 73.9010),
    "TWR-C-01": ("Shore Drive Tower", 18.5010, 73.8200),
}
for cell, (name, lat, lon) in sites.items():
    locations.append({"location_id": cell, "name": name, "lat": lat, "lon": lon, "kind": "cell_tower"})
locations.append({"location_id": "LOC-WH-01", "name": "River Bridge Warehouse", "lat": 18.5305, "lon": 73.8650, "kind": "warehouse"})

# --------------------------------------------------------------------------- vehicles
vehicles = [
    {"vehicle_id": "VH-001", "registration": "DD01 AB 1234", "owner_person_id": "P-A2", "owner_name": "Kavya Iyer", "type": "pickup"},  # FIR says P-A3 → contradiction
    {"vehicle_id": "VH-002", "registration": "DD02 CD 5678", "owner_person_id": "P-B2", "owner_name": "Sameer Qureshi", "type": "truck"},
    {"vehicle_id": "VH-003", "registration": "DD01 EF 9012", "owner_person_id": "P-BR", "owner_name": "Manish Tiwari", "type": "van"},
]

# --------------------------------------------------------------------------- FIR document
FIR_TEXT = """DEMO DISTRICT A POLICE (FICTIONAL) - FIRST INFORMATION REPORT (SYNTHETIC DEMO)
FIR No: FIR-DEMO-001            Case Ref: CASE-0001            Date: 2025-06-09
Classification: SYNTHETIC_DEMO. All persons, places, numbers and events are fictional.

1. Complainant
   Name: Pooja Menon (Lakeside Freight), Phone: +91 90000 00302

2. Summary of complaint
   The complainant states that on 2025-06-08 a consignment was diverted at the River Bridge
   Warehouse. A pickup vehicle bearing registration DD01 AB 1234, said to belong to
   Rohan Deshpande of Riverside Traders, was seen at the warehouse at approximately 22:30.

3. Persons named
   Arjun Malhotara, Riverside Traders, contact +91 90000 00101 (spelling as given by complainant)
   Rohan Deshpande, Riverside Traders, contact +91 90000 00103
   Manish Tiwari, no organisation stated, contact +91 90000 00901
   Rahul Verma, contact not provided, believed associated with Riverside Traders

4. Organisations named
   Riverside Traders; Lakeside Freight; Hilltop Logistics (mentioned by complainant as supplier)

5. Locations
   River Bridge Warehouse; Junction Square

6. Notes
   Complainant could not confirm the date of birth or address of Rahul Verma.
   A payment reference ACC-DEMO-0901 to ACC-DEMO-0302 was mentioned (amount not stated).
"""


def write_pdf(path: Path, text: str) -> None:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 50
    c.setFont("Courier", 9)
    for line in text.splitlines():
        if y < 50:
            c.showPage()
            c.setFont("Courier", 9)
            y = height - 50
        c.drawString(40, y, line)
        y -= 12
    c.save()


# --------------------------------------------------------------------------- truth labels
TRUTH = {
    "communities": {g: m for g, m in groups.items()},
    "bridge_candidate": "P-BR",
    "identity_pairs": [
        {"left": "Arjun Malhotra (people.json)", "right": "Arjun Malhotara (fir_001.pdf)", "same_entity": True, "expected_decision": "APPROVE", "reason": "spelling variation, same phone, same organisation"},
        {"left": "Rahul Verma (P-X1)", "right": "Rahul Verma (P-X2)", "same_entity": False, "expected_decision": "REJECT", "reason": "same name, conflicting DOB, address and district"},
        {"left": "Tanvi Bhatt (P-B3)", "right": "Imran Shaikh (P-B4)", "same_entity": False, "expected_decision": "DEFER", "reason": "shared phone +91 90000 00203 only; no person-level evidence"},
    ],
    "contradictions": [
        {"subject": "DD01 AB 1234", "attribute": "owner", "source_a": "vehicles.csv → Kavya Iyer (P-A2)", "source_b": "fir_001.pdf → Rohan Deshpande (P-A3)"}
    ],
    "missing_fields": [{"record": "transactions.csv", "field": "amount_inr", "txn": "TXN with reference 'amount missing in source'"}],
    "historical_relationships": [{"pair": ["P-A1", "P-C1"], "kind": "CALLED", "years": [2019], "note": "no contact after 2019; should render as historical"}],
    "rule_candidates": [
        {"rule": "communication_burst", "subject": "P-BR → P-B1", "window": "2025-07-02 21:00–23:00", "count": 12},
        {"rule": "transaction_fan_in", "subject": "ACC-DEMO-0301 (P-C1)", "window": "2025-07-20..2025-07-22", "sources": 5},
    ],
    "masked_fields": ["phone", "account"],
    "unauthorized_user": "outsider",
}



def write_dataset(out_dir: Path, p_list, c_list, t_list, tc2_list, a_list) -> None:
    docs_dir = out_dir / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "cases.json").write_text(json.dumps(CASES, indent=2))
    (out_dir / "people.json").write_text(json.dumps(p_list, indent=2))
    (out_dir / "aliases.json").write_text(json.dumps(a_list, indent=2))
    for name, rows in [("calls.csv", c_list), ("transactions.csv", t_list), ("locations.csv", locations), ("vehicles.csv", vehicles), ("transactions_case2.csv", tc2_list)]:
        with (out_dir / name).open("w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    (docs_dir / "fir_001.txt").write_text(FIR_TEXT)
    write_pdf(docs_dir / "fir_001.pdf", FIR_TEXT)
    (docs_dir / "fir_001_TAMPERED.txt").write_text(FIR_TEXT.replace("22:30", "02:30"))
    eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    (docs_dir / "eicar_test.txt").write_text(eicar)
    (out_dir / "truth-labels.json").write_text(json.dumps(TRUTH, indent=2))
    print(f"wrote synthetic dataset to {out_dir.name}: {len(p_list)} people, {len(c_list)} calls, {len(t_list)} transactions, {len(vehicles)} vehicles")

def main() -> None:
    # Golden dataset (no augmentations)
    golden_dir = ROOT / "golden"
    golden_dir.mkdir(parents=True, exist_ok=True)
    
    # Store golden copies
    golden_people = [p for p in PEOPLE if not p["person_id"].startswith("P-NEW")]
    golden_calls = list(calls)
    golden_tx = list(transactions)
    
    write_dataset(golden_dir, golden_people, golden_calls, golden_tx, transactions_case2, ALIASES)
    
    # Augmented Logic for scale
    scale_dir = ROOT / "scale"
    scale_dir.mkdir(parents=True, exist_ok=True)
    
    new_pids = [p["person_id"] for p in PEOPLE if p["person_id"].startswith("P-NEW")]
    for p in PEOPLE:
        PH[p["person_id"]] = p["phone"]
        AC[p["person_id"]] = p["account"]
        COMM[p["person_id"]] = p["community"]
    CELL["NEW"] = "TWR-NEW-01"
    
    base_aug = datetime(2025, 7, 1, 9, 0, 0)
    for _ in range(500):
        a, b = random.sample(new_pids, 2)
        add_call(a, b, ts(base_aug, days=random.randint(0, 40), hours=random.randint(0, 12)), random.randint(20, 900), "TWR-NEW-01")
        
    for _ in range(300):
        a, b = random.sample(new_pids, 2)
        add_tx(a, b, ts(base_aug, days=random.randint(0, 40), hours=random.randint(0, 12)), random.randint(100, 100000) * 10, "INV-NEW")
        
    write_dataset(scale_dir, PEOPLE, calls, transactions, transactions_case2, ALIASES)

if __name__ == "__main__":
    main()
