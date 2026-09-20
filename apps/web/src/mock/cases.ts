import type { CaseDetail, CaseSummary } from "@/types/case";
import {
  MOCK_CASE_ID,
  MOCK_CASE_TITLE,
  MOCK_ENTITIES,
  MOCK_RELATIONSHIPS,
  MOCK_PROVENANCE_RECORDS,
} from "./caseGraphData";

export const MOCK_CASE_STATS = {
  totalEntities: MOCK_ENTITIES.length, // 16
  totalRelationships: MOCK_RELATIONSHIPS.length, // 20
  totalEvidence: Object.keys(MOCK_PROVENANCE_RECORDS).length, // 3
  contradictionsCount: MOCK_RELATIONSHIPS.filter((r) => r.hasContradiction).length, // 1
  highestTier: 6 as const,
  activeAlerts: 2,
  notesCount: 6,
  pendingTasks: 3,
};

export const MOCK_CASE_DETAIL: CaseDetail = {
  id: MOCK_CASE_ID,
  caseNumber: MOCK_CASE_ID,
  title: MOCK_CASE_TITLE,
  description:
    "Organized interstate syndicate running systematic extortion and money laundering targeting infrastructure contractors in Rajasthan and NCR. Operations involve VoIP spoofing, forged SIM distribution, and layering via bullion shell companies.",
  status: "ACTIVE",
  priority: "CRITICAL",
  classification: "LAW_ENFORCEMENT_SENSITIVE",
  jurisdiction: "RAJ / JAIPUR DISTRICT",
  firNumber: "FIR No. 42/2026, PS Mansarovar, Jaipur Commissionerate",
  policeStation: "Mansarovar Police Station, Jaipur Commissionerate",
  incidentDate: "2026-02-14T10:15:22Z",
  registeredDate: "2026-02-14T12:30:00Z",
  lastUpdated: "2026-02-24T18:45:00Z",
  actsAndSections: [
    "Sec 308(2) BNS 2023 (Extortion)",
    "Sec 61(2) BNS 2023 (Criminal Conspiracy)",
    "Sec 106 BNSS 2023 (Attachment of Proceeds of Crime)",
    "Sec 66D IT Act 2000 (Cheating by Personation using Computer Resource)",
  ],
  leadInvestigator: {
    badgeNumber: "USR-9921",
    name: "Insp. V. Rathore",
    role: "Lead Investigating Officer",
    contact: "sog-jaipur-cell@rajpolice.gov.in",
  },
  assignedTeam: [
    {
      badgeNumber: "USR-9921",
      name: "Insp. V. Rathore",
      role: "Lead Investigating Officer",
    },
    {
      badgeNumber: "USR-7712",
      name: "Sub-Insp. K. L. Meena",
      role: "Digital Forensics & Ingestion Specialist",
    },
    {
      badgeNumber: "USR-8840",
      name: "DySP S. C. Verma",
      role: "Supervisory Officer / Gazetted Signoff",
    },
  ],
  summaryNarrative:
    "On 14 Feb 2026, complainant Rajesh Rathore (MD, Rathore Infraworks) received an encrypted VoIP extortion demand for ₹2.5 Crore threatening violence. Interception and CDR analysis identified caller Vikram Sharma operating a Realme burner handset with forged SIM activated at Apex Telecom Mansarovar. Financial tracing surfaced laundering shell company Marwar Gold Trading LLC and Hawala operator Arvind Meena. A critical spatio-temporal contradiction between an Airtel tower ping and an NHAI toll camera in Gurugram remains pending IO arbitration.",
  tags: [
    "EXTORTION",
    "HAWALA",
    "ORGANIZED_CRIME",
    "VOIP_SPOOFING",
    "MONEY_LAUNDERING",
  ],
  stats: MOCK_CASE_STATS,
};

export const MOCK_CASES_LIST: CaseSummary[] = [
  MOCK_CASE_DETAIL,
  {
    id: "DR-2026-00388",
    caseNumber: "DR-2026-00388",
    title: "NCR Fake Stamp Paper Syndicate",
    description:
      "Counterfeit revenue stamp papers circulating across revenue registries in Alwar, Bharatpur, and Gurugram.",
    status: "UNDER_REVIEW",
    priority: "HIGH",
    classification: "CONFIDENTIAL",
    jurisdiction: "RAJ / ALWAR DISTRICT",
    leadInvestigator: {
      badgeNumber: "USR-7712",
      name: "Sub-Insp. K. L. Meena",
      role: "Lead Investigating Officer",
    },
    registeredDate: "2026-01-18T09:00:00Z",
    lastUpdated: "2026-02-15T16:20:00Z",
    stats: {
      totalEntities: 9,
      totalRelationships: 11,
      totalEvidence: 4,
      contradictionsCount: 0,
      highestTier: 5,
      activeAlerts: 0,
      notesCount: 3,
      pendingTasks: 1,
    },
  },
  {
    id: "DR-2025-00912",
    caseNumber: "DR-2025-00912",
    title: "Phishing Infrastructure Operation Falcon",
    description:
      "Network of fake banking customer care numbers and SMS gateway hijacking based out of Mewat region.",
    status: "CLOSED",
    priority: "MEDIUM",
    classification: "RESTRICTED",
    jurisdiction: "RAJ / BHARATPUR DISTRICT",
    leadInvestigator: {
      badgeNumber: "USR-9921",
      name: "Insp. V. Rathore",
      role: "Supervisory Reviewer",
    },
    registeredDate: "2025-11-04T11:30:00Z",
    lastUpdated: "2026-01-10T14:00:00Z",
    stats: {
      totalEntities: 14,
      totalRelationships: 18,
      totalEvidence: 8,
      contradictionsCount: 0,
      highestTier: 6,
      activeAlerts: 0,
      notesCount: 12,
      pendingTasks: 0,
    },
  },
];
