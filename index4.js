require('dotenv-safe').config()
require('module-alias/register')
require('@/helpers/global-helpers.js')
require('@/models/index.js')

const roundRunner = require('./round-runner.js')
setInterval(roundRunner, 1000)

const placeBetRunner = require('./place-bet-runner.js')
setInterval(placeBetRunner, 80e3)

const getBetResultRunner = require('./get-bet-result-runner.js')
setInterval(getBetResultRunner, 120e3)
