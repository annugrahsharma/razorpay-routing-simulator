import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { simulateRoutingPipeline } from './data'

/*
 * FilterDiagram — Plinko-style NTF checker
 *
 * Balls rain down from above. Below are doors/bins for each terminal.
 * Rules close doors. If ALL doors close → NTF (balls pile up at the top).
 * Purpose: "Will these rules cause NTFs for this payment type?"
 */

const W = 640
const BALL_R = 6
const BALL_COUNT = 25
const BIN_W_MIN = 60
const BIN_H = 100
const DOOR_H = 50
const PEG_AREA_H = 180
const TOP_PAD = 50
const FUNNEL_H = 50

const COLORS_BY_METHOD = { Cards: '#3b82f6', UPI: '#16a34a', NB: '#9333ea' }

function hashStr(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff
  return h
}

export default function FilterDiagram({ merchant, rules, txn, gateways, simOverrides, onToggleRule }) {
  const terminals = useMemo(() => {
    return merchant.gatewayMetrics.map(gm => {
      const gw = gateways.find(g => g.id === gm.gatewayId)
      const term = gw?.terminals.find(t => t.id === gm.terminalId)
      return {
        terminalId: gm.terminalId,
        displayId: term?.terminalId || gm.terminalId,
        gatewayShort: gw?.shortName || '??',
        successRate: gm.successRate,
        supportedMethods: gm.supportedMethods || [],
      }
    })
  }, [merchant, gateways])

  const colCount = terminals.length
  const binW = Math.max(BIN_W_MIN, (W - 40) / colCount)
  const totalBinsW = colCount * binW
  const binsLeft = (W - totalBinsW) / 2

  // Run simulation to determine which terminals are blocked
  const simResult = useMemo(() => {
    return simulateRoutingPipeline(merchant, txn, rules, simOverrides)
  }, [merchant, txn, rules, simOverrides])

  // Determine which terminals are eliminated (door closed)
  const doorState = useMemo(() => {
    const result = {}
    terminals.forEach(t => { result[t.terminalId] = { open: true, reason: '' } })

    // Check pool elimination (method support)
    const poolStage = simResult.stages.find(s => s.type === 'initial')
    if (poolStage) {
      (poolStage.terminalsEliminated || []).forEach(t => {
        result[t.terminalId] = { open: false, reason: t.reason || 'Not eligible' }
      })
    }

    // Check rule eliminations
    simResult.stages.forEach(s => {
      if (s.type === 'rule_filter' || s.type === 'rule_ntf') {
        (s.terminalsEliminated || []).forEach(t => {
          if (result[t.terminalId]?.open) {
            result[t.terminalId] = { open: false, reason: `Rule: ${s.ruleName}`, ruleId: s.ruleId }
          }
        })
      }
    })

    return result
  }, [terminals, simResult])

  const isNTF = simResult.isNTF
  const openCount = Object.values(doorState).filter(d => d.open).length

  // ── Y Layout ──
  const funnelY = TOP_PAD
  const pegY = funnelY + FUNNEL_H + 10
  const doorY = pegY + PEG_AREA_H
  const binY = doorY + DOOR_H
  const totalH = binY + BIN_H + 40

  // ── Ball animation ──
  const [balls, setBalls] = useState([])
  const [isDropping, setIsDropping] = useState(false)
  const dropRef = useRef(null)

  const handleDrop = useCallback(() => {
    if (isDropping) return
    setIsDropping(true)
    setBalls([])

    const openTerminals = terminals.filter(t => doorState[t.terminalId]?.open)
    const newBalls = []

    for (let i = 0; i < BALL_COUNT; i++) {
      const seed = hashStr(`ball-${i}-${txn.payment_method}-${txn.amount}`)
      let targetCol
      if (openTerminals.length === 0) {
        // NTF — balls pile up
        targetCol = -1
      } else {
        // Randomly pick an open terminal
        targetCol = terminals.indexOf(openTerminals[seed % openTerminals.length])
      }

      // Generate random peg bounces
      const jitters = Array.from({ length: 8 }, (_, j) => ((hashStr(`${i}-j-${j}`) % 21) - 10))

      newBalls.push({
        id: `b-${i}`,
        targetCol,
        delay: i * 80,
        jitters,
        isNTF: targetCol < 0,
      })
    }

    let idx = 0
    if (dropRef.current) clearInterval(dropRef.current)
    const interval = setInterval(() => {
      if (idx >= newBalls.length) {
        clearInterval(interval)
        setTimeout(() => setIsDropping(false), 2000)
        return
      }
      setBalls(prev => [...prev, { ...newBalls[idx], startTime: Date.now() }])
      idx++
    }, 80)
    dropRef.current = interval
  }, [isDropping, terminals, doorState, txn])

  useEffect(() => {
    return () => { if (dropRef.current) clearInterval(dropRef.current) }
  }, [])

  // Auto-drop on first render or when rules change
  useEffect(() => {
    if (dropRef.current) clearInterval(dropRef.current)
    setIsDropping(false)
    setBalls([])
    const t = setTimeout(() => handleDrop(), 400)
    return () => clearTimeout(t)
  }, [simResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // Generate keyframes for each ball
  const ballStyleSheet = useMemo(() => {
    if (balls.length === 0) return ''
    const seen = new Set()
    return balls.map(ball => {
      const animName = `plinko-${ball.id}`
      if (seen.has(animName)) return ''
      seen.add(animName)

      const startX = W / 2
      const startY = funnelY + 10
      const targetX = ball.targetCol >= 0
        ? binsLeft + ball.targetCol * binW + binW / 2
        : W / 2
      const targetY = ball.isNTF ? doorY - 10 : binY + BIN_H * 0.6

      const steps = []
      steps.push(`0% { transform: translate(${startX}px, ${startY}px); opacity: 0; }`)
      steps.push(`5% { transform: translate(${startX}px, ${startY + 15}px); opacity: 1; }`)

      // Peg bounces through the peg area
      ball.jitters.forEach((j, ji) => {
        const pct = 10 + (ji / ball.jitters.length) * 50
        const progress = (ji + 1) / ball.jitters.length
        const x = startX + (targetX - startX) * progress * 0.8 + j
        const y = pegY + (PEG_AREA_H * progress)
        steps.push(`${pct}% { transform: translate(${x}px, ${y}px); opacity: 1; }`)
      })

      if (ball.isNTF) {
        // NTF — ball hits closed doors and bounces back
        steps.push(`70% { transform: translate(${targetX}px, ${doorY - 15}px); opacity: 1; }`)
        steps.push(`80% { transform: translate(${targetX}px, ${doorY - 5}px); opacity: 1; }`)
        steps.push(`85% { transform: translate(${targetX + ((hashStr(ball.id) % 20) - 10)}px, ${doorY - 20}px); opacity: 0.8; }`)
        steps.push(`100% { transform: translate(${targetX}px, ${doorY - 8}px); opacity: 0.5; }`)
      } else {
        // Successful — ball passes through open door into bin
        steps.push(`70% { transform: translate(${targetX}px, ${doorY}px); opacity: 1; }`)
        steps.push(`80% { transform: translate(${targetX}px, ${doorY + DOOR_H / 2}px); opacity: 1; }`)
        steps.push(`100% { transform: translate(${targetX}px, ${targetY}px); opacity: 0.6; }`)
      }

      return `@keyframes ${animName} { ${steps.join(' ')} }`
    }).filter(Boolean).join('\n')
  }, [balls, funnelY, pegY, doorY, binY, binsLeft, binW])

  const ballColor = COLORS_BY_METHOD[txn.payment_method] || '#3b82f6'

  // Peg grid
  const pegRows = 6
  const pegCols = colCount + 1
  const pegs = []
  for (let r = 0; r < pegRows; r++) {
    for (let c = 0; c < pegCols; c++) {
      const offset = r % 2 === 0 ? 0 : binW / 2
      pegs.push({
        x: binsLeft + c * binW + offset,
        y: pegY + 20 + r * (PEG_AREA_H - 30) / pegRows,
      })
    }
  }

  return (
    <div className="filter-diagram">
      {ballStyleSheet && <style>{ballStyleSheet}</style>}

      {/* NTF warning banner */}
      {isNTF && (
        <div className="fd-ntf-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>NTF Risk — All terminals blocked for {txn.payment_method} payments. {openCount} of {colCount} doors open.</span>
        </div>
      )}
      {!isNTF && (
        <div className="fd-safe-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{openCount} of {colCount} doors open — payments will route successfully</span>
        </div>
      )}

      <div className="fd-controls">
        <button className={`fd-drop-btn${isDropping ? ' dropping' : ''}`} onClick={handleDrop} disabled={isDropping}>
          {isDropping ? 'Dropping...' : `Drop ${BALL_COUNT} Payments`}
        </button>
      </div>

      <svg className="fd-svg" viewBox={`0 0 ${W} ${totalH}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="fd-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Funnel at top */}
        <path d={`M ${W / 2 - 100} ${funnelY} L ${W / 2 + 100} ${funnelY} L ${W / 2 + 25} ${funnelY + FUNNEL_H} L ${W / 2 - 25} ${funnelY + FUNNEL_H} Z`}
          fill="#e0e7ff" stroke="#528FF0" strokeWidth="2" opacity="0.7"/>
        <text x={W / 2} y={funnelY + 28} textAnchor="middle" style={{ fontSize: '12px', fill: '#528FF0', fontWeight: 700 }}>
          {txn.payment_method} · ₹{txn.amount}
        </text>

        {/* Pegs */}
        {pegs.map((peg, i) => (
          <circle key={`peg-${i}`} cx={peg.x} cy={peg.y} r={3} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1"/>
        ))}

        {/* ── DOORS — one per terminal ── */}
        {terminals.map((term, ci) => {
          const x = binsLeft + ci * binW
          const ds = doorState[term.terminalId]
          const isOpen = ds?.open
          const isHovered = false // could add hover state

          return (
            <g key={`door-${ci}`} style={{ cursor: ds?.ruleId ? 'pointer' : 'default' }}
              onClick={() => ds?.ruleId && onToggleRule(ds.ruleId)}>

              {/* Door frame */}
              <rect x={x + 4} y={doorY} width={binW - 8} height={DOOR_H} rx={6}
                fill="none" stroke={isOpen ? '#059669' : '#dc2626'} strokeWidth="2.5"/>

              {isOpen ? (
                /* OPEN DOOR — green, clear passage */
                <g>
                  <rect x={x + 6} y={doorY + 2} width={binW - 12} height={DOOR_H - 4} rx={4}
                    fill="#d1fae5" opacity="0.5"/>
                  {/* Open archway indicator */}
                  <path d={`M ${x + binW / 2 - 8} ${doorY + 14} L ${x + binW / 2} ${doorY + DOOR_H - 10} L ${x + binW / 2 + 8} ${doorY + 14}`}
                    fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <text x={x + binW / 2} y={doorY + 14} textAnchor="middle"
                    style={{ fontSize: '9px', fill: '#059669', fontWeight: 700 }}>OPEN</text>
                </g>
              ) : (
                /* CLOSED DOOR — red, blocked */
                <g>
                  <rect x={x + 6} y={doorY + 2} width={binW - 12} height={DOOR_H - 4} rx={4}
                    fill="#dc2626" opacity="0.85"/>
                  {/* X mark */}
                  <line x1={x + binW / 2 - 10} y1={doorY + DOOR_H / 2 - 10} x2={x + binW / 2 + 10} y2={doorY + DOOR_H / 2 + 10}
                    stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                  <line x1={x + binW / 2 + 10} y1={doorY + DOOR_H / 2 - 10} x2={x + binW / 2 - 10} y2={doorY + DOOR_H / 2 + 10}
                    stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                  <text x={x + binW / 2} y={doorY + DOOR_H - 6} textAnchor="middle"
                    style={{ fontSize: '7px', fill: '#fecaca', fontWeight: 600 }}>
                    {(ds?.reason || '').length > 14 ? (ds?.reason || '').slice(0, 14) + '..' : ds?.reason}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* ── BINS below doors ── */}
        {terminals.map((term, ci) => {
          const x = binsLeft + ci * binW
          const ds = doorState[term.terminalId]
          const isOpen = ds?.open

          return (
            <g key={`bin-${ci}`}>
              <rect x={x + 2} y={binY} width={binW - 4} height={BIN_H} rx={6}
                fill={isOpen ? '#f0fdf4' : '#fef2f2'} stroke={isOpen ? '#86efac' : '#fecaca'} strokeWidth="1.5"/>
              <text x={x + binW / 2} y={binY + 30} textAnchor="middle"
                style={{ fontSize: '11px', fill: isOpen ? '#1A202C' : '#cbd5e1', fontWeight: 700, fontFamily: "'Menlo', monospace" }}>
                {term.displayId}
              </text>
              <text x={x + binW / 2} y={binY + 46} textAnchor="middle"
                style={{ fontSize: '10px', fill: isOpen ? '#64748b' : '#e2e8f0', fontWeight: 500 }}>
                {term.gatewayShort}
              </text>
              <text x={x + binW / 2} y={binY + 62} textAnchor="middle"
                style={{ fontSize: '9px', fill: isOpen ? '#94a3b8' : '#f1f5f9', fontWeight: 500 }}>
                SR {term.successRate}%
              </text>
            </g>
          )
        })}

        {/* ── ANIMATED BALLS ── */}
        {balls.map((ball, bi) => {
          const animName = `plinko-${ball.id}`
          return (
            <circle key={ball.id} r={BALL_R}
              fill={ball.isNTF ? '#ef4444' : ballColor}
              filter="url(#fd-glow)"
              style={{
                animation: `${animName} 1800ms ease-in-out forwards`,
                animationDelay: `${ball.delay}ms`,
                opacity: 0,
              }}
            />
          )
        })}
      </svg>

      {/* Rule list — clickable to toggle */}
      <div className="fd-rules">
        <div className="fd-rules-header">Active Rules</div>
        {rules.filter(r => r.enabled && !r.isDefault).map(rule => {
          const isDisabled = simOverrides.disabledRules.has(rule.id)
          return (
            <div key={rule.id} className={`fd-rule ${isDisabled ? 'disabled' : ''}`}
              onClick={() => onToggleRule(rule.id)}>
              <span className={`fd-rule-dot ${isDisabled ? 'off' : 'on'}`}></span>
              <span className="fd-rule-name">{rule.name}</span>
              <span className="fd-rule-toggle">{isDisabled ? 'OFF' : 'ON'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
