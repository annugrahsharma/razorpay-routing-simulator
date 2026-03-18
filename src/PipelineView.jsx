import React, { useMemo, useEffect, useRef, useState } from 'react'
import { gateways } from './data'

// ── Layout constants ──
const W = 720
const LANE_PAD = 90
const LANE_RIGHT_PAD = 10
const STAGE_GAP = 20
const TERMINAL_BOX_H = 56
const RULE_ROW_H = 56 // taller for marble run doors
const THRESHOLD_H = 60
const SORTER_H = 80
const BIN_H = 80
const RAMP_SLOPE = 12 // px vertical drop per rule row for the ramp

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

  // Extract stages by type
  const poolStage = pipelineResult?.stages?.find(s => s.type === 'initial')
  const ruleStages = pipelineResult?.stages?.filter(s =>
    s.type === 'rule_filter' || s.type === 'rule_ntf' || s.type === 'rule_skip' || s.type === 'rule_pass' || s.type === 'rule_disabled'
  ) || []
  const thresholdStage = pipelineResult?.stages?.find(s => s.type === 'threshold_filter' || s.type === 'threshold_bypass')
  const sorterStage = pipelineResult?.stages?.find(s => s.type === 'sorter')
  const isNTF = pipelineResult?.isNTF

  // Track eliminated terminals at each stage
  const eliminatedAfterPool = useMemo(() => {
    if (!poolStage) return new Set()
    return new Set((poolStage.terminalsEliminated || []).map(t => t.terminalId))
  }, [poolStage])

  // Track cumulative elimination per rule row
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

  // ── Y positions ──
  const poolY = 30
  const poolEndY = poolY + TERMINAL_BOX_H + 20
  const rulesStartY = poolEndY + STAGE_GAP
  const rulesH = Math.max(ruleStages.length * RULE_ROW_H + 20, RULE_ROW_H + 20)
  const rulesEndY = rulesStartY + rulesH
  const thresholdY = rulesEndY + STAGE_GAP
  const thresholdEndY = thresholdY + THRESHOLD_H
  const sorterY = thresholdEndY + STAGE_GAP
  const sorterEndY = sorterY + SORTER_H
  const binY = sorterEndY + STAGE_GAP
  const binEndY = binY + BIN_H + 20
  const totalH = binEndY + 10

  // Selected terminal
  const selectedTerminalId = pipelineResult?.selectedTerminal?.terminalId
  const selectedColIdx = terminals.findIndex(t => t.terminalId === selectedTerminalId)

  // ── Ball animation ──
  const [ballProgress, setBallProgress] = useState(-1)
  const animTimerRef = useRef(null)

  useEffect(() => {
    if (!pipelineResult || animKey === 0) return
    setBallProgress(0)
    trailRef.current = []
    let start = null
    const duration = 4000

    const tick = (ts) => {
      if (!start) start = ts
      const elapsed = ts - start
      const pct = Math.min(elapsed / duration, 1)
      setBallProgress(pct)

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

  // Ball position — now with ramp physics for Stage 2
  const ballPos = useMemo(() => {
    if (ballProgress < 0 || !pipelineResult) return null
    const p = ballProgress

    const targetIdx = isNTF ? -1 : selectedColIdx
    const targetX = targetIdx >= 0
      ? laneStartX + targetIdx * laneW + laneW / 2
      : laneStartX + (colCount * laneW) / 2
    const startX = laneStartX + (colCount * laneW) / 2

    if (p < 0.10) {
      // Entry → pool
      const t = p / 0.10
      return { x: startX, y: poolY - 10 + t * (poolEndY - poolY + 10) }
    } else if (p < 0.55) {
      // Through rule marble run — ball rolls down the ramp diagonally
      const t = (p - 0.10) / 0.45
      const rampTotalH = rulesEndY - rulesStartY
      // Ball follows a sloped path, zigzagging between rule rows
      const y = rulesStartY + 10 + t * rampTotalH
      // Ease toward target lane, with slight sinusoidal wobble
      const wobble = Math.sin(t * Math.PI * ruleStages.length) * 8
      const progressX = startX + (targetX - startX) * t * 0.7 + wobble
      return { x: progressX, y }
    } else if (p < 0.67) {
      // Through threshold
      const t = (p - 0.55) / 0.12
      const progressX = startX + (targetX - startX) * 0.7 + (targetX - startX) * 0.15 * t
      return { x: progressX, y: thresholdY + t * THRESHOLD_H }
    } else if (p < 0.82) {
      // Through sorter
      const t = (p - 0.67) / 0.15
      const progressX = startX + (targetX - startX) * 0.85 + (targetX - startX) * 0.15 * t
      return { x: progressX, y: sorterY + t * SORTER_H }
    } else {
      // Into bin
      const t = (p - 0.82) / 0.18
      return { x: targetX, y: binY + t * (BIN_H * 0.6) }
    }
  }, [ballProgress, pipelineResult, isNTF, selectedColIdx, laneStartX, laneW, colCount, poolY, poolEndY, rulesStartY, rulesEndY, thresholdY, sorterY, binY, ruleStages.length])

  // Trail path
  const trailRef = useRef([])
  useEffect(() => {
    if (ballProgress <= 0) trailRef.current = []
    if (ballPos) {
      trailRef.current = [...trailRef.current, `${ballPos.x},${ballPos.y}`]
    }
  }, [ballPos, ballProgress])

  const trailPath = trailRef.current.length > 1 ? `M ${trailRef.current.join(' L ')}` : ''
  const ballColor = txn.payment_method === 'UPI' ? '#16a34a' : txn.payment_method === 'NB' ? '#9333ea' : '#528FF0'

  // Door dimensions
  const DOOR_W = 6
  const DOOR_H = 28
  const TRACK_H = 3

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
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="ramp-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cbd5e1"/>
              <stop offset="100%" stopColor="#94a3b8"/>
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
                  className={`pipe-term-rect ${isElim ? 'eliminated' : ''} ${isDown ? 'down' : ''}`}/>
                <text x={x + w / 2} y={poolY + 40} textAnchor="middle" className={`pipe-term-name ${isElim ? 'eliminated' : ''}`}>
                  {term.displayId}
                </text>
                <text x={x + w / 2} y={poolY + 53} textAnchor="middle" className="pipe-term-meta">{term.gatewayShort}</text>
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

          {/* Lane connectors pool → marble run */}
          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterPool.has(term.terminalId)
            return (
              <line key={`conn-pool-${ci}`} x1={cx} y1={poolY + 20 + TERMINAL_BOX_H} x2={cx} y2={rulesStartY + 16}
                className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}/>
            )
          })}

          {/* ════════ STAGE 2: Rule Filters — Marble Run ════════ */}
          <text x={4} y={rulesStartY + 12} className="pipe-stage-label">2</text>
          <text x={20} y={rulesStartY + 12} className="pipe-stage-title">Rule Filters</text>

          {/* Background — marble run track area */}
          <rect x={LANE_PAD - 4} y={rulesStartY + 18} width={W - LANE_PAD - LANE_RIGHT_PAD + 8}
            height={rulesH - 22} rx={8} className="marble-run-bg"/>

          {ruleStages.map((stage, ri) => {
            const rowY = rulesStartY + 24 + ri * RULE_ROW_H
            const isSkip = stage.type === 'rule_skip'
            const isDisabled = stage.type === 'rule_disabled'
            const isNTFCause = stage.type === 'rule_ntf'

            // Track which terminals were already eliminated BEFORE this rule
            const prevElim = ri > 0 ? eliminatedAtRule[ri - 1] : eliminatedAfterPool

            return (
              <g key={`rule-${ri}`}>
                {/* Rule label */}
                <text x={LANE_PAD - 8} y={rowY + RULE_ROW_H / 2 + 3} textAnchor="end"
                  className={`pipe-rule-label ${isSkip ? 'skip' : ''} ${isDisabled ? 'disabled' : ''}`}>
                  {(stage.ruleName || '').length > 14 ? (stage.ruleName || '').slice(0, 14) + '..' : stage.ruleName}
                </text>

                {/* Horizontal ramp track across all lanes */}
                <line
                  x1={laneStartX} y1={rowY + RULE_ROW_H / 2}
                  x2={laneStartX + colCount * laneW} y2={rowY + RULE_ROW_H / 2 + RAMP_SLOPE}
                  className={`marble-track ${isSkip ? 'skip' : ''} ${isDisabled ? 'disabled' : ''}`}
                />
                {/* Second rail */}
                <line
                  x1={laneStartX} y1={rowY + RULE_ROW_H / 2 + TRACK_H}
                  x2={laneStartX + colCount * laneW} y2={rowY + RULE_ROW_H / 2 + RAMP_SLOPE + TRACK_H}
                  className={`marble-track ${isSkip ? 'skip' : ''} ${isDisabled ? 'disabled' : ''}`}
                />

                {/* Doors at each terminal lane */}
                {terminals.map((term, ci) => {
                  const cx = laneStartX + ci * laneW + laneW / 2
                  // Interpolate Y along the sloped ramp
                  const laneProgress = (ci + 0.5) / colCount
                  const trackY = rowY + RULE_ROW_H / 2 + laneProgress * RAMP_SLOPE

                  const wasElimBefore = prevElim.has(term.terminalId)
                  if (wasElimBefore) {
                    // Already eliminated — show faded broken track
                    return (
                      <g key={`door-${ri}-${ci}`} opacity="0.15">
                        <rect x={cx - DOOR_W / 2 - 1} y={trackY - DOOR_H / 2} width={DOOR_W + 2} height={DOOR_H}
                          rx={2} fill="#94a3b8" stroke="none"/>
                      </g>
                    )
                  }

                  const isElimHere = (stage.terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
                  const isKeptHere = (stage.terminalsRemaining || []).some(t => t.terminalId === term.terminalId)

                  // Door visual: a rectangle that can be "open" (rotated away) or "closed" (blocking)
                  let doorClass = 'marble-door'
                  if (isDisabled) doorClass += ' disabled'
                  else if (isSkip) doorClass += ' skip'
                  else if (isElimHere) doorClass += ' closed'
                  else if (isKeptHere) doorClass += ' open'
                  else doorClass += ' neutral'

                  const isClosed = isElimHere && !isDisabled

                  return (
                    <g key={`door-${ri}-${ci}`}
                      style={{ cursor: stage.ruleId ? 'pointer' : 'default' }}
                      onClick={() => stage.ruleId && onToggleRule(stage.ruleId)}
                    >
                      {/* Door frame / archway */}
                      <rect x={cx - laneW / 2 + 4} y={trackY - DOOR_H / 2 - 2}
                        width={laneW - 8} height={DOOR_H + 4} rx={4}
                        className={`marble-door-frame ${isClosed ? 'closed' : ''}`}/>

                      {isClosed ? (
                        /* Closed door — solid blocking panel with X */
                        <g>
                          <rect x={cx - laneW / 2 + 6} y={trackY - DOOR_H / 2}
                            width={laneW - 12} height={DOOR_H} rx={3}
                            className="marble-door closed"/>
                          {/* X mark */}
                          <line x1={cx - 7} y1={trackY - 7} x2={cx + 7} y2={trackY + 7}
                            stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                          <line x1={cx + 7} y1={trackY - 7} x2={cx - 7} y2={trackY + 7}
                            stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                        </g>
                      ) : isSkip || isDisabled ? (
                        /* Skipped/disabled — dashed outline, ball passes freely */
                        <rect x={cx - laneW / 2 + 6} y={trackY - DOOR_H / 2}
                          width={laneW - 12} height={DOOR_H} rx={3}
                          className={`marble-door ${isDisabled ? 'disabled' : 'skip'}`}/>
                      ) : (
                        /* Open door — shows as an archway / opening */
                        <g>
                          {/* Left door half — swung open */}
                          <rect x={cx - laneW / 2 + 6} y={trackY - DOOR_H / 2}
                            width={(laneW - 12) * 0.2} height={DOOR_H} rx={2}
                            className="marble-door open"/>
                          {/* Right door half — swung open */}
                          <rect x={cx + laneW / 2 - 6 - (laneW - 12) * 0.2} y={trackY - DOOR_H / 2}
                            width={(laneW - 12) * 0.2} height={DOOR_H} rx={2}
                            className="marble-door open"/>
                          {/* Checkmark in opening */}
                          <polyline points={`${cx - 5},${trackY} ${cx - 1},${trackY + 4} ${cx + 6},${trackY - 5}`}
                            fill="none" stroke="#1EA672" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                      )}
                    </g>
                  )
                })}

                {/* NTF row highlight */}
                {isNTFCause && (
                  <rect x={LANE_PAD - 2} y={rowY + 2} width={W - LANE_PAD - LANE_RIGHT_PAD + 4} height={RULE_ROW_H - 4}
                    rx={6} fill="#E74C3C" opacity="0.06" pointerEvents="none"/>
                )}
              </g>
            )
          })}

          {/* Lane connectors rules → threshold */}
          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterRules.has(term.terminalId)
            return (
              <line key={`conn-rules-${ci}`} x1={cx} y1={rulesEndY} x2={cx} y2={thresholdY}
                className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}/>
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
                return <rect key={`thr-${ci}`} x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3} className="pipe-sr-bar faded"/>
              }

              return (
                <g key={`thr-${ci}`}>
                  <rect x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3} className="pipe-sr-bar-bg"/>
                  <rect x={cx - barW / 2} y={barY + barH - fillH} width={barW} height={fillH} rx={3}
                    className={`pipe-sr-bar-fill ${isElimHere ? 'below' : 'above'}`}/>
                  <text x={cx} y={barY + barH + 12} textAnchor="middle" className="pipe-sr-value">{term.successRate}%</text>
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
            return <line x1={LANE_PAD - 4} y1={lineY} x2={W - LANE_RIGHT_PAD} y2={lineY} className="pipe-threshold-line"/>
          })()}

          {/* Lane connectors threshold → sorter */}
          {terminals.map((term, ci) => {
            const cx = laneStartX + ci * laneW + laneW / 2
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return <line key={`conn-thr-${ci}`} x1={cx} y1={thresholdEndY} x2={cx} y2={sorterY}
              className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}/>
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
                  className={`pipe-funnel ${isElim ? 'eliminated' : ''} ${scored?.isSelected ? 'selected' : ''}`}/>
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
            return <line key={`conn-sort-${ci}`} x1={cx} y1={sorterEndY} x2={cx} y2={binY}
              className={`pipe-lane-connector ${isElim ? 'eliminated' : ''}`}/>
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
                  filter={isSelected ? 'url(#glow-selected)' : undefined}/>
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

          {isNTF && (
            <g>
              <rect x={W / 2 - 80} y={binY + 25} width={160} height={BIN_H - 20} rx={8}
                fill="#FDECEB" stroke="#E74C3C" strokeWidth="1.5"/>
              <text x={W / 2} y={binY + 50} textAnchor="middle" className="pipe-ntf-label">No Terminal Found</text>
              <text x={W / 2} y={binY + 66} textAnchor="middle" className="pipe-ntf-sub">Payment Failed</text>
            </g>
          )}

          {/* ════════ Trail ════════ */}
          {trailPath && (
            <path d={trailPath} fill="none" stroke={ballColor} strokeWidth="2.5" opacity="0.25"
              strokeLinecap="round" strokeLinejoin="round"/>
          )}

          {/* ════════ Ball ════════ */}
          {ballPos && ballProgress >= 0 && ballProgress <= 1 && (
            <circle cx={ballPos.x} cy={ballPos.y} r={7}
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
