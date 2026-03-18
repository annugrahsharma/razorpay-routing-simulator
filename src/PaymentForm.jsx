import React from 'react'

export default function PaymentForm({ txn, setTxn, onSimulate, pipelineResult, activeStageIdx, merchant }) {
  const isCards = txn.payment_method === 'Cards'

  const update = (field, value) => {
    setTxn(prev => ({ ...prev, [field]: value }))
  }

  // Find the active stage info
  const stages = pipelineResult?.stages || []
  const activeStage = activeStageIdx >= 0 && activeStageIdx < stages.length ? stages[activeStageIdx] : null

  return (
    <div className="payment-form-panel">
      <div className="pf-section">
        <div className="pf-section-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <span>Payment Definition</span>
        </div>

        <label className="pf-label">Payment Method</label>
        <select className="pf-select" value={txn.payment_method} onChange={e => update('payment_method', e.target.value)}>
          <option value="Cards">Cards</option>
          <option value="UPI">UPI</option>
          <option value="NB">Net Banking</option>
        </select>

        <label className="pf-label">Amount (₹)</label>
        <input
          className="pf-input"
          type="number"
          value={txn.amount}
          onChange={e => update('amount', Number(e.target.value))}
          min={1}
        />

        {isCards && (
          <>
            <label className="pf-label">Card Network</label>
            <select className="pf-select" value={txn.card_network} onChange={e => update('card_network', e.target.value)}>
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="RuPay">RuPay</option>
            </select>

            <label className="pf-label">Card Type</label>
            <select className="pf-select" value={txn.card_type} onChange={e => update('card_type', e.target.value)}>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
          </>
        )}

        <label className="pf-label">International</label>
        <label className="pf-toggle-row">
          <input
            type="checkbox"
            checked={txn.international}
            onChange={e => update('international', e.target.checked)}
            className="pf-checkbox"
          />
          <span className="pf-toggle-label">{txn.international ? 'International' : 'Domestic'}</span>
        </label>

        <button className="pf-simulate-btn" onClick={onSimulate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          Simulate Payment
        </button>
      </div>

      {/* Pipeline Stage Info */}
      {pipelineResult && (
        <div className="pf-section pf-result-section">
          <div className="pf-section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>Pipeline Result</span>
          </div>

          {/* Outcome badge */}
          <div className={`pf-outcome ${pipelineResult.isNTF ? 'ntf' : 'success'}`}>
            {pipelineResult.isNTF ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>Payment Failed — NTF</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 10"/></svg>
                <span>Routed to {pipelineResult.selectedTerminal?.displayId}</span>
              </>
            )}
          </div>

          {/* Selected terminal details */}
          {pipelineResult.selectedTerminal && (
            <div className="pf-terminal-detail">
              <div className="pf-detail-row">
                <span className="pf-detail-label">Gateway</span>
                <span className="pf-detail-value">{pipelineResult.selectedTerminal.gatewayShort}</span>
              </div>
              <div className="pf-detail-row">
                <span className="pf-detail-label">Success Rate</span>
                <span className="pf-detail-value">{pipelineResult.selectedTerminal.successRate}%</span>
              </div>
              <div className="pf-detail-row">
                <span className="pf-detail-label">Cost/Txn</span>
                <span className="pf-detail-value">₹{pipelineResult.selectedTerminal.costPerTxn}</span>
              </div>
              {pipelineResult.selectedTerminal.finalScore && (
                <div className="pf-detail-row">
                  <span className="pf-detail-label">Doppler Score</span>
                  <span className="pf-detail-value">{pipelineResult.selectedTerminal.finalScore}</span>
                </div>
              )}
            </div>
          )}

          {/* Stage count */}
          <div className="pf-stages-summary">
            {pipelineResult.stageCount} stages traversed
            {pipelineResult.warnings?.length > 0 && (
              <span className="pf-warning-count"> · {pipelineResult.warnings.length} warning(s)</span>
            )}
          </div>

          {/* Active stage detail */}
          {activeStage && (
            <div className="pf-active-stage">
              <div className="pf-active-stage-label">{activeStage.label}</div>
              <div className="pf-active-stage-desc">{activeStage.description}</div>
              {activeStage.remainingCount !== undefined && (
                <div className="pf-active-stage-count">
                  {activeStage.remainingCount} terminal{activeStage.remainingCount !== 1 ? 's' : ''} remaining
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {pipelineResult.warnings?.length > 0 && (
            <div className="pf-warnings">
              {pipelineResult.warnings.map((w, i) => (
                <div key={i} className="pf-warning">{w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
