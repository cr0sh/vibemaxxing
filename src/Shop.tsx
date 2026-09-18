import { useState } from 'react'
import type { Dispatch } from 'react'
import {
  ADVANCED_MODEL_PRICE,
  AGENT_MODELS,
  MAX_TOKENS,
  MERCURY_PRICE,
  SPARK_PRICE,
  TOKEN_PACK_COUNTS,
  TOKEN_PURCHASE_AMOUNT,
  TOKEN_PURCHASE_COST,
  tokenPurchaseAmount,
  tokenPurchaseCost,
  type GameAction,
  type GameState,
  type TerminalId,
  type TerminalUpgrade,
  type TokenPackCount,
  upgradePrice,
} from './game'
import { useDragDropSource } from './DragDropHintsContext'
import './Shop.css'

type ShopProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}

type UpgradeProduct = {
  upgrade: TerminalUpgrade
  icon: string
  title: string
  detail: string
}

const upgradeProducts: readonly UpgradeProduct[] = [
  { upgrade: 'split', icon: '◫', title: 'Split window', detail: 'Run another agent in parallel.' },
  { upgrade: 'yolo', icon: '⚡', title: 'YOLO mode', detail: 'Skip command approval pauses.' },
  { upgrade: 'terminal', icon: '🖥️', title: 'Additional terminal', detail: 'Open a second terminal window.' },
]

const terminalLabel = (terminalId: TerminalId): string => {
  if (terminalId === 'terminal-2') return 'Terminal 2'
  if (terminalId === 'spark') return 'Mapple Spark'
  return 'Terminal'
}

const moneyLabel = (amount: number): string => `$${amount.toLocaleString()}`

const durationLabel = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function UpgradeProductCard({
  product,
  state,
  dispatch,
  targetTerminal,
}: {
  product: UpgradeProduct
  state: GameState
  dispatch: Dispatch<GameAction>
  targetTerminal: TerminalId
}) {
  const { upgrade, icon, title, detail } = product
  const target = upgrade === 'terminal' ? 'terminal' : targetTerminal
  const price = upgradePrice(state, upgrade, target)
  const canInstall = price !== null && state.money >= price
  const dragSource = useDragDropSource({ kind: 'upgrade', id: upgrade }, canInstall)
  const installUpgrade = () => {
    if (price === null || state.money < price) return
    dispatch({ type: 'buy-upgrade', upgrade, terminalId: target })
  }
  let buttonLabel = moneyLabel(price ?? 0)
  if (state.stage !== 'hired') buttonLabel = 'Unavailable'
  else if (price === null) {
    if (target === 'spark' && upgrade === 'split') buttonLabel = 'Spark panes fixed'
    else if (upgrade === 'split') buttonLabel = 'Maximum panes'
    else if (upgrade === 'yolo') buttonLabel = 'Installed'
    else buttonLabel = 'Two terminals max'
  } else if (state.money < price) {
    buttonLabel = `Need ${moneyLabel(price)}`
  }

  return (
    <article
      className={`shop-product shop-upgrade-product ${canInstall ? '' : 'shop-product-unavailable'}`}
      draggable={canInstall}
      tabIndex={canInstall ? 0 : undefined}
      onFocus={dragSource.onFocus}
      onBlur={dragSource.onBlur}
      onMouseEnter={dragSource.onMouseEnter}
      onMouseLeave={dragSource.onMouseLeave}
      onKeyDown={dragSource.onKeyDown}
      onDragStart={(event) => {
        if (!canInstall) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-vibemaxxer-upgrade', upgrade)
        event.dataTransfer.setData('text/plain', upgrade)
        dragSource.onDragStart(event)
      }}
      onDragEnd={dragSource.onDragEnd}
      aria-label={`${title} upgrade`}
    >
      <span className="shop-product-icon" aria-hidden="true">{icon}</span>
      <div className="shop-product-copy">
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={installUpgrade} disabled={!canInstall}>
        {buttonLabel}
      </button>
    </article>
  )
}

function SparkProduct({ state, dispatch }: ShopProps) {
  const announcedAt = state.sparkAnnouncedAt
  const purchased = state.sparkPurchasedAt !== null
  const delivered = state.terminals.some((terminal) => terminal.id === 'spark')
  const availableAt = announcedAt === null ? null : announcedAt + 10
  const available = availableAt !== null && state.elapsed >= availableAt
  const canBuy = state.stage === 'hired' && available && !purchased && state.money >= SPARK_PRICE
  const buySpark = () => {
    if (canBuy) dispatch({ type: 'buy-spark' })
  }

  let detail = 'Not announced yet.'
  let buttonLabel = 'Unavailable'
  if (announcedAt !== null && !available) {
    detail = `Shop opens in ${durationLabel((availableAt ?? state.elapsed) - state.elapsed)} · ${moneyLabel(SPARK_PRICE)}.`
    buttonLabel = `Opens ${durationLabel((availableAt ?? state.elapsed) - state.elapsed)}`
  } else if (delivered) {
    detail = `Delivered · 2 fixed ${AGENT_MODELS.reasoning.label} panes · no cloud task tokens.`
    buttonLabel = 'Owned'
  } else if (purchased) {
    const deliveryAt = state.sparkDeliveryAt
    detail = deliveryAt === null
      ? 'Paid · delivery pending.'
      : `Paid ${moneyLabel(SPARK_PRICE)} · delivery in ${durationLabel(deliveryAt - state.elapsed)}.`
    buttonLabel = deliveryAt === null ? 'Delivering' : `ETA ${durationLabel(deliveryAt - state.elapsed)}`
  } else if (state.stage !== 'hired') {
    detail = `${moneyLabel(SPARK_PRICE)} · 2 ${AGENT_MODELS.reasoning.label} panes · no cloud task tokens.`
  } else {
    detail = `${moneyLabel(SPARK_PRICE)} · 2 ${AGENT_MODELS.reasoning.label} panes · no cloud task tokens.`
    buttonLabel = state.money >= SPARK_PRICE ? `Buy · ${moneyLabel(SPARK_PRICE)}` : `Need ${moneyLabel(SPARK_PRICE)}`
  }

  return (
    <article className={`shop-product shop-spark-product ${canBuy ? '' : 'shop-product-unavailable'}`} aria-label="Mapple Spark">
      <span className="shop-product-icon" aria-hidden="true">▣</span>
      <div className="shop-product-copy">
        <h3>Mapple Spark</h3>
        <p>{detail}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={buySpark} disabled={!canBuy}>
        {buttonLabel}
      </button>
    </article>
  )
}

function AdvancedModelProduct({ state, dispatch }: ShopProps) {
  const canBuy = state.stage === 'hired' &&
    state.advancedModelAnnouncedAt !== null &&
    !state.advancedModelUnlocked &&
    state.money >= ADVANCED_MODEL_PRICE
  const buyModel = () => {
    if (canBuy) dispatch({ type: 'buy-model', model: 'advanced' })
  }

  let detail = `${moneyLabel(ADVANCED_MODEL_PRICE)} · handles harder tasks at ${AGENT_MODELS.reasoning.label} speed.`
  let buttonLabel = 'Unavailable'
  if (state.advancedModelUnlocked) {
    detail = `Handles harder tasks at ${AGENT_MODELS.reasoning.label} speed.`
    buttonLabel = 'Owned'
  } else if (state.stage === 'hired' && state.advancedModelAnnouncedAt !== null) {
    buttonLabel = state.money >= ADVANCED_MODEL_PRICE
      ? `Buy · ${moneyLabel(ADVANCED_MODEL_PRICE)}`
      : `Need ${moneyLabel(ADVANCED_MODEL_PRICE)}`
  }

  return (
    <article className={`shop-product shop-model-product ${canBuy ? '' : 'shop-product-unavailable'}`} aria-label="ConvexLM Pro model">
      <span className="shop-product-icon" aria-hidden="true">✦</span>
      <div className="shop-product-copy">
        <h3>ConvexLM Pro</h3>
        <p>{detail}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={buyModel} disabled={!canBuy}>
        {buttonLabel}
      </button>
    </article>
  )
}

function MercuryProduct({ state, dispatch }: ShopProps) {
  const visible = state.advancedModelUnlocked
  const canBuy = state.stage === 'hired' && visible && !state.mercuryOwned && state.money >= MERCURY_PRICE
  const buyMercury = () => {
    if (canBuy) dispatch({ type: 'buy-mercury' })
  }
  const setMercury = (enabled: boolean) => {
    if (state.stage === 'hired' && state.mercuryOwned) dispatch({ type: 'set-mercury', enabled })
  }

  if (!visible) return null

  return (
    <article className={`shop-product shop-mercury-product ${canBuy || state.mercuryOwned ? '' : 'shop-product-unavailable'}`} aria-label="Mercury automatic handoffs">
      <span className="shop-product-icon" aria-hidden="true">↔</span>
      <div className="shop-product-copy">
        <h3>Mercury</h3>
        <p>Your most intelligent AI agent.</p>
        <p>
          {state.mercuryOwned
            ? 'Owned · 300K per handoff. Auto-retry after 10s; approvals stay manual.'
            : `${moneyLabel(MERCURY_PRICE)} · 300K each way, including a reserved return fee.`}
        </p>
      </div>
      {state.mercuryOwned ? (
        <label className="shop-fast-mode-toggle shop-mercury-toggle">
          <span className="shop-fast-mode-toggle-label">{state.mercuryEnabled ? 'On' : 'Off'}</span>
          <input
            type="checkbox"
            checked={state.mercuryEnabled}
            disabled={state.stage !== 'hired'}
            onChange={(event) => setMercury(event.currentTarget.checked)}
            aria-label="Enable Mercury automatic handoffs"
          />
          <span className="shop-toggle-track" aria-hidden="true"><span /></span>
        </label>
      ) : (
        <button className="shop-buy-button" type="button" onClick={buyMercury} disabled={!canBuy}>
          {state.stage !== 'hired' ? 'Unavailable' : state.money >= MERCURY_PRICE ? `Buy · ${moneyLabel(MERCURY_PRICE)}` : `Need ${moneyLabel(MERCURY_PRICE)}`}
        </button>
      )}
    </article>
  )
}


export function ShopContent({ state, dispatch }: ShopProps) {
  const [targetTerminal, setTargetTerminal] = useState<TerminalId>('terminal')
  const [tokenPacks, setTokenPacks] = useState<TokenPackCount>(10)

  const selectedTargetTerminal = state.terminals.some((terminal) => terminal.id === targetTerminal)
    ? targetTerminal
    : state.terminals[0]?.id ?? 'terminal'
  const selectedTerminal = state.terminals.find((terminal) => terminal.id === selectedTargetTerminal)
  const fastModeAvailable =
    state.stage === 'hired' &&
    state.fastModeUnlocked &&
    selectedTerminal !== undefined &&
    selectedTerminal.id !== 'spark'
  const refillAmount = tokenPurchaseAmount(state.tokens, tokenPacks)
  const refillCost = tokenPurchaseCost(refillAmount)
  const refillPrice = moneyLabel(refillCost)
  const canBuyTokens = state.stage === 'hired' && state.money >= refillCost && refillAmount > 0

  const buyTokens = () => {
    if (canBuyTokens) dispatch({ type: 'buy-tokens', packs: tokenPacks })
  }

  const setFastMode = (enabled: boolean) => {
    if (!fastModeAvailable) return
    dispatch({ type: 'set-fast-mode', terminalId: selectedTargetTerminal, enabled })
  }

  const fastModeLabel = state.stage !== 'hired'
    ? 'Unavailable'
    : selectedTerminal?.id === 'spark'
      ? 'Spark fixed'
      : selectedTerminal?.fastMode ? 'On' : 'Off'

  return (
    <div className="shop-app">
      <div className="shop-target-row">
        <label htmlFor="shop-target-terminal">Install on</label>
        <select
          id="shop-target-terminal"
          value={selectedTargetTerminal}
          disabled={state.stage !== 'hired'}
          onChange={(event) => setTargetTerminal(event.currentTarget.value as TerminalId)}
        >
          {state.terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminalLabel(terminal.id)}</option>)}
        </select>
      </div>


      <div className="shop-products">
        {upgradeProducts.map((product) => (
          <UpgradeProductCard
            key={product.upgrade}
            product={product}
            state={state}
            dispatch={dispatch}
            targetTerminal={selectedTargetTerminal}
          />
        ))}
        {state.fastModeUnlocked && (
          <article
            className={`shop-product shop-fast-mode-product ${fastModeAvailable ? '' : 'shop-product-unavailable'}`}
            aria-label="Fast mode"
          >
            <span className="shop-product-icon shop-fast-mode-icon" aria-hidden="true">»</span>
            <div className="shop-product-copy">
              <h3>Fast mode</h3>
              <p>2× speed · 2× tokens. Applies to new attempts while enabled.</p>
            </div>
            <label className="shop-fast-mode-toggle">
              <span className="shop-fast-mode-toggle-label">{fastModeLabel}</span>
              <input
                type="checkbox"
                checked={selectedTerminal?.fastMode ?? false}
                disabled={!fastModeAvailable}
                onChange={(event) => setFastMode(event.currentTarget.checked)}
                aria-label={`Use fast mode for ${terminalLabel(selectedTargetTerminal)} on new attempts`}
              />
              <span className="shop-toggle-track" aria-hidden="true"><span /></span>
            </label>
          </article>
        )}
        {state.sparkAnnouncedAt !== null && <SparkProduct state={state} dispatch={dispatch} />}
        {state.advancedModelAnnouncedAt !== null && <AdvancedModelProduct state={state} dispatch={dispatch} />}
        <MercuryProduct state={state} dispatch={dispatch} />
        <article
          className={`shop-product ${canBuyTokens ? '' : 'shop-product-unavailable'}`}
          aria-label="Token refill"
        >
          <span className="shop-product-icon" aria-hidden="true">◇</span>
          <div className="shop-product-copy">
            <h3>Token refill</h3>
            <label className="shop-pack-size">
              Pack size
              <select value={tokenPacks} disabled={state.stage !== 'hired'} onChange={(event) => setTokenPacks(Number(event.currentTarget.value) as TokenPackCount)}>
                {TOKEN_PACK_COUNTS.map((packs) => <option key={packs} value={packs}>{packs === 100 ? 'Fill balance · 10M max' : `${(TOKEN_PURCHASE_AMOUNT * packs).toLocaleString()} tokens · $${TOKEN_PURCHASE_COST * packs}`}</option>)}
              </select>
            </label>
            <p>{refillAmount > 0 ? `${refillAmount.toLocaleString()} tokens received · partial packs prorated` : 'Inventory is at the 10M token limit.'}</p>
          </div>
          <button className="shop-buy-button" type="button" onClick={buyTokens} disabled={!canBuyTokens}>
            {state.stage !== 'hired' ? 'Unavailable' : state.tokens >= MAX_TOKENS ? 'Balance full' : canBuyTokens ? refillPrice : `Need ${refillPrice}`}
          </button>
        </article>
      </div>
    </div>
  )
}
