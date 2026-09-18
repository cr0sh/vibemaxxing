import { describe, expect, test } from 'bun:test'
import { createMarket, advanceMarket, tradeMarket, transferMarket } from '../src/trading'

describe('trading balances', () => {
  test('Bitcoin opens at exactly one hundred dollars', () => {
    expect(createMarket(17, 0).price).toBe(100)
  })

  test('moves on each half-second and catches up one step at a time', () => {
    const start = createMarket(17, 0)
    const half = advanceMarket(start, 0.5)
    const one = advanceMarket(half, 1)

    expect(half.history).toHaveLength(2)
    expect(half.history.at(-1)).toEqual({ elapsed: 0.5, price: half.price })
    expect(one.history).toHaveLength(3)
    expect(one.history.at(-1)).toEqual({ elapsed: 1, price: one.price })
  })

  test('batched catch-up matches sequential half-second updates', () => {
    const start = createMarket(23, 0)
    const sequential = advanceMarket(advanceMarket(advanceMarket(start, 0.5), 1), 1.5)
    const batched = advanceMarket(start, 1.5)

    expect(batched).toEqual(sequential)
  })

  test('keeps a 120-second chart window with finite bounded prices', () => {
    const advanced = advanceMarket(createMarket(17, 0), 120)
    const last = advanced.history.at(-1)

    expect(advanced.history).toHaveLength(240)
    expect(advanced.history[0]?.elapsed).toBe(0.5)
    expect(last?.elapsed).toBe(120)
    expect(Number.isFinite(advanced.price)).toBe(true)
    expect(advanced.price).toBeGreaterThanOrEqual(1)
    expect(advanced.price).toBeLessThanOrEqual(10_000_000)
  })
  test('records successful buy and sell executions at the current chart sample', () => {
    const funded = transferMarket(createMarket(17, 0), 1_000, 'deposit', 250).market
    const current = advanceMarket(funded, 0.5)
    const bought = tradeMarket(current, 'buy', 0.125)
    const sold = tradeMarket(bought, 'sell', 0.05)

    expect(sold.trades).toMatchObject([
      { elapsed: 0.5, side: 'buy', price: current.price, quantity: 0.125 },
      { elapsed: 0.5, side: 'sell', price: current.price, quantity: 0.05 },
    ])
    expect(sold.trades[0]!.id).not.toBe(sold.trades[1]!.id)
  })

  test('records the clamped quantity for a wallet-boundary execution', () => {
    const funded = transferMarket(createMarket(17, 0), 1, 'deposit', 1).market
    const bought = tradeMarket(funded, 'buy', 0.010000000000000002)

    expect(bought.btc).toBe(0.01)
    expect(bought.usd).toBe(0)
    expect(bought.btcCostBasis).toBe(1)
    expect(bought.trades.at(-1)).toMatchObject({ elapsed: 0, side: 'buy', price: 100, quantity: 0.01 })

    const sold = tradeMarket(bought, 'sell', 0.010000000000000002)
    expect(sold.btc).toBe(0)
    expect(sold.btcCostBasis).toBe(0)
    expect(sold.realizedPnl).toBe(0)
    expect(sold.trades.at(-1)).toMatchObject({ elapsed: 0, side: 'sell', price: 100, quantity: 0.01 })
  })

  test('prunes only markers older than the retained history boundary during catch-up', () => {
    const funded = transferMarket(createMarket(17, 0), 1_000, 'deposit', 250).market
    const first = tradeMarket(funded, 'buy', 0.1)
    const second = tradeMarket(first, 'buy', 0.2)
    const atBoundary = tradeMarket(advanceMarket(second, 0.5), 'buy', 0.3)
    const visible = atBoundary.trades.at(-1)
    if (visible === undefined) throw new Error('Expected a visible trade marker')

    const caughtUp = advanceMarket(atBoundary, 120)

    expect(caughtUp.history[0]?.elapsed).toBe(0.5)
    expect(caughtUp.trades).toEqual([visible])
    expect(advanceMarket(caughtUp, 120.5).trades).toEqual([])
  })


  test('a fractional BTC round trip returns all cash without fees or rounding dust', () => {
    const deposited = transferMarket(createMarket(17, 0), 1_000, 'deposit', 250)
    const bought = tradeMarket(deposited.market, 'buy', 0.125)
    expect(bought.btc).toBe(0.125)
    const sold = tradeMarket(bought, 'sell', bought.btc)
    const withdrawn = transferMarket(sold, deposited.money, 'withdraw', sold.usd)
    expect(withdrawn.money).toBeCloseTo(1_000, 10)
    expect(withdrawn.market.usd).toBe(0)
    expect(withdrawn.market.btc).toBe(0)
  })

  test('decimal quantity sales can empty the displayed BTC balance without dust', () => {
    const funded = transferMarket(createMarket(17, 0), 100, 'deposit', 100).market
    const bought = tradeMarket(funded, 'buy', 1)
    const partlySold = tradeMarket(bought, 'sell', 0.9)
    const sold = tradeMarket(partlySold, 'sell', 0.1)
    expect(sold.btc).toBe(0)
    expect(sold.usd).toBeCloseTo(100, 10)
  })

  test('tracks weighted-average basis across mixed-price buys and partial then full sales', () => {
    const funded = transferMarket(createMarket(17, 0), 1_000, 'deposit', 600).market
    const firstBuy = tradeMarket(funded, 'buy', 2)
    const secondBuy = tradeMarket({ ...firstBuy, price: 200 }, 'buy', 1)

    expect(secondBuy.btc).toBe(3)
    expect(secondBuy.btcCostBasis).toBe(400)
    expect(secondBuy.realizedPnl).toBe(0)

    const partialSale = tradeMarket({ ...secondBuy, price: 300 }, 'sell', 1.5)
    expect(partialSale.btc).toBe(1.5)
    expect(partialSale.btcCostBasis).toBe(200)
    expect(partialSale.realizedPnl).toBe(250)

    const fullSale = tradeMarket({ ...partialSale, price: 50 }, 'sell', partialSale.btc)
    expect(fullSale.btc).toBe(0)
    expect(fullSale.btcCostBasis).toBe(0)
    expect(fullSale.realizedPnl).toBe(125)
  })

  test('retains lifetime realized PnL through transfers and marker eviction', () => {
    const deposited = transferMarket(createMarket(17, 0), 1_000, 'deposit', 250)
    const bought = tradeMarket(deposited.market, 'buy', 1)
    const sold = tradeMarket({ ...bought, price: 250 }, 'sell', 1)
    const withdrawn = transferMarket(sold, deposited.money, 'withdraw', sold.usd)
    const redeposited = transferMarket(withdrawn.market, withdrawn.money, 'deposit', 100)
    const transferred = transferMarket(redeposited.market, redeposited.money, 'withdraw', 100)

    expect(transferred.market.realizedPnl).toBe(150)
    expect(transferred.market.btcCostBasis).toBe(0)
    const caughtUp = advanceMarket(transferred.market, 120)
    expect(caughtUp.trades).toEqual([])
    expect(caughtUp.realizedPnl).toBe(150)
    expect(caughtUp.btcCostBasis).toBe(0)
  })

  test('a large break-even sale preserves previously realized profit', () => {
    const market = { ...createMarket(17, 0), btc: 1e14, btcCostBasis: 1e16, realizedPnl: 0.25 }
    const sold = tradeMarket(market, 'sell', market.btc)
    expect(sold.btc).toBe(0)
    expect(sold.realizedPnl).toBe(0.25)
  })

  test('invalid trades and transfers cannot poison or overdraw either wallet', () => {
    const funded = transferMarket(createMarket(17, 0), 1_000, 'deposit', 250)
    const before = { ...funded.market }
    expect(tradeMarket(funded.market, 'buy', Number.NaN)).toEqual(before)
    expect(tradeMarket(funded.market, 'buy', 3)).toEqual(before)
    expect(tradeMarket(funded.market, 'sell', 1)).toEqual(before)
    expect(transferMarket(funded.market, funded.money, 'deposit', 751)).toEqual({ market: before, money: 750 })
    expect(transferMarket(funded.market, funded.money, 'withdraw', 251)).toEqual({ market: before, money: 750 })
    expect(funded.market).toEqual(before)
  })

})
