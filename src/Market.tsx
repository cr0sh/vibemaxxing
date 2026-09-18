import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import type { GameAction, GameState } from './game'
import { executableBtcQuantity } from './trading'
import './Market.css'

const usdFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const btcFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
const EMPTY_HISTORY: { elapsed: number; price: number }[] = []

type MarketProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}

type ChartData = {
  points: string
  min: number | null
  max: number | null
}

function parseAmount(value: string): number | null {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function formatUsd(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? `$${usdFormatter.format(value)}` : '$—'
}

function formatBtc(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? btcFormatter.format(value) : '—'
}

function buildChart(history: readonly { elapsed: number; price: number }[]): ChartData {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let count = 0
  for (const point of history) {
    if (!Number.isFinite(point.elapsed) || !Number.isFinite(point.price) || point.price <= 0) continue
    min = Math.min(min, point.price)
    max = Math.max(max, point.price)
    count += 1
  }
  if (count === 0) return { points: '', min: null, max: null }

  const width = 480
  const height = 180
  const padding = 12
  const span = Math.max(max - min, Math.max(1, max * 0.02))
  const xSpan = Math.max(1, count - 1)
  let index = 0
  let points = ''
  for (const point of history) {
    if (!Number.isFinite(point.elapsed) || !Number.isFinite(point.price) || point.price <= 0) continue
    const x = padding + (width - padding * 2) * index / xSpan
    const y = height - padding - (height - padding * 2) * (point.price - min) / span
    if (points.length > 0) points += ' '
    points += `${x.toFixed(2)},${y.toFixed(2)}`
    index += 1
  }
  return { points, min, max }
}

export function MarketContent({ state, dispatch }: MarketProps) {
  const market = state.market
  const [transferAmount, setTransferAmount] = useState('100')
  const [transferMax, setTransferMax] = useState(false)
  const [btcAmount, setBtcAmount] = useState('1')
  const canUseMarket = state.stage === 'hired' && market !== null
  const transferValue = parseAmount(transferAmount)
  const transferValueFor = (direction: 'deposit' | 'withdraw') => {
    if (!canUseMarket) return null
    if (transferMax) {
      const available = direction === 'deposit' ? state.money : market.usd
      return Number.isFinite(available) && available > 0 ? available : null
    }
    return transferValue
  }
  const depositValue = transferValueFor('deposit')
  const withdrawValue = transferValueFor('withdraw')
  const btcValue = parseAmount(btcAmount)
  const canDeposit = depositValue !== null && depositValue <= state.money
  const canWithdraw = withdrawValue !== null && withdrawValue <= (market?.usd ?? 0)
  const canBuy = canUseMarket && btcValue !== null && executableBtcQuantity(market, 'buy', btcValue) !== null
  const canSell = canUseMarket && btcValue !== null && executableBtcQuantity(market, 'sell', btcValue) !== null
  const canSellAll = canUseMarket && executableBtcQuantity(market, 'sell', market.btc) !== null
  const history = market?.history ?? EMPTY_HISTORY
  const chart = useMemo(() => buildChart(history), [history])

  const submitTransfer = (direction: 'deposit' | 'withdraw') => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = direction === 'deposit' ? depositValue : withdrawValue
    if (!canUseMarket || amount === null) return
    dispatch({ type: 'market-transfer', direction, amount: transferMax ? 'max' : amount })
  }

  const executeTrade = (side: 'buy' | 'sell') => {
    if (!canUseMarket || btcValue === null || (side === 'buy' ? !canBuy : !canSell)) return
    dispatch({ type: 'market-trade', side, amount: btcValue })
  }

  const submitTrade = (side: 'buy' | 'sell') => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    executeTrade(side)
  }

  return (
    <div className="market-app">
      <header className="market-header">
        <h2>Market</h2>
        <div className="market-current-price" aria-label={`Current Bitcoin price ${formatUsd(market?.price)}`}>
          <span>BTC / USD</span>
          <strong>{formatUsd(market?.price)}</strong>
        </div>
      </header>

      <div className="market-layout">
        <div className="market-main">
      <section className="market-balances" aria-label="Balances">
        <div className="market-balance market-balance-cash">
          <span>Cash</span>
          <strong>{formatUsd(state.money)}</strong>
        </div>
        <div className="market-balance market-balance-usd">
          <span>Trading USD</span>
          <strong>{formatUsd(market?.usd)}</strong>
        </div>
        <div className="market-balance market-balance-btc">
          <span>Trading BTC</span>
          <strong>{formatBtc(market?.btc)} <small>BTC</small></strong>
        </div>
      </section>

      <figure className="market-chart">
        <figcaption>BTC / USD</figcaption>
        <svg
          className="market-chart-svg"
          viewBox="0 0 480 180"
          role="img"
          aria-label="Bitcoin price history"
          preserveAspectRatio="none"
        >
          <title>Bitcoin price history</title>
          <line className="market-chart-grid" x1="12" y1="12" x2="468" y2="12" />
          <line className="market-chart-grid" x1="12" y1="90" x2="468" y2="90" />
          <line className="market-chart-grid" x1="12" y1="168" x2="468" y2="168" />
          {chart.points && <polyline className="market-chart-line" points={chart.points} />}
        </svg>
        <div className="market-chart-range" aria-hidden="true">
          <span>Low {formatUsd(chart.min ?? undefined)}</span>
          <span>High {formatUsd(chart.max ?? undefined)}</span>
        </div>
      </figure>
        </div>

      <div className="market-panels">
        <section className="market-panel" aria-labelledby="market-transfer-heading">
          <h3 id="market-transfer-heading">USD wallet</h3>
          <form className="market-form" onSubmit={submitTransfer('deposit')}>
            <label htmlFor="market-transfer-amount">Amount <span>(USD)</span></label>
            <div className="market-input-control">
              <input
                id="market-transfer-amount"
                type="text"
                inputMode="decimal"
                value={transferMax ? 'MAX' : transferAmount}
                onChange={(event) => {
                  setTransferAmount(event.currentTarget.value)
                  setTransferMax(false)
                }}
                aria-describedby="market-transfer-help"
              />
              <button className="market-max-button" type="button" aria-pressed={transferMax} onClick={() => setTransferMax((enabled) => !enabled)} disabled={!canUseMarket}>MAX</button>
            </div>
            <span id="market-transfer-help" className="market-form-help">Cash {formatUsd(state.money)} · wallet {formatUsd(market?.usd)}</span>
            <div className="market-actions">
              <button type="submit" disabled={!canDeposit}>{transferMax ? 'Deposit MAX' : 'Deposit USD'}</button>
              <button type="button" disabled={!canWithdraw} onClick={() => {
                if (!canUseMarket || withdrawValue === null) return
                dispatch({ type: 'market-transfer', direction: 'withdraw', amount: transferMax ? 'max' : withdrawValue })
              }}>{transferMax ? 'Withdraw MAX' : 'Withdraw USD'}</button>
            </div>
          </form>
        </section>

        <section className="market-panel" aria-labelledby="market-trade-heading">
          <h3 id="market-trade-heading">Trade</h3>
          <form className="market-form" onSubmit={submitTrade('buy')}>
            <label htmlFor="market-btc-amount">Quantity <span>(BTC)</span></label>
            <input
              id="market-btc-amount"
              type="number"
              min="0.00000001"
              step="any"
              inputMode="decimal"
              value={btcAmount}
              onChange={(event) => setBtcAmount(event.currentTarget.value)}
            />
            <span className="market-form-help">USD wallet {formatUsd(market?.usd)} · BTC wallet {formatBtc(market?.btc)} BTC</span>
            <div className="market-actions">
              <button type="submit" disabled={!canBuy}>Buy BTC</button>
              <button type="button" disabled={!canSell} onClick={() => executeTrade('sell')}>Sell BTC</button>
              <button type="button" disabled={!canSellAll} onClick={() => {
                if (canUseMarket) dispatch({ type: 'market-trade', side: 'sell', amount: market.btc })
              }}>Sell all BTC</button>
            </div>
          </form>
        </section>
      </div>
        </div>
      </div>
  )
}
