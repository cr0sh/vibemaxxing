import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import type { GameAction, GameState } from './game'
import { executableBtcQuantity, type TradeMarker } from './trading'
import './Market.css'

const usdFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const btcFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
const EMPTY_HISTORY: readonly { elapsed: number; price: number }[] = []
const EMPTY_TRADES: readonly TradeMarker[] = []

const CHART_WIDTH = 480
const CHART_HEIGHT = 180
const CHART_PADDING = 12

type MarketProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}

type ChartMarker = TradeMarker & {
  x: number
  y: number
}

type ChartData = {
  points: string
  min: number | null
  max: number | null
  markers: readonly ChartMarker[]
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

function buildChart(
  history: readonly { elapsed: number; price: number }[],
  trades: readonly TradeMarker[],
): ChartData {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let minElapsed = Number.POSITIVE_INFINITY
  let maxElapsed = Number.NEGATIVE_INFINITY
  let count = 0
  for (const point of history) {
    if (!Number.isFinite(point.elapsed) || !Number.isFinite(point.price) || point.price <= 0) continue
    min = Math.min(min, point.price)
    max = Math.max(max, point.price)
    minElapsed = Math.min(minElapsed, point.elapsed)
    maxElapsed = Math.max(maxElapsed, point.elapsed)
    count += 1
  }
  if (count === 0) return { points: '', min: null, max: null, markers: [] }

  const span = Math.max(max - min, Math.max(1, max * 0.02))
  const xSpan = maxElapsed - minElapsed
  const xForElapsed = (elapsed: number) => {
    if (xSpan <= 0) return CHART_WIDTH / 2
    const x = CHART_PADDING + (CHART_WIDTH - CHART_PADDING * 2) * (elapsed - minElapsed) / xSpan
    return Math.max(CHART_PADDING, Math.min(CHART_WIDTH - CHART_PADDING, x))
  }
  const yForPrice = (price: number) => Math.max(
    CHART_PADDING,
    Math.min(
      CHART_HEIGHT - CHART_PADDING,
      CHART_HEIGHT - CHART_PADDING - (CHART_HEIGHT - CHART_PADDING * 2) * (price - min) / span,
    ),
  )

  let points = ''
  for (const point of history) {
    if (!Number.isFinite(point.elapsed) || !Number.isFinite(point.price) || point.price <= 0) continue
    const x = xForElapsed(point.elapsed)
    const y = yForPrice(point.price)
    if (points.length > 0) points += ' '
    points += `${x.toFixed(2)},${y.toFixed(2)}`
  }

  const markers: ChartMarker[] = []
  for (const marker of trades) {
    if (
      !Number.isFinite(marker.id) ||
      !Number.isFinite(marker.elapsed) ||
      !Number.isFinite(marker.price) ||
      marker.price <= 0 ||
      !Number.isFinite(marker.quantity) ||
      marker.quantity <= 0 ||
      (marker.side !== 'buy' && marker.side !== 'sell')
    ) continue
    markers.push({ ...marker, x: xForElapsed(marker.elapsed), y: yForPrice(marker.price) })
  }
  return { points, min, max, markers }
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
  const trades = market?.trades ?? EMPTY_TRADES
  const chart = useMemo(() => buildChart(history, trades), [history, trades])
  const portfolioValue = market !== null &&
    Number.isFinite(state.money) &&
    Number.isFinite(market.usd) &&
    Number.isFinite(market.btc) &&
    Number.isFinite(market.price)
    ? state.money + market.usd + market.btc * market.price
    : undefined

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
        <div className="market-header-values">
          <div
            className="market-portfolio"
            title="Cash + Trading USD + Trading BTC × current BTC / USD price"
            aria-label={`Total portfolio value ${formatUsd(portfolioValue)}`}
          >
            <span>Total</span>
            <strong>{formatUsd(portfolioValue)}</strong>
          </div>
          <div className="market-current-price" aria-label={`Current Bitcoin price ${formatUsd(market?.price)}`}>
            <span>BTC / USD</span>
            <strong>{formatUsd(market?.price)}</strong>
          </div>
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
          aria-label="Bitcoin price history with trade markers"
          preserveAspectRatio="none"
        >
          <title>Bitcoin price history with trade markers</title>
          <line className="market-chart-grid" x1="12" y1="12" x2="468" y2="12" />
          <line className="market-chart-grid" x1="12" y1="90" x2="468" y2="90" />
          <line className="market-chart-grid" x1="12" y1="168" x2="468" y2="168" />
          {chart.points && <polyline className="market-chart-line" points={chart.points} />}
          {chart.markers.map((marker) => {
            const side = marker.side === 'buy' ? 'Buy' : 'Sell'
            const description = `${side} ${formatBtc(marker.quantity)} BTC at ${formatUsd(marker.price)} (${marker.elapsed.toFixed(1)}s)`
            return (
              <g
                key={marker.id}
                className={`market-chart-marker market-chart-marker-${marker.side}`}
                transform={`translate(${marker.x.toFixed(2)} ${marker.y.toFixed(2)})`}
                role="img"
                tabIndex={0}
                aria-label={description}
              >
                <title>{description}</title>
                {marker.side === 'buy'
                  ? <path d="M 0,-9 L 7,4 L -7,4 Z" />
                  : <path d="M 0,9 L 7,-4 L -7,-4 Z" />}
              </g>
            )
          })}
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
