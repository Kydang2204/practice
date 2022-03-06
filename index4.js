require('dotenv-safe').config()
require('../../helpers/global-helpers.js')
require('../../models/index.js')
require('../jobs/event-monitor.js')

const roundRunner = require('./round-runner.js')
setInterval(roundRunner, 1000)
