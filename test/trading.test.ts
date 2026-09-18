import { describe, expect, test } from 'bun:test'
import { createMarket, tradeMarket, transferMarket } from '../src/trading'

describe('trading balances', () => {
  test('Bitcoin opens at exactly one hundred dollars', () => {
    expect(createMarket(17, 0).price).toBe(100)
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
