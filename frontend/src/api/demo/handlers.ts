import type { AuthResponse, CaseDecision, CaseResponse, CaseStatus, Role } from '../types'
import {
  demoAudit,
  demoCases,
  demoCustomerDetails,
  demoCustomers,
  demoDocuments,
  demoHostedSession,
  demoRisk,
  demoScoreTx,
  demoTrend,
  demoTxByCustomer,
  demoWebhook,
} from './data'

function delay<T>(value: T, ms = 180): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== 'string') return {}
  try {
    return JSON.parse(init.body) as Record<string, unknown>
  } catch {
    return {}
  }
}

function roleFor(username: string): Role {
  if (username === 'admin') return 'ADMIN'
  if (username === 'analyst') return 'ANALYST'
  return 'COMPLIANCE'
}

function login(body: Record<string, unknown>): AuthResponse {
  const username = String(body.username || 'compliance').trim() || 'compliance'
  const tenantCode = String(body.tenantCode || 'demo-bank').trim() || 'demo-bank'
  const role = roleFor(username)
  return {
    accessToken: `demo.access.${username}`,
    refreshToken: `demo.refresh.${username}`,
    tokenType: 'Bearer',
    expiresInMinutes: 60,
    username,
    role,
    tenantCode,
    tenantId: 1,
  }
}

function filterCases(path: string): CaseResponse[] {
  const url = new URL(path, 'http://local')
  const status = url.searchParams.get('status') as CaseStatus | null
  const sort = url.searchParams.get('sort') || 'risk'
  let rows = [...demoCases]
  if (status) rows = rows.filter((c) => c.status === status)
  if (sort === 'date') {
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } else {
    rows.sort((a, b) => b.riskScoreAtCreation - a.riskScoreAtCreation)
  }
  return rows
}

/** Handle desk + hosted KYC routes with in-memory demo data. */
export async function handleDemoRequest(path: string, init?: RequestInit): Promise<unknown> {
  const method = (init?.method || 'GET').toUpperCase()
  const body = parseBody(init)
  const clean = path.split('?')[0]

  if (method === 'POST' && clean === '/api/auth/login') {
    return delay(login(body))
  }
  if (method === 'POST' && clean === '/api/auth/refresh') {
    return delay({
      ...login({ username: 'compliance', tenantCode: 'demo-bank' }),
      accessToken: 'demo.access.refreshed',
    } satisfies AuthResponse)
  }

  if (method === 'GET' && clean === '/api/me') {
    return delay({
      username: 'compliance',
      tenantCode: 'demo-bank',
      tenantId: 1,
      authorities: ['ROLE_COMPLIANCE'],
    })
  }

  if (method === 'GET' && clean === '/api/cases') {
    return delay(filterCases(path))
  }

  const caseMatch = clean.match(/^\/api\/cases\/(\d+)$/)
  if (method === 'GET' && caseMatch) {
    const id = Number(caseMatch[1])
    const found = demoCases.find((c) => c.id === id)
    if (!found) throw Object.assign(new Error('Case not found'), { status: 404 })
    return delay(found)
  }

  const decideMatch = clean.match(/^\/api\/cases\/(\d+)\/decision$/)
  if (method === 'PATCH' && decideMatch) {
    const id = Number(decideMatch[1])
    const idx = demoCases.findIndex((c) => c.id === id)
    if (idx < 0) throw Object.assign(new Error('Case not found'), { status: 404 })
    const decision = String(body.decision || 'APPROVE') as CaseDecision
    const note = String(body.note || '')
    demoCases[idx] = {
      ...demoCases[idx],
      decision,
      decisionNote: note,
      status: decision === 'ESCALATE' ? 'UNDER_REVIEW' : 'RESOLVED',
      updatedAt: new Date().toISOString(),
    }
    return delay(demoCases[idx])
  }

  if (method === 'GET' && clean === '/api/customers') {
    return delay(demoCustomers)
  }

  const customerMatch = clean.match(/^\/api\/customers\/(\d+)$/)
  if (method === 'GET' && customerMatch) {
    const id = Number(customerMatch[1])
    const detail = demoCustomerDetails[id]
    if (!detail) throw Object.assign(new Error('Customer not found'), { status: 404 })
    return delay(detail)
  }

  const customerTx = clean.match(/^\/api\/customers\/(\d+)\/transactions$/)
  if (method === 'GET' && customerTx) {
    return delay(demoTxByCustomer[Number(customerTx[1])] || [])
  }

  const customerDocs = clean.match(/^\/api\/customers\/(\d+)\/documents$/)
  if (method === 'GET' && customerDocs) {
    const id = Number(customerDocs[1])
    return delay(demoDocuments.filter((d) => d.customerId === id))
  }

  const specimen = clean.match(/^\/api\/customers\/(\d+)\/signature-specimen$/)
  if (method === 'POST' && specimen) {
    const id = Number(specimen[1])
    const summary = demoCustomers.find((c) => c.id === id)
    if (summary) summary.hasSignatureSpecimen = true
    if (demoCustomerDetails[id]) demoCustomerDetails[id].hasSignatureSpecimen = true
    return delay({
      customerId: id,
      externalCustomerId: summary?.externalCustomerId || '',
      enrolled: true,
    })
  }

  const docMatch = clean.match(/^\/api\/documents\/(\d+)$/)
  if (method === 'GET' && docMatch) {
    const found = demoDocuments.find((d) => d.id === Number(docMatch[1]))
    if (!found) throw Object.assign(new Error('Document not found'), { status: 404 })
    return delay(found)
  }

  if (method === 'POST' && clean === '/api/documents') {
    const created = {
      id: 50 + demoDocuments.length,
      customerId: 3,
      type: (body.docType as 'CHEQUE') || 'CHEQUE',
      status: 'COMPLETE' as const,
      tamperingScore: 0.18,
      signatureMatchStatus: 'SCORED' as const,
      signatureMatchScore: 0.91,
      fraudRiskScore: 0.21,
      fieldConsistencyFlags: [] as string[],
      ocrExtractedData: {},
      createdAt: new Date().toISOString(),
    }
    demoDocuments.push(created)
    return delay(created)
  }

  if (method === 'POST' && clean === '/api/transactions/score') {
    return delay(demoScoreTx(body))
  }

  if (method === 'POST' && clean === '/api/transactions/import') {
    return delay({ processed: 12, failed: 0, results: [] })
  }

  if (method === 'GET' && clean === '/api/audit') {
    return delay(demoAudit)
  }

  if (method === 'GET' && clean === '/api/admin/analytics/fraud-trend') {
    return delay(demoTrend)
  }

  if (clean === '/api/admin/settings/risk-weights') {
    if (method === 'GET') return delay(demoRisk)
    if (method === 'PUT') {
      Object.assign(demoRisk, body, { updatedAt: new Date().toISOString() })
      return delay(demoRisk)
    }
  }

  if (clean === '/api/admin/settings/webhook') {
    if (method === 'GET') return delay(demoWebhook)
    if (method === 'PUT') {
      demoWebhook.webhookUrl = String(body.webhookUrl || '')
      return delay(demoWebhook)
    }
  }

  if (method === 'POST' && clean === '/api/admin/webhooks/test') {
    return delay({ queued: true, webhookUrl: demoWebhook.webhookUrl })
  }

  const hostedGet = clean.match(/^\/api\/kyc\/hosted\/([^/]+)$/)
  if (method === 'GET' && hostedGet) {
    return delay(demoHostedSession(false))
  }

  const hostedSubmit = clean.match(/^\/api\/kyc\/hosted\/([^/]+)\/submit$/)
  if (method === 'POST' && hostedSubmit) {
    return delay(demoHostedSession(true))
  }

  throw Object.assign(new Error(`Demo mode has no handler for ${method} ${clean}`), { status: 404 })
}
