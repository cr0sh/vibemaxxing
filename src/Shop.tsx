import { useState } from 'react'
import type { Dispatch } from 'react'
import {
  MAX_TOKENS,
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

const terminalLabel = (terminalId: TerminalId): string => terminalId === 'terminal' ? 'Terminal' : 'Terminal 2'
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
  let buttonLabel = `$${price ?? 0}`
  if (state.stage !== 'hired') buttonLabel = 'Unavailable'
  else if (price === null) {
    if (upgrade === 'split') buttonLabel = 'Maximum panes'
    else if (upgrade === 'yolo') buttonLabel = 'Installed'
    else buttonLabel = 'Two terminals max'
  } else if (state.money < price) {
    buttonLabel = `Need $${price}`
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

export function ShopContent({ state, dispatch }: ShopProps) {
  const [targetTerminal, setTargetTerminal] = useState<TerminalId>('terminal')
  const [tokenPacks, setTokenPacks] = useState<TokenPackCount>(10)

  const selectedTargetTerminal = state.terminals.some((terminal) => terminal.id === targetTerminal)
    ? targetTerminal
    : state.terminals[0]?.id ?? 'terminal'
  const refillAmount = tokenPurchaseAmount(state.tokens, tokenPacks)
  const refillCost = tokenPurchaseCost(refillAmount)
  const refillPrice = `$${refillCost.toFixed(2)}`
  const canBuyTokens = state.stage === 'hired' && state.money >= refillCost && refillAmount > 0

  const buyTokens = () => {
    if (canBuyTokens) dispatch({ type: 'buy-tokens', packs: tokenPacks })
  }


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
        <span>Drag an upgrade onto a Terminal window.</span>
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
                {TOKEN_PACK_COUNTS.map((packs) => <option key={packs} value={packs}>{(TOKEN_PURCHASE_AMOUNT * packs).toLocaleString()} tokens · ${TOKEN_PURCHASE_COST * packs}</option>)}
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
