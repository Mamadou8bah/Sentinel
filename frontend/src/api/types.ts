export type Role = 'ADMIN' | 'COMPLIANCE' | 'ANALYST'

export type CaseStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED'
export type CaseDecision = 'APPROVE' | 'REJECT' | 'ESCALATE'
export type KycStatus = 'PENDING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED'

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresInMinutes: number
  username: string
  role: Role
  tenantCode: string
  tenantId: number
}

export type MeResponse = {
  username: string
  tenantCode: string | null
  tenantId: number | null
  authorities: string[]
}

export type CaseResponse = {
  id: number
  customerId: number
  customerName: string
  status: CaseStatus
  riskScoreAtCreation: number
  explanation: string
  decision: CaseDecision | null
  decisionNote: string | null
  relatedDocumentId: number | null
  createdAt: string
  updatedAt: string
}

export type CustomerSummary = {
  id: number
  name: string
  externalCustomerId: string
  kycStatus: KycStatus
  riskScore: number
  hasSignatureSpecimen: boolean
}

export type CustomerDetail = {
  id: number
  name: string
  externalCustomerId: string
  dob: string | null
  idNumberMasked: string | null
  kycStatus: KycStatus
  faceMatchScore: number | null
  livenessScore: number | null
  riskScore: number
  hasSignatureSpecimen: boolean
  documentCount: number
  transactionCount: number
  createdAt: string
}

export type TxHistoryItem = {
  id: number
  externalTransactionId: string
  amount: number
  currency: string
  occurredAt: string
  channel: string
  anomalyScore: number
  flagged: boolean
  recommendation: string
}

export type AuditLog = {
  id: number
  action: string
  entityType: string
  entityId: string
  userId: number | null
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  createdAt: string
}

export type RiskSettings = {
  kycWeight: number
  documentWeight: number
  transactionWeight: number
  faceMatchThreshold: number
  signatureMatchThreshold: number
  tamperingThreshold: number
  anomalyThreshold: number
  autoFlagRiskScore: number
  updatedAt: string
}

export type WebhookSettings = {
  tenantCode: string
  webhookUrl: string | null
}

export type FraudTrend = {
  customers: number
  documents: number
  transactions: number
  flaggedTransactions: number
  casesTotal: number
  casesOpen: number
  casesUnderReview: number
  casesResolved: number
  customersByKycStatus: Record<string, number>
}

export type CaseEventMessage = {
  event: string
  tenantId: number
  payload: Record<string, unknown>
}

export type DocumentType = 'CHEQUE' | 'INVOICE' | 'ID'

export type DocumentStatus = 'PENDING' | 'COMPLETE' | 'FAILED'

export type SignatureMatchStatus = 'SCORED' | 'SKIPPED_NO_REFERENCE'

export type DocumentResponse = {
  id: number
  customerId: number
  type: DocumentType
  status: DocumentStatus
  tamperingScore: number | null
  signatureMatchStatus: SignatureMatchStatus
  signatureMatchScore: number | null
  fraudRiskScore: number | null
  fieldConsistencyFlags: string[] | null
  ocrExtractedData: Record<string, unknown> | null
  createdAt: string
}

export type TxScoreResponse = {
  externalTransactionId: string
  transactionId: string
  anomalyScore: number
  flagged: boolean
  ruleFlags: string[]
  recommendation: string
  customerRiskScore: number
  explanation: string
  shapTopFeatures: Array<Record<string, unknown>>
  externalCustomerId: string
  caseId: string | null
}

export type TxImportResponse = {
  processed: number
  failed: number
  results: unknown[]
}

export type ApiErrorBody = {
  message?: string
  error?: string
  status?: number
}
