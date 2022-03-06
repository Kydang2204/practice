const ethers = require('ethers')
const { provider, operator } = require('./_helper.js')
const address = process.env.ROULETTE_ADDRESS
const abi = require('./abi/Roulette.json')
const roulette = new ethers.Contract(address, abi, provider)
const SPAN = 120e3

// TODO: separate seedHash
const seedHash = ethers.utils.formatBytes32String('0x01')

module.exports.roulette = roulette

module.exports.createTable = async function () {
  const tx = await roulette.connect(operator).createTable()
  const { events: [{ data, decode }] } = await tx.wait()
  const { tableId } = decode(data)
  return {
    contractAddress: address,
    tableId: tableId.toString(),
  }
}

module.exports.getActiveTables = async function () {
  return await roulette.getActiveTables()
}

module.exports.getCurrentRound = async function (tableId) {
  const roundId = await roulette.getCurrentRound(tableId)
  const instance = await roulette.rounds(tableId, roundId)
  const startAt = instance.startAt.toNumber()
  const endAt = startAt * 1e3 + SPAN
  return { roundId: roundId.toString(), startAt, endAt }
}

module.exports.startRound = async function (tableId) {
  const currentRound = await roulette.getCurrentRound(tableId)
  const instance = await roulette.rounds(tableId, currentRound)
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

  if (startAt < 1) {
    global.debug(`Start first round (${tableId.toString()})`)
    const tx = await roulette
      .connect(operator)
      .startRound(tableId, secret, hash)
    await tx.wait()
    return
  }

  global.debug(`Start new round (${tableId.toString()})`)
  const tx = await roulette
    .connect(operator)
    .startRound(tableId, number, hash)
  await tx.wait()
}

module.exports.placeBet = async function ({
  user,
  tableId,
  betNumbers,
  betAmounts,
}) {
  const player = new ethers.Wallet(user.sunc.privateKey, provider)
  const _betNumbers = betNumbers.map((betNumber) => _bN(betNumber))
  const _betAmounts = betNumbers.map((betNumber) => _bN(betAmounts))
  const tx = await roulette.connect(player)
    .placeBet(tableId, seedHash, _betNumbers, _betAmounts, {
      gasLimit: 1000000,
    })
  await tx.wait()
}

module.exports.getBetResult = async function ({
  roundId,
  tableId,
}) {
  const instance = await roulette.rounds(tableId, roundId.toString())
  if (instance.closed) {
    const [winnerNumber] = await roulette.getWinningNumber(tableId, roundId)
    return winnerNumber.toString()
  }
  return '-1'
}

function _bN (val) {
  return ethers.BigNumber.from(val)
}
