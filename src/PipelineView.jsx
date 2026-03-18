import React, { useMemo, useEffect, useRef, useState } from 'react'
import { gateways } from './data'

const W = 760
const PIPE_LEFT = 80
const PIPE_RIGHT = W - 30
const PIPE_THICKNESS = 28
const HOLE_R = 16           // hole radius — big, clickable
const DROP_ZONE_H = 100     // vertical space for drop lines
const PIPE_SLOPE_DROP = 80  // vertical drop across the pipe width (~15° visual angle)
const TIER_SPACING = 30     // vertical gap between pipe tiers
const SOURCE_R = 20
const BIN_H = 68
const SORTER_H = 65
const THRESHOLD_H = 55

function getTerminalInfo(merchant, gw) {
  return merchant.gatewayMetrics.map(gm => {
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

  // Hole X positions — evenly spaced along the pipe
  const holeXs = terminals.map((_, ci) => PIPE_LEFT + pipeW * (ci + 0.5) / colCount)

  // Extract stages
  const poolStage = pipelineResult?.stages?.find(s => s.type === 'initial')
  const ruleStages = pipelineResult?.stages?.filter(s =>
    s.type === 'rule_filter' || s.type === 'rule_ntf' || s.type === 'rule_skip' || s.type === 'rule_pass' || s.type === 'rule_disabled'
  ) || []
  const thresholdStage = pipelineResult?.stages?.find(s => s.type === 'threshold_filter' || s.type === 'threshold_bypass')
  const sorterStage = pipelineResult?.stages?.find(s => s.type === 'sorter')
  const isNTF = pipelineResult?.isNTF
  const selectedTerminalId = pipelineResult?.selectedTerminal?.terminalId
  const selectedColIdx = terminals.findIndex(t => t.terminalId === selectedTerminalId)

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

  // ── Y layout ──
  const sourceY = 30
  const tierCount = Math.max(ruleStages.length, 1)
  const tierTotalH = PIPE_THICKNESS + PIPE_SLOPE_DROP
  const rulesBlockY = sourceY + SOURCE_R * 2 + 30
  const rulesBlockEndY = rulesBlockY + tierCount * (tierTotalH + TIER_SPACING)
  const termLabelY = rulesBlockEndY + 10
  const thresholdY = termLabelY + 30
  const sorterY = thresholdY + THRESHOLD_H + 20
  const binY = sorterY + SORTER_H + 20
  const totalH = binY + BIN_H + 20

  // Hole Y position on the tilted pipe at a given X
  const holeYOnPipe = (tierIdx, holeX) => {
    const tierBaseY = rulesBlockY + tierIdx * (tierTotalH + TIER_SPACING)
    const progress = (holeX - PIPE_LEFT) / pipeW
    return tierBaseY + PIPE_THICKNESS / 2 + progress * PIPE_SLOPE_DROP
  }

  // ── Ball animation ──
  const [ballProgress, setBallProgress] = useState(-1)
  const animTimerRef = useRef(null)
  const trailRef = useRef([])

  useEffect(() => {
    if (!pipelineResult || animKey === 0) return
    setBallProgress(0)
    trailRef.current = []
    let start = null
    const duration = 4500

    const tick = (ts) => {
      if (!start) start = ts
      const pct = Math.min((ts - start) / duration, 1)
      setBallProgress(pct)
      const stageCount = pipelineResult.stages.length
      onStageReached(Math.min(Math.floor(pct * stageCount), stageCount - 1))
      if (pct < 1) animTimerRef.current = requestAnimationFrame(tick)
    }
    animTimerRef.current = requestAnimationFrame(tick)
    return () => { if (animTimerRef.current) cancelAnimationFrame(animTimerRef.current) }
  }, [animKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ball follows tilted pipe L→R then drops through hole
  const ballPos = useMemo(() => {
    if (ballProgress < 0 || !pipelineResult) return null
    const p = ballProgress
    const dropX = selectedColIdx >= 0 ? holeXs[selectedColIdx] : PIPE_RIGHT

    if (p < 0.06) {
      // Drop from source to first pipe
      const t = p / 0.06
      const startY = sourceY + SOURCE_R
      const endY = rulesBlockY + PIPE_THICKNESS / 2
      return { x: PIPE_LEFT - 8, y: startY + t * (endY - startY) }
    } else if (p < 0.55) {
      // Roll L→R along the tilted pipe
      const t = (p - 0.06) / 0.49
      const x = PIPE_LEFT + t * (dropX - PIPE_LEFT)
      // Follow the pipe slope
      const lastTier = Math.min(Math.floor(t * tierCount), tierCount - 1)
      const y = holeYOnPipe(lastTier, x)
      // Small bounce on the pipe
      const bounce = Math.sin(t * Math.PI * 8) * 3
      return { x, y: y + bounce }
    } else if (p < 0.68) {
      // Drop through hole — gravity acceleration
      const t = (p - 0.55) / 0.13
      const dropStartY = holeYOnPipe(tierCount - 1, dropX) + HOLE_R
      const dropEndY = thresholdY
      const eased = t * t // gravity feel
      return { x: dropX, y: dropStartY + eased * (dropEndY - dropStartY) }
    } else if (p < 0.78) {
      // Through threshold
      const t = (p - 0.68) / 0.10
      return { x: dropX, y: thresholdY + t * THRESHOLD_H }
    } else if (p < 0.88) {
      // Through sorter
      const t = (p - 0.78) / 0.10
      return { x: dropX, y: sorterY + t * SORTER_H }
    } else {
      // Into bin
      const t = (p - 0.88) / 0.12
      return { x: dropX, y: binY + t * (BIN_H * 0.5) }
    }
  }, [ballProgress, pipelineResult, selectedColIdx, holeXs, rulesBlockY, tierCount, thresholdY, sorterY, binY, sourceY])

  useEffect(() => {
    if (ballProgress <= 0) trailRef.current = []
    if (ballPos) trailRef.current = [...trailRef.current, `${ballPos.x},${ballPos.y}`]
  }, [ballPos, ballProgress])

  const trailPath = trailRef.current.length > 1 ? `M ${trailRef.current.join(' L ')}` : ''
  const ballColor = txn.payment_method === 'UPI' ? '#16a34a' : txn.payment_method === 'NB' ? '#9333ea' : '#528FF0'

  // Hover state for holes
  const [hoveredHole, setHoveredHole] = useState(null) // {ri, ci}

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
            <filter id="ball-glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-selected"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="hole-shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3"/></filter>
            <radialGradient id="hole-open-grad"><stop offset="0%" stopColor="#065f46"/><stop offset="100%" stopColor="#047857"/></radialGradient>
            <radialGradient id="hole-closed-grad"><stop offset="0%" stopColor="#dc2626"/><stop offset="100%" stopColor="#b91c1c"/></radialGradient>
            <linearGradient id="pipe-grad" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0%" stopColor="#cbd5e1"/>
              <stop offset="50%" stopColor="#94a3b8"/>
              <stop offset="100%" stopColor="#64748b"/>
            </linearGradient>
            <linearGradient id="pipe-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.6)"/>
              <stop offset="40%" stopColor="rgba(255,255,255,0.1)"/>
              <stop offset="100%" stopColor="rgba(0,0,0,0.05)"/>
            </linearGradient>
          </defs>

          {/* ════════ BALL SOURCE — top-left ════════ */}
          <circle cx={PIPE_LEFT - 8} cy={sourceY + SOURCE_R} r={SOURCE_R}
            fill="#dbeafe" stroke="#528FF0" strokeWidth="2.5"/>
          <circle cx={PIPE_LEFT - 8} cy={sourceY + SOURCE_R} r={6}
            fill="#528FF0" opacity="0.4"/>
          <text x={PIPE_LEFT - 8} y={sourceY + 2} textAnchor="middle"
            style={{ fontSize: '10px', fill: '#528FF0', fontWeight: 700 }}>Source</text>

          {/* Chute line from source to first pipe */}
          <path d={`M ${PIPE_LEFT - 8} ${sourceY + SOURCE_R * 2} Q ${PIPE_LEFT - 8} ${rulesBlockY - 5} ${PIPE_LEFT + 10} ${rulesBlockY + PIPE_THICKNESS / 2}`}
            fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" opacity="0.5"/>

          {/* ════════ FILTERING STEPS — TILTED PIPES ════════ */}
          <text x={4} y={rulesBlockY - 8} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>Filtering Steps</text>

          {ruleStages.map((stage, ri) => {
            const tierBaseY = rulesBlockY + ri * (tierTotalH + TIER_SPACING)
            const isSkip = stage.type === 'rule_skip'
            const isDisabled = stage.type === 'rule_disabled'
            const isNTFCause = stage.type === 'rule_ntf'
            const prevElim = ri > 0 ? eliminatedAtRule[ri - 1] : eliminatedAfterPool

            // Pipe start and end points (tilted)
            const pipeStartX = PIPE_LEFT
            const pipeStartY = tierBaseY
            const pipeEndX = PIPE_RIGHT
            const pipeEndY = tierBaseY + PIPE_SLOPE_DROP

            return (
              <g key={`tier-${ri}`}>
                {/* Rule name */}
                <text x={PIPE_LEFT - 12} y={tierBaseY + PIPE_THICKNESS / 2 + 4} textAnchor="end"
                  style={{ fontSize: '10px', fill: isSkip ? '#A0AEC0' : isDisabled ? '#cbd5e1' : '#64748b', fontWeight: 600, textDecoration: isDisabled ? 'line-through' : 'none' }}>
                  {(stage.ruleName || '').length > 14 ? (stage.ruleName || '').slice(0, 14) + '..' : stage.ruleName}
                </text>

                {/* Tilted pipe — 3D-ish tube */}
                <path
                  d={`M ${pipeStartX} ${pipeStartY} L ${pipeEndX} ${pipeEndY} L ${pipeEndX} ${pipeEndY + PIPE_THICKNESS} L ${pipeStartX} ${pipeStartY + PIPE_THICKNESS} Z`}
                  fill={isSkip || isDisabled ? '#f1f5f9' : 'url(#pipe-grad)'}
                  stroke={isNTFCause ? '#E74C3C' : isSkip ? '#e2e8f0' : '#64748b'}
                  strokeWidth={isNTFCause ? 2 : 1}
                  opacity={isDisabled ? 0.4 : 1}
                />
                {/* Pipe shine/highlight */}
                <path
                  d={`M ${pipeStartX + 2} ${pipeStartY + 2} L ${pipeEndX - 2} ${pipeEndY + 2} L ${pipeEndX - 2} ${pipeEndY + PIPE_THICKNESS * 0.35} L ${pipeStartX + 2} ${pipeStartY + PIPE_THICKNESS * 0.35} Z`}
                  fill="url(#pipe-shine)" opacity={isDisabled ? 0.2 : 0.6} pointerEvents="none"
                />

                {/* ── HOLES at each terminal position ── */}
                {terminals.map((term, ci) => {
                  const hx = holeXs[ci]
                  const hy = holeYOnPipe(ri, hx)
                  const wasElimBefore = prevElim.has(term.terminalId)
                  const isElimHere = (stage.terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
                  const isKeptHere = (stage.terminalsRemaining || []).some(t => t.terminalId === term.terminalId)

                  const holeClosed = isElimHere && !isDisabled && !isSkip
                  const holeOpen = (isKeptHere && !isDisabled && !isSkip) || (!isElimHere && !wasElimBefore && !isSkip && !isDisabled)
                  const isHovered = hoveredHole?.ri === ri && hoveredHole?.ci === ci

                  if (wasElimBefore) {
                    // Already eliminated — tiny faded mark
                    return (
                      <circle key={`hole-${ri}-${ci}`} cx={hx} cy={hy} r={5}
                        fill="#cbd5e1" opacity="0.2"/>
                    )
                  }

                  if (isSkip || isDisabled) {
                    // Rule skipped/disabled — dashed circle
                    return (
                      <circle key={`hole-${ri}-${ci}`} cx={hx} cy={hy} r={HOLE_R * 0.7}
                        fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2"
                        opacity={isDisabled ? 0.3 : 0.5}/>
                    )
                  }

                  return (
                    <g key={`hole-${ri}-${ci}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => stage.ruleId && onToggleRule(stage.ruleId)}
                      onMouseEnter={() => setHoveredHole({ ri, ci })}
                      onMouseLeave={() => setHoveredHole(null)}
                    >
                      {/* Click target — invisible larger circle */}
                      <circle cx={hx} cy={hy} r={HOLE_R + 6} fill="transparent"/>

                      {/* Hover ring */}
                      {isHovered && (
                        <circle cx={hx} cy={hy} r={HOLE_R + 4}
                          fill="none" stroke={holeClosed ? '#fca5a5' : '#6ee7b7'} strokeWidth="2" opacity="0.6"/>
                      )}

                      {holeClosed ? (
                        /* ── CLOSED HOLE — red, sealed ── */
                        <g>
                          <circle cx={hx} cy={hy} r={HOLE_R}
                            fill="url(#hole-closed-grad)" filter="url(#hole-shadow)"/>
                          {/* Metallic cross */}
                          <line x1={hx - 7} y1={hy - 7} x2={hx + 7} y2={hy + 7}
                            stroke="#fef2f2" strokeWidth="3" strokeLinecap="round"/>
                          <line x1={hx + 7} y1={hy - 7} x2={hx - 7} y2={hy + 7}
                            stroke="#fef2f2" strokeWidth="3" strokeLinecap="round"/>
                          {/* Label */}
                          <text x={hx} y={hy + HOLE_R + 12} textAnchor="middle"
                            style={{ fontSize: '8px', fill: '#dc2626', fontWeight: 700 }}>BLOCKED</text>
                        </g>
                      ) : (
                        /* ── OPEN HOLE — green/dark, passage ── */
                        <g>
                          <circle cx={hx} cy={hy} r={HOLE_R}
                            fill="url(#hole-open-grad)" filter="url(#hole-shadow)"/>
                          {/* Inner dark hole */}
                          <circle cx={hx} cy={hy} r={HOLE_R * 0.55}
                            fill="#022c22" opacity="0.7"/>
                          {/* Down arrow */}
                          <path d={`M ${hx - 5} ${hy - 2} L ${hx} ${hy + 4} L ${hx + 5} ${hy - 2}`}
                            fill="none" stroke="#a7f3d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          {/* Label */}
                          <text x={hx} y={hy + HOLE_R + 12} textAnchor="middle"
                            style={{ fontSize: '8px', fill: '#047857', fontWeight: 700 }}>OPEN</text>
                        </g>
                      )}

                      {/* Hover tooltip */}
                      {isHovered && (
                        <g>
                          <rect x={hx - 50} y={hy - HOLE_R - 28} width={100} height={20} rx={4}
                            fill="#1e293b" opacity="0.9"/>
                          <text x={hx} y={hy - HOLE_R - 14} textAnchor="middle"
                            style={{ fontSize: '9px', fill: '#fff', fontWeight: 600 }}>
                            Click to {holeClosed ? 'open' : 'close'}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* ── Terminal labels below pipes ── */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterRules.has(term.terminalId)
            return (
              <g key={`tlabel-${ci}`}>
                <text x={hx} y={termLabelY + 10} textAnchor="middle"
                  style={{ fontSize: '10px', fill: isElim ? '#cbd5e1' : '#1A202C', fontWeight: 700, fontFamily: "'Menlo', monospace" }}>
                  {term.displayId}
                </text>
                <text x={hx} y={termLabelY + 22} textAnchor="middle"
                  style={{ fontSize: '9px', fill: isElim ? '#e2e8f0' : '#718096', fontWeight: 500 }}>
                  {term.gatewayShort}
                </text>
              </g>
            )
          })}

          {/* Drop lines from last pipe tier to threshold */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterRules.has(term.terminalId)
            const lastHoleY = holeYOnPipe(tierCount - 1, hx) + HOLE_R + 12
            return (
              <line key={`drop-${ci}`} x1={hx} y1={lastHoleY + 14} x2={hx} y2={thresholdY}
                stroke={isElim ? '#f1f5f9' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3 3"
                opacity={isElim ? 0.2 : 0.4}/>
            )
          })}

          {/* ════════ SR THRESHOLD ════════ */}
          <text x={4} y={thresholdY + 4} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>SR Threshold</text>
          {(simOverrides.srThreshold > 0 || merchant.srThresholdLow > 0) && (
            <text x={W - 6} y={thresholdY + 4} textAnchor="end" style={{ fontSize: '10px', fill: '#A0AEC0', fontWeight: 500 }}>
              ≥ {simOverrides.srThreshold || merchant.srThresholdLow || 0}%
            </text>
          )}

          {(() => {
            const threshold = simOverrides.srThreshold || merchant.srThresholdLow || 0
            const barY = thresholdY + 14
            const barH = THRESHOLD_H - 24
            const maxSR = Math.max(...terminals.map(t => t.successRate), 100)
            const minSR = Math.min(...terminals.map(t => t.successRate), 0)
            const range = maxSR - minSR + 10

            return (
              <g>
                {terminals.map((term, ci) => {
                  const cx = holeXs[ci]
                  const barW = 22
                  const isElimBefore = eliminatedAfterRules.has(term.terminalId)
                  const isElimHere = thresholdStage?.terminalsEliminated?.some(t => t.terminalId === term.terminalId)
                  const fillH = ((term.successRate - minSR + 5) / range) * barH

                  if (isElimBefore) return <rect key={`thr-${ci}`} x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3} fill="#f8fafc" opacity="0.3"/>

                  return (
                    <g key={`thr-${ci}`}>
                      <rect x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.5"/>
                      <rect x={cx - barW / 2} y={barY + barH - fillH} width={barW} height={fillH} rx={3}
                        fill={isElimHere ? '#fca5a5' : '#6ee7b7'} opacity="0.8"/>
                      <text x={cx} y={barY + barH + 12} textAnchor="middle"
                        style={{ fontSize: '9px', fill: isElimHere ? '#dc2626' : '#718096', fontWeight: 600 }}>
                        {term.successRate}%
                      </text>
                    </g>
                  )
                })}

                {/* Threshold line */}
                {threshold > 0 && (() => {
                  const lineY = barY + barH - ((threshold - minSR + 5) / range) * barH
                  return <line x1={PIPE_LEFT - 10} y1={lineY} x2={PIPE_RIGHT + 10} y2={lineY}
                    stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6"/>
                })()}
              </g>
            )
          })()}

          {/* Drop lines threshold → sorter */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return <line key={`drop2-${ci}`} x1={hx} y1={thresholdY + THRESHOLD_H} x2={hx} y2={sorterY}
              stroke={isElim ? '#f1f5f9' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3 3" opacity={isElim ? 0.2 : 0.4}/>
          })}

          {/* ════════ SORTER ════════ */}
          <text x={4} y={sorterY + 4} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>
            Sorter {pipelineResult?.routingStrategy === 'cost_based' ? '(Cost)' : '(SR)'}
          </text>

          {terminals.map((term, ci) => {
            const cx = holeXs[ci]
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            const scored = sorterStage?.scored?.find(s => s.terminalId === term.terminalId)
            const maxScore = Math.max(...(sorterStage?.scored || []).map(s => s.finalScore), 1)
            const score = scored?.finalScore || 0
            const colW = pipeW / colCount
            const funnelW = isElim ? 8 : 12 + (score / maxScore) * (colW * 0.65 - 12)
            const fy = sorterY + 14
            const fh = SORTER_H - 26

            return (
              <g key={`sort-${ci}`}>
                <path d={`M ${cx - funnelW / 2} ${fy} L ${cx + funnelW / 2} ${fy} L ${cx + funnelW / 4} ${fy + fh} L ${cx - funnelW / 4} ${fy + fh} Z`}
                  fill={isElim ? 'none' : scored?.isSelected ? '#dbeafe' : '#e0e7ff'}
                  stroke={isElim ? '#e2e8f0' : scored?.isSelected ? '#528FF0' : '#93a8d2'}
                  strokeWidth={scored?.isSelected ? 2 : 1}
                  opacity={isElim ? 0.15 : 0.8}/>
                {!isElim && scored && (
                  <text x={cx} y={fy + fh + 12} textAnchor="middle"
                    style={{ fontSize: '10px', fill: '#528FF0', fontWeight: 700 }}>{Math.round(score)}</text>
                )}
              </g>
            )
          })}

          {/* Drop lines sorter → bins */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return <line key={`drop3-${ci}`} x1={hx} y1={sorterY + SORTER_H} x2={hx} y2={binY}
              stroke={isElim ? '#f1f5f9' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3 3" opacity={isElim ? 0.2 : 0.4}/>
          })}

          {/* ════════ BINS ════════ */}
          <text x={4} y={binY + 4} style={{ fontSize: '12px', fill: '#1A202C', fontWeight: 700 }}>
            {isNTF ? 'Payment Failed' : 'Terminal Selected'}
          </text>

          {terminals.map((term, ci) => {
            const cx = holeXs[ci]
            const colW = pipeW / colCount
            const bw = Math.min(colW - 10, 90)
            const isSelected = term.terminalId === selectedTerminalId
            const isElim = eliminatedAfterThreshold.has(term.terminalId)

            return (
              <g key={`bin-${ci}`}>
                <rect x={cx - bw / 2} y={binY + 12} width={bw} height={BIN_H - 12} rx={8}
                  fill={isSelected ? '#dbeafe' : isElim ? '#fafafa' : '#f8fafc'}
                  stroke={isSelected ? '#528FF0' : isElim ? '#f1f5f9' : '#e2e8f0'}
                  strokeWidth={isSelected ? 2.5 : 1}
                  filter={isSelected ? 'url(#glow-selected)' : undefined}
                  opacity={isElim ? 0.3 : 1}/>
                <text x={cx} y={binY + 32} textAnchor="middle"
                  style={{ fontSize: '11px', fill: isSelected ? '#1e40af' : isElim ? '#cbd5e1' : '#64748b', fontWeight: 700, fontFamily: "'Menlo', monospace" }}>
                  {term.displayId}
                </text>
                <text x={cx} y={binY + 45} textAnchor="middle"
                  style={{ fontSize: '9px', fill: isSelected ? '#528FF0' : isElim ? '#e2e8f0' : '#94a3b8', fontWeight: 500 }}>
                  {term.gatewayShort}
                </text>
                {isSelected && (
                  <text x={cx} y={binY + 58} textAnchor="middle"
                    style={{ fontSize: '9px', fill: '#528FF0', fontWeight: 600 }}>
                    SR {term.successRate}% · ₹{term.costPerTxn}
                  </text>
                )}
              </g>
            )
          })}

          {isNTF && (
            <g>
              <rect x={W / 2 - 80} y={binY + 16} width={160} height={BIN_H - 20} rx={8}
                fill="#fef2f2" stroke="#ef4444" strokeWidth="2"/>
              <text x={W / 2} y={binY + 38} textAnchor="middle"
                style={{ fontSize: '12px', fill: '#dc2626', fontWeight: 700 }}>No Terminal Found</text>
              <text x={W / 2} y={binY + 54} textAnchor="middle"
                style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }}>Payment Failed</text>
            </g>
          )}

          {/* ════════ Trail ════════ */}
          {trailPath && (
            <path d={trailPath} fill="none" stroke={ballColor} strokeWidth="3" opacity="0.2"
              strokeLinecap="round" strokeLinejoin="round"/>
          )}

          {/* ════════ Ball ════════ */}
          {ballPos && ballProgress >= 0 && ballProgress <= 1 && (
            <g>
              <circle cx={ballPos.x} cy={ballPos.y} r={9}
                fill={isNTF && ballProgress > 0.7 ? '#ef4444' : ballColor}
                filter="url(#ball-glow)"
                opacity={ballProgress > 0.95 ? 0.3 : 1}/>
              {/* Ball shine */}
              <circle cx={ballPos.x - 2} cy={ballPos.y - 2} r={3}
                fill="rgba(255,255,255,0.4)" pointerEvents="none"
                opacity={ballProgress > 0.95 ? 0 : 1}/>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
