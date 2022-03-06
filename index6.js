const ethers = require('ethers')
const erc20Abi = require('./abi/ERC20.json')
const rouletteAbi = require('./abi/Roulette.json')
const { gameProvider, gameOperator } = require('./_helper.js')
const SPAN = 120e3

// TODO: separate seedHash
const seedHash = ethers.utils.formatBytes32String('0x01')

let gameErc20, roulette
;(async () => {
  const address = process.env.ROULETTE_ADDRESS
  roulette = new ethers.Contract(address, rouletteAbi, gameProvider)
  const token = await roulette.token()
  gameErc20 = new ethers.Contract(token, erc20Abi, gameProvider)
})()

module.exports.balanceOf = async function (user) {
  if (user?.sunc?.address) {
    return await gameErc20.balanceOf(user.sunc.address)
  }
  return 0
}

module.exports.createTable = async function () {
  const tx = await roulette.connect(gameOperator).createTable()
  const { events: [{ data, decode }] } = await tx.wait()
  const { tableId } = decode(data)
  return {
    contractAddress: roulette.address,
    tableId: tableId.toString(),
  }
}

module.exports.getActiveTables = async function () {
  return await roulette.getActiveTables()
}

module.exports.getCurrentRound = async function (tableId) {
  const roundId = await roulette.getCurrentRound(tableId)
  const instance = await getRoundInstance({ tableId, roundId })
  const startAt = instance.startAt.toNumber()
  const endAt = startAt * 1e3 + SPAN
  return { roundId: roundId.toString(), startAt, endAt }
}

module.exports.startRound = async function (tableId) {
  const currentRound = await roulette.getCurrentRound(tableId)
  const instance = await getRoundInstance({ roundId: currentRound, tableId })
  const startAt = instance.startAt.toNumber()
  const endAt = startAt * 1e3 + SPAN

  if (endAt > Date.now()) {
    const remain = Math.round((endAt - Date.now()) / 1e3)
    global.debug(`Remain: ${remain}s (${tableId.toString()} - ${currentRound})`)
    return
  }

  const secret = instance.secretValue
  const number = ethers.BigNumber.from(tableId)
  const hash = await roulette.getHash(number)

  let result = null
  if (startAt < 1) {
    global.debug(`Start first round (${tableId.toString()})`)
    const tx = await roulette
      .connect(gameOperator)
      .startRound(tableId, secret, hash)
    result = await tx.wait()
  }

  // global.debug(`Start new round (${tableId.toString()})`)
  // const tx = await roulette
  //   .connect(operator)
  //   .startRound(tableId, number, hash, {
  //     gasLimit: 1000000,
  //   })
  // result = await tx.wait()
  
  return result
}

module.exports.placeBet = async function ({
  user,
  tableId,
  betNumbers,
  betAmounts,
}) {
  const player = new ethers.Wallet(user.sunc.privateKey, gameProvider)
  const _betNumbers = betNumbers.map((betNumber) => _bN(betNumber))
  const _betAmounts = betAmounts.map((betAmount) => _bN(betAmount))
  const tx = await roulette.connect(player)
    .placeBet(tableId, seedHash, _betNumbers, _betAmounts, {
      gasLimit: 1000000,
    })
  const result = await tx.wait()
  return result
}

module.exports.getBetResult = async function ({
  roundId,
  tableId,
}) {
  const instance = await getRoundInstance({ roundId, tableId })
  if (instance.closed) {
    const [winnerNumber] = await roulette.getWinningNumber(tableId, roundId)
    return winnerNumber.toNumber()
  }
  return '-1'
}

module.exports.getBetWinners = async function ({
  roundId,
  tableId,
}) {
  const result = await roulette.getWinners(tableId, roundId)
  let [
    accounts,
    numbers,
    amounts,
    indexes,
    status,
  ] = result

  numbers = numbers.map(number => number.toString())
  amounts = amounts.map(amount => amount.toNumber())
  indexes = indexes.map(index => index.toNumber())

  return {
    accounts,
    numbers,
    amounts,
    indexes,
    status,
  }
}

module.exports.getEnPrisonBets = async function ({
  roundId,
  tableId,
}) {
  const result = await roulette.getEnPrisonBets(tableId, roundId)
  let [
    accounts,
    numbers,
    amounts,
    indexes,
    status,
  ] = result

  numbers = numbers.map(number => number.toString())
  amounts = amounts.map(amount => amount.toNumber())
  indexes = indexes.map(index => index.toNumber())

  return {
    accounts,
    numbers,
    amounts,
    indexes,
    status,
  }
}

const getRoundInstance = async function ({
  roundId,
  tableId,
}) {
  const instance = await roulette.rounds(tableId, roundId)
  return instance
}

module.exports.getRoundInstance = getRoundInstance

function _bN (val) {
  return ethers.BigNumber.from(val)
}
