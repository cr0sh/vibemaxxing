export type MarketState = {
  usd: number
  btc: number
  price: number
  history: { elapsed: number; price: number }[]
  rng: number
}

type RandomStep = [state: number, value: number]

const UINT_RANGE = 4_294_967_296
const INITIAL_PRICE = 30_000
const MIN_PRICE = 1
const MAX_PRICE = 10_000_000
const HISTORY_LIMIT = 120
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

function validMarket(market: MarketState): boolean {
  return Number.isFinite(market.usd) && market.usd >= 0 &&
    Number.isFinite(market.btc) && market.btc >= 0 &&
    Number.isFinite(market.price) && market.price >= MIN_PRICE && market.price <= MAX_PRICE &&
    Number.isFinite(market.rng)
}

export function createMarket(seed: number, elapsed: number): MarketState {
  const [rng, roll] = nextRandom(seedState(seed))
  const price = boundedPrice(INITIAL_PRICE * (0.9 + roll * 0.2))
  const at = Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0
  return {
    usd: 0,
    btc: 0,
    price,
    history: [{ elapsed: at, price }],
    rng,
  }
}

export function advanceMarket(market: MarketState, elapsed: number): MarketState {
  if (!validMarket(market) || !Number.isFinite(elapsed) || !Array.isArray(market.history)) return market
  const previous = market.history.at(-1)
  if (previous === undefined || !Number.isFinite(previous.elapsed) || !Number.isFinite(previous.price)) return market
  const at = Math.max(0, Math.floor(elapsed))
  if (at <= previous.elapsed) return market

  let rng = market.rng >>> 0
  let eventRoll: number
  ;[rng, eventRoll] = nextRandom(rng)
  let noiseA: number
  ;[rng, noiseA] = nextRandom(rng)
  let noiseB: number
  ;[rng, noiseB] = nextRandom(rng)

  const elapsedGap = Math.max(1, at - previous.elapsed)
  const timeScale = Math.min(3, Math.sqrt(elapsedGap))
  const brownian = ((noiseA - 0.5) + (noiseB - 0.5)) * 0.035 * timeScale
  const move = eventRoll < 0.045
    ? (noiseA < 0.5 ? -1 : 1) * (0.12 + noiseB * 0.24) * timeScale
    : brownian
  const price = boundedPrice(previous.price * (1 + Math.max(-0.8, Math.min(0.8, move))))
  const point = { elapsed: at, price }
  const history = market.history.length >= HISTORY_LIMIT
    ? [...market.history.slice(-(HISTORY_LIMIT - 1)), point]
    : [...market.history, point]

  return { ...market, price, history, rng }
}

export function tradeMarket(market: MarketState, side: 'buy' | 'sell', amount: number): MarketState {
  if (!validMarket(market) || !Number.isFinite(amount) || amount <= 0) return market

  if (side === 'buy') {
    if (amount > market.usd) return market
    const btcReceived = amount / market.price
    const usd = market.usd - amount
    const btc = market.btc + btcReceived
    if (!Number.isFinite(btcReceived) || !Number.isFinite(usd) || !Number.isFinite(btc) || usd >= market.usd || btc <= market.btc || usd < -EPSILON || btc < 0) return market
    return { ...market, usd: usd < 0 ? 0 : usd, btc }
  }

  if (side === 'sell') {
    if (amount > market.btc) return market
    const usdReceived = amount * market.price
    const usd = market.usd + usdReceived
    const btc = market.btc - amount
    if (!Number.isFinite(usdReceived) || !Number.isFinite(usd) || !Number.isFinite(btc) || usd <= market.usd || btc >= market.btc || usd < 0 || btc < -EPSILON) return market
    return { ...market, usd, btc: btc < 0 ? 0 : btc }
  }

  return market
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
