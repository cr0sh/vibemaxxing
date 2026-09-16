import { useState } from 'react'
import type { DragEvent, Dispatch } from 'react'
import {
  MAX_TOKENS,
  TOKEN_PURCHASE_AMOUNT,
  TOKEN_PURCHASE_COST,
  type GameAction,
  type GameState,
  type TerminalId,
  type TerminalUpgrade,
  upgradePrice,
} from './game'
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
  { upgrade: 'split', icon: '◫', title: 'Split window', detail: 'Add one independent lane.' },
  { upgrade: 'yolo', icon: '⚡', title: 'YOLO mode', detail: 'Skip command approval pauses.' },
  { upgrade: 'terminal', icon: '🖥️', title: 'Additional terminal', detail: 'Open a second terminal window.' },
]

const terminalLabel = (terminalId: TerminalId): string => terminalId === 'terminal' ? 'Terminal' : 'Terminal 2'

export function ShopContent({ state, dispatch }: ShopProps) {
  const [targetTerminal, setTargetTerminal] = useState<TerminalId>('terminal')

  const selectedTargetTerminal = state.terminals.some((terminal) => terminal.id === targetTerminal)
    ? targetTerminal
    : state.terminals[0]?.id ?? 'terminal'
  const canBuyTokens = state.stage === 'hired' && state.money >= TOKEN_PURCHASE_COST && state.tokens < MAX_TOKENS
  const selectedUpgradeTarget = (upgrade: TerminalUpgrade): TerminalId =>
    upgrade === 'terminal' ? 'terminal' : selectedTargetTerminal

  const buyTokens = () => {
    if (canBuyTokens) dispatch({ type: 'buy-tokens' })
  }

  const installUpgrade = (upgrade: TerminalUpgrade) => {
    const target = selectedUpgradeTarget(upgrade)
    const price = upgradePrice(state, upgrade, target)
    if (price === null || state.money < price) return
    dispatch({ type: 'buy-upgrade', upgrade, terminalId: target })
  }

  const handleUpgradeDragStart = (event: DragEvent<HTMLElement>, upgrade: TerminalUpgrade) => {
    const price = upgradePrice(state, upgrade, selectedUpgradeTarget(upgrade))
    if (price === null || state.money < price) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-vibemaxxer-upgrade', upgrade)
    event.dataTransfer.setData('text/plain', upgrade)
  }

  const productState = (upgrade: TerminalUpgrade, price: number | null): string => {
    if (state.stage !== 'hired') return 'Unavailable'
    if (price === null) {
      if (upgrade === 'split') return 'Max lanes'
      if (upgrade === 'yolo') return 'Installed'
      return 'Two terminals max'
    }
    if (state.money < price) return `Need $${price}`
    return `$${price}`
  }

  return (
    <div className="shop-app">
      <header className="shop-header">
        <div>
          <h2>Shop</h2>
          <p className="shop-money">$ {state.money.toLocaleString()} available</p>
        </div>
        <span className="shop-balance" aria-label={`${state.tokens.toLocaleString()} tokens`}>◇ {state.tokens.toLocaleString()}</span>
      </header>

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
        <span>Drag an upgrade onto any terminal lane.</span>
      </div>

      <div className="shop-products">
        <article
          className={`shop-product ${canBuyTokens ? '' : 'shop-product-unavailable'}`}
          aria-label="100K token refill"
        >
          <span className="shop-product-icon" aria-hidden="true">◇</span>
          <div className="shop-product-copy">
            <h3>100K tokens</h3>
            <p>{TOKEN_PURCHASE_AMOUNT.toLocaleString()} token refill</p>
          </div>
          <button className="shop-buy-button" type="button" onClick={buyTokens} disabled={!canBuyTokens}>
            {state.stage !== 'hired' ? 'Unavailable' : state.tokens >= MAX_TOKENS ? 'Balance full' : canBuyTokens ? `$${TOKEN_PURCHASE_COST}` : `Need $${TOKEN_PURCHASE_COST}`}
          </button>
        </article>

        {upgradeProducts.map(({ upgrade, icon, title, detail }) => {
          const price = upgradePrice(state, upgrade, selectedUpgradeTarget(upgrade))
          const canInstall = price !== null && state.money >= price
          return (
            <article
              className={`shop-product shop-upgrade-product ${canInstall ? '' : 'shop-product-unavailable'}`}
              key={upgrade}
              draggable={canInstall}
              onDragStart={(event) => handleUpgradeDragStart(event, upgrade)}
              aria-label={`${title} upgrade`}
            >
              <span className="shop-product-icon" aria-hidden="true">{icon}</span>
              <div className="shop-product-copy">
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
              <button className="shop-buy-button" type="button" onClick={() => installUpgrade(upgrade)} disabled={!canInstall}>
                {productState(upgrade, price)}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
