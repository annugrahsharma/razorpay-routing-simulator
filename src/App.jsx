import React, { useState, useMemo, useCallback } from 'react'
import FilterDiagram from './FilterDiagram'
import SortDiagram from './SortDiagram'
import PaymentForm from './PaymentForm'
import { merchants, gateways, generateSeedRules, simulateRoutingPipeline } from './data'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return React.createElement('div', { style: { padding: 20, color: '#dc2626', background: '#fef2f2', borderRadius: 8, margin: 16 } },
        React.createElement('strong', null, 'Error: '),
        this.state.error.message,
        React.createElement('button', { onClick: () => this.setState({ error: null }), style: { marginLeft: 12, padding: '4px 12px', cursor: 'pointer' } }, 'Retry')
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [selectedMerchantId, setSelectedMerchantId] = useState(merchants[0].id)
  const [mode, setMode] = useState('single') // 'single' | 'batch'
  const [vizTab, setVizTab] = useState('filter') // 'filter' | 'sort'
  const merchant = merchants.find(m => m.id === selectedMerchantId)
  const rules = useMemo(() => merchant ? generateSeedRules(merchant) : [], [merchant])

  const [simOverrides, setSimOverrides] = useState({
    disabledRules: new Set(),
    disabledTerminals: new Set(),
    srThreshold: merchant?.srThresholdLow || 0,
    routingStrategy: merchant?.routingStrategy || 'success_rate',
  })

  const [txn, setTxn] = useState({
    payment_method: 'Cards',
    amount: 5000,
    card_network: 'Visa',
    card_type: 'credit',
    international: false,
  })

  const [pipelineResult, setPipelineResult] = useState(null)
  const [animKey, setAnimKey] = useState(0)
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
          <select className="merchant-select" value={selectedMerchantId} onChange={handleMerchantChange}>
            {merchants.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.gatewayMetrics.length} terminals</option>
            ))}
          </select>
        </div>
      </header>

      <div className="app-body">
        <PaymentForm
          txn={txn}
          setTxn={setTxn}
          onSimulate={handleSimulate}
          pipelineResult={pipelineResult}
          activeStageIdx={activeStageIdx}
          merchant={merchant}
        />

        <div className="app-viz-panel">
          {/* Tab bar */}
          <div className="viz-tabs">
            <button className={`viz-tab${vizTab === 'filter' ? ' active' : ''}`} onClick={() => setVizTab('filter')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filter — NTF Check
            </button>
            <button className={`viz-tab${vizTab === 'sort' ? ' active' : ''}`} onClick={() => setVizTab('sort')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
              </svg>
              Sort — Probability
            </button>
          </div>

          {/* Diagram */}
          <div className="viz-content">
            <ErrorBoundary>
              {vizTab === 'filter' ? (
                <FilterDiagram
                  merchant={merchant}
                  rules={rules}
                  txn={txn}
                  gateways={gateways}
                  simOverrides={simOverrides}
                  onToggleRule={handleToggleRule}
                />
              ) : (
                <SortDiagram
                  merchant={merchant}
                  rules={rules}
                  txn={txn}
                  gateways={gateways}
                  simOverrides={simOverrides}
                />
              )}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
