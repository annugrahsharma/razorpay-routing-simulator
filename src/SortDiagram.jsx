import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { simulateRoutingPipeline } from './data'

/*
 * SortDiagram — Probability distribution
 *
 * Shows only eligible terminals (survivors from filtering).
 * 20+ balls drop through, weighted by sorter scores.
 * Bins fill up showing the traffic split probability.
 * Purpose: "Given eligible terminals, what's the likely traffic split?"
 */

const W = 640
const BALL_R = 6
const BALL_COUNT = 30
const BIN_H = 140
const TOP_PAD = 50
const FUNNEL_H = 60
const PEG_AREA_H = 150

const COLORS_BY_METHOD = { Cards: '#3b82f6', UPI: '#16a34a', NB: '#9333ea' }

function hashStr(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff
  return h
}

export default function SortDiagram({ merchant, rules, txn, gateways, simOverrides }) {
  const terminals = useMemo(() => {
    return merchant.gatewayMetrics.map(gm => {
      const gw = gateways.find(g => g.id === gm.gatewayId)
      const term = gw?.terminals.find(t => t.id === gm.terminalId)
      return {
        terminalId: gm.terminalId,
        displayId: term?.terminalId || gm.terminalId,
        gatewayShort: gw?.shortName || '??',
        successRate: gm.successRate,
        costPerTxn: gm.costPerTxn,
      }
    })
  }, [merchant, gateways])

  // Run simulation to get scored terminals
  const simResult = useMemo(() => {
    return simulateRoutingPipeline(merchant, txn, rules, simOverrides)
  }, [merchant, txn, rules, simOverrides])

  const scoredTerminals = simResult.stages?.find(s => s.type === 'sorter')?.scored || []
  const eligibleTerminals = scoredTerminals.map(s => ({
    ...s,
    ...terminals.find(t => t.terminalId === s.terminalId),
  }))

  const colCount = eligibleTerminals.length
  if (colCount === 0) {
    return (
      <div className="sort-diagram">
        <div className="sd-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p>No eligible terminals after filtering. All terminals are blocked — this payment type will result in NTF.</p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Switch to the Filter tab to diagnose which rules are causing this.</p>
        </div>
      </div>
    )
  }

  const binW = Math.max(80, (W - 60) / colCount)
  const totalBinsW = colCount * binW
  const binsLeft = (W - totalBinsW) / 2

  // Compute probability weights from scores
  const totalScore = eligibleTerminals.reduce((s, t) => s + t.finalScore, 0)
  const weights = eligibleTerminals.map(t => t.finalScore / totalScore)

  // Weighted random selection
  const pickTerminal = (seed) => {
    const r = (seed % 10000) / 10000
    let cumulative = 0
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i]
      if (r < cumulative) return i
    }
    return weights.length - 1
  }

  // Track bin counts for fill heights
  const [binCounts, setBinCounts] = useState({})
  const maxBinCount = Math.max(...Object.values(binCounts), 1)

  const funnelY = TOP_PAD
  const pegY = funnelY + FUNNEL_H + 10
  const binY = pegY + PEG_AREA_H + 20
  const totalH = binY + BIN_H + 60

  // Balls
  const [balls, setBalls] = useState([])
  const [isDropping, setIsDropping] = useState(false)
  const dropRef = useRef(null)

  const handleDrop = useCallback(() => {
    if (isDropping) return
    setIsDropping(true)
    setBalls([])
    setBinCounts({})

    const newBalls = []
    const counts = {}

    for (let i = 0; i < BALL_COUNT; i++) {
      const seed = hashStr(`sort-${i}-${txn.payment_method}-${txn.amount}-${Date.now()}`)
      const targetCol = pickTerminal(seed)
      const tid = eligibleTerminals[targetCol].terminalId
      counts[tid] = (counts[tid] || 0) + 1

      const jitters = Array.from({ length: 6 }, (_, j) => ((hashStr(`${i}-sj-${j}`) % 25) - 12))

      newBalls.push({
        id: `sb-${i}`,
        targetCol,
        delay: i * 100,
        jitters,
      })
    }

    let idx = 0
    const runningCounts = {}
    if (dropRef.current) clearInterval(dropRef.current)
    const interval = setInterval(() => {
      if (idx >= newBalls.length) {
        clearInterval(interval)
        setTimeout(() => setIsDropping(false), 2000)
        return
      }
      const ball = newBalls[idx]
      const tid = eligibleTerminals[ball.targetCol].terminalId
      runningCounts[tid] = (runningCounts[tid] || 0) + 1
      setBinCounts({ ...runningCounts })
      setBalls(prev => [...prev, { ...ball, startTime: Date.now() }])
      idx++
    }, 100)
    dropRef.current = interval
  }, [isDropping, eligibleTerminals, weights, txn])

  useEffect(() => {
    return () => { if (dropRef.current) clearInterval(dropRef.current) }
  }, [])

  // Auto-drop
  useEffect(() => {
    if (dropRef.current) clearInterval(dropRef.current)
    setIsDropping(false)
    setBalls([])
    setBinCounts({})
    const t = setTimeout(() => handleDrop(), 500)
    return () => clearTimeout(t)
  }, [simResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyframes
  const ballStyleSheet = useMemo(() => {
    if (balls.length === 0) return ''
    const seen = new Set()
    return balls.map(ball => {
      const animName = `sort-${ball.id}`
      if (seen.has(animName)) return ''
      seen.add(animName)

      const startX = W / 2
      const targetX = binsLeft + ball.targetCol * binW + binW / 2
      const steps = []
      steps.push(`0% { transform: translate(${startX}px, ${funnelY + 10}px); opacity: 0; }`)
      steps.push(`5% { transform: translate(${startX}px, ${funnelY + 25}px); opacity: 1; }`)

      ball.jitters.forEach((j, ji) => {
        const pct = 10 + (ji / ball.jitters.length) * 50
        const progress = (ji + 1) / ball.jitters.length
        const x = startX + (targetX - startX) * progress + j
        const y = pegY + PEG_AREA_H * progress
        steps.push(`${pct}% { transform: translate(${x}px, ${y}px); opacity: 1; }`)
      })

      steps.push(`75% { transform: translate(${targetX}px, ${binY + 10}px); opacity: 1; }`)
      steps.push(`100% { transform: translate(${targetX}px, ${binY + BIN_H * 0.7}px); opacity: 0.4; }`)

      return `@keyframes ${animName} { ${steps.join(' ')} }`
    }).filter(Boolean).join('\n')
  }, [balls, funnelY, pegY, binY, binsLeft, binW])

  const ballColor = COLORS_BY_METHOD[txn.payment_method] || '#3b82f6'

  // Peg grid
  const pegRows = 5
  const pegs = []
  for (let r = 0; r < pegRows; r++) {
    for (let c = 0; c <= colCount; c++) {
      const offset = r % 2 === 0 ? 0 : binW / 2
      pegs.push({
        x: binsLeft + c * binW + offset - binW / 2,
        y: pegY + 15 + r * (PEG_AREA_H - 20) / pegRows,
      })
    }
  }

  return (
    <div className="sort-diagram">
      {ballStyleSheet && <style>{ballStyleSheet}</style>}

      <div className="sd-header">
        <div className="sd-strategy">
          {simResult.routingStrategy === 'cost_based' ? 'Cost Optimized' : 'SR Optimized'} — {eligibleTerminals.length} eligible terminals
        </div>
      </div>

      <div className="fd-controls">
        <button className={`fd-drop-btn${isDropping ? ' dropping' : ''}`} onClick={handleDrop} disabled={isDropping}>
          {isDropping ? 'Dropping...' : `Drop ${BALL_COUNT} Payments`}
        </button>
      </div>

      <svg className="fd-svg" viewBox={`0 0 ${W} ${totalH}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="sd-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="sd-fill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#528FF0" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#528FF0" stopOpacity="0.25"/>
          </linearGradient>
        </defs>

        {/* Funnel */}
        <path d={`M ${W / 2 - 120} ${funnelY} L ${W / 2 + 120} ${funnelY} L ${W / 2 + 30} ${funnelY + FUNNEL_H} L ${W / 2 - 30} ${funnelY + FUNNEL_H} Z`}
          fill="#e0e7ff" stroke="#528FF0" strokeWidth="2" opacity="0.7"/>
        <text x={W / 2} y={funnelY + 30} textAnchor="middle" style={{ fontSize: '12px', fill: '#528FF0', fontWeight: 700 }}>
          {txn.payment_method} Payments
        </text>
        <text x={W / 2} y={funnelY + 46} textAnchor="middle" style={{ fontSize: '10px', fill: '#93a8d2', fontWeight: 500 }}>
          weighted by sorter scores
        </text>

        {/* Pegs */}
        {pegs.filter(p => p.x > binsLeft - 10 && p.x < binsLeft + totalBinsW + 10).map((peg, i) => (
          <circle key={`peg-${i}`} cx={peg.x} cy={peg.y} r={3.5} fill="#94a3b8" stroke="#64748b" strokeWidth="0.5" opacity="0.4"/>
        ))}

        {/* Bins with fill bars */}
        {eligibleTerminals.map((term, ci) => {
          const x = binsLeft + ci * binW
          const count = binCounts[term.terminalId] || 0
          const fillPct = maxBinCount > 0 ? count / BALL_COUNT : 0
          const fillH = Math.max(2, fillPct * (BIN_H - 20))
          const pctLabel = BALL_COUNT > 0 ? Math.round((count / BALL_COUNT) * 100) : 0

          return (
            <g key={`sbin-${ci}`}>
              {/* Bin outline */}
              <rect x={x + 3} y={binY} width={binW - 6} height={BIN_H} rx={8}
                fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>

              {/* Fill bar from bottom */}
              <rect x={x + 5} y={binY + BIN_H - 2 - fillH} width={binW - 10} height={fillH} rx={5}
                fill="url(#sd-fill)"/>

              {/* Count */}
              <text x={x + binW / 2} y={binY + BIN_H - fillH - 8} textAnchor="middle"
                style={{ fontSize: '16px', fill: '#1A202C', fontWeight: 800 }}>
                {count}
              </text>

              {/* Percentage */}
              <text x={x + binW / 2} y={binY + BIN_H + 18} textAnchor="middle"
                style={{ fontSize: '13px', fill: '#528FF0', fontWeight: 700 }}>
                {pctLabel}%
              </text>

              {/* Terminal label */}
              <text x={x + binW / 2} y={binY + BIN_H + 34} textAnchor="middle"
                style={{ fontSize: '11px', fill: '#1A202C', fontWeight: 700, fontFamily: "'Menlo', monospace" }}>
                {term.displayId}
              </text>
              <text x={x + binW / 2} y={binY + BIN_H + 48} textAnchor="middle"
                style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }}>
                {term.gatewayShort} · Score {Math.round(term.finalScore)}
              </text>
            </g>
          )
        })}

        {/* Animated balls */}
        {balls.map(ball => (
          <circle key={ball.id} r={BALL_R} fill={ballColor} filter="url(#sd-glow)"
            style={{
              animation: `sort-${ball.id} 2000ms ease-in-out forwards`,
              animationDelay: `${ball.delay}ms`,
              opacity: 0,
            }}/>
        ))}
      </svg>
    </div>
  )
}
