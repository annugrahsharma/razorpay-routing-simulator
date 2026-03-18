import React, { useMemo, useEffect, useRef, useState } from 'react'
import { gateways } from './data'

// ── Layout ──
const W = 760
const PIPE_LEFT = 90
const PIPE_RIGHT = W - 30
const PIPE_THICKNESS = 32
const PIPE_SLOPE_DROP = 70
const TIER_SPACING = 50      // gap between pipe tiers (room for ejected chips)
const CHIP_R = 14            // terminal chip radius
const HOLE_R = 17            // hole clickable area
const EJECT_DROP = 32        // how far ejected chips fall below pipe
const SORTER_H = 90
const RANK_CHIP_H = 36

// Terminal color palette
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

  // Extract stages
  const poolStage = pipelineResult?.stages?.find(s => s.type === 'initial')
  const ruleStages = pipelineResult?.stages?.filter(s =>
    s.type === 'rule_filter' || s.type === 'rule_ntf' || s.type === 'rule_skip' || s.type === 'rule_pass' || s.type === 'rule_disabled'
  ) || []
  const sorterStage = pipelineResult?.stages?.find(s => s.type === 'sorter')
  const isNTF = pipelineResult?.isNTF

  const eliminatedAfterPool = useMemo(() => {
    if (!poolStage) return new Set()
    return new Set((poolStage.terminalsEliminated || []).map(t => t.terminalId))
  }, [poolStage])

  // Per-rule cumulative elimination
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

  // ── Y layout ──
  const tierCount = Math.max(ruleStages.length, 1)
  const tierFullH = PIPE_THICKNESS + PIPE_SLOPE_DROP + TIER_SPACING
  const sourceY = 30
  const chipsStartY = sourceY + 50 // initial chip lineup
  const pipeBlockY = chipsStartY + 50
  const pipeBlockEndY = pipeBlockY + tierCount * tierFullH
  const sorterY = pipeBlockEndY + 40
  const rankY = sorterY + SORTER_H + 20
  const scoredTerminals = sorterStage?.scored || []
  const rankBlockH = Math.max(scoredTerminals.length, 1) * (RANK_CHIP_H + 6) + 20
  const totalH = rankY + rankBlockH + 20

  // Hole positions along pipe
  const holeXs = terminals.map((_, ci) => PIPE_LEFT + pipeW * (ci + 0.5) / colCount)

  // Y on tilted pipe at given X
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
    const duration = 5000
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

  // Chip positions per terminal during animation
  const chipPositions = useMemo(() => {
    if (animProgress < 0 || !pipelineResult) return null
    const p = animProgress

    return terminals.map((term, ci) => {
      const isElimPool = eliminatedAfterPool.has(term.terminalId)

      if (isElimPool) {
        // Eliminated in pool — chip stays at start, faded, with X
        return { x: holeXs[ci], y: chipsStartY + 20, state: 'eliminated-pool', opacity: 0.25 }
      }

      // Find at which rule this terminal gets ejected
      let ejectedAtRule = -1
      for (let ri = 0; ri < ruleStages.length; ri++) {
        const wasElimBefore = ri > 0 ? eliminatedAtRule[ri - 1].has(term.terminalId) : eliminatedAfterPool.has(term.terminalId)
        if (wasElimBefore) break
        const isElimHere = (ruleStages[ri].terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
        if (isElimHere) { ejectedAtRule = ri; break }
      }

      const isEliminated = eliminatedAfterRules.has(term.terminalId)

      if (p < 0.08) {
        // Chips lined up at the top, ready to enter pipe
        const t = p / 0.08
        const startX = PIPE_LEFT + 20 + ci * (CHIP_R * 2 + 6)
        const startY = chipsStartY + 20
        const enterY = pipeYAt(0, PIPE_LEFT) + PIPE_THICKNESS / 2
        return { x: startX + t * (PIPE_LEFT + 10 - startX), y: startY + t * (enterY - startY), state: 'entering', opacity: 1 }
      }

      // Chip rolls through pipe tiers
      const rollPhase = 0.08
      const rollEnd = 0.65
      const rollT = Math.min(Math.max((p - rollPhase) / (rollEnd - rollPhase), 0), 1)

      if (ejectedAtRule >= 0) {
        // This chip gets ejected at a specific rule
        const ejectionPoint = (ejectedAtRule + 0.5) / tierCount
        if (rollT < ejectionPoint) {
          // Still rolling, hasn't reached ejection point
          const localT = rollT / ejectionPoint
          const tierIdx = Math.min(Math.floor(localT * tierCount), ejectedAtRule)
          const x = PIPE_LEFT + localT * pipeW * 0.8
          const y = pipeYAt(tierIdx, x) + PIPE_THICKNESS / 2
          return { x, y, state: 'rolling', opacity: 1 }
        } else {
          // Ejected! Chip drops below the pipe
          const ejectT = Math.min((rollT - ejectionPoint) / 0.15, 1)
          const ejectX = holeXs[ci]
          const ejectStartY = pipeYAt(ejectedAtRule, ejectX) + PIPE_THICKNESS
          const ejectEndY = ejectStartY + EJECT_DROP
          const easeT = ejectT * ejectT // gravity
          return {
            x: ejectX,
            y: ejectStartY + easeT * (ejectEndY - ejectStartY),
            state: 'ejected',
            opacity: 0.5 + (1 - ejectT) * 0.5,
            ejectedAtTier: ejectedAtRule,
          }
        }
      }

      // Surviving chip — rolls through all tiers
      if (rollT < 1) {
        const tierIdx = Math.min(Math.floor(rollT * tierCount), tierCount - 1)
        const x = PIPE_LEFT + rollT * pipeW * 0.9
        const y = pipeYAt(tierIdx, x) + PIPE_THICKNESS / 2
        const bounce = Math.sin(rollT * Math.PI * 6) * 2
        return { x, y: y + bounce, state: 'rolling', opacity: 1 }
      }

      // Post-filter: chip exits pipe and moves to sorter
      const postT = Math.min(Math.max((p - rollEnd) / (0.85 - rollEnd), 0), 1)
      if (postT < 1) {
        const exitX = PIPE_RIGHT - 10
        const exitY = pipeYAt(tierCount - 1, exitX) + PIPE_THICKNESS / 2
        const targetY = sorterY + 30
        return { x: exitX + postT * (holeXs[ci] - exitX), y: exitY + postT * (targetY - exitY), state: 'to-sorter', opacity: 1 }
      }

      // Sorter → rank: chip moves to its final ranked position
      const rankT = Math.min(Math.max((p - 0.85) / 0.15, 0), 1)
      const scoredIdx = scoredTerminals.findIndex(s => s.terminalId === term.terminalId)
      const finalY = rankY + 14 + (scoredIdx >= 0 ? scoredIdx : 0) * (RANK_CHIP_H + 6) + RANK_CHIP_H / 2
      const finalX = PIPE_LEFT + 100
      const fromX = holeXs[ci]
      const fromY = sorterY + 30
      return { x: fromX + rankT * (finalX - fromX), y: fromY + rankT * (finalY - fromY), state: 'ranked', opacity: 1 }
    })
  }, [animProgress, pipelineResult, terminals, holeXs, eliminatedAfterPool, eliminatedAtRule, eliminatedAfterRules, ruleStages, tierCount, chipsStartY, sorterY, rankY, scoredTerminals])

  // Hover
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
            <filter id="chip-shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25"/></filter>
            <filter id="glow-rank1"><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.4"/></filter>
            <linearGradient id="pipe-grad" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0%" stopColor="#cbd5e1"/><stop offset="50%" stopColor="#94a3b8"/><stop offset="100%" stopColor="#64748b"/>
            </linearGradient>
            <linearGradient id="pipe-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.55)"/><stop offset="35%" stopColor="rgba(255,255,255,0.1)"/><stop offset="100%" stopColor="rgba(0,0,0,0.05)"/>
            </linearGradient>
          </defs>

          {/* ════════ STAGE 1: INITIAL CHIP LINEUP ════════ */}
          <text x={4} y={sourceY + 12} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>Terminal Pool</text>
          <text x={W - 6} y={sourceY + 12} textAnchor="end" style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }}>
            {poolStage ? `${poolStage.remainingCount} of ${poolStage.totalCount} eligible for ${txn.payment_method}` : ''}
          </text>

          {/* Static chip labels at starting positions */}
          {terminals.map((term, ci) => {
            const x = PIPE_LEFT + 20 + ci * (CHIP_R * 2 + 6)
            const isElim = eliminatedAfterPool.has(term.terminalId)
            return (
              <g key={`start-${ci}`}>
                {/* Starting chip (static, before animation) */}
                {animProgress < 0 && (
                  <g>
                    <circle cx={x} cy={chipsStartY + 20} r={CHIP_R}
                      fill={term.color} opacity={isElim ? 0.3 : 0.9} filter="url(#chip-shadow)"/>
                    <text x={x} y={chipsStartY + 24} textAnchor="middle"
                      style={{ fontSize: '7px', fill: '#fff', fontWeight: 700 }}>
                      {term.gatewayShort}
                    </text>
                    {isElim && (
                      <g>
                        <line x1={x - 6} y1={chipsStartY + 14} x2={x + 6} y2={chipsStartY + 26} stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        <line x1={x + 6} y1={chipsStartY + 14} x2={x - 6} y2={chipsStartY + 26} stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                      </g>
                    )}
                  </g>
                )}
                <text x={x} y={chipsStartY + 40} textAnchor="middle"
                  style={{ fontSize: '8px', fill: isElim ? '#cbd5e1' : '#64748b', fontWeight: 600, fontFamily: "'Menlo', monospace" }}>
                  {term.displayId.length > 8 ? term.displayId.slice(-7) : term.displayId}
                </text>
              </g>
            )
          })}

          {/* ════════ STAGE 2: TILTED FILTER PIPES ════════ */}
          <text x={4} y={pipeBlockY - 10} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>Filtering Steps</text>
          <text x={W - 6} y={pipeBlockY - 10} textAnchor="end" style={{ fontSize: '9px', fill: '#94a3b8', fontWeight: 500, fontStyle: 'italic' }}>
            click holes to toggle rules
          </text>

          {ruleStages.map((stage, ri) => {
            const tierBaseY = pipeBlockY + ri * tierFullH
            const isSkip = stage.type === 'rule_skip'
            const isDisabled = stage.type === 'rule_disabled'
            const isNTFCause = stage.type === 'rule_ntf'
            const prevElim = ri > 0 ? eliminatedAtRule[ri - 1] : eliminatedAfterPool

            const pStartX = PIPE_LEFT
            const pStartY = tierBaseY
            const pEndX = PIPE_RIGHT
            const pEndY = tierBaseY + PIPE_SLOPE_DROP

            return (
              <g key={`tier-${ri}`}>
                {/* Rule label */}
                <text x={PIPE_LEFT - 10} y={tierBaseY + PIPE_THICKNESS / 2 + 4} textAnchor="end"
                  style={{ fontSize: '10px', fill: isSkip ? '#A0AEC0' : isDisabled ? '#cbd5e1' : '#475569', fontWeight: 600, textDecoration: isDisabled ? 'line-through' : 'none' }}>
                  {(stage.ruleName || '').length > 14 ? (stage.ruleName || '').slice(0, 14) + '..' : stage.ruleName}
                </text>

                {/* Tilted pipe body */}
                <path d={`M ${pStartX} ${pStartY} L ${pEndX} ${pEndY} L ${pEndX} ${pEndY + PIPE_THICKNESS} L ${pStartX} ${pStartY + PIPE_THICKNESS} Z`}
                  fill={isSkip || isDisabled ? '#f1f5f9' : 'url(#pipe-grad)'}
                  stroke={isNTFCause ? '#ef4444' : isSkip ? '#e2e8f0' : '#64748b'}
                  strokeWidth={isNTFCause ? 2 : 1} opacity={isDisabled ? 0.35 : 1}/>
                {/* Pipe shine */}
                <path d={`M ${pStartX + 2} ${pStartY + 2} L ${pEndX - 2} ${pEndY + 2} L ${pEndX - 2} ${pEndY + PIPE_THICKNESS * 0.3} L ${pStartX + 2} ${pStartY + PIPE_THICKNESS * 0.3} Z`}
                  fill="url(#pipe-shine)" opacity={isDisabled ? 0.15 : 0.5} pointerEvents="none"/>

                {/* Holes at each terminal position */}
                {terminals.map((term, ci) => {
                  const hx = holeXs[ci]
                  const hy = pipeYAt(ri, hx) + PIPE_THICKNESS / 2
                  const wasElimBefore = prevElim.has(term.terminalId)
                  const isElimHere = (stage.terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
                  const holeClosed = isElimHere && !isDisabled && !isSkip
                  const isHovered = hoveredHole?.ri === ri && hoveredHole?.ci === ci

                  if (wasElimBefore || isSkip || isDisabled) {
                    return (
                      <circle key={`hole-${ri}-${ci}`} cx={hx} cy={hy} r={6}
                        fill={wasElimBefore ? '#94a3b8' : 'none'} stroke="#94a3b8" strokeWidth="1"
                        strokeDasharray={isSkip || isDisabled ? '2 2' : 'none'}
                        opacity={wasElimBefore ? 0.15 : 0.25}/>
                    )
                  }

                  return (
                    <g key={`hole-${ri}-${ci}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => stage.ruleId && onToggleRule(stage.ruleId)}
                      onMouseEnter={() => setHoveredHole({ ri, ci })}
                      onMouseLeave={() => setHoveredHole(null)}>
                      <circle cx={hx} cy={hy} r={HOLE_R + 4} fill="transparent"/>
                      {isHovered && <circle cx={hx} cy={hy} r={HOLE_R + 3} fill="none" stroke={holeClosed ? '#fca5a5' : '#6ee7b7'} strokeWidth="2.5" opacity="0.7"/>}

                      {holeClosed ? (
                        <g>
                          <circle cx={hx} cy={hy} r={HOLE_R} fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" filter="url(#chip-shadow)"/>
                          <line x1={hx - 6} y1={hy - 6} x2={hx + 6} y2={hy + 6} stroke="#fef2f2" strokeWidth="2.5" strokeLinecap="round"/>
                          <line x1={hx + 6} y1={hy - 6} x2={hx - 6} y2={hy + 6} stroke="#fef2f2" strokeWidth="2.5" strokeLinecap="round"/>
                        </g>
                      ) : (
                        <g>
                          <circle cx={hx} cy={hy} r={HOLE_R} fill="#065f46" stroke="#047857" strokeWidth="1.5" filter="url(#chip-shadow)"/>
                          <circle cx={hx} cy={hy} r={HOLE_R * 0.5} fill="#022c22" opacity="0.6"/>
                          <path d={`M ${hx - 4} ${hy - 1} L ${hx} ${hy + 4} L ${hx + 4} ${hy - 1}`}
                            fill="none" stroke="#a7f3d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                      )}

                      {isHovered && (
                        <g>
                          <rect x={hx - 48} y={hy - HOLE_R - 26} width={96} height={18} rx={4} fill="#1e293b" opacity="0.9"/>
                          <text x={hx} y={hy - HOLE_R - 13} textAnchor="middle"
                            style={{ fontSize: '9px', fill: '#fff', fontWeight: 600 }}>
                            Click to {holeClosed ? 'open' : 'close'}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}

                {/* Ejection zone label — shows ejected chip names */}
                {(stage.terminalsEliminated || []).length > 0 && !isSkip && !isDisabled && (
                  <text x={PIPE_RIGHT + 4} y={pEndY + PIPE_THICKNESS + EJECT_DROP + 4} textAnchor="start"
                    style={{ fontSize: '8px', fill: '#ef4444', fontWeight: 500, fontStyle: 'italic' }}>
                    ejected
                  </text>
                )}
              </g>
            )
          })}

          {/* ════════ STAGE 3: SORTER ════════ */}
          <text x={4} y={sorterY + 4} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>
            Sorter — {pipelineResult?.routingStrategy === 'cost_based' ? 'Cost Optimized' : 'SR Optimized'}
          </text>
          <text x={W - 6} y={sorterY + 4} textAnchor="end" style={{ fontSize: '9px', fill: '#94a3b8', fontWeight: 500 }}>
            {scoredTerminals.length} terminals scored & ranked
          </text>

          {/* Sorter visualization — converging funnel */}
          <path d={`M ${PIPE_LEFT} ${sorterY + 16} L ${PIPE_RIGHT} ${sorterY + 16} L ${PIPE_LEFT + 200} ${sorterY + SORTER_H - 10} L ${PIPE_LEFT + 60} ${sorterY + SORTER_H - 10} Z`}
            fill="#f0f4ff" stroke="#93a8d2" strokeWidth="1" opacity="0.5"/>
          <path d={`M ${PIPE_LEFT + 2} ${sorterY + 18} L ${PIPE_RIGHT - 2} ${sorterY + 18} L ${PIPE_LEFT + 200} ${sorterY + 34} L ${PIPE_LEFT + 60} ${sorterY + 34} Z`}
            fill="rgba(255,255,255,0.4)" pointerEvents="none"/>

          {/* Score labels inside sorter */}
          {scoredTerminals.map((scored, si) => {
            const term = terminals.find(t => t.terminalId === scored.terminalId)
            if (!term) return null
            const x = PIPE_LEFT + 40 + si * ((PIPE_RIGHT - PIPE_LEFT - 80) / Math.max(scoredTerminals.length - 1, 1))
            return (
              <text key={`sscore-${si}`} x={x} y={sorterY + 50} textAnchor="middle"
                style={{ fontSize: '9px', fill: '#528FF0', fontWeight: 600 }}>
                {term.gatewayShort}: {Math.round(scored.finalScore)}
              </text>
            )
          })}

          {/* ════════ STAGE 4: RANKED OUTPUT ════════ */}
          <text x={4} y={rankY + 4} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>
            {isNTF ? 'No Terminal Found — Payment Failed' : 'Ranked Terminals'}
          </text>

          {isNTF ? (
            <g>
              <rect x={PIPE_LEFT} y={rankY + 14} width={300} height={50} rx={10}
                fill="#fef2f2" stroke="#ef4444" strokeWidth="2"/>
              <text x={PIPE_LEFT + 150} y={rankY + 36} textAnchor="middle"
                style={{ fontSize: '13px', fill: '#dc2626', fontWeight: 700 }}>All terminals eliminated</text>
              <text x={PIPE_LEFT + 150} y={rankY + 52} textAnchor="middle"
                style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }}>Payment cannot be processed</text>
            </g>
          ) : (
            scoredTerminals.map((scored, si) => {
              const term = terminals.find(t => t.terminalId === scored.terminalId)
              if (!term) return null
              const y = rankY + 14 + si * (RANK_CHIP_H + 6)
              const isFirst = si === 0

              return (
                <g key={`rank-${si}`}>
                  {/* Rank card */}
                  <rect x={PIPE_LEFT} y={y} width={pipeW} height={RANK_CHIP_H} rx={8}
                    fill={isFirst ? '#eff6ff' : '#fafafa'}
                    stroke={isFirst ? '#528FF0' : '#e2e8f0'}
                    strokeWidth={isFirst ? 2 : 1}
                    filter={isFirst ? 'url(#glow-rank1)' : undefined}/>

                  {/* Rank number */}
                  <circle cx={PIPE_LEFT + 22} cy={y + RANK_CHIP_H / 2} r={12}
                    fill={isFirst ? '#528FF0' : '#e2e8f0'}/>
                  <text x={PIPE_LEFT + 22} y={y + RANK_CHIP_H / 2 + 4} textAnchor="middle"
                    style={{ fontSize: '11px', fill: isFirst ? '#fff' : '#94a3b8', fontWeight: 700 }}>
                    {si + 1}
                  </text>

                  {/* Terminal chip */}
                  <circle cx={PIPE_LEFT + 52} cy={y + RANK_CHIP_H / 2} r={10}
                    fill={term.color} filter="url(#chip-shadow)"/>

                  {/* Terminal name */}
                  <text x={PIPE_LEFT + 72} y={y + RANK_CHIP_H / 2 - 4} textAnchor="start"
                    style={{ fontSize: '12px', fill: isFirst ? '#1e3a5f' : '#475569', fontWeight: 700, fontFamily: "'Menlo', monospace" }}>
                    {term.displayId}
                  </text>
                  <text x={PIPE_LEFT + 72} y={y + RANK_CHIP_H / 2 + 10} textAnchor="start"
                    style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }}>
                    {term.gatewayShort} · SR {scored.successRate}% · ₹{scored.costPerTxn} · Score: {Math.round(scored.finalScore)}
                  </text>

                  {/* Winner badge */}
                  {isFirst && (
                    <g>
                      <rect x={PIPE_RIGHT - 80} y={y + 6} width={70} height={24} rx={12}
                        fill="#528FF0"/>
                      <text x={PIPE_RIGHT - 45} y={y + 22} textAnchor="middle"
                        style={{ fontSize: '10px', fill: '#fff', fontWeight: 700 }}>SELECTED</text>
                    </g>
                  )}
                </g>
              )
            })
          )}

          {/* ════════ ANIMATED CHIPS ════════ */}
          {chipPositions && chipPositions.map((pos, ci) => {
            if (!pos) return null
            const term = terminals[ci]
            const isEjected = pos.state === 'ejected' || pos.state === 'eliminated-pool'

            return (
              <g key={`achip-${ci}`} opacity={pos.opacity}>
                <circle cx={pos.x} cy={pos.y} r={CHIP_R}
                  fill={isEjected ? '#94a3b8' : term.color}
                  stroke={isEjected ? '#64748b' : 'rgba(255,255,255,0.3)'}
                  strokeWidth="1.5" filter="url(#chip-shadow)"/>
                <text x={pos.x} y={pos.y + 4} textAnchor="middle"
                  style={{ fontSize: '7px', fill: '#fff', fontWeight: 700, pointerEvents: 'none' }}>
                  {term.gatewayShort}
                </text>
                {isEjected && (
                  <g opacity="0.7">
                    <line x1={pos.x - 5} y1={pos.y - 5} x2={pos.x + 5} y2={pos.y + 5} stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1={pos.x + 5} y1={pos.y - 5} x2={pos.x - 5} y2={pos.y + 5} stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
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
