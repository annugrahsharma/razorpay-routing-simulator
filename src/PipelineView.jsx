import React, { useMemo, useEffect, useRef, useState } from 'react'
import { gateways } from './data'

// ── Layout constants ──
const W = 700
const LANE_PAD = 90 // left padding for labels
const LANE_RIGHT_PAD = 10
const STAGE_GAP = 16
const TERMINAL_BOX_H = 56
const RULE_ROW_H = 44
const THRESHOLD_H = 60
const SORTER_H = 80
const BIN_H = 80

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
  const laneW = (W - LANE_PAD - LANE_RIGHT_PAD) / colCount
  const laneStartX = LANE_PAD

  // Extract stages by type from pipeline result
  const poolStage = pipelineResult?.stages?.find(s => s.type === 'initial')
  const ruleStages = pipelineResult?.stages?.filter(s =>
    s.type === 'rule_filter' || s.type === 'rule_ntf' || s.type === 'rule_skip' || s.type === 'rule_pass' || s.type === 'rule_disabled'
  ) || []
  const thresholdStage = pipelineResult?.stages?.find(s => s.type === 'threshold_filter' || s.type === 'threshold_bypass')
  const sorterStage = pipelineResult?.stages?.find(s => s.type === 'sorter')
  const ntfStage = pipelineResult?.stages?.find(s => s.type === 'ntf')
  const isNTF = pipelineResult?.isNTF

  // Track which terminals are eliminated at each point
  const eliminatedAfterPool = useMemo(() => {
    if (!poolStage) return new Set()
    return new Set((poolStage.terminalsEliminated || []).map(t => t.terminalId))
  }, [poolStage])

  const eliminatedAfterRules = useMemo(() => {
    const elim = new Set(eliminatedAfterPool)
    ruleStages.forEach(s => {
      (s.terminalsEliminated || []).forEach(t => elim.add(t.terminalId))
    })
    return elim
  }, [eliminatedAfterPool, ruleStages])

  const eliminatedAfterThreshold = useMemo(() => {
    const elim = new Set(eliminatedAfterRules)
    if (thresholdStage) {
      (thresholdStage.terminalsEliminated || []).forEach(t => elim.add(t.terminalId))
    }
    return elim
  }, [eliminatedAfterRules, thresholdStage])

  // ── Y positions for stages ──
  const poolY = 30
  const poolEndY = poolY + TERMINAL_BOX_H + 20
  const rulesStartY = poolEndY + STAGE_GAP
  const rulesH = Math.max(ruleStages.length * RULE_ROW_H, RULE_ROW_H)
  const rulesEndY = rulesStartY + rulesH
  const thresholdY = rulesEndY + STAGE_GAP
  const thresholdEndY = thresholdY + THRESHOLD_H
  const sorterY = thresholdEndY + STAGE_GAP
  const sorterEndY = sorterY + SORTER_H
  const binY = sorterEndY + STAGE_GAP
  const binEndY = binY + BIN_H + 20
  const totalH = binEndY + 10

  // ── Selected terminal index ──
  const selectedTerminalId = pipelineResult?.selectedTerminal?.terminalId
  const selectedColIdx = terminals.findIndex(t => t.terminalId === selectedTerminalId)

  // ── Ball animation ──
  const [ballProgress, setBallProgress] = useState(-1) // -1 = not animating
  const animTimerRef = useRef(null)

  useEffect(() => {
    if (!pipelineResult || animKey === 0) return
    setBallProgress(0)
    let start = null
    const duration = 3500

    const tick = (ts) => {
      if (!start) start = ts
      const elapsed = ts - start
      const pct = Math.min(elapsed / duration, 1)
      setBallProgress(pct)

      // Notify which stage the ball is at
      const stageCount = pipelineResult.stages.length
      const stageIdx = Math.min(Math.floor(pct * stageCount), stageCount - 1)
      onStageReached(stageIdx)

      if (pct < 1) {
        animTimerRef.current = requestAnimationFrame(tick)
      }
    }
    animTimerRef.current = requestAnimationFrame(tick)
    return () => { if (animTimerRef.current) cancelAnimationFrame(animTimerRef.current) }
  }, [animKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ball position based on progress
  const ballPos = useMemo(() => {
    if (ballProgress < 0 || !pipelineResult) return null
    const p = ballProgress

    // Determine which terminal the ball targets
    const targetIdx = isNTF ? -1 : selectedColIdx
    const targetX = targetIdx >= 0
      ? laneStartX + targetIdx * laneW + laneW / 2
      : laneStartX + (colCount * laneW) / 2

    const startX = laneStartX + (colCount * laneW) / 2

    // Map progress to Y positions through stages
    if (p < 0.12) {
      // Entry → pool
      const t = p / 0.12
      return { x: startX, y: poolY - 10 + t * (poolEndY - poolY + 15) }
    } else if (p < 0.50) {
      // Through rule stages
      const t = (p - 0.12) / 0.38
      const rulesH = rulesEndY - rulesStartY
      const progressX = startX + (targetX - startX) * t * 0.7
      return { x: progressX, y: rulesStartY + t * rulesH }
    } else if (p < 0.62) {
      // Through threshold
      const t = (p - 0.50) / 0.12
      const progressX = startX + (targetX - startX) * 0.7 + (targetX - startX) * 0.15 * t
      return { x: progressX, y: thresholdY + t * THRESHOLD_H }
    } else if (p < 0.80) {
      // Through sorter
      const t = (p - 0.62) / 0.18
      const progressX = startX + (targetX - startX) * 0.85 + (targetX - startX) * 0.15 * t
      return { x: progressX, y: sorterY + t * SORTER_H }
    } else {
      // Into bin
      const t = (p - 0.80) / 0.20
      return { x: targetX, y: binY + t * (BIN_H * 0.6) }
    }
  }, [ballProgress, pipelineResult, isNTF, selectedColIdx, laneStartX, laneW, colCount, poolY, poolEndY, rulesStartY, rulesEndY, thresholdY, sorterY, binY])

  // ── Trail path ──
  const trailRef = useRef([])
  useEffect(() => {
    if (ballProgress <= 0) trailRef.current = []
    if (ballPos) {
      trailRef.current = [...trailRef.current, `${ballPos.x},${ballPos.y}`]
    }
  }, [ballPos, ballProgress])

  const trailPath = trailRef.current.length > 1
    ? `M ${trailRef.current.join(' L ')}`
    : ''

  // Ball color
  const ballColor = txn.payment_method === 'UPI' ? '#16a34a' : txn.payment_method === 'NB' ? '#9333ea' : '#528FF0'

  // ── Render ──
  return (
    <div className="pipeline-container">
      {!pipelineResult && (
        <div className="pipeline-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#A0AEC0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/>
          </svg>
          <p>Define a payment and click <strong>Simulate</strong> to visualize the routing pipeline</p>
        </div>
      )}

      {pipelineResult && (
        <svg className="pipeline-svg" viewBox={`0 0 ${W} ${totalH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="glow-selected">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="ball-glow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="pipe-bin-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#528FF0" stopOpacity="0.15"/>
              <stop offset="100%" stopColor="#528FF0" stopOpacity="0.4"/>
            </linearGradient>
            <linearGradient id="pipe-bin-ntf-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E74C3C" stopOpacity="0.15"/>
              <stop offset="100%" stopColor="#E74C3C" stopOpacity="0.4"/>
            </linearGradient>
          </defs>

          {/* ════════ STAGE 1: Terminal Pool ════════ */}
          <text x={4} y={poolY + 12} className="pipe-stage-label">1</text>
          <text x={20} y={poolY + 12} className="pipe-stage-title">Terminal Pool</text>
          {poolStage && (
            <text x={W - 6} y={poolY + 12} textAnchor="end" className="pipe-stage-count">
              {poolStage.remainingCount} of {poolStage.totalCount} eligible
            </text>
          )}

          {terminals.map((term, ci) => {
            const x = laneStartX + ci * laneW + 4
            const w = laneW - 8
            const isElim = eliminatedAfterPool.has(term.terminalId)
            const isDown = simOverrides.disabledTerminals.has(term.terminalId)
            return (
              <g key={`pool-${ci}`} className="pipe-terminal-box" onClick={() => onToggleTerminal(term.terminalId)} style={{ cursor: 'pointer' }}>
                <rect x={x} y={poolY + 20} width={w} height={TERMINAL_BOX_H} rx={6}
                  className={`pipe-term-rect ${isElim ? 'eliminated' : ''} ${isDown ? 'down' : ''}`}
                />
                <text x={x + w / 2} y={poolY + 40} textAnchor="middle" className={`pipe-term-name ${isElim ? 'eliminated' : ''}`}>
                  {term.displayId}
                </text>
                <text x={x + w / 2} y={poolY + 53} textAnchor="middle" className="pipe-term-meta">
                  {term.gatewayShort}
                </text>
                <text x={x + w / 2} y={poolY + 65} textAnchor="middle" className="pipe-term-meta">
                  SR {term.successRate}% · ₹{term.costPerTxn}
                </text>
                {isElim && (
                  <g>
                    <line x1={x + 6} y1={poolY + 26} x2={x + w - 6} y2={poolY + 20 + TERMINAL_BOX_H - 6} stroke="#E74C3C" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                    <line x1={x + w - 6} y1={poolY + 26} x2={x + 6} y2={poolY + 20 + TERMINAL_BOX_H - 6} stroke="#E74C3C" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                  </g>
                )}
                {isDown && (
                  <text x={x + w / 2} y={poolY + 20 + TERMINAL_BOX_H / 2 + 3} textAnchor="middle" className="pipe-down-label">DOWN</text>
                )}
              </g>
            )
          })}

          {/* Lane connectors pool → rules */}
          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterPool.has(term.terminalId)
            return (
              <line key={`conn-pool-${ci}`} x1={cx} y1={poolY + 20 + TERMINAL_BOX_H} x2={cx} y2={rulesStartY}
                className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}
              />
            )
          })}

          {/* ════════ STAGE 2: Rule Filters ════════ */}
          <text x={4} y={rulesStartY + 12} className="pipe-stage-label">2</text>
          <text x={20} y={rulesStartY + 12} className="pipe-stage-title">Rule Filters</text>

          {ruleStages.map((stage, ri) => {
            const rowY = rulesStartY + 20 + ri * RULE_ROW_H
            const isSkip = stage.type === 'rule_skip'
            const isDisabled = stage.type === 'rule_disabled'
            const isNTFCause = stage.type === 'rule_ntf'

            return (
              <g key={`rule-${ri}`}>
                {/* Rule name label */}
                <text x={LANE_PAD - 6} y={rowY + RULE_ROW_H / 2 + 3} textAnchor="end"
                  className={`pipe-rule-label ${isSkip ? 'skip' : ''} ${isDisabled ? 'disabled' : ''}`}>
                  {(stage.ruleName || '').length > 16 ? (stage.ruleName || '').slice(0, 16) + '..' : stage.ruleName}
                </text>

                {/* Gate per terminal */}
                {terminals.map((term, ci) => {
                  const cx = laneStartX + ci * laneW + laneW / 2
                  const gateY = rowY + 6
                  const gateH = RULE_ROW_H - 12
                  const gateW = Math.min(laneW - 12, 28)

                  // Is this terminal already eliminated before this rule?
                  const prevElim = eliminatedAfterPool.has(term.terminalId)
                  if (prevElim) {
                    return (
                      <rect key={`gate-${ri}-${ci}`} x={cx - gateW / 2} y={gateY} width={gateW} height={gateH} rx={4}
                        className="pipe-gate faded"/>
                    )
                  }

                  const isElimHere = (stage.terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
                  const isKeptHere = (stage.terminalsRemaining || []).some(t => t.terminalId === term.terminalId)

                  let gateClass = 'pipe-gate'
                  if (isDisabled) gateClass += ' disabled'
                  else if (isSkip) gateClass += ' skip'
                  else if (isElimHere) gateClass += ' blocked'
                  else if (isKeptHere) gateClass += ' open'
                  else gateClass += ' neutral'

                  return (
                    <g key={`gate-${ri}-${ci}`} style={{ cursor: stage.ruleId ? 'pointer' : 'default' }}
                      onClick={() => stage.ruleId && onToggleRule(stage.ruleId)}>
                      <rect x={cx - gateW / 2} y={gateY} width={gateW} height={gateH} rx={4} className={gateClass}/>
                      {isElimHere && !isDisabled && (
                        <>
                          <line x1={cx - 6} y1={gateY + gateH / 2 - 6} x2={cx + 6} y2={gateY + gateH / 2 + 6}
                            stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                          <line x1={cx + 6} y1={gateY + gateH / 2 - 6} x2={cx - 6} y2={gateY + gateH / 2 + 6}
                            stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        </>
                      )}
                      {isKeptHere && !isSkip && !isDisabled && (
                        <polyline points={`${cx - 4},${gateY + gateH / 2} ${cx - 1},${gateY + gateH / 2 + 3} ${cx + 5},${gateY + gateH / 2 - 4}`}
                          fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      )}
                    </g>
                  )
                })}

                {/* NTF highlight */}
                {isNTFCause && (
                  <rect x={LANE_PAD - 2} y={rowY} width={W - LANE_PAD - LANE_RIGHT_PAD + 4} height={RULE_ROW_H}
                    rx={4} fill="#E74C3C" opacity="0.08" pointerEvents="none"/>
                )}
              </g>
            )
          })}

          {/* Lane connectors rules → threshold */}
          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterRules.has(term.terminalId)
            return (
              <line key={`conn-rules-${ci}`} x1={cx} y1={rulesEndY + 20} x2={cx} y2={thresholdY}
                className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}
              />
            )
          })}

          {/* ════════ STAGE 3: SR Threshold ════════ */}
          <text x={4} y={thresholdY + 12} className="pipe-stage-label">3</text>
          <text x={20} y={thresholdY + 12} className="pipe-stage-title">SR Threshold</text>
          {(simOverrides.srThreshold > 0 || merchant.srThresholdLow > 0) && (
            <text x={W - 6} y={thresholdY + 12} textAnchor="end" className="pipe-stage-count">
              ≥ {simOverrides.srThreshold || merchant.srThresholdLow || 0}%
            </text>
          )}

          {(() => {
            const threshold = simOverrides.srThreshold || merchant.srThresholdLow || 0
            const barY = thresholdY + 24
            const barH = THRESHOLD_H - 30
            const maxSR = Math.max(...terminals.map(t => t.successRate), 100)
            const minSR = Math.min(...terminals.map(t => t.successRate), 0)
            const range = maxSR - minSR + 10

            return terminals.map((term, ci) => {
              const cx = laneStartX + ci * laneW + laneW / 2
              const barW = Math.min(laneW - 16, 24)
              const isElimBefore = eliminatedAfterRules.has(term.terminalId)
              const isElimHere = thresholdStage?.terminalsEliminated?.some(t => t.terminalId === term.terminalId)
              const fillH = ((term.successRate - minSR + 5) / range) * barH

              if (isElimBefore) {
                return (
                  <rect key={`thr-${ci}`} x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3}
                    className="pipe-sr-bar faded"/>
                )
              }

              return (
                <g key={`thr-${ci}`}>
                  <rect x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3} className="pipe-sr-bar-bg"/>
                  <rect x={cx - barW / 2} y={barY + barH - fillH} width={barW} height={fillH} rx={3}
                    className={`pipe-sr-bar-fill ${isElimHere ? 'below' : 'above'}`}/>
                  <text x={cx} y={barY + barH + 12} textAnchor="middle" className="pipe-sr-value">
                    {term.successRate}%
                  </text>
                </g>
              )
            })
          })()}

          {/* Threshold line */}
          {(simOverrides.srThreshold > 0 || merchant.srThresholdLow > 0) && (() => {
            const threshold = simOverrides.srThreshold || merchant.srThresholdLow || 0
            const barY = thresholdY + 24
            const barH = THRESHOLD_H - 30
            const maxSR = Math.max(...terminals.map(t => t.successRate), 100)
            const minSR = Math.min(...terminals.map(t => t.successRate), 0)
            const range = maxSR - minSR + 10
            const lineY = barY + barH - ((threshold - minSR + 5) / range) * barH

            return (
              <line x1={LANE_PAD - 4} y1={lineY} x2={W - LANE_RIGHT_PAD} y2={lineY}
                className="pipe-threshold-line"/>
            )
          })()}

          {/* Lane connectors threshold → sorter */}
          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return (
              <line key={`conn-thr-${ci}`} x1={cx} y1={thresholdEndY} x2={cx} y2={sorterY}
                className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}
              />
            )
          })}

          {/* ════════ STAGE 4: Sorter ════════ */}
          <text x={4} y={sorterY + 12} className="pipe-stage-label">4</text>
          <text x={20} y={sorterY + 12} className="pipe-stage-title">
            Sorter {pipelineResult?.routingStrategy === 'cost_based' ? '(Cost)' : '(SR)'}
          </text>

          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            const scored = sorterStage?.scored?.find(s => s.terminalId === term.terminalId)
            const maxScore = Math.max(...(sorterStage?.scored || []).map(s => s.finalScore), 1)
            const score = scored?.finalScore || 0
            const funnelW = isElim ? 8 : 10 + (score / maxScore) * (laneW * 0.7 - 10)
            const funnelY = sorterY + 22
            const funnelH = SORTER_H - 34

            return (
              <g key={`sort-${ci}`}>
                <path
                  d={`M ${cx - funnelW / 2} ${funnelY} L ${cx + funnelW / 2} ${funnelY} L ${cx + funnelW / 4} ${funnelY + funnelH} L ${cx - funnelW / 4} ${funnelY + funnelH} Z`}
                  className={`pipe-funnel ${isElim ? 'eliminated' : ''} ${scored?.isSelected ? 'selected' : ''}`}
                />
                {!isElim && scored && (
                  <text x={cx} y={funnelY + funnelH + 12} textAnchor="middle" className="pipe-funnel-score">
                    {Math.round(score)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Lane connectors sorter → bins */}
          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return (
              <line key={`conn-sort-${ci}`} x1={cx} y1={sorterEndY} x2={cx} y2={binY}
                className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}
              />
            )
          })}

          {/* ════════ STAGE 5: Terminal Selected ════════ */}
          <text x={4} y={binY + 12} className="pipe-stage-label">5</text>
          <text x={20} y={binY + 12} className="pipe-stage-title">
            {isNTF ? 'Payment Failed' : 'Terminal Selected'}
          </text>

          {terminals.map((term, ci) => {
            const x = laneStartX + ci * laneW + 4
            const w = laneW - 8
            const isSelected = term.terminalId === selectedTerminalId
            const isElim = eliminatedAfterThreshold.has(term.terminalId)

            return (
              <g key={`bin-${ci}`}>
                <rect x={x} y={binY + 20} width={w} height={BIN_H - 10} rx={6}
                  className={`pipe-bin ${isSelected ? 'selected' : ''} ${isElim ? 'eliminated' : ''}`}
                  filter={isSelected ? 'url(#glow-selected)' : undefined}
                />
                <text x={x + w / 2} y={binY + 45} textAnchor="middle"
                  className={`pipe-bin-label ${isSelected ? 'selected' : ''} ${isElim ? 'eliminated' : ''}`}>
                  {term.displayId}
                </text>
                <text x={x + w / 2} y={binY + 58} textAnchor="middle"
                  className={`pipe-bin-sub ${isSelected ? 'selected' : ''} ${isElim ? 'eliminated' : ''}`}>
                  {term.gatewayShort}
                </text>
                {isSelected && (
                  <text x={x + w / 2} y={binY + 72} textAnchor="middle" className="pipe-bin-score">
                    SR {term.successRate}% · ₹{term.costPerTxn}
                  </text>
                )}
              </g>
            )
          })}

          {/* NTF indicator */}
          {isNTF && (
            <g>
              <rect x={W / 2 - 80} y={binY + 25} width={160} height={BIN_H - 20} rx={8}
                fill="#FDECEB" stroke="#E74C3C" strokeWidth="1.5"/>
              <text x={W / 2} y={binY + 50} textAnchor="middle" className="pipe-ntf-label">No Terminal Found</text>
              <text x={W / 2} y={binY + 66} textAnchor="middle" className="pipe-ntf-sub">Payment Failed</text>
            </g>
          )}

          {/* ════════ Trail path ════════ */}
          {trailPath && (
            <path d={trailPath} fill="none" stroke={ballColor} strokeWidth="2" opacity="0.3"
              strokeLinecap="round" strokeLinejoin="round"/>
          )}

          {/* ════════ Ball ════════ */}
          {ballPos && ballProgress >= 0 && ballProgress <= 1 && (
            <circle cx={ballPos.x} cy={ballPos.y} r={6}
              fill={isNTF && ballProgress > 0.7 ? '#E74C3C' : ballColor}
              filter="url(#ball-glow)"
              opacity={ballProgress > 0.95 ? 0.4 : 1}
            />
          )}
        </svg>
      )}
    </div>
  )
}
