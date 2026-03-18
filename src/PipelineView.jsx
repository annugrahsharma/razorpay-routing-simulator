import React, { useMemo, useEffect, useRef, useState } from 'react'
import { gateways } from './data'

// ── Layout ──
const W = 740
const PIPE_TOP = 40
const PIPE_H = 36         // pipe thickness
const PIPE_LEFT = 60       // ball source area
const PIPE_RIGHT = W - 20
const HOLE_W = 24          // trapdoor width
const DROP_H = 120         // how far ball drops through hole
const BIN_H = 70
const RULE_ROW_SPACING = 20 // vertical gap between pipe tiers
const SOURCE_R = 18

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

  // Pipe section width per terminal (evenly spaced holes along the pipe)
  const pipeUsableW = PIPE_RIGHT - PIPE_LEFT
  const holeSpacing = pipeUsableW / (colCount + 1)

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

  // Track eliminated terminals
  const eliminatedAfterPool = useMemo(() => {
    if (!poolStage) return new Set()
    return new Set((poolStage.terminalsEliminated || []).map(t => t.terminalId))
  }, [poolStage])

  // Cumulative elimination per rule
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

  // Which terminal does the ball actually drop through?
  // It's the selected terminal from the pipeline result
  const dropColIdx = selectedColIdx

  // ── Vertical layout ──
  // Each rule is a horizontal pipe tier. Ball rolls L→R, hits holes.
  // After rules: threshold bar, sorter funnels, then bins.
  const tierCount = Math.max(ruleStages.length, 1)
  const tierH = PIPE_H + RULE_ROW_SPACING
  const rulesBlockY = PIPE_TOP + 60
  const rulesBlockH = tierCount * tierH + 20
  const thresholdY = rulesBlockY + rulesBlockH + 30
  const sorterY = thresholdY + 80
  const binY = sorterY + 90
  const totalH = binY + BIN_H + 30

  // Hole positions (same X for each terminal across all tiers)
  const holeXs = terminals.map((_, ci) => PIPE_LEFT + holeSpacing * (ci + 1))

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

  // Ball position — rolls L→R through pipe, drops through the winning hole
  const ballPos = useMemo(() => {
    if (ballProgress < 0 || !pipelineResult) return null
    const p = ballProgress

    const sourceX = PIPE_LEFT - 10
    const sourceY = PIPE_TOP + 20
    const dropX = dropColIdx >= 0 ? holeXs[dropColIdx] : PIPE_RIGHT - 20
    const pipeY = rulesBlockY + (tierCount - 1) * tierH + PIPE_H / 2 // bottom tier pipe center

    if (p < 0.05) {
      // Ball appears at source
      const t = p / 0.05
      return { x: sourceX, y: sourceY + t * (rulesBlockY + PIPE_H / 2 - sourceY) }
    } else if (p < 0.55) {
      // Roll L→R through the pipe, across all rule tiers
      // Ball traverses from left to the target hole X position
      const t = (p - 0.05) / 0.50
      const rollEndX = dropX
      const x = PIPE_LEFT + t * (rollEndX - PIPE_LEFT)

      // Determine which tier the ball is on based on which rules it has passed
      // Ball descends tier-by-tier as it passes holes
      let currentTierIdx = 0
      for (let ri = 0; ri < ruleStages.length; ri++) {
        // Ball moves to next tier when it passes each rule's evaluation point
        if (t > (ri + 1) / (ruleStages.length + 1)) currentTierIdx = ri
      }
      const y = rulesBlockY + currentTierIdx * tierH + PIPE_H / 2

      // Subtle bounce on the pipe
      const bounce = Math.sin(t * Math.PI * 6) * 2
      return { x, y: y + bounce }
    } else if (p < 0.65) {
      // Drop through the hole
      const t = (p - 0.55) / 0.10
      const startDropY = rulesBlockY + (tierCount - 1) * tierH + PIPE_H
      const endDropY = thresholdY - 10
      // Gravity acceleration feel
      const easeT = t * t
      return { x: dropX, y: startDropY + easeT * (endDropY - startDropY) }
    } else if (p < 0.75) {
      // Through threshold
      const t = (p - 0.65) / 0.10
      return { x: dropX, y: thresholdY + t * 60 }
    } else if (p < 0.88) {
      // Through sorter
      const t = (p - 0.75) / 0.13
      return { x: dropX, y: sorterY + t * 70 }
    } else {
      // Into bin
      const t = (p - 0.88) / 0.12
      return { x: dropX, y: binY + t * (BIN_H * 0.5) }
    }
  }, [ballProgress, pipelineResult, dropColIdx, holeXs, rulesBlockY, tierCount, tierH, thresholdY, sorterY, binY, ruleStages.length])

  // Trail
  useEffect(() => {
    if (ballProgress <= 0) trailRef.current = []
    if (ballPos) trailRef.current = [...trailRef.current, `${ballPos.x},${ballPos.y}`]
  }, [ballPos, ballProgress])

  const trailPath = trailRef.current.length > 1 ? `M ${trailRef.current.join(' L ')}` : ''
  const ballColor = txn.payment_method === 'UPI' ? '#16a34a' : txn.payment_method === 'NB' ? '#9333ea' : '#528FF0'

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
            <filter id="ball-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-selected"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          {/* ════════ BALL SOURCE — top-left ════════ */}
          <circle cx={PIPE_LEFT - 10} cy={PIPE_TOP + 20} r={SOURCE_R}
            className="pipe-source"/>
          <text x={PIPE_LEFT - 10} y={PIPE_TOP + 6} textAnchor="middle" className="pipe-source-label">
            Ball Source
          </text>
          {/* Chute from source down to first pipe */}
          <line x1={PIPE_LEFT - 10} y1={PIPE_TOP + 20 + SOURCE_R} x2={PIPE_LEFT - 10} y2={rulesBlockY}
            className="pipe-chute"/>
          <line x1={PIPE_LEFT - 10} y1={rulesBlockY} x2={PIPE_LEFT} y2={rulesBlockY + PIPE_H / 2}
            className="pipe-chute"/>

          {/* ════════ STAGE 2: RULE PIPES WITH HOLES ════════ */}
          <text x={4} y={rulesBlockY - 6} className="pipe-stage-title">Filtering Steps</text>

          {ruleStages.map((stage, ri) => {
            const tierY = rulesBlockY + ri * tierH
            const isSkip = stage.type === 'rule_skip'
            const isDisabled = stage.type === 'rule_disabled'
            const isNTFCause = stage.type === 'rule_ntf'
            const prevElim = ri > 0 ? eliminatedAtRule[ri - 1] : eliminatedAfterPool

            return (
              <g key={`tier-${ri}`}>
                {/* Rule name */}
                <text x={PIPE_LEFT - 14} y={tierY + PIPE_H / 2 + 4} textAnchor="end"
                  className={`pipe-rule-name ${isSkip ? 'skip' : ''} ${isDisabled ? 'disabled' : ''}`}>
                  {(stage.ruleName || '').length > 12 ? (stage.ruleName || '').slice(0, 12) + '..' : stage.ruleName}
                </text>

                {/* Pipe body — horizontal tube */}
                <rect x={PIPE_LEFT} y={tierY} width={pipeUsableW} height={PIPE_H} rx={PIPE_H / 2}
                  className={`pipe-body ${isSkip ? 'skip' : ''} ${isDisabled ? 'disabled' : ''} ${isNTFCause ? 'ntf' : ''}`}/>

                {/* Pipe inner highlight (3D effect) */}
                <rect x={PIPE_LEFT + 4} y={tierY + 3} width={pipeUsableW - 8} height={PIPE_H / 3} rx={5}
                  className="pipe-highlight"/>

                {/* Holes / trapdoors at each terminal position */}
                {terminals.map((term, ci) => {
                  const hx = holeXs[ci]
                  const wasElimBefore = prevElim.has(term.terminalId)
                  const isElimHere = (stage.terminalsEliminated || []).some(t => t.terminalId === term.terminalId)
                  const isKeptHere = (stage.terminalsRemaining || []).some(t => t.terminalId === term.terminalId)

                  // Is this hole open (ball can drop) or closed (blocked)?
                  // "Closed" = rule KEEPS this terminal (door covers the hole, ball rolls past)
                  // "Open" = rule ELIMINATES this terminal... wait, that's inverted.
                  //
                  // Actually: the holes represent exit points. When a rule BLOCKS a terminal,
                  // it closes the trapdoor so the ball CAN'T exit there.
                  // When a terminal is allowed through, the hole stays open (ball COULD drop).
                  // But the ball only drops at the FINAL selected terminal.
                  //
                  // Simpler: show hole as CLOSED (red plate) when rule blocks this terminal.
                  // Show hole as OPEN when terminal passes this rule.

                  const holeClosed = isElimHere && !isDisabled && !isSkip
                  const holeOpen = isKeptHere && !isDisabled && !isSkip
                  const holeFaded = wasElimBefore || isSkip || isDisabled

                  return (
                    <g key={`hole-${ri}-${ci}`}
                      style={{ cursor: stage.ruleId ? 'pointer' : 'default' }}
                      onClick={() => stage.ruleId && onToggleRule(stage.ruleId)}>

                      {holeFaded ? (
                        /* Already eliminated or skipped — faded hole */
                        <rect x={hx - HOLE_W / 2} y={tierY + PIPE_H - 6} width={HOLE_W} height={8} rx={3}
                          className="pipe-hole faded"/>
                      ) : holeClosed ? (
                        /* Closed trapdoor — red plate covering the hole */
                        <g>
                          {/* Hole outline */}
                          <rect x={hx - HOLE_W / 2 - 2} y={tierY + PIPE_H - 8} width={HOLE_W + 4} height={12} rx={4}
                            fill="#991b1b" opacity="0.15"/>
                          {/* Closed plate */}
                          <rect x={hx - HOLE_W / 2} y={tierY + PIPE_H - 6} width={HOLE_W} height={8} rx={3}
                            className="pipe-hole closed"/>
                          {/* Lock icon — small X */}
                          <line x1={hx - 3} y1={tierY + PIPE_H - 4} x2={hx + 3} y2={tierY + PIPE_H}
                            stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                          <line x1={hx + 3} y1={tierY + PIPE_H - 4} x2={hx - 3} y2={tierY + PIPE_H}
                            stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                        </g>
                      ) : (
                        /* Open hole — ball can potentially drop through */
                        <g>
                          {/* Dark opening */}
                          <rect x={hx - HOLE_W / 2} y={tierY + PIPE_H - 6} width={HOLE_W} height={8} rx={3}
                            className="pipe-hole open"/>
                          {/* Small down arrow hint */}
                          <path d={`M ${hx - 4} ${tierY + PIPE_H + 4} L ${hx} ${tierY + PIPE_H + 8} L ${hx + 4} ${tierY + PIPE_H + 4}`}
                            fill="none" stroke="#1EA672" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
                        </g>
                      )}

                      {/* Terminal label below hole */}
                      {ri === ruleStages.length - 1 && (
                        <text x={hx} y={tierY + PIPE_H + 20} textAnchor="middle" className="pipe-hole-label">
                          {term.displayId.length > 8 ? term.displayId.slice(-6) : term.displayId}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* NTF highlight on this tier */}
                {isNTFCause && (
                  <rect x={PIPE_LEFT - 2} y={tierY - 2} width={pipeUsableW + 4} height={PIPE_H + 4} rx={PIPE_H / 2 + 2}
                    fill="none" stroke="#E74C3C" strokeWidth="2" opacity="0.4"/>
                )}
              </g>
            )
          })}

          {/* Drop lines from holes down to threshold */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterRules.has(term.terminalId)
            const lastTierY = rulesBlockY + (tierCount - 1) * tierH + PIPE_H
            return (
              <line key={`drop-${ci}`} x1={hx} y1={lastTierY + 10} x2={hx} y2={thresholdY - 6}
                className={`pipe-drop-line ${isElim ? 'eliminated' : ''}`}/>
            )
          })}

          {/* ════════ STAGE 3: SR THRESHOLD ════════ */}
          <text x={4} y={thresholdY + 4} className="pipe-stage-title">SR Threshold</text>
          {(simOverrides.srThreshold > 0 || merchant.srThresholdLow > 0) && (
            <text x={W - 6} y={thresholdY + 4} textAnchor="end" className="pipe-stage-count">
              ≥ {simOverrides.srThreshold || merchant.srThresholdLow || 0}%
            </text>
          )}

          {(() => {
            const threshold = simOverrides.srThreshold || merchant.srThresholdLow || 0
            const barY = thresholdY + 12
            const barH = 40
            const maxSR = Math.max(...terminals.map(t => t.successRate), 100)
            const minSR = Math.min(...terminals.map(t => t.successRate), 0)
            const range = maxSR - minSR + 10

            return terminals.map((term, ci) => {
              const cx = holeXs[ci]
              const barW = Math.min(holeSpacing - 16, 24)
              const isElimBefore = eliminatedAfterRules.has(term.terminalId)
              const isElimHere = thresholdStage?.terminalsEliminated?.some(t => t.terminalId === term.terminalId)
              const fillH = ((term.successRate - minSR + 5) / range) * barH

              if (isElimBefore) return <rect key={`thr-${ci}`} x={cx - barW / 2} y={barY} width={barW} height={barH} rx={3} className="pipe-sr-bar faded"/>

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
            const barY = thresholdY + 12
            const barH = 40
            const maxSR = Math.max(...terminals.map(t => t.successRate), 100)
            const minSR = Math.min(...terminals.map(t => t.successRate), 0)
            const range = maxSR - minSR + 10
            const lineY = barY + barH - ((threshold - minSR + 5) / range) * barH
            return <line x1={PIPE_LEFT - 4} y1={lineY} x2={PIPE_RIGHT} y2={lineY} className="pipe-threshold-line"/>
          })()}

          {/* Drop lines threshold → sorter */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return <line key={`drop2-${ci}`} x1={hx} y1={thresholdY + 66} x2={hx} y2={sorterY - 6}
              className={`pipe-drop-line ${isElim ? 'eliminated' : ''}`}/>
          })}

          {/* ════════ STAGE 4: SORTER ════════ */}
          <text x={4} y={sorterY + 4} className="pipe-stage-title">
            Sorter {pipelineResult?.routingStrategy === 'cost_based' ? '(Cost)' : '(SR)'}
          </text>

          {terminals.map((term, ci) => {
            const cx = holeXs[ci]
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            const scored = sorterStage?.scored?.find(s => s.terminalId === term.terminalId)
            const maxScore = Math.max(...(sorterStage?.scored || []).map(s => s.finalScore), 1)
            const score = scored?.finalScore || 0
            const funnelW = isElim ? 8 : 10 + (score / maxScore) * (holeSpacing * 0.7 - 10)
            const funnelY = sorterY + 12
            const funnelH = 50

            return (
              <g key={`sort-${ci}`}>
                <path d={`M ${cx - funnelW / 2} ${funnelY} L ${cx + funnelW / 2} ${funnelY} L ${cx + funnelW / 4} ${funnelY + funnelH} L ${cx - funnelW / 4} ${funnelY + funnelH} Z`}
                  className={`pipe-funnel ${isElim ? 'eliminated' : ''} ${scored?.isSelected ? 'selected' : ''}`}/>
                {!isElim && scored && (
                  <text x={cx} y={funnelY + funnelH + 12} textAnchor="middle" className="pipe-funnel-score">{Math.round(score)}</text>
                )}
              </g>
            )
          })}

          {/* Drop lines sorter → bins */}
          {terminals.map((term, ci) => {
            const hx = holeXs[ci]
            const isElim = eliminatedAfterThreshold.has(term.terminalId)
            return <line key={`drop3-${ci}`} x1={hx} y1={sorterY + 76} x2={hx} y2={binY - 6}
              className={`pipe-drop-line ${isElim ? 'eliminated' : ''}`}/>
          })}

          {/* ════════ STAGE 5: BINS ════════ */}
          <text x={4} y={binY + 4} className="pipe-stage-title">
            {isNTF ? 'Payment Failed' : 'Terminal Selected'}
          </text>

          {terminals.map((term, ci) => {
            const cx = holeXs[ci]
            const bw = Math.min(holeSpacing - 10, 80)
            const isSelected = term.terminalId === selectedTerminalId
            const isElim = eliminatedAfterThreshold.has(term.terminalId)

            return (
              <g key={`bin-${ci}`}>
                <rect x={cx - bw / 2} y={binY + 10} width={bw} height={BIN_H - 10} rx={6}
                  className={`pipe-bin ${isSelected ? 'selected' : ''} ${isElim ? 'eliminated' : ''}`}
                  filter={isSelected ? 'url(#glow-selected)' : undefined}/>
                <text x={cx} y={binY + 32} textAnchor="middle"
                  className={`pipe-bin-label ${isSelected ? 'selected' : ''} ${isElim ? 'eliminated' : ''}`}>
                  {term.displayId}
                </text>
                <text x={cx} y={binY + 45} textAnchor="middle"
                  className={`pipe-bin-sub ${isSelected ? 'selected' : ''} ${isElim ? 'eliminated' : ''}`}>
                  {term.gatewayShort}
                </text>
                {isSelected && (
                  <text x={cx} y={binY + 58} textAnchor="middle" className="pipe-bin-score">
                    SR {term.successRate}% · ₹{term.costPerTxn}
                  </text>
                )}
              </g>
            )
          })}

          {isNTF && (
            <g>
              <rect x={W / 2 - 80} y={binY + 15} width={160} height={BIN_H - 20} rx={8}
                fill="#FDECEB" stroke="#E74C3C" strokeWidth="1.5"/>
              <text x={W / 2} y={binY + 38} textAnchor="middle" className="pipe-ntf-label">No Terminal Found</text>
              <text x={W / 2} y={binY + 54} textAnchor="middle" className="pipe-ntf-sub">Payment Failed</text>
            </g>
          )}

          {/* ════════ Trail ════════ */}
          {trailPath && (
            <path d={trailPath} fill="none" stroke={ballColor} strokeWidth="2.5" opacity="0.2"
              strokeLinecap="round" strokeLinejoin="round"/>
          )}

          {/* ════════ Ball ════════ */}
          {ballPos && ballProgress >= 0 && ballProgress <= 1 && (
            <circle cx={ballPos.x} cy={ballPos.y} r={8}
              fill={isNTF && ballProgress > 0.7 ? '#E74C3C' : ballColor}
              filter="url(#ball-glow)"
              opacity={ballProgress > 0.95 ? 0.4 : 1}/>
          )}
        </svg>
      )}
    </div>
  )
}
