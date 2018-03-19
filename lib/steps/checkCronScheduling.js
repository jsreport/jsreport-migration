'use strict'

const inquirer = require('inquirer')
const { showSpinner, showWarn } = require('../utils')

module.exports = async (jsreportInstance) => {
  console.log('checking scheduling extension usage in project')

  const schedulesCollection = jsreportInstance.documentStore.collection('schedules')

  const invalidSchedules = await showSpinner('searching schedules in store', async ({ stop, success, fail }) => {
    try {
      const entities = await schedulesCollection.find()

      if (entities.length === 0) {
        success('no schedules found to migrate')
        return
      }

      const invalid = {
        badFormat: [],
        badMonth: []
      }

      const getValidCronRegExp = () => {
        return /^([^\s]+[\s]+)([^\s]+[\s]+)([^\s]+[\s]+)([^\s]+[\s]+)([^\s]+[\s]*)([^\s]+[\s]*)?$/
      }

      entities.forEach((sched) => {
        const cronRegExp = getValidCronRegExp()
        let results = cronRegExp.exec(sched.cron)

        if (results == null) {
          return invalid.badFormat.push({
            schedule: sched
          })
        }

        results = results.slice(1)

        const hasFiveSlots = results[results.length - 1] == null
        let month

        if (hasFiveSlots) {
          // 5 slots cron expr
          month = results[3]
        } else {
          // 6 slots cron expr
          month = results[4]
        }

        if (month == null) {
          return
        }

        month = month.trim()
        month = parseInt(month, 10)

        if (isNaN(month)) {
          // no need to update
          return
        }

        let newCron

        if (hasFiveSlots) {
          newCron = `${results[0].trim()} ${results[1].trim()} ${results[2].trim()} ${month + 1} ${results[4].trim()}`
        } else {
          newCron = `${results[0].trim()} ${results[1].trim()} ${results[2].trim()} ${results[3].trim()} ${month + 1} ${results[5].trim()}`
        }

        invalid.badMonth.push({
          schedule: sched,
          newCron: newCron
        })
      })

      if (
        invalid.badFormat.length === 0 &&
        invalid.badMonth.length === 0
      ) {
        success('no schedules found that need updates')
        return
      }

      stop()
      return invalid
    } catch (e) {
      fail()
      throw e
    }
  })

  if (
    invalidSchedules == null ||
    (
      invalidSchedules &&
      invalidSchedules.badFormat.length === 0 &&
      invalidSchedules.badMonth.length === 0
    )
  ) {
    return
  }

  if (invalidSchedules.badMonth.length > 0) {
    console.log([
      `you have ${invalidSchedules.badMonth.length} schedule(s) stored that need updates in month format. `,
      `jsreport v2 has some changes about the month format of cron expressions of schedules. `,
      `month format is changed from "0-11" to "1-12" to match standard cron expressions.`
    ].join(''))

    const result = await inquirer.prompt([{
      type: 'list',
      name: 'cronMonth',
      message: 'please choose what would you want to do in order to continue',
      choices: [{
        name: 'change my schedules to the new cron month format',
        value: 'migrate'
      }, {
        name: 'i want to review my schedules and migrate them manually',
        value: 'skip'
      }],
      default: 0
    }])

    if (result.cronMonth === 'skip') {
      showWarn(`you will need to update the following schedules manually: ${
        invalidSchedules.badMonth.map(s => `"${s.schedule.name}"`).join(', ')
      }`)

      await inquirer.prompt([{
        type: 'input',
        name: 'cronMonthSkipConfirmation',
        message: 'PRESS ENTER TO CONTINUE..',
        filter: (inp) => {
          return ''
        },
        transformer: (inp) => {
          return ''
        }
      }])
    } else {
      await showSpinner('updating schedules in store', async ({ success, fail }) => {
        try {
          const schedulesToMigrate = invalidSchedules.badMonth

          await Promise.all(schedulesToMigrate.map((toMigrate) => {
            return schedulesCollection.update({
              _id: toMigrate.schedule._id
            }, {
              $set: { cron: toMigrate.newCron }
            })
          }))

          success(`schedules month format migration completed. ${schedulesToMigrate.length} schedule(s) migrated`)
        } catch (e) {
          fail()
          throw e
        }
      })
    }
  }

  if (invalidSchedules.badFormat.length > 0) {
    showWarn([
      `you have ${invalidSchedules.badFormat.length} schedule(s) stored that contains invalid cron format. `,
      `jsreport v2 now validates that schedules contain cron expressions with at least 5 or 6 parts in the string. `,
      `you will need to check the following schedules (${
        invalidSchedules.badFormat.map(s => `"${s.schedule.name}"`).join(', ')
      }) and update them manually.`
    ].join(''))

    await inquirer.prompt([{
      type: 'input',
      name: 'cronBadFormatConfirmation',
      message: 'PRESS ENTER TO CONTINUE..',
      filter: (inp) => {
        return ''
      },
      transformer: (inp) => {
        return ''
      }
    }])
  }
}
