'use strict'

const { showSpinner } = require('../utils')

module.exports = async (instance) => {
  await showSpinner('initializing jsreport instance in project', async ({ success, fail }) => {
    try {
      if (instance.options.logger) {
        instance.options.logger.silent = true
      } else {
        instance.options.logger = {
          silent: true
        }
      }

      if (instance.options.scheduling) {
        instance.options.scheduling.autoStart = false
      } else {
        instance.options.scheduling = {
          autoStart: false
        }
      }

      await instance.init()
      success('jsreport instance initialized')
    } catch (e) {
      fail()

      let msg = 'An error has occurred when trying to initialize jsreport..'

      if (e.code === 'EADDRINUSE') {
        msg += ` seems like there is already a server running in port: ${e.port}`
      }

      e.message = `${msg} ${e.message}`

      throw e
    }
  })
}
