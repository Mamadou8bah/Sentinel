import type {
  AuditLog,
  CaseDecision,
  CaseResponse,
  CaseStatus,
  CustomerDetail,
  CustomerSummary,
  DocumentResponse,
  DocumentType,
  FraudTrend,
  KycStatus,
  RiskSettings,
  SignatureMatchStatus,
  TxHistoryItem,
  TxScoreResponse,
  WebhookSettings,
} from '../types'

const now = () => new Date().toISOString()
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysAgo = (d: number) => hoursAgo(d * 24)

type SeedCustomer = {
  id: number
  name: string
  externalCustomerId: string
  dob: string
  idMasked: string
  kycStatus: KycStatus
  riskScore: number
  hasSpecimen: boolean
  faceMatch: number
  liveness: number
  createdHoursAgo: number
}

const SEED: SeedCustomer[] = [
  { id: 1, name: 'Awa Jallow', externalCustomerId: 'bank-core-1001', dob: '1994-03-12', idMasked: '••••-4821', kycStatus: 'FLAGGED', riskScore: 82, hasSpecimen: false, faceMatch: 0.62, liveness: 0.71, createdHoursAgo: 40 },
  { id: 2, name: 'Omar Ceesay', externalCustomerId: 'bank-core-1002', dob: '1988-11-02', idMasked: '••••-1190', kycStatus: 'VERIFIED', riskScore: 71, hasSpecimen: false, faceMatch: 0.91, liveness: 0.88, createdHoursAgo: 90 },
  { id: 3, name: 'Fatou Bah', externalCustomerId: 'bank-core-1003', dob: '1991-07-21', idMasked: '••••-3344', kycStatus: 'VERIFIED', riskScore: 48, hasSpecimen: true, faceMatch: 0.94, liveness: 0.92, createdHoursAgo: 120 },
  { id: 4, name: 'Lamin Sowe', externalCustomerId: 'bank-core-1004', dob: '1985-01-18', idMasked: '••••-7712', kycStatus: 'REJECTED', riskScore: 91, hasSpecimen: false, faceMatch: 0.41, liveness: 0.38, createdHoursAgo: 18 },
  { id: 5, name: 'Mariama Touray', externalCustomerId: 'bank-core-1005', dob: '1996-09-04', idMasked: '••••-5520', kycStatus: 'VERIFIED', riskScore: 33, hasSpecimen: true, faceMatch: 0.96, liveness: 0.95, createdHoursAgo: 200 },
  { id: 6, name: 'Ebrima Manneh', externalCustomerId: 'bank-core-1006', dob: '1979-05-30', idMasked: '••••-9088', kycStatus: 'FLAGGED', riskScore: 76, hasSpecimen: true, faceMatch: 0.74, liveness: 0.69, createdHoursAgo: 55 },
  { id: 7, name: 'Isatou Camara', externalCustomerId: 'bank-core-1007', dob: '1993-12-11', idMasked: '••••-2145', kycStatus: 'PENDING', riskScore: 58, hasSpecimen: false, faceMatch: 0.79, liveness: 0.81, createdHoursAgo: 6 },
  { id: 8, name: 'Yankuba Darboe', externalCustomerId: 'bank-core-1008', dob: '1990-02-27', idMasked: '••••-6631', kycStatus: 'VERIFIED', riskScore: 52, hasSpecimen: true, faceMatch: 0.89, liveness: 0.9, createdHoursAgo: 150 },
  { id: 9, name: 'Haddy Njie', externalCustomerId: 'bank-core-1009', dob: '1998-08-14', idMasked: '••••-4402', kycStatus: 'VERIFIED', riskScore: 29, hasSpecimen: true, faceMatch: 0.97, liveness: 0.94, createdHoursAgo: 300 },
  { id: 10, name: 'Buba Sanneh', externalCustomerId: 'bank-core-1010', dob: '1982-04-09', idMasked: '••••-1887', kycStatus: 'FLAGGED', riskScore: 68, hasSpecimen: false, faceMatch: 0.77, liveness: 0.72, createdHoursAgo: 72 },
  { id: 11, name: 'Kaddy Jammeh', externalCustomerId: 'bank-core-1011', dob: '1995-06-22', idMasked: '••••-3299', kycStatus: 'VERIFIED', riskScore: 41, hasSpecimen: true, faceMatch: 0.93, liveness: 0.91, createdHoursAgo: 180 },
  { id: 12, name: 'Modou Jaiteh', externalCustomerId: 'bank-core-1012', dob: '1987-10-03', idMasked: '••••-8156', kycStatus: 'VERIFIED', riskScore: 62, hasSpecimen: false, faceMatch: 0.86, liveness: 0.84, createdHoursAgo: 95 },
  { id: 13, name: 'Sainabou Colley', externalCustomerId: 'bank-core-1013', dob: '1992-01-25', idMasked: '••••-2704', kycStatus: 'PENDING', riskScore: 45, hasSpecimen: false, faceMatch: 0.83, liveness: 0.8, createdHoursAgo: 12 },
  { id: 14, name: 'Alieu Jobe', externalCustomerId: 'bank-core-1014', dob: '1976-07-17', idMasked: '••••-9910', kycStatus: 'REJECTED', riskScore: 88, hasSpecimen: false, faceMatch: 0.35, liveness: 0.44, createdHoursAgo: 30 },
  { id: 15, name: 'Ndey Bojang', externalCustomerId: 'bank-core-1015', dob: '1999-03-08', idMasked: '••••-1563', kycStatus: 'VERIFIED', riskScore: 37, hasSpecimen: true, faceMatch: 0.95, liveness: 0.93, createdHoursAgo: 220 },
  { id: 16, name: 'Pa Saidy', externalCustomerId: 'bank-core-1016', dob: '1984-11-29', idMasked: '••••-6047', kycStatus: 'FLAGGED', riskScore: 79, hasSpecimen: true, faceMatch: 0.68, liveness: 0.75, createdHoursAgo: 48 },
  { id: 17, name: 'Amie Sonko', externalCustomerId: 'bank-core-1017', dob: '1997-05-16', idMasked: '••••-7382', kycStatus: 'VERIFIED', riskScore: 44, hasSpecimen: true, faceMatch: 0.92, liveness: 0.89, createdHoursAgo: 160 },
  { id: 18, name: 'Musa Badjie', externalCustomerId: 'bank-core-1018', dob: '1981-09-01', idMasked: '••••-4255', kycStatus: 'VERIFIED', riskScore: 55, hasSpecimen: false, faceMatch: 0.88, liveness: 0.86, createdHoursAgo: 110 },
  { id: 19, name: 'Jainaba Kujabi', externalCustomerId: 'bank-core-1019', dob: '1993-02-19', idMasked: '••••-8671', kycStatus: 'PENDING', riskScore: 51, hasSpecimen: false, faceMatch: 0.81, liveness: 0.78, createdHoursAgo: 4 },
  { id: 20, name: 'Tijan Ceesay', externalCustomerId: 'bank-core-1020', dob: '1989-12-07', idMasked: '••••-3028', kycStatus: 'VERIFIED', riskScore: 60, hasSpecimen: true, faceMatch: 0.9, liveness: 0.87, createdHoursAgo: 140 },
  { id: 21, name: 'Rohey Mendy', externalCustomerId: 'bank-core-1021', dob: '1994-08-23', idMasked: '••••-5194', kycStatus: 'FLAGGED', riskScore: 73, hasSpecimen: false, faceMatch: 0.7, liveness: 0.66, createdHoursAgo: 22 },
  { id: 22, name: 'Sarjo Faye', externalCustomerId: 'bank-core-1022', dob: '1986-06-05', idMasked: '••••-1480', kycStatus: 'VERIFIED', riskScore: 39, hasSpecimen: true, faceMatch: 0.94, liveness: 0.96, createdHoursAgo: 260 },
  { id: 23, name: 'Adama Gaye', externalCustomerId: 'bank-core-1023', dob: '1990-04-13', idMasked: '••••-6759', kycStatus: 'VERIFIED', riskScore: 57, hasSpecimen: true, faceMatch: 0.87, liveness: 0.85, createdHoursAgo: 85 },
  { id: 24, name: 'Binta Cham', externalCustomerId: 'bank-core-1024', dob: '1995-10-28', idMasked: '••••-2396', kycStatus: 'REJECTED', riskScore: 85, hasSpecimen: false, faceMatch: 0.48, liveness: 0.52, createdHoursAgo: 16 },
]

export const demoCustomers: CustomerSummary[] = SEED.map((c) => ({
  id: c.id,
  name: c.name,
  externalCustomerId: c.externalCustomerId,
  kycStatus: c.kycStatus,
  riskScore: c.riskScore,
  hasSignatureSpecimen: c.hasSpecimen,
}))

export const demoCustomerDetails: Record<number, CustomerDetail> = Object.fromEntries(
  SEED.map((c) => [
    c.id,
    {
      id: c.id,
      name: c.name,
      externalCustomerId: c.externalCustomerId,
      dob: c.dob,
      idNumberMasked: c.idMasked,
      kycStatus: c.kycStatus,
      faceMatchScore: c.faceMatch,
      livenessScore: c.liveness,
      riskScore: c.riskScore,
      hasSignatureSpecimen: c.hasSpecimen,
      documentCount: 0,
      transactionCount: 0,
      createdAt: hoursAgo(c.createdHoursAgo),
    } satisfies CustomerDetail,
  ]),
)

const DOC_TYPES: DocumentType[] = ['ID', 'CHEQUE', 'INVOICE', 'CHEQUE', 'ID']

function buildDocuments(): DocumentResponse[] {
  const docs: DocumentResponse[] = []
  let id = 11
  for (const c of SEED) {
    const count = c.hasSpecimen ? 2 + (c.id % 3) : 1 + (c.id % 2)
    for (let i = 0; i < count; i++) {
      const type = i === 0 ? 'ID' : DOC_TYPES[(c.id + i) % DOC_TYPES.length]
      const hasSpecimen = c.hasSpecimen && type !== 'ID'
      const tampering = type === 'CHEQUE' && c.riskScore >= 70 ? 0.55 + (c.id % 30) / 100 : 0.08 + (c.id % 20) / 100
      const sigStatus: SignatureMatchStatus = hasSpecimen ? 'SCORED' : 'SKIPPED_NO_REFERENCE'
      docs.push({
        id: id++,
        customerId: c.id,
        type,
        status: 'COMPLETE',
        tamperingScore: Number(tampering.toFixed(2)),
        signatureMatchStatus: sigStatus,
        signatureMatchScore: hasSpecimen ? Number((0.7 + (c.id % 25) / 100).toFixed(2)) : null,
        fraudRiskScore: Number((tampering * 0.9 + (1 - c.faceMatch) * 0.3).toFixed(2)),
        fieldConsistencyFlags:
          tampering > 0.5
            ? ['AMOUNT_WORDS_MISMATCH', 'DATE_INCONSISTENT']
            : type === 'ID'
              ? ['DOB_FORMAT_OK', 'MRZ_OK']
              : ['FIELDS_CONSISTENT'],
        ocrExtractedData: {
          name: c.name,
          ...(type === 'CHEQUE' ? { amount: String(1500 + c.id * 350) } : {}),
          ...(type === 'INVOICE' ? { vendor: 'Atlantic Supplies Ltd' } : {}),
        },
        createdAt: hoursAgo(c.createdHoursAgo - i * 5),
      })
    }
  }
  return docs
}

export const demoDocuments: DocumentResponse[] = buildDocuments()

const CHANNELS = ['MOBILE', 'BRANCH', 'ATM', 'POS', 'WEB'] as const

function buildTransactions(): Record<number, TxHistoryItem[]> {
  const byCustomer: Record<number, TxHistoryItem[]> = {}
  let id = 201
  for (const c of SEED) {
    const count = 4 + (c.id % 6)
    const rows: TxHistoryItem[] = []
    for (let i = 0; i < count; i++) {
      const amount = 120 + ((c.id * 17 + i * 230) % 18000)
      const flagged = amount >= 8000 || (c.riskScore >= 75 && i === 0)
      const anomaly = flagged ? 0.72 + (i % 20) / 100 : 0.12 + (i % 40) / 100
      rows.push({
        id: id++,
        externalTransactionId: `tx-demo-${c.id}-${i + 1}`,
        amount,
        currency: 'GMD',
        occurredAt: hoursAgo(i * 7 + (c.id % 5)),
        channel: CHANNELS[(c.id + i) % CHANNELS.length],
        anomalyScore: Number(anomaly.toFixed(2)),
        flagged,
        recommendation: flagged ? (amount >= 12000 ? 'BLOCK' : 'REVIEW') : 'ALLOW',
      })
    }
    byCustomer[c.id] = rows
  }
  return byCustomer
}

export const demoTxByCustomer: Record<number, TxHistoryItem[]> = buildTransactions()

// Keep detail counters in sync
for (const c of SEED) {
  const detail = demoCustomerDetails[c.id]
  detail.documentCount = demoDocuments.filter((d) => d.customerId === c.id).length
  detail.transactionCount = (demoTxByCustomer[c.id] || []).length
}

type CaseSeed = {
  id: number
  customerId: number
  status: CaseStatus
  risk: number
  explanation: string
  decision?: CaseDecision
  note?: string
  docId?: number | null
  createdHoursAgo: number
  updatedHoursAgo: number
}

const CASE_SEEDS: CaseSeed[] = [
  { id: 101, customerId: 1, status: 'OPEN', risk: 82, explanation: 'KYC face match below threshold; liveness challenge incomplete on first attempt.', docId: 11, createdHoursAgo: 2, updatedHoursAgo: 2 },
  { id: 102, customerId: 2, status: 'UNDER_REVIEW', risk: 71, explanation: 'Cheque tampering score elevated; signature match skipped — no specimen enrolled.', docId: 12, createdHoursAgo: 8, updatedHoursAgo: 3 },
  { id: 103, customerId: 3, status: 'RESOLVED', risk: 64, explanation: 'Transaction anomaly AMOUNT_OUTLIER on mobile channel.', decision: 'APPROVE', note: 'Verified with branch — large but expected remittance.', createdHoursAgo: 28, updatedHoursAgo: 20 },
  { id: 104, customerId: 4, status: 'OPEN', risk: 91, explanation: 'Fail-closed KYC: spoof / poor quality selfie; face match 0.41.', createdHoursAgo: 5, updatedHoursAgo: 5 },
  { id: 105, customerId: 6, status: 'OPEN', risk: 76, explanation: 'Invoice field inconsistency + elevated customer risk after TX spike.', createdHoursAgo: 10, updatedHoursAgo: 7 },
  { id: 106, customerId: 7, status: 'UNDER_REVIEW', risk: 58, explanation: 'KYC session pending human review — ambiguous liveness.', createdHoursAgo: 6, updatedHoursAgo: 4 },
  { id: 107, customerId: 10, status: 'OPEN', risk: 68, explanation: 'Document verify without specimen; signature match SKIPPED_NO_REFERENCE.', createdHoursAgo: 14, updatedHoursAgo: 11 },
  { id: 108, customerId: 12, status: 'RESOLVED', risk: 62, explanation: 'POS channel velocity spike across 24h window.', decision: 'ESCALATE', note: 'Escalated to financial crime unit for pattern review.', createdHoursAgo: 60, updatedHoursAgo: 36 },
  { id: 109, customerId: 14, status: 'RESOLVED', risk: 88, explanation: 'Rejected KYC — ID tampering signals and failed liveness.', decision: 'REJECT', note: 'Customer asked to re-apply with clear ID capture.', createdHoursAgo: 30, updatedHoursAgo: 24 },
  { id: 110, customerId: 16, status: 'UNDER_REVIEW', risk: 79, explanation: 'SHAP top feature amount_vs_avg_30d; recommendation REVIEW.', createdHoursAgo: 16, updatedHoursAgo: 9 },
  { id: 111, customerId: 18, status: 'OPEN', risk: 55, explanation: 'Cheque OCR amount mismatch vs written words.', createdHoursAgo: 20, updatedHoursAgo: 18 },
  { id: 112, customerId: 19, status: 'OPEN', risk: 51, explanation: 'New KYC session awaiting desk confirmation.', createdHoursAgo: 3, updatedHoursAgo: 3 },
  { id: 113, customerId: 20, status: 'RESOLVED', risk: 60, explanation: 'ATM withdrawal cluster overnight.', decision: 'APPROVE', note: 'Customer confirmed travel; within travel notice.', createdHoursAgo: 72, updatedHoursAgo: 50 },
  { id: 114, customerId: 21, status: 'OPEN', risk: 73, explanation: 'Face match marginal; document ID quality flags.', createdHoursAgo: 9, updatedHoursAgo: 8 },
  { id: 115, customerId: 24, status: 'UNDER_REVIEW', risk: 85, explanation: 'Rejected path reopened after branch appeal.', createdHoursAgo: 12, updatedHoursAgo: 6 },
  { id: 116, customerId: 5, status: 'RESOLVED', risk: 33, explanation: 'False positive on small POS burst.', decision: 'APPROVE', note: 'Retail payroll day — cleared.', createdHoursAgo: 96, updatedHoursAgo: 80 },
  { id: 117, customerId: 8, status: 'RESOLVED', risk: 52, explanation: 'Invoice vendor unknown to watchlist stub.', decision: 'APPROVE', note: 'Vendor registered locally.', createdHoursAgo: 110, updatedHoursAgo: 100 },
  { id: 118, customerId: 11, status: 'OPEN', risk: 41, explanation: 'Low risk but policy auto-flag for first international counterparty.', createdHoursAgo: 25, updatedHoursAgo: 22 },
  { id: 119, customerId: 15, status: 'RESOLVED', risk: 37, explanation: 'Specimen enroll delayed; temporary SKIPPED match on cheque.', decision: 'APPROVE', note: 'Specimen enrolled after decision prep.', createdHoursAgo: 140, updatedHoursAgo: 120 },
  { id: 120, customerId: 17, status: 'UNDER_REVIEW', risk: 44, explanation: 'Multiple small WEB transfers to new beneficiary.', createdHoursAgo: 18, updatedHoursAgo: 12 },
  { id: 121, customerId: 22, status: 'RESOLVED', risk: 39, explanation: 'Historical case from pilot week — clean.', decision: 'APPROVE', note: 'Closed during pilot cleanup.', createdHoursAgo: 200, updatedHoursAgo: 190 },
  { id: 122, customerId: 23, status: 'OPEN', risk: 57, explanation: 'Device / channel switch: MOBILE → ATM within 1 hour.', createdHoursAgo: 7, updatedHoursAgo: 7 },
]

function relatedDocFor(customerId: number): number | null {
  const doc = demoDocuments.find((d) => d.customerId === customerId && d.type !== 'ID')
    || demoDocuments.find((d) => d.customerId === customerId)
  return doc?.id ?? null
}

export const demoCases: CaseResponse[] = CASE_SEEDS.map((c) => {
  const customer = SEED.find((s) => s.id === c.customerId)!
  return {
    id: c.id,
    customerId: c.customerId,
    customerName: customer.name,
    status: c.status,
    riskScoreAtCreation: c.risk,
    explanation: c.explanation,
    decision: c.decision ?? null,
    decisionNote: c.note ?? null,
    relatedDocumentId: c.docId === undefined ? relatedDocFor(c.customerId) : c.docId,
    createdAt: hoursAgo(c.createdHoursAgo),
    updatedAt: hoursAgo(c.updatedHoursAgo),
  }
})

export const demoAudit: AuditLog[] = [
  { id: 1, action: 'CASE_DECIDE', entityType: 'Case', entityId: '103', userId: 2, beforeState: { status: 'OPEN' }, afterState: { status: 'RESOLVED', decision: 'APPROVE' }, createdAt: hoursAgo(20) },
  { id: 2, action: 'KYC_CREATE', entityType: 'Customer', entityId: '1', userId: null, beforeState: null, afterState: { kycStatus: 'FLAGGED' }, createdAt: hoursAgo(40) },
  { id: 3, action: 'CASE_OPEN', entityType: 'Case', entityId: '104', userId: null, beforeState: null, afterState: { riskScore: 91 }, createdAt: hoursAgo(5) },
  { id: 4, action: 'DOCUMENT_VERIFY', entityType: 'Document', entityId: '12', userId: 3, beforeState: null, afterState: { tamperingScore: 0.78 }, createdAt: hoursAgo(9) },
  { id: 5, action: 'SPECIMEN_ENROLL', entityType: 'Customer', entityId: '3', userId: 3, beforeState: null, afterState: { hasSpecimen: true }, createdAt: hoursAgo(100) },
  { id: 6, action: 'CASE_DECIDE', entityType: 'Case', entityId: '109', userId: 1, beforeState: { status: 'OPEN' }, afterState: { status: 'RESOLVED', decision: 'REJECT' }, createdAt: hoursAgo(24) },
  { id: 7, action: 'RISK_SETTINGS_UPDATE', entityType: 'RiskSettings', entityId: '1', userId: 1, beforeState: { autoFlagRiskScore: 65 }, afterState: { autoFlagRiskScore: 60 }, createdAt: hoursAgo(48) },
  { id: 8, action: 'KYC_UPDATE', entityType: 'Customer', entityId: '6', userId: null, beforeState: { kycStatus: 'PENDING' }, afterState: { kycStatus: 'FLAGGED' }, createdAt: hoursAgo(55) },
  { id: 9, action: 'CASE_OPEN', entityType: 'Case', entityId: '110', userId: null, beforeState: null, afterState: { recommendation: 'REVIEW' }, createdAt: hoursAgo(16) },
  { id: 10, action: 'CASE_DECIDE', entityType: 'Case', entityId: '108', userId: 2, beforeState: { status: 'UNDER_REVIEW' }, afterState: { decision: 'ESCALATE' }, createdAt: hoursAgo(36) },
  { id: 11, action: 'DOCUMENT_VERIFY', entityType: 'Document', entityId: '25', userId: 3, beforeState: null, afterState: { type: 'INVOICE' }, createdAt: hoursAgo(22) },
  { id: 12, action: 'CASE_OPEN', entityType: 'Case', entityId: '114', userId: null, beforeState: null, afterState: { riskScore: 73 }, createdAt: hoursAgo(9) },
  { id: 13, action: 'KYC_CREATE', entityType: 'Customer', entityId: '19', userId: null, beforeState: null, afterState: { kycStatus: 'PENDING' }, createdAt: hoursAgo(4) },
  { id: 14, action: 'CASE_DECIDE', entityType: 'Case', entityId: '113', userId: 2, beforeState: { status: 'OPEN' }, afterState: { decision: 'APPROVE' }, createdAt: hoursAgo(50) },
  { id: 15, action: 'SPECIMEN_ENROLL', entityType: 'Customer', entityId: '5', userId: 3, beforeState: null, afterState: { hasSpecimen: true }, createdAt: daysAgo(7) },
  { id: 16, action: 'CASE_OPEN', entityType: 'Case', entityId: '122', userId: null, beforeState: null, afterState: { explanation: 'channel switch' }, createdAt: hoursAgo(7) },
  { id: 17, action: 'CASE_DECIDE', entityType: 'Case', entityId: '116', userId: 1, beforeState: { status: 'OPEN' }, afterState: { decision: 'APPROVE' }, createdAt: hoursAgo(80) },
  { id: 18, action: 'KYC_CREATE', entityType: 'Customer', entityId: '4', userId: null, beforeState: null, afterState: { kycStatus: 'REJECTED' }, createdAt: hoursAgo(18) },
  { id: 19, action: 'DOCUMENT_VERIFY', entityType: 'Document', entityId: '40', userId: 3, beforeState: null, afterState: { signatureMatchStatus: 'SKIPPED_NO_REFERENCE' }, createdAt: hoursAgo(14) },
  { id: 20, action: 'CASE_OPEN', entityType: 'Case', entityId: '120', userId: null, beforeState: null, afterState: { status: 'UNDER_REVIEW' }, createdAt: hoursAgo(18) },
]

export const demoRisk: RiskSettings = {
  kycWeight: 0.35,
  documentWeight: 0.4,
  transactionWeight: 0.25,
  faceMatchThreshold: 0.8,
  signatureMatchThreshold: 0.85,
  tamperingThreshold: 0.5,
  anomalyThreshold: 0.7,
  autoFlagRiskScore: 60,
  updatedAt: now(),
}

export const demoWebhook: WebhookSettings = {
  tenantCode: 'demo-bank',
  webhookUrl: 'https://bank.example/hooks/sentinel',
}

const allTx = Object.values(demoTxByCustomer).flat()
const kycMix = SEED.reduce<Record<string, number>>((acc, c) => {
  acc[c.kycStatus] = (acc[c.kycStatus] || 0) + 1
  return acc
}, {})

export const demoTrend: FraudTrend = {
  customers: SEED.length,
  documents: demoDocuments.length,
  transactions: allTx.length,
  flaggedTransactions: allTx.filter((t) => t.flagged).length,
  casesTotal: demoCases.length,
  casesOpen: demoCases.filter((c) => c.status === 'OPEN').length,
  casesUnderReview: demoCases.filter((c) => c.status === 'UNDER_REVIEW').length,
  casesResolved: demoCases.filter((c) => c.status === 'RESOLVED').length,
  customersByKycStatus: kycMix,
}

export function demoScoreTx(body: Record<string, unknown>): TxScoreResponse {
  const amount = Number(body.amount ?? 0)
  const flagged = amount >= 5000
  return {
    externalTransactionId: String(body.externalTransactionId ?? `tx-demo-${Date.now()}`),
    transactionId: String(9000 + (amount % 500)),
    anomalyScore: flagged ? 0.86 : 0.24,
    flagged,
    ruleFlags: flagged ? ['AMOUNT_OUTLIER', 'VELOCITY_HINT'] : [],
    recommendation: flagged ? (amount >= 15000 ? 'BLOCK' : 'REVIEW') : 'ALLOW',
    customerRiskScore: flagged ? 74 : 32,
    explanation: flagged
      ? 'Demo stub: amount above typical profile for this customer.'
      : 'Demo stub: payment within expected pattern.',
    shapTopFeatures: [
      { feature: 'amount_vs_avg_30d', contribution: flagged ? 0.31 : 0.04 },
      { feature: 'tx_count_24h', contribution: flagged ? 0.12 : 0.02 },
      { feature: 'channel_risk', contribution: flagged ? 0.08 : 0.01 },
    ],
    externalCustomerId: String(body.externalCustomerId ?? ''),
    caseId: flagged ? '110' : null,
  }
}

export type DemoHostedSession = {
  status: 'PENDING' | 'SUBMITTED' | 'COMPLETE'
  tenantName: string
  tenantCode: string
  livenessHint: string
  expiresAt: string
  expired: boolean
  returnUrl: string | null
  explanation: string | null
  kycStatus: string | null
  riskScore: number | null
}

export function demoHostedSession(complete = false): DemoHostedSession {
  return {
    status: complete ? 'COMPLETE' : 'PENDING',
    tenantName: 'Demo Bank',
    tenantCode: 'demo-bank',
    livenessHint: 'Turn head slowly left, then right',
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    expired: false,
    returnUrl: 'https://bank.example/onboarding/continue',
    explanation: complete
      ? 'Demo stub: face match and liveness within policy thresholds.'
      : null,
    kycStatus: complete ? 'VERIFIED' : null,
    riskScore: complete ? 28 : null,
  }
}
