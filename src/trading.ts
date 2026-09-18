export type TradeMarker = {
  id: number
  elapsed: number
  side: 'buy' | 'sell'
  price: number
  quantity: number
}

export type MarketState = {
  usd: number
  btc: number
  price: number
  realizedPnl: number
  btcCostBasis: number
  history: { elapsed: number; price: number }[]
  trades: TradeMarker[]
  nextTradeId: number
  rng: number
}

type RandomStep = [state: number, value: number]

const UINT_RANGE = 4_294_967_296
const INITIAL_PRICE = 100
const MIN_PRICE = 1
const MAX_PRICE = 10_000_000
const HISTORY_LIMIT = 240
const MARKET_STEP_SECONDS = 0.5
const BROWNIAN_SCALE = 0.055
const JUMP_PROBABILITY = 0.06
const EPSILON = Number.EPSILON * 8


function seedState(seed: number): number {
  if (!Number.isFinite(seed)) return 0x6d2b79f5
  const normalized = Math.trunc(seed) >>> 0
  return normalized === 0 ? 0x6d2b79f5 : normalized
}

function nextRandom(state: number): RandomStep {
  const next = (Math.imul(state >>> 0, 1_664_525) + 1_013_904_223) >>> 0
  return [next, next / UINT_RANGE]
}

function boundedPrice(price: number): number {
  if (!Number.isFinite(price)) return INITIAL_PRICE
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, price))
}
function elapsedHalfSteps(elapsed: number): number {
  return Math.floor(Math.max(0, elapsed) / MARKET_STEP_SECONDS + Number.EPSILON * 8)
}

export function createMarket(seed: number, elapsed: number): MarketState {
  const [rng] = nextRandom(seedState(seed))
  const price = boundedPrice(INITIAL_PRICE)
  const at = Number.isFinite(elapsed) ? elapsedHalfSteps(elapsed) * MARKET_STEP_SECONDS : 0
  return {
    usd: 0,
    btc: 0,
    price,
    realizedPnl: 0,
    btcCostBasis: 0,
    history: [{ elapsed: at, price }],
    trades: [],
    nextTradeId: 1,
    rng,
  }
}

export function advanceMarket(market: MarketState, elapsed: number): MarketState {
  if (!validMarket(market) || !Number.isFinite(elapsed) || !Array.isArray(market.history)) return market
  const previous = market.history.at(-1)
  if (previous === undefined || !Number.isFinite(previous.elapsed) || !Number.isFinite(previous.price)) return market

  const targetStep = elapsedHalfSteps(elapsed)
  const previousStep = elapsedHalfSteps(previous.elapsed)
  if (targetStep <= previousStep) return market

  let rng = market.rng >>> 0
  let price = previous.price
  const history = market.history.slice()
  for (let step = previousStep + 1; step <= targetStep; step += 1) {
    let eventRoll: number
    ;[rng, eventRoll] = nextRandom(rng)
    let noiseA: number
    ;[rng, noiseA] = nextRandom(rng)
    let noiseB: number
    ;[rng, noiseB] = nextRandom(rng)

    const brownian = ((noiseA - 0.5) + (noiseB - 0.5)) * BROWNIAN_SCALE
    const move = eventRoll < JUMP_PROBABILITY
      ? (noiseA < 0.5 ? -1 : 1) * (0.14 + noiseB * 0.28)
      : brownian
    price = boundedPrice(price * (1 + Math.max(-0.8, Math.min(0.8, move))))
    history.push({ elapsed: step * MARKET_STEP_SECONDS, price })
  }
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT)

  let trades = market.trades
  const retainedFrom = history[0]?.elapsed
  if (retainedFrom !== undefined && trades.length > 0) {
    let expired = 0
    while (expired < trades.length && trades[expired]!.elapsed < retainedFrom) expired += 1
    if (expired > 0) trades = trades.slice(expired)
  }

  return { ...market, price, history, trades, rng }
}

function validMarket(market: MarketState): boolean {
  return Number.isFinite(market.usd) && market.usd >= 0 &&
    Number.isFinite(market.btc) && market.btc >= 0 &&
    Number.isFinite(market.price) && market.price >= MIN_PRICE && market.price <= MAX_PRICE &&
    Number.isFinite(market.realizedPnl) &&
    Number.isFinite(market.btcCostBasis) && market.btcCostBasis >= 0 &&
    Array.isArray(market.history) &&
    Array.isArray(market.trades) &&
    Number.isInteger(market.nextTradeId) && market.nextTradeId >= 1 &&
    Number.isFinite(market.rng)
}


export function executableBtcQuantity(market: MarketState, side: 'buy' | 'sell', amount: number): number | null {
  if (!validMarket(market) || !Number.isFinite(amount) || amount <= 0 || (side !== 'buy' && side !== 'sell')) return null
  const available = side === 'buy' ? market.usd / market.price : market.btc
  const tolerance = EPSILON * available
  if (amount - available > tolerance) return null
  // Treat floating-point noise at a wallet boundary as the full balance.
  const quantity = Math.abs(amount - available) <= tolerance ? available : amount
  const value = quantity * market.price
  const usd = side === 'buy' ? Math.max(0, market.usd - value) : market.usd + value
  const btc = side === 'buy' ? market.btc + quantity : market.btc - quantity
  if (quantity <= 0 || !Number.isFinite(value) || !Number.isFinite(usd) || !Number.isFinite(btc)) return null
  if (side === 'buy' ? usd >= market.usd || btc <= market.btc : usd <= market.usd || btc >= market.btc) return null
  return quantity
}

export function tradeMarket(market: MarketState, side: 'buy' | 'sell', amount: number): MarketState {
  const quantity = executableBtcQuantity(market, side, amount)
  if (quantity === null) return market
  const latest = market.history.at(-1)
  if (latest === undefined || !Number.isFinite(latest.elapsed)) return market
  const value = quantity * market.price
  const soldCostBasis = side === 'sell'
    ? quantity === market.btc ? market.btcCostBasis : market.btcCostBasis * (quantity / market.btc)
    : 0
  const nextUsd = side === 'buy' ? Math.max(0, market.usd - value) : market.usd + value
  const nextBtc = side === 'buy' ? market.btc + quantity : market.btc - quantity
  const nextRealizedPnl = side === 'sell' ? market.realizedPnl + (value - soldCostBasis) : market.realizedPnl
  const nextBtcCostBasis = side === 'buy'
    ? market.btcCostBasis + value
    : quantity === market.btc ? 0 : market.btcCostBasis - soldCostBasis
  if (!Number.isFinite(nextUsd) || !Number.isFinite(nextBtc) ||
    !Number.isFinite(nextRealizedPnl) || !Number.isFinite(nextBtcCostBasis) || nextBtcCostBasis < 0) return market
  const marker: TradeMarker = {
    id: market.nextTradeId,
    elapsed: latest.elapsed,
    side,
    price: market.price,
    quantity,
  }
  const trades = [...market.trades, marker]
  return {
    ...market,
    usd: nextUsd,
    btc: nextBtc,
    realizedPnl: nextRealizedPnl,
    btcCostBasis: nextBtcCostBasis,
    trades,
    nextTradeId: market.nextTradeId + 1,
  }
}

export function transferMarket(
  market: MarketState,
  money: number,
  direction: 'deposit' | 'withdraw',
  amount: number,
): { market: MarketState; money: number } {
  if (!validMarket(market) || !Number.isFinite(money) || money < 0 || !Number.isFinite(amount) || amount <= 0) {
    return { market, money }
  }

  if (direction === 'deposit') {
    const nextUsd = market.usd + amount
    const nextMoney = money - amount
    if (amount > money || !Number.isFinite(nextUsd) || !Number.isFinite(nextMoney) || nextUsd <= market.usd || nextMoney >= money || nextMoney < -EPSILON) return { market, money }
    return {
      market: { ...market, usd: nextUsd },
      money: nextMoney < 0 ? 0 : nextMoney,
    }
  }

  if (direction === 'withdraw') {
    const nextUsd = market.usd - amount
    const nextMoney = money + amount
    if (amount > market.usd || !Number.isFinite(nextUsd) || !Number.isFinite(nextMoney) || nextUsd >= market.usd || nextMoney <= money || nextUsd < -EPSILON) return { market, money }
    return {
      market: { ...market, usd: nextUsd < 0 ? 0 : nextUsd },
      money: nextMoney,
    }
  }

  return { market, money }
}
