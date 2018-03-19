'use strict'

const util = require('util')
const ora = require('ora')
const npmInstallPkg = util.promisify(require('npm-install-package'))

async function showSpinner (msg, work) {
  const spinner = ora(msg).start()

  const result = await work({
    text: (newText, append = false) => {
      if (append) {
        spinner.text = spinner.text + newText
      } else {
        spinner.text = newText
      }
    },
    stop: spinner.stop.bind(spinner),
    success: spinner.succeed.bind(spinner),
    warn: spinner.warn.bind(spinner),
    fail: spinner.fail.bind(spinner)
  })

  return result
}

function showInfo (msg) {
  ora().info(msg)
}

function showWarn (msg) {
  ora().warn(msg)
}

function showSuccess (msg) {
  ora().succeed(msg)
}

function showFailure (msg) {
  ora().fail(msg)
}

async function npmInstall (pkg) {
  return npmInstallPkg(pkg, {
    save: true,
    silent: true
  })
}

module.exports.showSpinner = showSpinner
module.exports.showInfo = showInfo
module.exports.showWarn = showWarn
module.exports.showSuccess = showSuccess
module.exports.showFailure = showFailure
module.exports.npmInstall = npmInstall
