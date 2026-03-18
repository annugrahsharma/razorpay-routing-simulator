// ========================================
// Razorpay Routing Simulator — Mock Data & Engine
// Extracted from KAM Dashboard
// ========================================

// ── Gateways ────────────────────────────
export const gateways = [
  {
    id: 'gw-hdfc',
    name: 'HDFC Bank',
    shortName: 'HDFC',
    terminals: [
      { id: 'term-hdfc-001', terminalId: 'HDFC_T1', successRate: 73.5, costPerTxn: 1.80, isZeroCost: false },
      { id: 'term-hdfc-002', terminalId: 'HDFC_T2', successRate: 72.1, costPerTxn: 0, isZeroCost: true },
    ],
  },
  {
    id: 'gw-icici',
    name: 'ICICI Bank',
    shortName: 'ICICI',
    terminals: [
      { id: 'term-icici-001', terminalId: 'ICICI_T1', successRate: 72.8, costPerTxn: 1.70, isZeroCost: false },
      { id: 'term-icici-002', terminalId: 'ICICI_T2', successRate: 71.2, costPerTxn: 1.45, isZeroCost: false },
    ],
  },
  {
    id: 'gw-axis',
    name: 'Axis Bank',
    shortName: 'Axis',
    terminals: [
      { id: 'term-axis-001', terminalId: 'AXIS_T1', successRate: 71.4, costPerTxn: 1.50, isZeroCost: false },
      { id: 'term-axis-002', terminalId: 'AXIS_T2', successRate: 69.6, costPerTxn: 0, isZeroCost: true },
    ],
  },
  {
    id: 'gw-rbl',
    name: 'RBL Bank',
    shortName: 'RBL',
    terminals: [
      { id: 'term-rbl-001', terminalId: 'RBL_T1', successRate: 68.8, costPerTxn: 1.10, isZeroCost: false },
      { id: 'term-rbl-002', terminalId: 'RBL_T2', successRate: 67.5, costPerTxn: 0.95, isZeroCost: false },
    ],
  },
  {
    id: 'gw-yes',
    name: 'Yes Bank',
    shortName: 'Yes',
    terminals: [
      { id: 'term-yes-001', terminalId: 'YES_T1', successRate: 69.1, costPerTxn: 0, isZeroCost: true },
      { id: 'term-yes-002', terminalId: 'YES_T2', successRate: 67.8, costPerTxn: 0.85, isZeroCost: false },
    ],
  },
]

// ── Demo Merchants ──
export const merchants = [
  {
    id: 'merch-005',
    name: 'BigBasket',
    mid: 'MID_BBK_005',
    category: 'Grocery',
    mcc: '5411',
    mccLabel: 'Grocery Stores',
    dealType: 'standard',
    dealDetails: null,
    monthlyTxnVolume: 680000,
    monthlyGMV: 238000000,
    avgPaymentSuccessRate: 70.7,
    forwardPricing: 2.1,
    currentGatewayId: 'gw-icici',
    currentTerminalId: 'term-icici-001',
    routingStrategy: 'success_rate',
    gatewayMetrics: [
      { gatewayId: 'gw-hdfc', terminalId: 'term-hdfc-001', successRate: 73.5, costPerTxn: 1.80, txnShare: 35, supportedMethods: ['Cards'] },
      { gatewayId: 'gw-hdfc', terminalId: 'term-hdfc-002', successRate: 72.1, costPerTxn: 0, txnShare: 20, supportedMethods: ['UPI'] },
      { gatewayId: 'gw-icici', terminalId: 'term-icici-001', successRate: 72.8, costPerTxn: 1.70, txnShare: 30, supportedMethods: ['Cards', 'NB'] },
      { gatewayId: 'gw-yes', terminalId: 'term-yes-001', successRate: 69.1, costPerTxn: 0, txnShare: 15, supportedMethods: ['UPI'] },
    ],
    status: 'active',
    srSensitive: false,
    srThresholdLow: 87,
    txnVolumeHistory: { currentMonth: 720000, lastYearSameMonth: 880000 },
    contactName: 'Hari Menon',
    contactEmail: 'finance@bigbasket.com',
  },
  {
    id: 'merch-002',
    name: 'Swiggy',
    mid: 'MID_SWG_002',
    category: 'Food & Delivery',
    mcc: '5812',
    mccLabel: 'Restaurants',
    dealType: 'tsp',
    dealDetails: {
      description: 'HDFC has given special CC rates for Swiggy based on combined CC+UPI acquiring volume.',
      constraint: 'Annual GMV commitment of ₹300Cr via HDFC terminals',
      expiresAt: 'Sep 2026',
      lockedGatewayId: 'gw-hdfc',
      tspCompliance: { gmvCommitment: 3000000000, commitmentPeriod: 'annual' },
    },
    monthlyTxnVolume: 1100000,
    monthlyGMV: 385000000,
    avgPaymentSuccessRate: 71.8,
    forwardPricing: 1.9,
    currentGatewayId: 'gw-hdfc',
    currentTerminalId: 'term-hdfc-001',
    routingStrategy: 'success_rate',
    gatewayMetrics: [
      { gatewayId: 'gw-hdfc', terminalId: 'term-hdfc-001', successRate: 73.5, costPerTxn: 1.80, txnShare: 70, supportedMethods: ['Cards', 'UPI', 'NB'] },
      { gatewayId: 'gw-icici', terminalId: 'term-icici-002', successRate: 71.2, costPerTxn: 1.45, txnShare: 30, supportedMethods: ['Cards', 'NB'] },
    ],
    status: 'active',
    srSensitive: true,
    srThresholdLow: null,
    txnVolumeHistory: { currentMonth: 1100000, lastYearSameMonth: 1050000 },
    contactName: 'Sriharsha Majety',
    contactEmail: 'finance@swiggy.in',
  },
  {
    id: 'merch-004',
    name: 'Flipkart',
    mid: 'MID_FLK_004',
    category: 'E-commerce',
    mcc: '5311',
    mccLabel: 'Department Stores',
    dealType: 'standard',
    dealDetails: null,
    monthlyTxnVolume: 2200000,
    monthlyGMV: 1320000000,
    avgPaymentSuccessRate: 71.5,
    forwardPricing: 1.6,
    currentGatewayId: 'gw-icici',
    currentTerminalId: 'term-icici-001',
    routingStrategy: 'success_rate',
    gatewayMetrics: [
      { gatewayId: 'gw-icici', terminalId: 'term-icici-001', successRate: 72.8, costPerTxn: 1.70, txnShare: 50, supportedMethods: ['Cards', 'NB'] },
      { gatewayId: 'gw-hdfc', terminalId: 'term-hdfc-002', successRate: 72.1, costPerTxn: 0, txnShare: 30, supportedMethods: ['Cards', 'UPI'] },
      { gatewayId: 'gw-axis', terminalId: 'term-axis-001', successRate: 71.4, costPerTxn: 1.50, txnShare: 20, supportedMethods: ['UPI', 'NB'] },
    ],
    status: 'active',
    srSensitive: false,
    srThresholdLow: 64,
    txnVolumeHistory: { currentMonth: 980000, lastYearSameMonth: 950000 },
    contactName: 'Kalyan Krishnamurthy',
    contactEmail: 'payments@flipkart.com',
  },
]

// ── Routing Rules per Merchant ──
const SEED_RULES = {
  'merch-005': [
    {
      id: 'rule-merch-005-001', name: 'UPI → RBL', type: 'conditional', enabled: true, priority: 1,
      conditions: [{ field: 'payment_method', operator: 'equals', value: 'UPI' }],
      conditionLogic: 'AND',
      action: { type: 'route', terminals: ['term-rbl-001'], splits: [] },
      isDefault: false, createdAt: '2026-02-15T16:00:00Z', createdBy: 'anugrah.sharma@razorpay.com',
    },
  ],
  'merch-002': [
    {
      id: 'rule-merch-002-001', name: 'HDFC Volume Commitment (TSP)', type: 'volume_split', enabled: true, priority: 1,
      conditions: [],
      conditionLogic: 'AND',
      action: { type: 'split', terminals: [], splits: [
        { terminalId: 'term-hdfc-001', percentage: 70 },
        { terminalId: 'term-icici-002', percentage: 30 },
      ]},
      isDefault: false, createdAt: '2026-01-15T10:30:00Z', createdBy: 'anugrah.sharma@razorpay.com',
    },
    {
      id: 'rule-merch-002-002', name: 'High Value Visa CC → HDFC', type: 'conditional', enabled: true, priority: 2,
      conditions: [
        { field: 'payment_method', operator: 'equals', value: 'Cards' },
        { field: 'card_network', operator: 'equals', value: 'Visa' },
        { field: 'amount', operator: 'greater_than', value: 5000 },
      ],
      conditionLogic: 'AND',
      action: { type: 'route', terminals: ['term-hdfc-001'], splits: [], srThreshold: 92, minPaymentCount: 200 },
      isDefault: false, createdAt: '2026-01-20T14:15:00Z', createdBy: 'anugrah.sharma@razorpay.com',
    },
  ],
  'merch-004': [
    {
      id: 'rule-merch-004-001', name: 'Mastercard CC → ICICI', type: 'conditional', enabled: true, priority: 1,
      conditions: [
        { field: 'payment_method', operator: 'equals', value: 'Cards' },
        { field: 'card_network', operator: 'equals', value: 'Mastercard' },
      ],
      conditionLogic: 'AND',
      action: { type: 'route', terminals: ['term-icici-001'], splits: [], srThreshold: 91, minPaymentCount: 100 },
      isDefault: false, createdAt: '2026-02-01T11:00:00Z', createdBy: 'anugrah.sharma@razorpay.com',
    },
    {
      id: 'rule-merch-004-002', name: 'UPI → HDFC + Axis + ICICI', type: 'conditional', enabled: true, priority: 2,
      conditions: [{ field: 'payment_method', operator: 'equals', value: 'UPI' }],
      conditionLogic: 'AND',
      action: { type: 'route', terminals: ['term-hdfc-002', 'term-axis-001', 'term-icici-001'], splits: [], srThreshold: 90, minPaymentCount: 100 },
      isDefault: false, createdAt: '2026-02-01T11:15:00Z', createdBy: 'anugrah.sharma@razorpay.com',
    },
    {
      id: 'rule-merch-004-003', name: 'RuPay Debit → ICICI', type: 'conditional', enabled: true, priority: 3,
      conditions: [
        { field: 'payment_method', operator: 'equals', value: 'Cards' },
        { field: 'card_network', operator: 'equals', value: 'RuPay' },
      ],
      conditionLogic: 'AND',
      action: { type: 'route', terminals: ['term-icici-001'], splits: [], srThreshold: 90, minPaymentCount: 100 },
      isDefault: false, createdAt: '2026-02-01T11:30:00Z', createdBy: 'anugrah.sharma@razorpay.com',
    },
  ],
}

// ── Helpers ──

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return Math.abs(hash)
}

function seededRandom(seed) {
  let s = seed | 0
  s ^= s << 13; s ^= s >> 17; s ^= s << 5
  return ((s < 0 ? ~s + 1 : s) % 10000) / 10000
}

// ── Generate Seed Rules ──

export function generateSeedRules(merchant) {
  const customRules = SEED_RULES[merchant.id] || []
  const rules = customRules.map(r => ({ ...r }))

  const sortedTerminals = [...merchant.gatewayMetrics]
    .sort((a, b) => {
      if (merchant.routingStrategy === 'cost_based') return a.costPerTxn - b.costPerTxn
      return b.successRate - a.successRate
    })
    .map(gm => gm.terminalId)

  rules.push({
    id: `rule-${merchant.id}-default`,
    name: 'Default Routing',
    type: 'conditional',
    enabled: true,
    priority: 999,
    conditions: [],
    conditionLogic: 'AND',
    action: { type: 'route', terminals: sortedTerminals, splits: [] },
    isDefault: true,
    createdAt: '2025-12-01T00:00:00Z',
    createdBy: 'system',
  })

  return rules
}

// ── Rule Evaluation ──

function matchesConditions(rule, transaction) {
  if (!rule.conditions || rule.conditions.length === 0) return true

  const results = rule.conditions.map(cond => {
    const txnValue = transaction[cond.field]
    if (txnValue === undefined || txnValue === null) return false

    switch (cond.operator) {
      case 'equals':
        return String(txnValue).toLowerCase() === String(cond.value).toLowerCase()
      case 'in':
        return Array.isArray(cond.value) && cond.value.some(v => String(v).toLowerCase() === String(txnValue).toLowerCase())
      case 'greater_than':
        return Number(txnValue) > Number(cond.value)
      case 'less_than':
        return Number(txnValue) < Number(cond.value)
      case 'between':
        if (!Array.isArray(cond.value) || cond.value.length < 2) return false
        return Number(txnValue) >= Number(cond.value[0]) && Number(txnValue) <= Number(cond.value[1])
      default:
        return false
    }
  })

  if (rule.conditionLogic === 'OR') return results.some(Boolean)
  return results.every(Boolean)
}

// ── Format helpers ──

function formatRuleConditions(rule) {
  if (!rule.conditions || rule.conditions.length === 0) return 'Unconditional (matches all)'
  return rule.conditions.map(c => {
    const field = c.field.replace(/_/g, ' ')
    const val = Array.isArray(c.value) ? c.value.join('–') : c.value
    return `${field} ${c.operator.replace(/_/g, ' ')} ${val}`
  }).join(` ${rule.conditionLogic || 'AND'} `)
}

function formatRuleAction(rule) {
  if (rule.action.type === 'split') {
    return 'Split: ' + rule.action.splits.map(s =>
      `${_traceTerminalLabel(s.terminalId)} (${s.percentage}%)`
    ).join(', ')
  }
  return 'Route to: ' + (rule.action.terminals || []).map(id => _traceTerminalLabel(id)).join(' → ')
}

function _traceTerminalLabel(terminalId) {
  for (const gw of gateways) {
    const term = gw.terminals.find(t => t.id === terminalId)
    if (term) return `${term.terminalId} (${gw.shortName})`
  }
  return terminalId
}

// ── Doppler ML Scores ──

function generateDopplerScores(terminals, transaction, merchant) {
  const seed = hashCode(`${merchant.id}-${transaction.payment_method}-${transaction.card_network || ''}-${transaction.amount}`)
  return terminals.map((t, i) => {
    const baseSR = t.successRate || 70
    const noise = (seededRandom(seed + i * 37) - 0.5) * 10
    const dopplerScore = Math.min(100, Math.max(0, baseSR * 1.1 + noise))
    return {
      terminalId: t.terminalId,
      dopplerScore: Math.round(dopplerScore * 10) / 10,
    }
  })
}

// ── Full Routing Pipeline ──

export function simulateRoutingPipeline(merchant, transaction, rules, overrides = {}) {
  const stages = []
  const warnings = []
  const {
    disabledRules = new Set(),
    disabledTerminals = new Set(),
    srThreshold = merchant.srThresholdLow || 0,
    routingStrategy = merchant.routingStrategy || 'success_rate',
  } = overrides

  const paymentMethod = transaction.payment_method || 'Cards'

  // Stage 0: Terminal Pool Assembly
  const allTerminals = merchant.gatewayMetrics.map(gm => {
    const gw = gateways.find(g => g.id === gm.gatewayId)
    const term = gw?.terminals.find(t => t.id === gm.terminalId)
    return {
      terminalId: gm.terminalId,
      displayId: term?.terminalId || gm.terminalId,
      gatewayId: gm.gatewayId,
      gatewayShort: gw?.shortName || '??',
      successRate: gm.successRate,
      costPerTxn: gm.costPerTxn,
      txnShare: gm.txnShare,
      supportedMethods: gm.supportedMethods || [],
      isZeroCost: gm.costPerTxn === 0,
    }
  })

  const methodEligible = allTerminals.filter(t => t.supportedMethods.includes(paymentMethod))
  const methodIneligible = allTerminals.filter(t => !t.supportedMethods.includes(paymentMethod))
  const downedInThisStep = methodEligible.filter(t => disabledTerminals.has(t.terminalId))
  const eligible = methodEligible.filter(t => !disabledTerminals.has(t.terminalId))

  const eliminatedInPool = [
    ...methodIneligible.map(t => ({ ...t, status: 'eliminated', reason: `Does not support ${paymentMethod}` })),
    ...downedInThisStep.map(t => ({ ...t, status: 'eliminated', reason: 'Terminal marked as down' })),
  ]

  stages.push({
    id: 'pool', stepNumber: 0, type: 'initial', label: 'Terminal Pool',
    description: `${eligible.length} of ${allTerminals.length} terminals eligible for ${paymentMethod}`,
    terminalsRemaining: eligible.map(t => ({ ...t, status: 'eligible' })),
    terminalsEliminated: eliminatedInPool,
    totalCount: allTerminals.length, remainingCount: eligible.length,
  })

  if (eligible.length === 0) {
    stages.push({
      id: 'ntf_pool', stepNumber: 1, type: 'ntf', label: 'NTF — No eligible terminals',
      description: `No terminal supports ${paymentMethod}${downedInThisStep.length > 0 ? ' (some are marked down)' : ''}. Payment fails immediately.`,
      ntfCause: downedInThisStep.length > 0 ? 'terminals_down' : 'method_unsupported',
    })
    return _buildResult(stages, null, true, warnings, merchant, routingStrategy)
  }

  // Stage 1+: Rule Filters
  let remaining = [...eligible]
  const enabledRules = [...rules].filter(r => r.enabled && !disabledRules.has(r.id)).sort((a, b) => a.priority - b.priority)
  const skippedByOverride = [...rules].filter(r => r.enabled && disabledRules.has(r.id)).sort((a, b) => a.priority - b.priority)
  let stepNum = 1

  for (const rule of enabledRules) {
    if (rule.isDefault) continue
    if (remaining.length === 0) break

    const txnProxy = {
      payment_method: paymentMethod,
      amount: transaction.amount || 0,
      card_network: transaction.card_network || null,
      card_type: transaction.card_type || null,
      issuer_bank: transaction.issuer_bank || null,
      international: transaction.international || false,
    }

    const ruleMatches = matchesConditions(rule, txnProxy)

    if (!ruleMatches) {
      stages.push({
        id: `rule_${rule.id}`, stepNumber: stepNum++, type: 'rule_skip',
        label: `Rule: ${rule.name}`, ruleId: rule.id, ruleName: rule.name,
        ruleType: rule.type === 'volume_split' ? 'Volume Split' : 'Conditional',
        conditions: formatRuleConditions(rule),
        description: 'Conditions did not match — rule skipped',
        terminalsRemaining: remaining.map(t => ({ ...t, status: 'passed' })),
        terminalsEliminated: [], remainingCount: remaining.length, delta: 0,
      })
      continue
    }

    const targetIds = new Set(
      rule.action.type === 'split'
        ? rule.action.splits.map(s => s.terminalId)
        : rule.action.terminals || []
    )

    const kept = remaining.filter(t => targetIds.has(t.terminalId))
    const eliminated = remaining.filter(t => !targetIds.has(t.terminalId))

    if (kept.length === 0 && eliminated.length > 0) {
      stages.push({
        id: `rule_${rule.id}`, stepNumber: stepNum, type: 'rule_ntf',
        label: `Rule: ${rule.name}`, ruleId: rule.id, ruleName: rule.name,
        ruleType: rule.type === 'volume_split' ? 'Volume Split' : 'Conditional',
        conditions: formatRuleConditions(rule), action: formatRuleAction(rule),
        description: `Rule routes to ${[...targetIds].map(id => _traceTerminalLabel(id)).join(', ')} — none in eligible set. All eliminated.`,
        terminalsRemaining: [],
        terminalsEliminated: eliminated.map(t => ({ ...t, status: 'eliminated', reason: `Not in rule target` })),
        isNTFCause: true, remainingCount: 0, delta: -eliminated.length,
      })
      stages.push({
        id: 'ntf_rule', stepNumber: stepNum + 1, type: 'ntf',
        label: 'NTF — Payment Failed',
        description: `Rule "${rule.name}" eliminated all eligible terminals.`,
        ntfCause: 'rule_elimination', causeRuleId: rule.id, causeRuleName: rule.name,
      })
      return _buildResult(stages, null, true, warnings, merchant, routingStrategy)
    }

    if (eliminated.length > 0) {
      stages.push({
        id: `rule_${rule.id}`, stepNumber: stepNum++, type: 'rule_filter',
        label: `Rule: ${rule.name}`, ruleId: rule.id, ruleName: rule.name,
        ruleType: rule.type === 'volume_split' ? 'Volume Split' : 'Conditional',
        conditions: formatRuleConditions(rule), action: formatRuleAction(rule),
        description: `Rule matched. ${eliminated.length} terminal(s) not in target list eliminated.`,
        terminalsRemaining: kept.map(t => ({ ...t, status: 'passed' })),
        terminalsEliminated: eliminated.map(t => ({ ...t, status: 'eliminated', reason: 'Not in rule target list' })),
        remainingCount: kept.length, delta: -eliminated.length,
      })
      remaining = kept
    } else {
      stages.push({
        id: `rule_${rule.id}`, stepNumber: stepNum++, type: 'rule_pass',
        label: `Rule: ${rule.name}`, ruleId: rule.id, ruleName: rule.name,
        ruleType: rule.type === 'volume_split' ? 'Volume Split' : 'Conditional',
        conditions: formatRuleConditions(rule), action: formatRuleAction(rule),
        description: 'Rule matched. All remaining terminals are in target list.',
        terminalsRemaining: remaining.map(t => ({ ...t, status: 'passed' })),
        terminalsEliminated: [], remainingCount: remaining.length, delta: 0,
      })
    }
  }

  for (const rule of skippedByOverride) {
    if (rule.isDefault) continue
    stages.push({
      id: `rule_${rule.id}`, stepNumber: stepNum++, type: 'rule_disabled',
      label: `Rule: ${rule.name}`, ruleId: rule.id, ruleName: rule.name,
      ruleType: rule.type === 'volume_split' ? 'Volume Split' : 'Conditional',
      conditions: formatRuleConditions(rule),
      description: 'Rule disabled in simulation (what-if override)',
      terminalsRemaining: remaining.map(t => ({ ...t, status: 'passed' })),
      terminalsEliminated: [], remainingCount: remaining.length, delta: 0, isWhatIfDisabled: true,
    })
  }

  if (remaining.length === 0) {
    return _buildResult(stages, null, true, warnings, merchant, routingStrategy)
  }

  // SR Threshold Filter
  if (srThreshold > 0) {
    const belowThreshold = remaining.filter(t => t.successRate < srThreshold)
    const aboveThreshold = remaining.filter(t => t.successRate >= srThreshold)

    if (belowThreshold.length > 0 && aboveThreshold.length > 0) {
      stages.push({
        id: 'sr_threshold', stepNumber: stepNum++, type: 'threshold_filter',
        label: `SR Safety Net (≥${srThreshold}%)`,
        description: `${belowThreshold.length} terminal(s) below ${srThreshold}% SR threshold removed.`,
        terminalsRemaining: aboveThreshold.map(t => ({ ...t, status: 'passed' })),
        terminalsEliminated: belowThreshold.map(t => ({ ...t, status: 'eliminated', reason: `SR ${t.successRate}% < threshold ${srThreshold}%` })),
        remainingCount: aboveThreshold.length, delta: -belowThreshold.length, threshold: srThreshold,
      })
      remaining = aboveThreshold
    } else if (belowThreshold.length > 0 && aboveThreshold.length === 0) {
      warnings.push(`All ${remaining.length} terminals are below SR threshold ${srThreshold}% — threshold bypassed to prevent NTF`)
      stages.push({
        id: 'sr_threshold', stepNumber: stepNum++, type: 'threshold_bypass',
        label: `SR Safety Net (≥${srThreshold}%)`,
        description: `All terminals below threshold — bypassed to prevent NTF.`,
        terminalsRemaining: remaining.map(t => ({ ...t, status: 'warning' })),
        terminalsEliminated: [], remainingCount: remaining.length, delta: 0, threshold: srThreshold,
      })
    }
  }

  // Sorter
  const dopplerScores = generateDopplerScores(remaining, transaction, merchant)
  const dopplerMap = Object.fromEntries(dopplerScores.map(d => [d.terminalId, d.dopplerScore]))

  const scored = remaining.map(t => {
    const doppler = dopplerMap[t.terminalId] || 50
    let finalScore

    if (routingStrategy === 'cost_based') {
      const maxCost = Math.max(...remaining.map(r => r.costPerTxn), 3)
      const costScore = ((maxCost - t.costPerTxn) / maxCost) * 100
      finalScore = Math.round((costScore * 0.6 + doppler * 0.2 + t.successRate * 0.2) * 10) / 10
    } else {
      finalScore = Math.round((t.successRate * 0.5 + doppler * 0.35 + (t.isZeroCost ? 5 : 0) * 0.15) * 10) / 10
    }

    return { ...t, dopplerScore: doppler, finalScore }
  }).sort((a, b) => b.finalScore - a.finalScore)

  const selectedTerminal = scored[0]

  stages.push({
    id: 'sorter', stepNumber: stepNum++, type: 'sorter',
    label: `Sorter: ${routingStrategy === 'cost_based' ? 'Cost-Optimized' : 'SR-Optimized'}`,
    description: `${scored.length} terminal(s) scored and ranked.`,
    strategy: routingStrategy,
    scored: scored.map((t, rank) => ({ ...t, rank: rank + 1, isSelected: t.terminalId === selectedTerminal.terminalId })),
    selectedTerminal: {
      terminalId: selectedTerminal.terminalId, displayId: selectedTerminal.displayId,
      gatewayShort: selectedTerminal.gatewayShort, successRate: selectedTerminal.successRate,
      costPerTxn: selectedTerminal.costPerTxn, finalScore: selectedTerminal.finalScore,
      dopplerScore: selectedTerminal.dopplerScore,
    },
    remainingCount: scored.length,
  })

  return _buildResult(stages, selectedTerminal, false, warnings, merchant, routingStrategy)
}

function _buildResult(stages, selectedTerminal, isNTF, warnings, merchant, routingStrategy) {
  const currentPrimary = merchant.gatewayMetrics.find(gm => gm.terminalId === merchant.currentTerminalId)
  const currentGw = currentPrimary ? gateways.find(g => g.id === currentPrimary.gatewayId) : null
  const currentTerm = currentGw?.terminals.find(t => t.id === currentPrimary?.terminalId)

  let costDelta = null
  let srDelta = null

  if (selectedTerminal && currentPrimary) {
    costDelta = {
      absolute: Math.round((selectedTerminal.costPerTxn - currentPrimary.costPerTxn) * 100) / 100,
      label: selectedTerminal.costPerTxn <= currentPrimary.costPerTxn ? 'saving' : 'increase',
    }
    srDelta = {
      absolute: Math.round((selectedTerminal.successRate - currentPrimary.avgPaymentSuccessRate || currentPrimary.successRate) * 10) / 10,
      label: selectedTerminal.successRate >= (currentPrimary.successRate || 0) ? 'improvement' : 'decrease',
    }
  }

  return {
    stages, isNTF, warnings,
    selectedTerminal: selectedTerminal ? {
      terminalId: selectedTerminal.terminalId, displayId: selectedTerminal.displayId,
      gatewayShort: selectedTerminal.gatewayShort, successRate: selectedTerminal.successRate,
      costPerTxn: selectedTerminal.costPerTxn, dopplerScore: selectedTerminal.dopplerScore,
      finalScore: selectedTerminal.finalScore,
    } : null,
    currentPrimary: currentPrimary ? {
      terminalId: currentPrimary.terminalId,
      displayId: currentTerm?.terminalId || currentPrimary.terminalId,
      gatewayShort: currentGw?.shortName || '??',
      successRate: currentPrimary.successRate, costPerTxn: currentPrimary.costPerTxn,
    } : null,
    costDelta, srDelta, routingStrategy,
    stageCount: stages.length, terminalPoolSize: stages[0]?.totalCount || 0,
  }
}

// ── Batch Simulation (Galton Board) ──

export function batchSimulatePayments(merchant, transactions, rules, overrides = {}) {
  const terminalCounts = {}, terminalSRSums = {}, terminalCostSums = {}
  const ruleMatchCounts = {}, ruleElimCounts = {}, ruleAffected = {}
  let ntfCount = 0
  const traces = []

  const termInfoMap = {}
  merchant.gatewayMetrics.forEach(gm => {
    const gw = gateways.find(g => g.id === gm.gatewayId)
    const term = gw?.terminals.find(t => t.id === gm.terminalId)
    termInfoMap[gm.terminalId] = {
      terminalId: gm.terminalId, displayId: term?.terminalId || gm.terminalId,
      gatewayShort: gw?.shortName || '??', successRate: gm.successRate, costPerTxn: gm.costPerTxn,
    }
  })

  transactions.forEach((txn, idx) => {
    const simTxn = {
      payment_method: txn.paymentMethod?.short === 'CC' || txn.paymentMethod?.short === 'DC' ? 'Cards'
        : txn.paymentMethod?.short === 'UPI' ? 'UPI'
        : txn.paymentMethod?.short === 'NB' ? 'NB'
        : txn.paymentMethod?.label || 'Cards',
      amount: txn.amount || 1000,
      card_network: txn.paymentMethod?.short === 'CC' ? 'Visa' : txn.paymentMethod?.short === 'DC' ? 'RuPay' : '',
      card_type: txn.paymentMethod?.short === 'CC' ? 'credit' : txn.paymentMethod?.short === 'DC' ? 'debit' : '',
      international: false,
    }

    const result = simulateRoutingPipeline(merchant, simTxn, rules, overrides)

    if (result.isNTF) {
      ntfCount++
    } else if (result.selectedTerminal) {
      const tid = result.selectedTerminal.terminalId
      terminalCounts[tid] = (terminalCounts[tid] || 0) + 1
      terminalSRSums[tid] = (terminalSRSums[tid] || 0) + result.selectedTerminal.successRate
      terminalCostSums[tid] = (terminalCostSums[tid] || 0) + result.selectedTerminal.costPerTxn
    }

    result.stages.forEach(stage => {
      if (stage.type === 'rule_filter' || stage.type === 'rule_ntf' || stage.type === 'rule_pass') {
        const rid = stage.ruleId
        if (rid) {
          ruleMatchCounts[rid] = (ruleMatchCounts[rid] || 0) + 1
          ruleElimCounts[rid] = (ruleElimCounts[rid] || 0) + (stage.terminalsEliminated?.length || 0)
          if (!ruleAffected[rid]) ruleAffected[rid] = { name: stage.ruleName, count: 0 }
          ruleAffected[rid].count++
        }
      }
    })

    if (idx < 80) {
      const pathStages = []
      let eliminatedAtStage = null
      result.stages.forEach((stage, si) => {
        if (stage.type === 'rule_filter' || stage.type === 'rule_pass' || stage.type === 'rule_skip' || stage.type === 'rule_ntf') {
          pathStages.push(si)
        }
        if (stage.type === 'ntf' || stage.type === 'rule_ntf') {
          eliminatedAtStage = si
        }
      })

      traces.push({
        id: txn.txnId || `txn-${idx}`,
        paymentMethod: simTxn.payment_method,
        cardNetwork: simTxn.card_network,
        amount: simTxn.amount,
        finalTerminalId: result.isNTF ? null : result.selectedTerminal?.terminalId,
        isNTF: result.isNTF,
        pathStages, eliminatedAtStage,
      })
    }
  })

  const totalPayments = transactions.length
  const terminalDistribution = Object.keys(termInfoMap).map(tid => {
    const count = terminalCounts[tid] || 0
    const info = termInfoMap[tid]
    return {
      terminalId: tid, displayId: info.displayId, gatewayShort: info.gatewayShort,
      count, percentage: totalPayments > 0 ? Math.round((count / totalPayments) * 1000) / 10 : 0,
      avgSR: count > 0 ? Math.round((terminalSRSums[tid] / count) * 10) / 10 : info.successRate,
      avgCost: count > 0 ? Math.round((terminalCostSums[tid] / count) * 100) / 100 : info.costPerTxn,
    }
  }).sort((a, b) => b.count - a.count)

  const ruleImpact = Object.entries(ruleAffected).map(([rid, info]) => ({
    ruleId: rid, ruleName: info.name,
    matchCount: ruleMatchCounts[rid] || 0, eliminatedTerminals: ruleElimCounts[rid] || 0,
    affectedPayments: info.count,
  }))

  return { totalPayments, terminalDistribution, ntfCount, ntfPercentage: totalPayments > 0 ? Math.round((ntfCount / totalPayments) * 1000) / 10 : 0, ruleImpact, traces }
}

// ── Transaction Generator ──

const PAYMENT_METHODS = [
  { type: 'Visa Card', short: 'Cards', network: 'Visa', cardType: 'card' },
  { type: 'Mastercard Card', short: 'Cards', network: 'Mastercard', cardType: 'card' },
  { type: 'RuPay Card', short: 'Cards', network: 'RuPay', cardType: 'card' },
  { type: 'UPI', short: 'UPI', network: null, cardType: null },
  { type: 'Net Banking', short: 'NB', network: null, cardType: null },
]

export function generateMerchantTransactions(merchant) {
  const txnCount = 50
  const transactions = []
  const avgTxnValue = merchant.monthlyGMV / merchant.monthlyTxnVolume

  const terminalInfos = merchant.gatewayMetrics.map((gm) => {
    const gw = gateways.find((g) => g.id === gm.gatewayId)
    const term = gw?.terminals.find((t) => t.id === gm.terminalId)
    return {
      gatewayId: gm.gatewayId, terminalId: gm.terminalId,
      displayTerminalId: term?.terminalId || gm.terminalId,
      gatewayShort: gw?.shortName || 'Unknown',
      successRate: gm.successRate, costPerTxn: gm.costPerTxn,
      txnShare: gm.txnShare,
    }
  })

  const preferred = terminalInfos.slice().sort((a, b) => b.txnShare - a.txnShare)[0]

  for (let i = 0; i < txnCount; i++) {
    const seed = hashCode(merchant.id + '-txn-' + i)
    const txnId = 'pay_' + seed.toString(36).padStart(8, '0').slice(0, 8).toUpperCase()

    const now = new Date(2026, 2, 11, 10, 0, 0)
    const hoursAgo = (seed % 168)
    const timestamp = new Date(now.getTime() - hoursAgo * 3600000)

    const amountSeed = hashCode(merchant.id + '-amt-' + i)
    const amount = Math.round(avgTxnValue * (0.3 + (amountSeed % 300) / 100))

    const pmIdx = seed % PAYMENT_METHODS.length
    const paymentMethod = PAYMENT_METHODS[pmIdx]

    const statusSeed = hashCode(merchant.id + '-st-' + i) % 20
    const status = statusSeed < 15 ? 'success' : statusSeed < 18 ? 'failed' : 'refunded'

    let isNTF = false
    if (status === 'failed') {
      const ntfSeed = hashCode(merchant.id + '-ntf-' + i) % 10
      const ntfThreshold = merchant.dealType === 'tsp' ? 7 : merchant.dealType === 'offer-linked' ? 6 : 4
      if (ntfSeed < ntfThreshold) isNTF = true
    }

    transactions.push({ txnId, timestamp, amount, paymentMethod, status, isNTF })
  }

  transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  return transactions
}
