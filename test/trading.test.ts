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
