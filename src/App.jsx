import React, { useState, useMemo } from 'react'
import GaltonBoard from './GaltonBoard'
import { merchants, gateways, generateSeedRules } from './data'

export default function App() {
  const [selectedMerchantId, setSelectedMerchantId] = useState(merchants[0].id)
  const merchant = merchants.find(m => m.id === selectedMerchantId)
  const rules = useMemo(() => merchant ? generateSeedRules(merchant) : [], [merchant])

  const [simOverrides, setSimOverrides] = useState({
    disabledRules: new Set(),
    disabledTerminals: new Set(),
    srThreshold: merchant?.srThresholdLow || 0,
    routingStrategy: merchant?.routingStrategy || 'success_rate',
  })

  // Reset overrides when merchant changes
  const handleMerchantChange = (e) => {
    const m = merchants.find(m => m.id === e.target.value)
    setSelectedMerchantId(e.target.value)
    setSimOverrides({
      disabledRules: new Set(),
      disabledTerminals: new Set(),
      srThreshold: m?.srThresholdLow || 0,
      routingStrategy: m?.routingStrategy || 'success_rate',
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#528FF0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="8 12 12 16 16 12"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
          </svg>
          <h1>Payment Routing Simulator</h1>
        </div>
        <div className="app-header-right">
          <label className="merchant-select-label">Merchant</label>
          <select
            className="merchant-select"
            value={selectedMerchantId}
            onChange={handleMerchantChange}
          >
            {merchants.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.category} ({m.gatewayMetrics.length} terminals)
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="app-main">
        <div className="merchant-info">
          <span className="merchant-name">{merchant.name}</span>
          <span className="merchant-mid">{merchant.mid}</span>
          <span className="merchant-badge">{merchant.category}</span>
          <span className="merchant-badge strategy">
            {merchant.routingStrategy === 'success_rate' ? 'SR-Optimized' : 'Cost-Optimized'}
          </span>
          {merchant.dealType === 'tsp' && (
            <span className="merchant-badge tsp">TSP</span>
          )}
        </div>

        {merchant && (
          <GaltonBoard
            merchant={merchant}
            rules={rules}
            simOverrides={simOverrides}
            setSimOverrides={setSimOverrides}
            gateways={gateways}
          />
        )}
      </main>
    </div>
  )
}
