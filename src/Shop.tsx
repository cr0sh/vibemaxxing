import { useEffect, useRef, useState } from 'react'
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
import { useI18n, type Translate } from './i18n'
import './Shop.css'

type ShopProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}
type ShopContentProps = ShopProps & {
  active: boolean
}
type ShopHighlightProps = {
  highlighted: boolean
}

const SHOP_HIGHLIGHT_DURATION_MS = 5_000

const purchaseChanged = (previous: GameState, current: GameState, item: ShopItemId): boolean => {
  switch (item) {
    case 'split':
      return current.terminals.some((terminal) => {
        const prior = previous.terminals.find((candidate) => candidate.id === terminal.id)
        return prior !== undefined && terminal.slots > prior.slots
      })
    case 'yolo':
      return current.terminals.some((terminal) => {
        const prior = previous.terminals.find((candidate) => candidate.id === terminal.id)
        return prior !== undefined && !prior.yolo && terminal.yolo
      })
    case 'terminal':
      return !previous.terminals.some((terminal) => terminal.id === 'terminal-2') &&
        current.terminals.some((terminal) => terminal.id === 'terminal-2')
    case 'fast-mode':
      return current.terminals.some((terminal) => {
        const prior = previous.terminals.find((candidate) => candidate.id === terminal.id)
        return prior !== undefined && !prior.fastMode && terminal.fastMode
      })
    case 'spark':
      return previous.sparkPurchasedAt === null && current.sparkPurchasedAt !== null
    case 'spark-ultra':
      return previous.sparkUltraPurchasedAt === null && current.sparkUltraPurchasedAt !== null
    case 'advanced-model':
      return !previous.advancedModelUnlocked && current.advancedModelUnlocked
    case 'mercury':
      return !previous.mercuryOwned && current.mercuryOwned
  }
}

const productClassName = (className: string, highlighted: boolean): string =>
  highlighted ? `${className} shop-product-newly-discovered` : className

function useShopHighlights(state: GameState, active: boolean): ReadonlySet<ShopItemId> {
  const [highlighted, setHighlighted] = useState<ReadonlySet<ShopItemId>>(() => new Set())
  const highlightedRef = useRef<ReadonlySet<ShopItemId>>(new Set())
  const knownDiscoveries = useRef<Set<ShopItemId>>(new Set(state.shopDiscoveries))
  const pendingDiscoveries = useRef<Set<ShopItemId>>(new Set())
  const previousState = useRef<GameState | null>(null)
  const timers = useRef(new Map<ShopItemId, number>())

  useEffect(() => {
    const prior = previousState.current
    const currentDiscoveries = new Set(state.shopDiscoveries)
    const removed = [...knownDiscoveries.current].filter((id) => !currentDiscoveries.has(id))
    const newlyDiscovered = state.shopDiscoveries.filter((id) => !knownDiscoveries.current.has(id))
    for (const id of removed) knownDiscoveries.current.delete(id)
    for (const id of state.shopDiscoveries) knownDiscoveries.current.add(id)

    const candidateIds = new Set<ShopItemId>([
      ...state.shopDiscoveries,
      ...pendingDiscoveries.current,
      ...highlightedRef.current,
    ])
    const purchased = prior === null
      ? []
      : [...candidateIds].filter((id) => purchaseChanged(prior, state, id))
    const cancelled = new Set<ShopItemId>([...removed, ...purchased])
    for (const id of cancelled) {
      pendingDiscoveries.current.delete(id)
      const timer = timers.current.get(id)
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timers.current.delete(id)
      }
    }
    for (const id of newlyDiscovered) {
      if (!purchased.includes(id)) pendingDiscoveries.current.add(id)
    }

    const startedNow: ShopItemId[] = []
    if (active) {
      for (const id of pendingDiscoveries.current) {
        if (timers.current.has(id)) continue
        const timer = window.setTimeout(() => {
          timers.current.delete(id)
          pendingDiscoveries.current.delete(id)
          setHighlighted((current) => {
            if (!current.has(id)) return current
            const next = new Set(current)
            next.delete(id)
            highlightedRef.current = next
            return next
          })
        }, SHOP_HIGHLIGHT_DURATION_MS)
        timers.current.set(id, timer)
        startedNow.push(id)
      }
    }

    if (cancelled.size > 0 || startedNow.length > 0) {
      setHighlighted((current) => {
        const next = new Set(current)
        for (const id of cancelled) next.delete(id)
        for (const id of startedNow) next.add(id)
        highlightedRef.current = next
        return next
      })
    }

    previousState.current = state
  }, [active, state])

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
  }, [])

  return highlighted
}

type UpgradeProduct = {
  upgrade: TerminalUpgrade
  icon: string
  titleKey: 'shop.split.title' | 'shop.yolo.title' | 'shop.terminal.title'
  detailKey: 'shop.split.detail' | 'shop.yolo.detail' | 'shop.terminal.detail'
}

const upgradeProducts: readonly UpgradeProduct[] = [
  { upgrade: 'split', icon: '◫', titleKey: 'shop.split.title', detailKey: 'shop.split.detail' },
  { upgrade: 'yolo', icon: '⚡', titleKey: 'shop.yolo.title', detailKey: 'shop.yolo.detail' },
  { upgrade: 'terminal', icon: '🖥️', titleKey: 'shop.terminal.title', detailKey: 'shop.terminal.detail' },
]

const sparkProduct = { titleKey: 'shop.spark.title' } as const
const sparkUltraProduct = { titleKey: 'shop.sparkUltra.title' } as const
const advancedModelProduct = { titleKey: 'shop.advancedModel.title' } as const
const mercuryProduct = { titleKey: 'shop.mercury.title' } as const

const terminalLabel = (terminalId: TerminalId, t: Translate): string => {
  if (terminalId === 'terminal-2') return t('employment.terminal.nameTwo')
  if (terminalId === 'spark-ultra') return t('employment.terminal.nameSparkUltra')
  if (terminalId === 'spark') return t('employment.terminal.nameSpark')
  return t('employment.terminal.name')
}

const moneyLabel = (amount: number, locale: string): string => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
}).format(Math.max(0, amount))

const durationLabel = (seconds: number, t: Translate): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return minutes > 0
    ? t('common.durationMinutes', { minutes, seconds: String(remainder).padStart(2, '0') })
    : t('common.durationSeconds', { seconds: remainder })
}


function UpgradeProductCard({
  product,
  state,
  dispatch,
  targetTerminal,
  highlighted,
}: ShopProps & { product: UpgradeProduct; targetTerminal: TerminalId } & ShopHighlightProps) {
  const { t, locale } = useI18n()
  const { upgrade, icon, titleKey, detailKey } = product
  const target = upgrade === 'terminal' ? 'terminal' : targetTerminal
  const localTarget = isLocalTerminal(target)
  const price = localTarget && upgrade === 'split' ? null : upgradePrice(state, upgrade, target)
  const canInstall = state.stage === 'hired' && price !== null && state.money >= price
  const dragSource = useDragDropSource({ kind: 'upgrade', id: upgrade }, canInstall)
  const installUpgrade = () => {
    if (!canInstall || price === null) return
    dispatch({ type: 'buy-upgrade', upgrade, terminalId: target, source: 'click' })
  }
  let buttonLabel = moneyLabel(price ?? 0, locale)
  if (state.stage !== 'hired') buttonLabel = t('common.unavailable')
  else if (price === null) {
    if (localTarget && upgrade === 'split') buttonLabel = t('shop.fixedPanes')
    else if (upgrade === 'split') buttonLabel = t('shop.maximumPanes')
    else if (upgrade === 'yolo') buttonLabel = t('common.installed')
    else buttonLabel = t('shop.twoTerminalsMax')
  } else if (state.money < price) {
    buttonLabel = t('shop.need', { price: moneyLabel(price, locale) })
  }

  return (
    <article
      className={productClassName(`shop-product shop-upgrade-product ${canInstall ? '' : 'shop-product-unavailable'}`, highlighted)}
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
      aria-label={t('shop.upgrade.aria', { title: t(titleKey) })}
    >
      <span className="shop-product-icon" aria-hidden="true">{icon}</span>
      <div className="shop-product-copy">
        <h3>{t(titleKey)}</h3>
        <p>{t(detailKey)}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={installUpgrade} disabled={!canInstall}>
        {buttonLabel}
      </button>
    </article>
  )
}

function SparkProduct({ state, dispatch, highlighted }: ShopProps & ShopHighlightProps) {
  const { t, locale } = useI18n()
  const announcedAt = state.sparkAnnouncedAt
  const purchased = state.sparkPurchasedAt !== null
  const delivered = state.terminals.some((terminal) => terminal.id === 'spark')
  const availableAt = announcedAt === null ? null : announcedAt + 10
  const available = availableAt !== null && state.elapsed >= availableAt
  const canBuy = state.stage === 'hired' && state.market !== null && available && !purchased && state.money >= SPARK_PRICE
  const buySpark = () => {
    if (canBuy) dispatch({ type: 'buy-spark' })
  }

  let detail = t('shop.notAnnounced')
  let buttonLabel = t('common.unavailable')
  if (announcedAt !== null && !available) {
    detail = t('shop.shopOpens', { time: durationLabel((availableAt ?? state.elapsed) - state.elapsed, t), price: moneyLabel(SPARK_PRICE, locale) })
    buttonLabel = t('shop.opens', { time: durationLabel((availableAt ?? state.elapsed) - state.elapsed, t) })
  } else if (delivered) {
    detail = t('shop.deliveredSpark', { model: AGENT_MODELS.reasoning.label })
    buttonLabel = t('common.owned')
  } else if (purchased) {
    const deliveryAt = state.sparkDeliveryAt
    detail = deliveryAt === null
      ? t('shop.paidDeliveryPending')
      : t('shop.paidDelivery', { price: moneyLabel(SPARK_PRICE, locale), time: durationLabel(deliveryAt - state.elapsed, t) })
    buttonLabel = deliveryAt === null ? t('shop.delivering') : t('common.eta', { time: durationLabel(deliveryAt - state.elapsed, t) })
  } else {
    detail = t('shop.modelNoCloudTokens', { price: moneyLabel(SPARK_PRICE, locale), model: AGENT_MODELS.reasoning.label })
    if (state.stage === 'hired') buttonLabel = state.money >= SPARK_PRICE
      ? t('shop.buy', { price: moneyLabel(SPARK_PRICE, locale) })
      : t('shop.need', { price: moneyLabel(SPARK_PRICE, locale) })
  }

  return (
    <article className={productClassName(`shop-product shop-spark-product ${canBuy ? '' : 'shop-product-unavailable'}`, highlighted)} aria-label={t(sparkProduct.titleKey)}>
      <span className="shop-product-icon" aria-hidden="true">▣</span>
      <div className="shop-product-copy">
        <h3>{t(sparkProduct.titleKey)}</h3>
        <p>{detail}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={buySpark} disabled={!canBuy}>{buttonLabel}</button>
    </article>
  )
}
function SparkUltraProduct({ state, dispatch, highlighted }: ShopProps & ShopHighlightProps) {
  const { t, locale } = useI18n()
  const announcedAt = state.sparkUltraAnnouncedAt
  const purchased = state.sparkUltraPurchasedAt !== null
  const delivered = state.terminals.some((terminal) => terminal.id === 'spark-ultra')
  const availableAt = announcedAt === null ? null : announcedAt + 10
  const available = availableAt !== null && state.elapsed >= availableAt
  const canBuy = state.stage === 'hired' && state.market !== null && available && !purchased && state.money >= SPARK_ULTRA_PRICE
  const buySparkUltra = () => {
    if (canBuy) dispatch({ type: 'buy-spark-ultra' })
  }
  let detail = t('shop.notAnnounced')
  let buttonLabel = t('common.unavailable')
  if (announcedAt !== null && !available) {
    detail = t('shop.saleOpens', { time: durationLabel((availableAt ?? state.elapsed) - state.elapsed, t), price: moneyLabel(SPARK_ULTRA_PRICE, locale) })
    buttonLabel = t('shop.opens', { time: durationLabel((availableAt ?? state.elapsed) - state.elapsed, t) })
  } else if (delivered) {
    detail = t('shop.deliveredSpark', { model: AGENT_MODELS.advanced.label })
    buttonLabel = t('common.owned')
  } else if (purchased) {
    const deliveryAt = state.sparkUltraDeliveryAt
    detail = deliveryAt === null
      ? t('shop.paidDeliveryPending')
      : t('shop.paidDelivery', { price: moneyLabel(SPARK_ULTRA_PRICE, locale), time: durationLabel(deliveryAt - state.elapsed, t) })
    buttonLabel = deliveryAt === null ? t('shop.delivering') : t('common.eta', { time: durationLabel(deliveryAt - state.elapsed, t) })
  } else {
    detail = t('shop.modelNoCloudTokens', { price: moneyLabel(SPARK_ULTRA_PRICE, locale), model: AGENT_MODELS.advanced.label })
    if (state.stage === 'hired') buttonLabel = state.money >= SPARK_ULTRA_PRICE
      ? t('shop.buy', { price: moneyLabel(SPARK_ULTRA_PRICE, locale) })
      : t('shop.need', { price: moneyLabel(SPARK_ULTRA_PRICE, locale) })
  }
  return (
    <article className={productClassName(`shop-product shop-spark-ultra-product ${canBuy ? '' : 'shop-product-unavailable'}`, highlighted)} aria-label={t(sparkUltraProduct.titleKey)}>
      <span className="shop-product-icon" aria-hidden="true">▣</span>
      <div className="shop-product-copy">
        <h3>{t(sparkUltraProduct.titleKey)}</h3>
        <p>{detail}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={buySparkUltra} disabled={!canBuy}>{buttonLabel}</button>
    </article>
  )
}
function AdvancedModelProduct({ state, dispatch, highlighted }: ShopProps & ShopHighlightProps) {
  const { t, locale } = useI18n()
  const canBuy = state.stage === 'hired' &&
    state.advancedModelAnnouncedAt !== null &&
    !state.advancedModelUnlocked &&
    state.money >= ADVANCED_MODEL_PRICE
  const buyModel = () => {
    if (canBuy) dispatch({ type: 'buy-model', model: 'advanced' })
  }
  let detail = t('shop.advancedDetail', { price: moneyLabel(ADVANCED_MODEL_PRICE, locale), model: AGENT_MODELS.reasoning.label })
  let buttonLabel = t('common.unavailable')
  if (state.advancedModelUnlocked) {
    detail = t('shop.handlesHarder', { model: AGENT_MODELS.reasoning.label })
    buttonLabel = t('common.owned')
  } else if (state.stage === 'hired' && state.advancedModelAnnouncedAt !== null) {
    buttonLabel = state.money >= ADVANCED_MODEL_PRICE
      ? t('shop.buy', { price: moneyLabel(ADVANCED_MODEL_PRICE, locale) })
      : t('shop.need', { price: moneyLabel(ADVANCED_MODEL_PRICE, locale) })
  }
  return (
    <article className={productClassName(`shop-product shop-model-product ${canBuy ? '' : 'shop-product-unavailable'}`, highlighted)} aria-label={t(advancedModelProduct.titleKey)}>
      <span className="shop-product-icon" aria-hidden="true">✦</span>
      <div className="shop-product-copy">
        <h3>{t(advancedModelProduct.titleKey)}</h3>
        <p>{detail}</p>
      </div>
      <button className="shop-buy-button" type="button" onClick={buyModel} disabled={!canBuy}>{buttonLabel}</button>
    </article>
  )
}
function MercuryProduct({ state, dispatch, highlighted }: ShopProps & ShopHighlightProps) {
  const { t, locale } = useI18n()
  const canBuy = state.stage === 'hired' && state.advancedModelUnlocked && !state.mercuryOwned && state.money >= MERCURY_PRICE
  const buyMercury = () => {
    if (canBuy) dispatch({ type: 'buy-mercury' })
  }
  const setMercury = (enabled: boolean) => {
    if (state.stage === 'hired' && state.mercuryOwned) dispatch({ type: 'set-mercury', enabled })
  }
  return (
    <article className={productClassName(`shop-product shop-mercury-product ${canBuy || state.mercuryOwned ? '' : 'shop-product-unavailable'}`, highlighted)} aria-label={t(mercuryProduct.titleKey)}>
      <span className="shop-product-icon" aria-hidden="true">↔</span>
      <div className="shop-product-copy">
        <h3>{t(mercuryProduct.titleKey)}</h3>
        <p>{t('shop.mercuryDetail')}</p>
        <p>{state.mercuryOwned
          ? t('shop.mercuryOwnedDetail')
          : t('shop.mercuryPriceDetail', { price: moneyLabel(MERCURY_PRICE, locale) })}</p>
      </div>
      {state.mercuryOwned ? (
        <label className="shop-fast-mode-toggle shop-mercury-toggle">
          <span className="shop-fast-mode-toggle-label">{state.mercuryEnabled ? t('common.on') : t('common.off')}</span>
          <input
            type="checkbox"
            checked={state.mercuryEnabled}
            disabled={state.stage !== 'hired'}
            onChange={(event) => setMercury(event.currentTarget.checked)}
            aria-label={t('shop.mercuryToggleAria')}
          />
          <span className="shop-toggle-track" aria-hidden="true"><span /></span>
        </label>
      ) : (
        <button className="shop-buy-button" type="button" onClick={buyMercury} disabled={!canBuy}>
          {state.stage !== 'hired' ? t('common.unavailable') : state.money >= MERCURY_PRICE ? t('shop.buy', { price: moneyLabel(MERCURY_PRICE, locale) }) : t('shop.need', { price: moneyLabel(MERCURY_PRICE, locale) })}
        </button>
      )}
    </article>
  )
}


export function ShopContent({ state, dispatch, active }: ShopContentProps) {
  const { t, locale, formatNumber } = useI18n()
  const [targetTerminal, setTargetTerminal] = useState<TerminalId>('terminal')
  const highlighted = useShopHighlights(state, active)
  const hasDiscovery = (id: ShopItemId): boolean => state.shopDiscoveries.includes(id)

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
  const refillPrice = moneyLabel(refillCost, locale)
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
    ? t('common.unavailable')
    : selectedTerminal !== undefined && isLocalTerminal(selectedTerminal.id)
      ? t('shop.localFixed')
      : selectedTerminal?.fastMode ? t('common.on') : t('common.off')

  return (
    <div className="shop-app">
      <div className="shop-target-row">
        <label htmlFor="shop-target-terminal">{t('shop.installOn')}</label>
        <select
          id="shop-target-terminal"
          value={selectedTargetTerminal}
          disabled={state.stage !== 'hired'}
          onChange={(event) => setTargetTerminal(event.currentTarget.value as TerminalId)}
        >
          {state.terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminalLabel(terminal.id, t)}</option>)}
        </select>
      </div>


      <div className="shop-products">
        {upgradeProducts.filter((product) => hasDiscovery(product.upgrade)).map((product) => (
          <UpgradeProductCard
            key={product.upgrade}
            product={product}
            state={state}
            dispatch={dispatch}
            highlighted={highlighted.has(product.upgrade)}
            targetTerminal={selectedTargetTerminal}
          />
        ))}
        {hasDiscovery('fast-mode') && (
          <article
            className={productClassName(`shop-product shop-fast-mode-product ${fastModeAvailable ? '' : 'shop-product-unavailable'}`, highlighted.has('fast-mode'))}
            aria-label={t('shop.fastModeAria')}
          >
            <span className="shop-product-icon shop-fast-mode-icon" aria-hidden="true">»</span>
            <div className="shop-product-copy">
              <h3>{t('shop.fastModeAria')}</h3>
              <p>{t('shop.fastModeDetail')}</p>
            </div>
            <label className="shop-fast-mode-toggle">
              <span className="shop-fast-mode-toggle-label">{fastModeLabel}</span>
              <input
                type="checkbox"
                checked={selectedTerminal?.fastMode ?? false}
                disabled={!fastModeAvailable}
                onChange={(event) => setFastMode(event.currentTarget.checked)}
                aria-label={t('shop.fastModeFor', { terminal: terminalLabel(selectedTargetTerminal, t) })}
              />
              <span className="shop-toggle-track" aria-hidden="true"><span /></span>
            </label>
          </article>
        )}
        {hasDiscovery('spark') && <SparkProduct state={state} dispatch={dispatch} highlighted={highlighted.has('spark')} />}
        {hasDiscovery('spark-ultra') && <SparkUltraProduct state={state} dispatch={dispatch} highlighted={highlighted.has('spark-ultra')} />}
        {hasDiscovery('advanced-model') && <AdvancedModelProduct state={state} dispatch={dispatch} highlighted={highlighted.has('advanced-model')} />}
        {hasDiscovery('mercury') && <MercuryProduct state={state} dispatch={dispatch} highlighted={highlighted.has('mercury')} />}
        <article
          className={`shop-product ${canBuyTokens ? '' : 'shop-product-unavailable'}`}
          aria-label={t('shop.tokenRefillAria')}
        >
          <span className="shop-product-icon" aria-hidden="true">◇</span>
          <div className="shop-product-copy">
            <h3>{t('shop.tokenRefill')}</h3>
            <div className="shop-token-options">
              <label className="shop-pack-size">
                {t('shop.packSize')}
                <select
                  value={state.tokenPacks}
                  disabled={state.stage !== 'hired'}
                  onChange={(event) => dispatch({ type: 'set-token-packs', packs: Number(event.currentTarget.value) as TokenPackCount })}
                >
                  {TOKEN_PACK_COUNTS.map((packs) => {
                    const amount = tokenPurchaseAmount(state.tokens, packs)
                    const cost = tokenPurchaseCost(amount, state)
                    const quantity = amount >= MAX_TOKENS - state.tokens
                      ? t('shop.fillBalance')
                      : t('common.tokens', { amount: formatNumber(amount) })
                    return <option key={packs} value={packs}>{quantity} · {moneyLabel(cost, locale)}</option>
                  })}
                </select>
              </label>
              <label className="shop-fast-mode-toggle shop-auto-buy-toggle">
                <span className="shop-auto-buy-name">{t('shop.autoBuy')}</span>
                <span className="shop-fast-mode-toggle-label">{state.tokenAutoBuy ? t('common.on') : t('common.off')}</span>
                <input
                  type="checkbox"
                  checked={state.tokenAutoBuy}
                  disabled={state.stage !== 'hired'}
                  onChange={(event) => dispatch({ type: 'set-token-auto-buy', enabled: event.currentTarget.checked })}
                  aria-label={t('shop.autoBuyAria')}
                />
                <span className="shop-toggle-track" aria-hidden="true"><span /></span>
              </label>
            </div>
            <p>{refillAmount > 0
              ? t('shop.tokensReceived', { amount: formatNumber(refillAmount) })
              : t('shop.inventoryFull')}</p>
            {monopolyActive && (
              <p className="shop-token-rate">
                {t('shop.monopolyRate', { multiplier: tokenMultiplier.toFixed(2), seconds: formatNumber(secondsToNextTokenIncrease ?? 0) })}
              </p>
            )}
          </div>
          <button className="shop-buy-button" type="button" onClick={buyTokens} disabled={!canBuyTokens}>
            {state.stage !== 'hired'
              ? t('common.unavailable')
              : state.tokens >= MAX_TOKENS
                ? t('shop.balanceFull')
                : canBuyTokens ? refillPrice : t('shop.need', { price: refillPrice })}
          </button>
        </article>
      </div>
    </div>
  )
}
