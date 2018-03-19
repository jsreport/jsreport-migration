'use strict'

const path = require('path')
const semver = require('semver')
const { showSpinner } = require('../utils')

module.exports = async (cwd) => {
  // configure jsreport to return an instance
  process.env.JSREPORT_CLI = true

  console.log(`checking jsreport installation at: ${cwd}`)

  const requiredVersion = '1.10.x'
  let jsreportModule
  let jsreportInstance

  const instance = await showSpinner(
    'verifying jsreport installation',
    async ({ success, fail }) => {
      try {
        jsreportModule = require(require.resolve(path.join(cwd, 'node_modules', 'jsreport')))
      } catch (e) {
        fail()

        if (e.code === 'MODULE_NOT_FOUND') {
          throw new Error([
            'jsreport not found installed in project. ',
            'are you sure that you are running the migration in a jsreport project directory?. ',
            'if yes, make sure to run "npm install" first.'
          ].join(''))
        } else {
          throw e
        }
      }

      try {
        jsreportInstance = require(require.resolve(path.join(cwd, 'server.js')))
      } catch (e) {
        fail()

        if (e.code === 'MODULE_NOT_FOUND') {
          throw new Error([
            `jsreport entry file "server.js" not found. `,
            'are you sure that you are running the cli in a jsreport project directory created by "jsreport init" command?.'
          ].join(''))
        } else {
          throw e
        }
      }

      if (!isJsreportInstance(jsreportInstance, jsreportModule)) {
        fail()

        throw new Error([
          'jsreport entry file "server.js" is not returning a jsreport instance. ',
          'are you sure that you are running the cli on a jsreport project directory created by "jsreport init" command?.'
        ].join(''))
      }

      if (!semver.satisfies(jsreportInstance.version, requiredVersion)) {
        fail()

        throw new Error([
          `jsreport version found in project (${jsreportInstance.version}) does not match with the latest jsreport v1 version (${requiredVersion}). `,
          'make sure to update your project and check it works with latest jsreport v1 version first before running the migration. ',
          `easy way to update is to run "npm install jsreport@${requiredVersion} --save" command in your project.`
        ].join(''))
      }

      success(`jsreport installation is ok. version found: ${jsreportInstance.version}`)

      return jsreportInstance
    }
  )

  return instance
}

function isJsreportInstance (instance, jsreportModule) {
  if (!instance) {
    return false
  }

  return instance instanceof jsreportModule.Reporter
}
