import React, { useMemo, useEffect, useRef, useState } from 'react'
import { gateways } from './data'

const W = 760
const PIPE_LEFT = 100
const PIPE_RIGHT = W - 20
const PIPE_THICKNESS = 40
const PIPE_SLOPE_DROP = 90
const TIER_SPACING = 60
const CHIP_R = 18
const HOLE_R = 20
const EJECT_DROP = 45
const THRESHOLD_H = 80
const SORTER_H = 90
const RANK_CHIP_H = 44

const CHIP_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1']

function getTerminalInfo(merchant, gw) {
  return merchant.gatewayMetrics.map((gm, i) => {
    const gateway = gw.find(g => g.id === gm.gatewayId)
    const term = gateway?.terminals.find(t => t.id === gm.terminalId)
    return {
      terminalId: gm.terminalId,
      displayId: term?.terminalId || gm.terminalId,
      gatewayShort: gateway?.shortName || '??',
      successRate: gm.successRate,
      costPerTxn: gm.costPerTxn,
      supportedMethods: gm.supportedMethods || [],
      isZeroCost: gm.costPerTxn === 0,
      color: CHIP_COLORS[i % CHIP_COLORS.length],
    }
  })
}

export default function PipelineView({
  merchant, rules, txn, gateways: gw, simOverrides,
  pipelineResult, animKey, onStageReached, onToggleRule, onToggleTerminal,
}) {
  const terminals = useMemo(() => getTerminalInfo(merchant, gw), [merchant, gw])
  const colCount = terminals.length
  const pipeW = PIPE_RIGHT - PIPE_LEFT
  const holeXs = terminals.map((_, ci) => PIPE_LEFT + pipeW * (ci + 0.5) / colCount)

  const poolStage = pipelineResult?.stages?.find(s => s.type === 'initial')
  const ruleStages = pipelineResult?.stages?.filter(s =>
    s.type === 'rule_filter' || s.type === 'rule_ntf' || s.type === 'rule_skip' || s.type === 'rule_pass' || s.type === 'rule_disabled'
  ) || []
  const thresholdStage = pipelineResult?.stages?.find(s => s.type === 'threshold_filter' || s.type === 'threshold_bypass')
  const sorterStage = pipelineResult?.stages?.find(s => s.type === 'sorter')
  const isNTF = pipelineResult?.isNTF
  const selectedTerminalId = pipelineResult?.selectedTerminal?.terminalId

  const eliminatedAfterPool = useMemo(() => {
    if (!poolStage) return new Set()
    return new Set((poolStage.terminalsEliminated || []).map(t => t.terminalId))
  }, [poolStage])

  const eliminatedAtRule = useMemo(() => {
    const result = []
    let cumulative = new Set(eliminatedAfterPool)
    ruleStages.forEach(s => {
      const newElim = new Set(cumulative)
      ;(s.terminalsEliminated || []).forEach(t => newElim.add(t.terminalId))
      result.push(newElim)
      cumulative = newElim
    })
    return result
  }, [eliminatedAfterPool, ruleStages])

  const eliminatedAfterRules = eliminatedAtRule.length > 0 ? eliminatedAtRule[eliminatedAtRule.length - 1] : new Set(eliminatedAfterPool)

  const eliminatedAfterThreshold = useMemo(() => {
    const elim = new Set(eliminatedAfterRules)
    if (thresholdStage) {
      (thresholdStage.terminalsEliminated || []).forEach(t => elim.add(t.terminalId))
    }
    return elim
  }, [eliminatedAfterRules, thresholdStage])

  // ── Layout Y ──
  const poolY = 10
  const chipLineY = poolY + 30
  const chipLineH = 60
  const pipeBlockY = chipLineY + chipLineH + 20
  const tierCount = Math.max(ruleStages.length, 1)
  const tierFullH = PIPE_THICKNESS + PIPE_SLOPE_DROP + TIER_SPACING
  const pipeBlockEndY = pipeBlockY + tierCount * tierFullH
  const thresholdY = pipeBlockEndY + 20
  const thresholdEndY = thresholdY + THRESHOLD_H
  const sorterY = thresholdEndY + 20
  const sorterEndY = sorterY + SORTER_H
  const rankY = sorterEndY + 20
  const scoredTerminals = sorterStage?.scored || []
  const survivingCount = scoredTerminals.length || terminals.filter(t => !eliminatedAfterThreshold.has(t.terminalId)).length
  const rankBlockH = Math.max(survivingCount, 1) * (RANK_CHIP_H + 8) + 30
  const totalH = rankY + rankBlockH + 10

  const pipeYAt = (tierIdx, x) => {
    const tierBaseY = pipeBlockY + tierIdx * tierFullH
    const progress = (x - PIPE_LEFT) / pipeW
    return tierBaseY + progress * PIPE_SLOPE_DROP
  }

  // ── Animation ──
  const [animProgress, setAnimProgress] = useState(-1)
  const animRef = useRef(null)

  useEffect(() => {
    if (!pipelineResult || animKey === 0) return
    setAnimProgress(0)
    let start = null
    const duration = 5500
    const tick = (ts) => {
      if (!start) start = ts
      const pct = Math.min((ts - start) / duration, 1)
      setAnimProgress(pct)
      const stageCount = pipelineResult.stages.length
      onStageReached(Math.min(Math.floor(pct * stageCount), stageCount - 1))
      if (pct < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [animKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Chip positions during animation
  const chipPositions = useMemo(() => {
    if (animProgress < 0 || !pipelineResult) return null
    const p = animProgress

    return terminals.map((term, ci) => {
      const isElimPool = eliminatedAfterPool.has(term.terminalId)

      if (isElimPool) {
        // Pool eliminated — chip drops down and fades
        if (p < 0.1) {
          return { x: holeXs[ci], y: chipLineY + 30, opacity: 1 - p * 5, state: 'pool-elim' }
        }
        return { x: holeXs[ci], y: chipLineY + 55, opacity: 0.15, state: 'pool-elim' }
      }

      // Find ejection rule
      let ejectedAtRule = -1
      for (let ri = 0; ri < ruleStages.length; ri++) {
        const wasElimBefore = ri > 0 ? eliminatedAtRule[ri - 1].has(term.terminalId) : eliminatedAfterPool.has(term.terminalId)
        if (wasElimBefore) break
        const isElimHere = (ruleStages[ri].terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
        if (isElimHere) { ejectedAtRule = ri; break }
      }

      // Phase 1: Chips enter pipe (0 - 0.08)
      if (p < 0.08) {
        const t = p / 0.08
        const startX = holeXs[ci]
        const startY = chipLineY + 30
        const enterY = pipeYAt(0, PIPE_LEFT) + PIPE_THICKNESS / 2
        return { x: startX + t * (PIPE_LEFT + 15 - startX), y: startY + t * (enterY - startY), state: 'entering', opacity: 1 }
      }

      // Phase 2: Roll through pipes (0.08 - 0.55)
      const rollStart = 0.08
      const rollEnd = 0.55
      const rollT = Math.min(Math.max((p - rollStart) / (rollEnd - rollStart), 0), 1)

      if (ejectedAtRule >= 0) {
        const ejectionPoint = (ejectedAtRule + 0.7) / tierCount
        if (rollT < ejectionPoint) {
          const localT = rollT / ejectionPoint
          const tierIdx = Math.min(Math.floor(localT * tierCount), ejectedAtRule)
          const x = PIPE_LEFT + 15 + localT * (pipeW - 30)
          const y = pipeYAt(tierIdx, x) + PIPE_THICKNESS / 2
          const bounce = Math.sin(localT * Math.PI * 5) * 3
          return { x, y: y + bounce, state: 'rolling', opacity: 1 }
        } else {
          // Ejected — drops below pipe
          const ejectT = Math.min((rollT - ejectionPoint) / 0.2, 1)
          const ejectX = holeXs[ci]
          const ejectStartY = pipeYAt(ejectedAtRule, ejectX) + PIPE_THICKNESS + 5
          const ejectEndY = ejectStartY + EJECT_DROP
          return { x: ejectX, y: ejectStartY + ejectT * ejectT * (ejectEndY - ejectStartY), state: 'ejected', opacity: 0.7 - ejectT * 0.4 }
        }
      }

      // Surviving chip — rolls through all tiers
      if (rollT < 1) {
        const tierIdx = Math.min(Math.floor(rollT * tierCount), tierCount - 1)
        const x = PIPE_LEFT + 15 + rollT * (pipeW - 30)
        const y = pipeYAt(tierIdx, x) + PIPE_THICKNESS / 2
        const bounce = Math.sin(rollT * Math.PI * 6) * 2.5
        return { x, y: y + bounce, state: 'rolling', opacity: 1 }
      }

      // Phase 3: Exit pipe → threshold (0.55 - 0.65)
      const exitT = Math.min(Math.max((p - rollEnd) / 0.10, 0), 1)
      if (exitT < 1) {
        const fromX = PIPE_RIGHT - 20
        const fromY = pipeYAt(tierCount - 1, fromX) + PIPE_THICKNESS / 2
        const toY = thresholdY + 20
        return { x: fromX + exitT * (holeXs[ci] - fromX), y: fromY + exitT * (toY - fromY), state: 'to-threshold', opacity: 1 }
      }

      // Phase 4: Through threshold → sorter (0.65 - 0.78)
      const thrT = Math.min(Math.max((p - 0.65) / 0.13, 0), 1)
      if (thrT < 1) {
        return { x: holeXs[ci], y: thresholdY + 20 + thrT * (sorterY + 20 - thresholdY - 20), state: 'to-sorter', opacity: 1 }
      }

      // Phase 5: Sorter → ranked position (0.78 - 0.95)
      const rankT = Math.min(Math.max((p - 0.78) / 0.17, 0), 1)
      const scoredIdx = scoredTerminals.findIndex(s => s.terminalId === term.terminalId)
      if (scoredIdx < 0) return { x: holeXs[ci], y: sorterY + 40, state: 'lost', opacity: 0.2 }
      const finalX = PIPE_LEFT + 56
      const finalY = rankY + 20 + scoredIdx * (RANK_CHIP_H + 8) + RANK_CHIP_H / 2
      const fromX = holeXs[ci]
      const fromY = sorterY + 40
      return { x: fromX + rankT * (finalX - fromX), y: fromY + rankT * (finalY - fromY), state: rankT >= 0.98 ? 'hidden' : 'ranking', opacity: rankT > 0.9 ? 1 - (rankT - 0.9) * 10 : 1 }
    })
  }, [animProgress, pipelineResult, terminals, holeXs, eliminatedAfterPool, eliminatedAtRule, eliminatedAfterRules, ruleStages, tierCount, chipLineY, pipeBlockY, thresholdY, sorterY, rankY, scoredTerminals])

  const [hoveredHole, setHoveredHole] = useState(null)

  return (
    <div className="pipeline-container">
      {!pipelineResult && (
        <div className="pipeline-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#A0AEC0" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
          <p>Define a payment and click <strong>Simulate</strong> to visualize the routing pipeline</p>
        </div>
      )}

      {pipelineResult && (
        <svg className="pipeline-svg" viewBox={`0 0 ${W} ${totalH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="chip-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3"/></filter>
            <filter id="glow-rank1"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#3b82f6" floodOpacity="0.5"/></filter>
            <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b0bec5"/><stop offset="40%" stopColor="#78909c"/><stop offset="100%" stopColor="#546e7a"/>
            </linearGradient>
            <linearGradient id="ps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.5)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/>
            </linearGradient>
          </defs>

          {/* ════ STAGE 1: TERMINAL POOL — BIG COLORED CHIPS ════ */}
          <text x={8} y={poolY + 16} style={{ fontSize: '13px', fill: '#1A202C', fontWeight: 800 }}>Terminal Pool</text>
          <text x={W - 8} y={poolY + 16} textAnchor="end" style={{ fontSize: '11px', fill: '#64748b', fontWeight: 600 }}>
            {poolStage ? `${poolStage.remainingCount} of ${poolStage.totalCount} eligible for ${txn.payment_method}` : ''}
          </text>

          {/* Chip row — big, bold, clearly colored */}
          {terminals.map((term, ci) => {
            const cx = holeXs[ci]
            const cy = chipLineY + 30
            const isElim = eliminatedAfterPool.has(term.terminalId)
            const showStatic = animProgress < 0 || (animProgress < 0.05 && !isElim)

            if (!showStatic && animProgress >= 0) return null // animated version takes over

            return (
              <g key={`poolchip-${ci}`}>
                <circle cx={cx} cy={cy} r={CHIP_R + 2} fill={isElim ? '#e2e8f0' : term.color}
                  stroke={isElim ? '#94a3b8' : 'rgba(0,0,0,0.15)'} strokeWidth="2" filter="url(#chip-shadow)"
                  opacity={isElim ? 0.4 : 1}/>
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: '9px', fill: '#fff', fontWeight: 800, letterSpacing: '0.5px' }}>
                  {term.gatewayShort}
                </text>
                {isElim && (
                  <g>
                    <line x1={cx - 8} y1={cy - 8} x2={cx + 8} y2={cy + 8} stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
                    <line x1={cx + 8} y1={cy - 8} x2={cx - 8} y2={cy + 8} stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
                  </g>
                )}
                <text x={cx} y={cy + CHIP_R + 14} textAnchor="middle"
                  style={{ fontSize: '10px', fill: isElim ? '#cbd5e1' : '#1A202C', fontWeight: 700, fontFamily: "'Menlo', monospace" }}>
                  {term.displayId}
                </text>
                <text x={cx} y={cy + CHIP_R + 26} textAnchor="middle"
                  style={{ fontSize: '9px', fill: '#94a3b8', fontWeight: 500 }}>
                  SR {term.successRate}% · ₹{term.costPerTxn}
                </text>
              </g>
            )
          })}

          {/* ════ STAGE 2: TILTED FILTER PIPES — THICK & BOLD ════ */}
          <text x={8} y={pipeBlockY - 12} style={{ fontSize: '13px', fill: '#1A202C', fontWeight: 800 }}>Filtering Steps</text>
          <text x={W - 8} y={pipeBlockY - 12} textAnchor="end" style={{ fontSize: '10px', fill: '#528FF0', fontWeight: 600, fontStyle: 'italic' }}>
            click holes to toggle rules
          </text>

          {ruleStages.map((stage, ri) => {
            const tierBaseY = pipeBlockY + ri * tierFullH
            const isSkip = stage.type === 'rule_skip'
            const isDisabled = stage.type === 'rule_disabled'
            const isNTFCause = stage.type === 'rule_ntf'
            const prevElim = ri > 0 ? eliminatedAtRule[ri - 1] : eliminatedAfterPool

            const p1x = PIPE_LEFT, p1y = tierBaseY
            const p2x = PIPE_RIGHT, p2y = tierBaseY + PIPE_SLOPE_DROP

            return (
              <g key={`tier-${ri}`}>
                {/* Rule label — bold */}
                <text x={PIPE_LEFT - 12} y={tierBaseY + PIPE_THICKNESS / 2 + 5} textAnchor="end"
                  style={{ fontSize: '11px', fill: isDisabled ? '#cbd5e1' : '#334155', fontWeight: 700, textDecoration: isDisabled ? 'line-through' : 'none' }}>
                  {(stage.ruleName || '').length > 12 ? (stage.ruleName || '').slice(0, 12) + '..' : stage.ruleName}
                </text>

                {/* ── THICK TILTED PIPE ── */}
                <path d={`M ${p1x} ${p1y} L ${p2x} ${p2y} L ${p2x} ${p2y + PIPE_THICKNESS} L ${p1x} ${p1y + PIPE_THICKNESS} Z`}
                  fill={isSkip || isDisabled ? '#e2e8f0' : 'url(#pg)'}
                  stroke={isNTFCause ? '#ef4444' : '#475569'}
                  strokeWidth={isNTFCause ? 2.5 : 1.5}
                  opacity={isDisabled ? 0.3 : 1}/>
                {/* Top shine */}
                <path d={`M ${p1x + 1} ${p1y + 1} L ${p2x - 1} ${p2y + 1} L ${p2x - 1} ${p2y + PIPE_THICKNESS * 0.3} L ${p1x + 1} ${p1y + PIPE_THICKNESS * 0.3} Z`}
                  fill="url(#ps)" opacity={isDisabled ? 0.1 : 0.7} pointerEvents="none"/>
                {/* Pipe end caps */}
                <ellipse cx={p1x} cy={p1y + PIPE_THICKNESS / 2} rx={6} ry={PIPE_THICKNESS / 2}
                  fill={isSkip || isDisabled ? '#cbd5e1' : '#78909c'} stroke="#475569" strokeWidth="1" opacity={isDisabled ? 0.3 : 0.8}/>
                <ellipse cx={p2x} cy={p2y + PIPE_THICKNESS / 2} rx={6} ry={PIPE_THICKNESS / 2}
                  fill={isSkip || isDisabled ? '#cbd5e1' : '#78909c'} stroke="#475569" strokeWidth="1" opacity={isDisabled ? 0.3 : 0.8}/>

                {/* ── HOLES — BIG, BOLD, UNMISSABLE ── */}
                {terminals.map((term, ci) => {
                  const hx = holeXs[ci]
                  const hy = pipeYAt(ri, hx) + PIPE_THICKNESS / 2
                  const wasElimBefore = prevElim.has(term.terminalId)
                  const isElimHere = (stage.terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
                  const holeClosed = isElimHere && !isDisabled && !isSkip
                  const isHovered = hoveredHole?.ri === ri && hoveredHole?.ci === ci

                  if (wasElimBefore) {
                    return <circle key={`h-${ri}-${ci}`} cx={hx} cy={hy} r={8} fill="#78909c" opacity="0.15"/>
                  }
                  if (isSkip || isDisabled) {
                    return <circle key={`h-${ri}-${ci}`} cx={hx} cy={hy} r={12} fill="none" stroke="#94a3b8"
                      strokeWidth="1.5" strokeDasharray="4 3" opacity={isDisabled ? 0.2 : 0.4}/>
                  }

                  return (
                    <g key={`h-${ri}-${ci}`} style={{ cursor: 'pointer' }}
                      onClick={() => stage.ruleId && onToggleRule(stage.ruleId)}
                      onMouseEnter={() => setHoveredHole({ ri, ci })}
                      onMouseLeave={() => setHoveredHole(null)}>
                      <circle cx={hx} cy={hy} r={HOLE_R + 8} fill="transparent"/>

                      {/* Hover ring */}
                      {isHovered && <circle cx={hx} cy={hy} r={HOLE_R + 5} fill="none"
                        stroke={holeClosed ? '#fca5a5' : '#86efac'} strokeWidth="3" opacity="0.8"/>}

                      {holeClosed ? (
                        <g>
                          {/* CLOSED — bright red, prominent X */}
                          <circle cx={hx} cy={hy} r={HOLE_R} fill="#dc2626" stroke="#7f1d1d" strokeWidth="2"/>
                          <line x1={hx - 7} y1={hy - 7} x2={hx + 7} y2={hy + 7} stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                          <line x1={hx + 7} y1={hy - 7} x2={hx - 7} y2={hy + 7} stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                        </g>
                      ) : (
                        <g>
                          {/* OPEN — dark green with visible hole */}
                          <circle cx={hx} cy={hy} r={HOLE_R} fill="#059669" stroke="#064e3b" strokeWidth="2"/>
                          <circle cx={hx} cy={hy} r={HOLE_R * 0.45} fill="#022c22"/>
                          <path d={`M ${hx - 5} ${hy - 1} L ${hx} ${hy + 5} L ${hx + 5} ${hy - 1}`}
                            fill="none" stroke="#a7f3d0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                      )}

                      {/* Terminal name below hole */}
                      <text x={hx} y={hy + HOLE_R + 14} textAnchor="middle"
                        style={{ fontSize: '8px', fill: holeClosed ? '#ef4444' : '#059669', fontWeight: 700 }}>
                        {term.gatewayShort}
                      </text>

                      {/* Hover tooltip */}
                      {isHovered && (
                        <g>
                          <rect x={hx - 55} y={hy - HOLE_R - 30} width={110} height={22} rx={6} fill="#1e293b" opacity="0.92"/>
                          <text x={hx} y={hy - HOLE_R - 15} textAnchor="middle"
                            style={{ fontSize: '10px', fill: '#fff', fontWeight: 600 }}>
                            Click to {holeClosed ? 'open' : 'close'}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}

                {/* NTF row glow */}
                {isNTFCause && (
                  <rect x={PIPE_LEFT - 4} y={tierBaseY - 4} width={pipeW + 8} height={PIPE_SLOPE_DROP + PIPE_THICKNESS + 8}
                    rx={8} fill="#ef4444" opacity="0.05" pointerEvents="none"/>
                )}
              </g>
            )
          })}

          {/* Drop lines pipes → threshold */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterRules.has(term.terminalId)
            const fromY = pipeYAt(tierCount - 1, hx) + PIPE_THICKNESS + HOLE_R + 16
            return <line key={`d1-${ci}`} x1={hx} y1={fromY} x2={hx} y2={thresholdY}
              stroke={isElim ? '#f1f5f9' : '#94a3b8'} strokeWidth="1.5" strokeDasharray="4 4" opacity={isElim ? 0.15 : 0.35}/>
          })}

          {/* ════ STAGE 3: SR THRESHOLD ════ */}
          <text x={8} y={thresholdY + 16} style={{ fontSize: '13px', fill: '#1A202C', fontWeight: 800 }}>SR Threshold</text>
          {(() => {
            const threshold = simOverrides.srThreshold || merchant.srThresholdLow || 0
            return threshold > 0 && (
              <text x={W - 8} y={thresholdY + 16} textAnchor="end" style={{ fontSize: '11px', fill: '#ef4444', fontWeight: 700 }}>
                ≥ {threshold}%
              </text>
            )
          })()}

          {(() => {
            const threshold = simOverrides.srThreshold || merchant.srThresholdLow || 0
            const barY = thresholdY + 26
            const barH = THRESHOLD_H - 36
            const maxSR = Math.max(...terminals.map(t => t.successRate), 80)
            const minSR = Math.min(...terminals.map(t => t.successRate), 60)
            const range = maxSR - minSR + 10

            return (
              <g>
                {terminals.map((term, ci) => {
                  const cx = holeXs[ci]
                  const barW = 28
                  const isElimBefore = eliminatedAfterRules.has(term.terminalId)
                  const isElimHere = thresholdStage?.terminalsEliminated?.some(t => t.terminalId === term.terminalId)
                  const fillH = Math.max(((term.successRate - minSR + 5) / range) * barH, 4)

                  if (isElimBefore) {
                    return <rect key={`thr-${ci}`} x={cx - barW / 2} y={barY} width={barW} height={barH} rx={4} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.3"/>
                  }

                  return (
                    <g key={`thr-${ci}`}>
                      <rect x={cx - barW / 2} y={barY} width={barW} height={barH} rx={4} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1"/>
                      <rect x={cx - barW / 2} y={barY + barH - fillH} width={barW} height={fillH} rx={4}
                        fill={isElimHere ? '#ef4444' : '#10b981'} opacity="0.85"/>
                      <text x={cx} y={barY + barH + 14} textAnchor="middle"
                        style={{ fontSize: '10px', fill: isElimHere ? '#ef4444' : '#334155', fontWeight: 700 }}>
                        {term.successRate}%
                      </text>
                      <text x={cx} y={barY + barH + 26} textAnchor="middle"
                        style={{ fontSize: '8px', fill: '#94a3b8', fontWeight: 500 }}>{term.gatewayShort}</text>
                    </g>
                  )
                })}

                {/* Threshold line */}
                {threshold > 0 && (() => {
                  const lineY = barY + barH - ((threshold - minSR + 5) / range) * barH
                  return (
                    <g>
                      <line x1={PIPE_LEFT - 10} y1={lineY} x2={PIPE_RIGHT + 10} y2={lineY}
                        stroke="#ef4444" strokeWidth="2" strokeDasharray="8 4" opacity="0.7"/>
                      <text x={PIPE_LEFT - 14} y={lineY + 4} textAnchor="end"
                        style={{ fontSize: '9px', fill: '#ef4444', fontWeight: 700 }}>{threshold}%</text>
                    </g>
                  )
                })()}
              </g>
            )
          })()}

          {/* Drop lines threshold → sorter */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return <line key={`d2-${ci}`} x1={hx} y1={thresholdEndY} x2={hx} y2={sorterY}
              stroke={isElim ? '#f1f5f9' : '#94a3b8'} strokeWidth="1.5" strokeDasharray="4 4" opacity={isElim ? 0.15 : 0.35}/>
          })}

          {/* ════ STAGE 4: SORTER ════ */}
          <text x={8} y={sorterY + 16} style={{ fontSize: '13px', fill: '#1A202C', fontWeight: 800 }}>
            Sorter — {pipelineResult?.routingStrategy === 'cost_based' ? 'Cost Optimized' : 'SR Optimized'}
          </text>
          <text x={W - 8} y={sorterY + 16} textAnchor="end" style={{ fontSize: '11px', fill: '#64748b', fontWeight: 600 }}>
            {scoredTerminals.length} terminals scored
          </text>

          {/* Converging funnel */}
          <path d={`M ${PIPE_LEFT} ${sorterY + 28} L ${PIPE_RIGHT} ${sorterY + 28} L ${W / 2 + 60} ${sorterY + SORTER_H - 8} L ${W / 2 - 60} ${sorterY + SORTER_H - 8} Z`}
            fill="#eef2ff" stroke="#818cf8" strokeWidth="1.5" opacity="0.5"/>

          {/* Funnel scores */}
          {scoredTerminals.map((scored, si) => {
            const term = terminals.find(t => t.terminalId === scored.terminalId)
            if (!term) return null
            const x = PIPE_LEFT + 40 + si * Math.max((pipeW - 80) / Math.max(scoredTerminals.length - 1, 1), 40)
            return (
              <g key={`fscore-${si}`}>
                <circle cx={x} cy={sorterY + 50} r={14} fill={term.color} opacity="0.2"/>
                <text x={x} y={sorterY + 54} textAnchor="middle"
                  style={{ fontSize: '10px', fill: '#4338ca', fontWeight: 700 }}>{Math.round(scored.finalScore)}</text>
                <text x={x} y={sorterY + 68} textAnchor="middle"
                  style={{ fontSize: '8px', fill: '#94a3b8', fontWeight: 600 }}>{term.gatewayShort}</text>
              </g>
            )
          })}

          {/* ════ STAGE 5: RANKED OUTPUT ════ */}
          <text x={8} y={rankY + 16} style={{ fontSize: '13px', fill: '#1A202C', fontWeight: 800 }}>
            {isNTF ? 'Payment Failed — No Terminal Found' : 'Ranked Terminals'}
          </text>

          {isNTF ? (
            <rect x={PIPE_LEFT} y={rankY + 24} width={pipeW} height={50} rx={12}
              fill="#fef2f2" stroke="#ef4444" strokeWidth="2"/>
          ) : (
            scoredTerminals.map((scored, si) => {
              const term = terminals.find(t => t.terminalId === scored.terminalId)
              if (!term) return null
              const y = rankY + 24 + si * (RANK_CHIP_H + 8)
              const isFirst = si === 0

              return (
                <g key={`rank-${si}`}>
                  <rect x={PIPE_LEFT} y={y} width={pipeW} height={RANK_CHIP_H} rx={10}
                    fill={isFirst ? '#eff6ff' : '#fafafa'}
                    stroke={isFirst ? '#3b82f6' : '#e2e8f0'}
                    strokeWidth={isFirst ? 2.5 : 1}
                    filter={isFirst ? 'url(#glow-rank1)' : undefined}/>

                  {/* Rank # */}
                  <circle cx={PIPE_LEFT + 26} cy={y + RANK_CHIP_H / 2} r={14}
                    fill={isFirst ? '#3b82f6' : '#e2e8f0'}/>
                  <text x={PIPE_LEFT + 26} y={y + RANK_CHIP_H / 2 + 5} textAnchor="middle"
                    style={{ fontSize: '13px', fill: isFirst ? '#fff' : '#94a3b8', fontWeight: 800 }}>{si + 1}</text>

                  {/* Colored chip */}
                  <circle cx={PIPE_LEFT + 56} cy={y + RANK_CHIP_H / 2} r={12}
                    fill={term.color} stroke="rgba(0,0,0,0.1)" strokeWidth="1" filter="url(#chip-shadow)"/>
                  <text x={PIPE_LEFT + 56} y={y + RANK_CHIP_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: '7px', fill: '#fff', fontWeight: 800 }}>{term.gatewayShort.charAt(0)}</text>

                  {/* Terminal info */}
                  <text x={PIPE_LEFT + 78} y={y + RANK_CHIP_H / 2 - 6} textAnchor="start"
                    style={{ fontSize: '13px', fill: isFirst ? '#1e3a5f' : '#475569', fontWeight: 700, fontFamily: "'Menlo', monospace" }}>
                    {term.displayId}
                  </text>
                  <text x={PIPE_LEFT + 78} y={y + RANK_CHIP_H / 2 + 10} textAnchor="start"
                    style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }}>
                    {term.gatewayShort} · SR {scored.successRate}% · ₹{scored.costPerTxn} · Score {Math.round(scored.finalScore)}
                  </text>

                  {/* Winner badge */}
                  {isFirst && (
                    <g>
                      <rect x={PIPE_RIGHT - 90} y={y + 10} width={80} height={RANK_CHIP_H - 20} rx={12} fill="#3b82f6"/>
                      <text x={PIPE_RIGHT - 50} y={y + RANK_CHIP_H / 2 + 4} textAnchor="middle"
                        style={{ fontSize: '11px', fill: '#fff', fontWeight: 800 }}>SELECTED</text>
                    </g>
                  )}
                </g>
              )
            })
          )}

          {isNTF && (
            <g>
              <text x={W / 2} y={rankY + 48} textAnchor="middle" style={{ fontSize: '14px', fill: '#dc2626', fontWeight: 700 }}>All terminals eliminated</text>
              <text x={W / 2} y={rankY + 64} textAnchor="middle" style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 500 }}>Payment cannot be processed</text>
            </g>
          )}

          {/* ════ ANIMATED CHIPS ════ */}
          {chipPositions && chipPositions.map((pos, ci) => {
            if (!pos || pos.state === 'hidden') return null
            const term = terminals[ci]
            const isEjected = pos.state === 'ejected' || pos.state === 'pool-elim'

            return (
              <g key={`ac-${ci}`} opacity={pos.opacity}>
                <circle cx={pos.x} cy={pos.y} r={CHIP_R}
                  fill={isEjected ? '#94a3b8' : term.color}
                  stroke={isEjected ? 'none' : 'rgba(0,0,0,0.15)'}
                  strokeWidth="1.5" filter="url(#chip-shadow)"/>
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: '8px', fill: '#fff', fontWeight: 800, pointerEvents: 'none' }}>
                  {term.gatewayShort}
                </text>
                {isEjected && (
                  <g>
                    <line x1={pos.x - 6} y1={pos.y - 6} x2={pos.x + 6} y2={pos.y + 6} stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    <line x1={pos.x + 6} y1={pos.y - 6} x2={pos.x - 6} y2={pos.y + 6} stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
