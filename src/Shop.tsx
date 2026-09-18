import { useState } from 'react'
import type { Dispatch } from 'react'
import {
  ADVANCED_MODEL_PRICE,
  AGENT_MODELS,
  MAX_TOKENS,
  MERCURY_PRICE,
  SPARK_PRICE,
  SPARK_ULTRA_PRICE,
  TOKEN_PACK_COUNTS,
  tokenPurchaseAmount,
  tokenPurchaseCost,
  tokenPriceMultiplier,
  type GameAction,
  type GameState,
  type ShopItemId,
  type TerminalId,
  type TerminalUpgrade,
  type TokenPackCount,
  isLocalTerminal,
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
  if (terminalId === 'spark-ultra') return 'Mapple Spark Ultra'
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
  const localTarget = isLocalTerminal(target)
  const price = localTarget && upgrade === 'split' ? null : upgradePrice(state, upgrade, target)
  const canInstall = state.stage === 'hired' && price !== null && state.money >= price
  const dragSource = useDragDropSource({ kind: 'upgrade', id: upgrade }, canInstall)
  const installUpgrade = () => {
    if (!canInstall || price === null) return
    dispatch({ type: 'buy-upgrade', upgrade, terminalId: target, source: 'click' })
  }
  let buttonLabel = moneyLabel(price ?? 0)
  if (state.stage !== 'hired') buttonLabel = 'Unavailable'
  else if (price === null) {
    if (localTarget && upgrade === 'split') buttonLabel = 'Fixed panes'
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
      onPointerDown={dragSource.onPointerDown}
      onPointerCancel={dragSource.onPointerCancel}
      onLostPointerCapture={dragSource.onLostPointerCapture}
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
  const canBuy = state.stage === 'hired' && state.market !== null && available && !purchased && state.money >= SPARK_PRICE
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

function SparkUltraProduct({ state, dispatch }: ShopProps) {
  const announcedAt = state.sparkUltraAnnouncedAt
  const purchased = state.sparkUltraPurchasedAt !== null
  const delivered = state.terminals.some((terminal) => terminal.id === 'spark-ultra')
  const availableAt = announcedAt === null ? null : announcedAt + 10
  const available = availableAt !== null && state.elapsed >= availableAt
  const canBuy = state.stage === 'hired' && state.market !== null && available && !purchased && state.money >= SPARK_ULTRA_PRICE
  const buySparkUltra = () => {
    if (canBuy) dispatch({ type: 'buy-spark-ultra' })
  }

  let detail = 'Not announced yet.'
  let buttonLabel = 'Unavailable'
  if (announcedAt !== null && !available) {
    detail = `Sale opens in ${durationLabel((availableAt ?? state.elapsed) - state.elapsed)} · ${moneyLabel(SPARK_ULTRA_PRICE)}.`
    buttonLabel = `Opens ${durationLabel((availableAt ?? state.elapsed) - state.elapsed)}`
  } else if (delivered) {
    detail = `Delivered · 2 fixed ${AGENT_MODELS.advanced.label} panes · no cloud task tokens.`
    buttonLabel = 'Owned'
  } else if (purchased) {
    const deliveryAt = state.sparkUltraDeliveryAt
    detail = deliveryAt === null
      ? 'Paid · delivery pending.'
      : `Paid ${moneyLabel(SPARK_ULTRA_PRICE)} · delivery in ${durationLabel(deliveryAt - state.elapsed)}.`
    buttonLabel = deliveryAt === null ? 'Delivering' : `ETA ${durationLabel(deliveryAt - state.elapsed)}`
  } else if (state.stage !== 'hired') {
    detail = `${moneyLabel(SPARK_ULTRA_PRICE)} · 2 fixed ${AGENT_MODELS.advanced.label} panes · no cloud task tokens.`
  } else {
    detail = `${moneyLabel(SPARK_ULTRA_PRICE)} · 2 fixed ${AGENT_MODELS.advanced.label} panes · no cloud task tokens.`
    buttonLabel = state.money >= SPARK_ULTRA_PRICE ? `Buy · ${moneyLabel(SPARK_ULTRA_PRICE)}` : `Need ${moneyLabel(SPARK_ULTRA_PRICE)}`
  }

  return (
    <article className={`shop-product shop-spark-ultra-product ${canBuy ? '' : 'shop-product-unavailable'}`} aria-label="Mapple Spark Ultra">
      <span className="shop-product-icon" aria-hidden="true">▣</span>
      <div className="shop-product-copy">
        <h3>Mapple Spark Ultra</h3>
        <p>{detail}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={buySparkUltra} disabled={!canBuy}>
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
  const canBuy = state.stage === 'hired' && state.advancedModelUnlocked && !state.mercuryOwned && state.money >= MERCURY_PRICE
  const buyMercury = () => {
    if (canBuy) dispatch({ type: 'buy-mercury' })
  }
  const setMercury = (enabled: boolean) => {
    if (state.stage === 'hired' && state.mercuryOwned) dispatch({ type: 'set-mercury', enabled })
  }

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
  const hasDiscovery = (id: ShopItemId): boolean => state.shopDiscoveries.includes(id)
  const hasVisibleProduct = (['split', 'yolo', 'terminal', 'tokens', 'fast-mode', 'spark', 'spark-ultra', 'advanced-model', 'mercury'] as const)
    .some((id) => hasDiscovery(id))

  const selectedTargetTerminal = state.terminals.some((terminal) => terminal.id === targetTerminal)
    ? targetTerminal
    : state.terminals[0]?.id ?? 'terminal'
  const selectedTerminal = state.terminals.find((terminal) => terminal.id === selectedTargetTerminal)
  const fastModeAvailable =
    state.stage === 'hired' &&
    state.fastModeUnlocked &&
    selectedTerminal !== undefined &&
    !isLocalTerminal(selectedTerminal.id)
  const refillAmount = tokenPurchaseAmount(state.tokens, state.tokenPacks)
  const refillCost = tokenPurchaseCost(refillAmount, state)
  const refillPrice = moneyLabel(refillCost)
  const canBuyTokens = state.stage === 'hired' && state.money >= refillCost && refillAmount > 0
  const tokenMultiplier = tokenPriceMultiplier(state)
  const monopolyActive = state.monopolyAnnouncedAt !== null
  const secondsSinceMonopoly = state.monopolyAnnouncedAt === null ? 0 : Math.max(0, state.elapsed - state.monopolyAnnouncedAt)
  const secondsToNextTokenIncrease = monopolyActive
    ? Math.max(1, Math.ceil(5 - (secondsSinceMonopoly % 5)))
    : null

  const buyTokens = () => {
    if (canBuyTokens) dispatch({ type: 'buy-tokens', packs: state.tokenPacks })
  }

  const setFastMode = (enabled: boolean) => {
    if (!fastModeAvailable) return
    dispatch({ type: 'set-fast-mode', terminalId: selectedTargetTerminal, enabled })
  }

  const fastModeLabel = state.stage !== 'hired'
    ? 'Unavailable'
    : selectedTerminal !== undefined && isLocalTerminal(selectedTerminal.id)
      ? 'Local fixed'
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
        {!hasVisibleProduct && (
          <p className="shop-empty-guidance">
            Keep working and earning—new products appear here when they become available.
          </p>
        )}
        {upgradeProducts.filter((product) => hasDiscovery(product.upgrade)).map((product) => (
          <UpgradeProductCard
            key={product.upgrade}
            product={product}
            state={state}
            dispatch={dispatch}
            targetTerminal={selectedTargetTerminal}
          />
        ))}
        {hasDiscovery('fast-mode') && (
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
        {hasDiscovery('spark') && <SparkProduct state={state} dispatch={dispatch} />}
        {hasDiscovery('spark-ultra') && <SparkUltraProduct state={state} dispatch={dispatch} />}
        {hasDiscovery('advanced-model') && <AdvancedModelProduct state={state} dispatch={dispatch} />}
        {hasDiscovery('mercury') && <MercuryProduct state={state} dispatch={dispatch} />}
        {hasDiscovery('tokens') && (
          <article
            className={`shop-product ${canBuyTokens ? '' : 'shop-product-unavailable'}`}
            aria-label="Token refill"
          >
            <span className="shop-product-icon" aria-hidden="true">◇</span>
            <div className="shop-product-copy">
              <h3>Token refill</h3>
              <div className="shop-token-options">
                <label className="shop-pack-size">
                  Pack size
                  <select
                    value={state.tokenPacks}
                    disabled={state.stage !== 'hired'}
                    onChange={(event) => dispatch({ type: 'set-token-packs', packs: Number(event.currentTarget.value) as TokenPackCount })}
                  >
                    {TOKEN_PACK_COUNTS.map((packs) => {
                      const amount = tokenPurchaseAmount(state.tokens, packs)
                      const cost = tokenPurchaseCost(amount, state)
                      const quantity = amount >= MAX_TOKENS - state.tokens ? 'Fill balance · 10M max' : `${amount.toLocaleString()} tokens`
                      return <option key={packs} value={packs}>{quantity} · {moneyLabel(cost)}</option>
                    })}
                  </select>
                </label>
                <label className="shop-fast-mode-toggle shop-auto-buy-toggle">
                  <span className="shop-auto-buy-name">Auto-buy</span>
                  <span className="shop-fast-mode-toggle-label">{state.tokenAutoBuy ? 'On' : 'Off'}</span>
                  <input
                    type="checkbox"
                    checked={state.tokenAutoBuy}
                    disabled={state.stage !== 'hired'}
                    onChange={(event) => dispatch({ type: 'set-token-auto-buy', enabled: event.currentTarget.checked })}
                    aria-label="Automatically buy tokens when balance is low"
                  />
                  <span className="shop-toggle-track" aria-hidden="true"><span /></span>
                </label>
              </div>
              <p>{refillAmount > 0 ? `${refillAmount.toLocaleString()} tokens received · partial packs prorated` : 'Inventory is at the 10M token limit.'}</p>
              {monopolyActive && (
                <p className="shop-token-rate">
                  Monopoly rate {tokenMultiplier.toFixed(2)}× · +10% every 5s · next increase in {secondsToNextTokenIncrease}s.
                </p>
              )}
            </div>
            <button className="shop-buy-button" type="button" onClick={buyTokens} disabled={!canBuyTokens}>
              {state.stage !== 'hired' ? 'Unavailable' : state.tokens >= MAX_TOKENS ? 'Balance full' : canBuyTokens ? refillPrice : `Need ${refillPrice}`}
            </button>
          </article>
        )}
      </div>
    </div>
  )
}
