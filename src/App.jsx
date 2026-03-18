import React, { useState, useMemo, useCallback } from 'react'
import GaltonBoard from './GaltonBoard'
import PipelineView from './PipelineView'
import PaymentForm from './PaymentForm'
import { merchants, gateways, generateSeedRules, simulateRoutingPipeline } from './data'

export default function App() {
  const [selectedMerchantId, setSelectedMerchantId] = useState(merchants[0].id)
  const [mode, setMode] = useState('single') // 'single' | 'batch'
  const merchant = merchants.find(m => m.id === selectedMerchantId)
  const rules = useMemo(() => merchant ? generateSeedRules(merchant) : [], [merchant])

  const [simOverrides, setSimOverrides] = useState({
    disabledRules: new Set(),
    disabledTerminals: new Set(),
    srThreshold: merchant?.srThresholdLow || 0,
    routingStrategy: merchant?.routingStrategy || 'success_rate',
  })

  // Single-payment transaction definition
  const [txn, setTxn] = useState({
    payment_method: 'Cards',
    amount: 5000,
    card_network: 'Visa',
    card_type: 'credit',
    international: false,
  })

  // Pipeline result + animation state
  const [pipelineResult, setPipelineResult] = useState(null)
  const [animKey, setAnimKey] = useState(0) // increment to restart animation
  const [activeStageIdx, setActiveStageIdx] = useState(-1)

  const handleMerchantChange = (e) => {
    const m = merchants.find(m => m.id === e.target.value)
    setSelectedMerchantId(e.target.value)
    setSimOverrides({
      disabledRules: new Set(),
      disabledTerminals: new Set(),
      srThreshold: m?.srThresholdLow || 0,
      routingStrategy: m?.routingStrategy || 'success_rate',
    })
    setPipelineResult(null)
    setActiveStageIdx(-1)
  }

  const handleSimulate = useCallback(() => {
    if (!merchant) return
    const result = simulateRoutingPipeline(merchant, txn, rules, simOverrides)
    setPipelineResult(result)
    setAnimKey(k => k + 1)
    setActiveStageIdx(-1)
  }, [merchant, txn, rules, simOverrides])

  const handleToggleRule = useCallback((ruleId) => {
    if (!ruleId) return
    setSimOverrides(prev => {
      const next = new Set(prev.disabledRules)
      next.has(ruleId) ? next.delete(ruleId) : next.add(ruleId)
      return { ...prev, disabledRules: next }
    })
  }, [])

  const handleToggleTerminal = useCallback((terminalId) => {
    if (!terminalId) return
    setSimOverrides(prev => {
      const next = new Set(prev.disabledTerminals)
      next.has(terminalId) ? next.delete(terminalId) : next.add(terminalId)
      return { ...prev, disabledTerminals: next }
    })
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#528FF0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>
          </svg>
          <h1>Payment Routing Simulator</h1>
        </div>
        <div className="app-header-right">
          <div className="mode-toggle">
            <button className={`mode-btn${mode === 'single' ? ' active' : ''}`} onClick={() => setMode('single')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-10-10h4m12 0h4"/></svg>
              Single Payment
            </button>
            <button className={`mode-btn${mode === 'batch' ? ' active' : ''}`} onClick={() => setMode('batch')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              Batch
            </button>
          </div>
          <div className="header-sep"></div>
          <select className="merchant-select" value={selectedMerchantId} onChange={handleMerchantChange}>
            {merchants.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.gatewayMetrics.length} terminals</option>
            ))}
          </select>
        </div>
      </header>

      <div className="app-body">
        {mode === 'single' ? (
          <>
            <PaymentForm
              txn={txn}
              setTxn={setTxn}
              onSimulate={handleSimulate}
              pipelineResult={pipelineResult}
              activeStageIdx={activeStageIdx}
              merchant={merchant}
            />
            <div className="app-pipeline-panel">
              <PipelineView
                key={selectedMerchantId}
                merchant={merchant}
                rules={rules}
                txn={txn}
                gateways={gateways}
                simOverrides={simOverrides}
                pipelineResult={pipelineResult}
                animKey={animKey}
                onStageReached={setActiveStageIdx}
                onToggleRule={handleToggleRule}
                onToggleTerminal={handleToggleTerminal}
              />
            </div>
          </>
        ) : (
          <div className="app-batch-panel">
            <GaltonBoard
              merchant={merchant}
              rules={rules}
              simOverrides={simOverrides}
              setSimOverrides={setSimOverrides}
              gateways={gateways}
            />
          </div>
        )}
      </div>
    </div>
  )
}
