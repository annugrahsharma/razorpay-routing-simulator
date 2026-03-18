import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { generateMerchantTransactions, batchSimulatePayments, simulateRoutingPipeline } from './data'

// Deterministic pseudo-random from a string
function hashStr(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff
  }
  return hash
}

export default function GaltonBoard({ merchant, rules, simOverrides, setSimOverrides, gateways: gwData }) {
  const [galtonRange, setGaltonRange] = useState('7d')
  const [galtonBalls, setGaltonBalls] = useState([])
  const [isDropping, setIsDropping] = useState(false)
  const [hoveredBin, setHoveredBin] = useState(null)
  const dropTimerRef = useRef(null)

  // Generate transactions and filter by date range
  const allTxns = useMemo(() => merchant ? generateMerchantTransactions(merchant) : [], [merchant])

  const filteredTxns = useMemo(() => {
    const now = new Date(2026, 2, 11, 10, 0, 0)
    const rangeMs = {
      '24h': 24 * 3600000,
      '7d': 7 * 24 * 3600000,
      '30d': 30 * 24 * 3600000,
      'all': Infinity,
    }
    const cutoff = rangeMs[galtonRange] || rangeMs['7d']
    if (cutoff === Infinity) return allTxns
    return allTxns.filter(t => (now.getTime() - t.timestamp.getTime()) <= cutoff)
  }, [allTxns, galtonRange])

  // Batch simulation result
  const batchResult = useMemo(() => {
    if (!merchant || !merchant.gatewayMetrics) return { totalPayments: 0, terminalDistribution: [], ntfCount: 0, ntfPercentage: 0, traces: [], ruleImpact: [] }
    return batchSimulatePayments(merchant, filteredTxns, rules, simOverrides)
  }, [merchant, filteredTxns, rules, simOverrides])

  // Build terminal columns (always show all terminals + NTF bin)
  const terminalCols = useMemo(() => {
    if (!merchant || !merchant.gatewayMetrics || !batchResult?.terminalDistribution) return []
    const cols = merchant.gatewayMetrics.map(gm => {
      const gw = gwData.find(g => g.id === gm.gatewayId)
      const term = gw?.terminals.find(t => t.id === gm.terminalId)
      const dist = batchResult.terminalDistribution.find(d => d.terminalId === gm.terminalId)
      return {
        terminalId: gm.terminalId,
        displayId: term?.terminalId || gm.terminalId,
        gatewayShort: gw?.shortName || '??',
        count: dist?.count || 0,
        percentage: dist?.percentage || 0,
        avgSR: dist?.avgSR || gm.successRate,
        avgCost: dist?.avgCost || gm.costPerTxn,
      }
    })
    cols.push({
      terminalId: '__ntf__',
      displayId: 'NTF',
      gatewayShort: 'Failed',
      count: batchResult.ntfCount,
      percentage: batchResult.ntfPercentage,
      avgSR: 0, avgCost: 0, isNTF: true,
    })
    return cols
  }, [merchant, gwData, batchResult])

  // Extract rule rows from simulation for the peg board
  const ruleRows = useMemo(() => {
    if (!merchant || !merchant.gatewayMetrics) return []
    const sampleTxn = { payment_method: 'Cards', amount: 5000, card_network: 'Visa', card_type: 'credit', international: false }
    const sampleResult = simulateRoutingPipeline(merchant, sampleTxn, rules, simOverrides)
    const ruleStages = sampleResult.stages.filter(s =>
      s.type === 'rule_filter' || s.type === 'rule_ntf' || s.type === 'rule_skip' || s.type === 'rule_pass' || s.type === 'rule_disabled'
    )
    return ruleStages.map(stage => {
      const eliminatedIds = new Set((stage.terminalsEliminated || []).map(t => t.terminalId))
      const remainingIds = new Set((stage.terminalsRemaining || []).map(t => t.terminalId))
      return {
        ruleId: stage.ruleId, ruleName: stage.ruleName || stage.label,
        type: stage.type, eliminatedIds, remainingIds, isDisabled: stage.isWhatIfDisabled,
      }
    })
  }, [merchant, rules, simOverrides])

  // Sorter scores for deflector widths
  const sorterScores = useMemo(() => {
    const sampleTxn = { payment_method: 'Cards', amount: 5000, card_network: 'Visa', card_type: 'credit', international: false }
    const sampleResult = simulateRoutingPipeline(merchant, sampleTxn, rules, simOverrides)
    const sorterStage = sampleResult.stages.find(s => s.type === 'sorter')
    if (!sorterStage?.scored) return {}
    const scoreMap = {}
    sorterStage.scored.forEach(t => { scoreMap[t.terminalId] = t.finalScore })
    return scoreMap
  }, [merchant, rules, simOverrides])

  // Layout constants
  const W = 800, H = 600
  const colCount = terminalCols.length
  const laneW = W / colCount
  const entryY = 60
  const pegStartY = 100
  const pegRowH = ruleRows.length > 0 ? Math.min(45, 160 / ruleRows.length) : 45
  const sorterY = pegStartY + ruleRows.length * pegRowH + 20
  const binStartY = sorterY + 60
  const binH = H - binStartY - 30

  const maxCount = Math.max(...terminalCols.map(c => c.count), 1)

  const ballColor = (pm) => {
    if (pm === 'UPI') return '#16a34a'
    if (pm === 'NB') return '#9333ea'
    return '#2563eb'
  }

  const isDroppingRef = useRef(false)

  const handleDrop = useCallback(() => {
    if (isDroppingRef.current) return
    if (!batchResult || !batchResult.traces || batchResult.traces.length === 0 || terminalCols.length === 0) return
    isDroppingRef.current = true
    setIsDropping(true)
    setGaltonBalls([])

    const traces = batchResult.traces
    const cols = terminalCols
    const rows = ruleRows

    const balls = traces.map((trace, i) => {
      let targetColIdx = cols.findIndex(c => c.terminalId === trace.finalTerminalId)
      if (trace.isNTF || targetColIdx < 0) targetColIdx = cols.length - 1

      const jitters = rows.map((_, ri) => ((hashStr(trace.id + '-j-' + ri) % 17) - 8))

      return {
        id: trace.id,
        targetColIdx,
        color: ballColor(trace.paymentMethod),
        delay: i * 30,
        isNTF: trace.isNTF,
        jitters,
        paymentMethod: trace.paymentMethod,
        amount: trace.amount,
      }
    })

    let ballIdx = 0
    if (dropTimerRef.current) clearInterval(dropTimerRef.current)
    const interval = setInterval(() => {
      if (ballIdx >= balls.length) {
        clearInterval(interval)
        setTimeout(() => {
          isDroppingRef.current = false
          setIsDropping(false)
        }, 1800)
        return
      }
      setGaltonBalls(prev => [...prev, { ...balls[ballIdx], startTime: Date.now() }])
      ballIdx++
    }, 30)
    dropTimerRef.current = interval
  }, [batchResult, terminalCols, ruleRows])

  useEffect(() => {
    return () => {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current)
      isDroppingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (dropTimerRef.current) {
      clearInterval(dropTimerRef.current)
      dropTimerRef.current = null
    }
    isDroppingRef.current = false
    setIsDropping(false)
    setGaltonBalls([])
    const t = setTimeout(() => handleDrop(), 300)
    return () => clearTimeout(t)
  }, [batchResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleRule = (ruleId) => {
    if (!ruleId) return
    setSimOverrides(prev => {
      const next = new Set(prev.disabledRules)
      next.has(ruleId) ? next.delete(ruleId) : next.add(ruleId)
      return { ...prev, disabledRules: next }
    })
  }

  const generateBallStyle = useCallback((ball) => {
    if (!ball || !ball.id) return null
    const targetX = laneW * ball.targetColIdx + laneW / 2
    const startX = W / 2
    const totalDuration = 1500

    const steps = []
    steps.push({ pct: 0, x: startX, y: entryY - 15 })
    steps.push({ pct: 8, x: startX, y: entryY + 10 })

    ruleRows.forEach((_, ri) => {
      const pct = 15 + (ri / Math.max(ruleRows.length, 1)) * 40
      const progress = (ri + 1) / Math.max(ruleRows.length, 1)
      const x = startX + (targetX - startX) * progress * 0.6 + (ball.jitters?.[ri] || 0)
      const y = pegStartY + ri * pegRowH + pegRowH / 2
      steps.push({ pct, x, y })
    })

    steps.push({ pct: 65, x: startX + (targetX - startX) * 0.85, y: sorterY + 15 })
    steps.push({ pct: 88, x: targetX, y: binStartY + 5 })
    steps.push({ pct: 100, x: targetX, y: binStartY + binH * 0.5 })

    const keyframes = steps.map(s =>
      `${s.pct}% { transform: translate(${s.x}px, ${s.y}px); opacity: ${s.pct > 92 ? 0.3 : s.pct < 5 ? 0 : 1}; }`
    ).join('\n')

    const animName = `galton-ball-${(ball.id || 'unknown').replace(/[^a-zA-Z0-9]/g, '')}`

    return { animName, keyframes, duration: totalDuration, delay: ball.delay }
  }, [laneW, W, entryY, pegStartY, pegRowH, ruleRows, sorterY, binStartY, binH])

  const ballStyleSheet = useMemo(() => {
    if (galtonBalls.length === 0) return ''
    const seen = new Set()
    return galtonBalls.map(ball => {
      const s = generateBallStyle(ball)
      if (!s || seen.has(s.animName)) return ''
      seen.add(s.animName)
      return `@keyframes ${s.animName} { ${s.keyframes} }`
    }).filter(Boolean).join('\n')
  }, [galtonBalls, generateBallStyle])

  if (terminalCols.length === 0) return null

  return (
    <div className="kam-galton-board">
      {ballStyleSheet && <style>{ballStyleSheet}</style>}

      <div className="kam-galton-controls">
        <div className="kam-galton-range-btns">
          {['24h', '7d', '30d', 'all'].map(r => (
            <button
              key={r}
              className={`kam-galton-range-btn${galtonRange === r ? ' active' : ''}`}
              onClick={() => setGaltonRange(r)}
            >{r === 'all' ? 'All' : r}</button>
          ))}
        </div>
        <span className="kam-galton-count">{filteredTxns.length} payments in range</span>
        <button
          className={`kam-galton-drop-btn${isDropping ? ' dropping' : ''}`}
          onClick={handleDrop}
          disabled={isDropping}
        >
          {isDropping ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/></svg>
              Dropping...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>
              </svg>
              Drop Payments
            </>
          )}
        </button>
      </div>

      <svg className="kam-galton-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="galton-glow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="galton-bin-fill-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#528FF0" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#528FF0" stopOpacity="0.3"/>
          </linearGradient>
          <linearGradient id="galton-ntf-fill-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#E74C3C" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#E74C3C" stopOpacity="0.3"/>
          </linearGradient>
        </defs>

        {/* Entry zone: funnel */}
        <path
          d={`M ${W / 2 - 80} ${entryY - 10} L ${W / 2 + 80} ${entryY - 10} L ${W / 2 + 30} ${entryY + 20} L ${W / 2 - 30} ${entryY + 20} Z`}
          className="kam-galton-funnel"
        />
        <text x={W / 2} y={entryY + 5} textAnchor="middle" className="kam-galton-funnel-label">
          {filteredTxns.length} payments
        </text>

        {/* Lane dividers */}
        {terminalCols.map((_, ci) => (
          <line key={`lane-${ci}`} x1={laneW * (ci + 1)} y1={pegStartY - 10} x2={laneW * (ci + 1)} y2={H - 10} className="kam-galton-lane-divider"/>
        ))}

        {/* Lane headers */}
        {terminalCols.map((col, ci) => (
          <text key={`hdr-${ci}`} x={laneW * ci + laneW / 2} y={pegStartY - 15} textAnchor="middle" className={`kam-galton-lane-header${col.isNTF ? ' ntf' : ''}`}>
            {col.displayId.length > 12 ? col.displayId.slice(-8) : col.displayId}
          </text>
        ))}

        {/* Peg rows (one per rule) */}
        {ruleRows.map((row, ri) => {
          const rowY = pegStartY + ri * pegRowH + pegRowH / 2
          return (
            <g key={`rule-row-${ri}`}>
              <text x={8} y={rowY + 4} className={`kam-galton-rule-label${row.isDisabled ? ' disabled' : ''}`}>
                {(row.ruleName || '').length > 14 ? (row.ruleName || '').slice(0, 14) + '..' : row.ruleName}
              </text>
              {terminalCols.map((col, ci) => {
                if (col.isNTF) return null
                const cx = laneW * ci + laneW / 2
                const isEliminated = row.eliminatedIds.has(col.terminalId)
                const isKept = row.remainingIds.has(col.terminalId)
                const isSkip = row.type === 'rule_skip'
                const isDisabled = row.isDisabled

                let pegClass = 'kam-galton-peg'
                if (isDisabled) pegClass += ' disabled'
                else if (isEliminated) pegClass += ' blocking'
                else if (isKept) pegClass += ' open'
                else if (isSkip) pegClass += ' skip'
                else pegClass += ' neutral'

                return (
                  <g key={`peg-${ri}-${ci}`} style={{ cursor: row.ruleId ? 'pointer' : 'default' }} onClick={() => handleToggleRule(row.ruleId)}>
                    <circle cx={cx} cy={rowY} r={8} className={pegClass} />
                    {isEliminated && !isDisabled && (
                      <line x1={cx - 5} y1={rowY - 5} x2={cx + 5} y2={rowY + 5} className="kam-galton-peg-strike" />
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* Sorter row */}
        <text x={8} y={sorterY + 15} className="kam-galton-rule-label">Sorter</text>
        {terminalCols.map((col, ci) => {
          if (col.isNTF) return null
          const cx = laneW * ci + laneW / 2
          const score = sorterScores[col.terminalId] || 50
          const maxScore = Math.max(...Object.values(sorterScores), 1)
          const deflW = 10 + (score / maxScore) * (laneW * 0.6 - 10)
          return (
            <g key={`defl-${ci}`}>
              <path d={`M ${cx - deflW / 2} ${sorterY} L ${cx + deflW / 2} ${sorterY} L ${cx + deflW / 3} ${sorterY + 30} L ${cx - deflW / 3} ${sorterY + 30} Z`} className="kam-galton-deflector"/>
              <text x={cx} y={sorterY + 48} textAnchor="middle" className="kam-galton-deflector-score">{Math.round(score)}</text>
            </g>
          )
        })}

        {/* Terminal bins */}
        {terminalCols.map((col, ci) => {
          const bx = laneW * ci + 6
          const bw = laneW - 12
          const fillPct = maxCount > 0 ? col.count / maxCount : 0
          const fillH = Math.max(4, fillPct * (binH - 20))
          const isNTFBin = col.isNTF

          return (
            <g key={`bin-${ci}`} onMouseEnter={() => setHoveredBin(ci)} onMouseLeave={() => setHoveredBin(null)} className="kam-galton-bin-group">
              <rect x={bx} y={binStartY} width={bw} height={binH - 10} rx={4} className={`kam-galton-bin${isNTFBin ? ' ntf' : ''}`}/>
              <rect x={bx + 2} y={binStartY + (binH - 12) - fillH} width={bw - 4} height={fillH} rx={3} className={`kam-galton-bin-fill${isNTFBin ? ' ntf' : ''}`}/>
              <text x={laneW * ci + laneW / 2} y={binStartY + binH - 18} textAnchor="middle" className={`kam-galton-bin-count${isNTFBin ? ' ntf' : ''}`}>{col.count}</text>
              <text x={laneW * ci + laneW / 2} y={binStartY + binH - 4} textAnchor="middle" className={`kam-galton-bin-pct${isNTFBin ? ' ntf' : ''}`}>{col.percentage}%</text>
              <text x={laneW * ci + laneW / 2} y={binStartY + binH + 10} textAnchor="middle" className={`kam-galton-bin-label${isNTFBin ? ' ntf' : ''}`}>{col.gatewayShort}</text>

              {hoveredBin === ci && (
                <g>
                  <rect x={laneW * ci + laneW / 2 - 65} y={binStartY - 55} width={130} height={48} rx={6} className="kam-galton-tooltip-bg"/>
                  <text x={laneW * ci + laneW / 2} y={binStartY - 38} textAnchor="middle" className="kam-galton-tooltip-text">
                    {isNTFBin ? `${col.count} failed payments` : `SR: ${col.avgSR}% | Cost: ₹${col.avgCost}`}
                  </text>
                  <text x={laneW * ci + laneW / 2} y={binStartY - 22} textAnchor="middle" className="kam-galton-tooltip-sub">
                    {isNTFBin ? 'No terminal found' : `${col.count} payments (${col.percentage}%)`}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Animated balls */}
        {galtonBalls.map((ball, bi) => {
          const s = generateBallStyle(ball)
          if (!s) return null
          return (
            <circle
              key={`${ball.id || bi}-${bi}`}
              r={4}
              className={`kam-galton-ball${ball.isNTF ? ' ntf' : ''}`}
              style={{
                fill: ball.color,
                animation: `${s.animName} ${s.duration}ms ease-in-out forwards`,
                animationDelay: `${s.delay}ms`,
              }}
            />
          )
        })}
      </svg>

      <div className="kam-galton-legend">
        <span className="kam-galton-legend-item"><span className="kam-galton-dot" style={{ background: '#2563eb' }}></span> Cards</span>
        <span className="kam-galton-legend-item"><span className="kam-galton-dot" style={{ background: '#16a34a' }}></span> UPI</span>
        <span className="kam-galton-legend-item"><span className="kam-galton-dot" style={{ background: '#9333ea' }}></span> NB</span>
        <span className="kam-galton-legend-sep"></span>
        <span className="kam-galton-legend-item"><span className="kam-galton-dot blocking"></span> Blocks terminal</span>
        <span className="kam-galton-legend-item"><span className="kam-galton-dot open"></span> Passes through</span>
        <span className="kam-galton-legend-item"><span className="kam-galton-dot skip"></span> Rule skipped</span>
        <span className="kam-galton-legend-hint">Click pegs to toggle rules</span>
      </div>
    </div>
  )
}
