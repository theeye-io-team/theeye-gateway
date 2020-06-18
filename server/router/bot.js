const express = require('express')
const mongoose = require('mongoose')
const format = require('util').format
const logger = require('../logger')('router:bot')
const CredentialsConstants = require('../constants/credentials')

module.exports = (app) => {
  const router = express.Router()

  router.get('/credentials', async (req, res, next) => {
    try {
      const session = req.session

      let agentMember = await app.models.member.findOne({
        credential: CredentialsConstants.AGENT,
        customer_id: session.customer_id
      })

      let agentPassport = await app.models.passport.findOne({
        protocol: 'local',
        user_id: agentMember.user_id
      })

      if (!agentPassport || (!agentMember && !agentMember.user_id)) {
        let err = new Error('Error getting agent credentials.')
        err.statusCode = 500
        throw err
      }

      let botAgent = {
        customer_name: agentMember.customer_name,
        client_id: agentPassport.identifier,
        client_secret: agentPassport.tokens.refresh_token
      }

      botAgent.customer_name = agentMember.customer_name

      botAgent.curl = format(
        'curl -s "%s" | bash -s "%s" "%s" "%s" "%s"',
        app.config.agent.installer.linux.url,
        botAgent.client_id,
        botAgent.client_secret,
        botAgent.customer_name,
        app.config.supervisor.url
      )

      botAgent.windowsCurl = format(
        'powershell -command "& {&"Invoke-WebRequest" -uri "%s" -outFile agent-installer.ps1}" && powershell.exe -ExecutionPolicy ByPass -File agent-installer.ps1 "%s" "%s" "%s" "%s"',
        app.config.agent.installer.windows.url,
        botAgent.client_id,
        botAgent.client_secret,
        botAgent.customer_name,
        app.config.supervisor.url
      )

      botAgent.dockerCurl = format(
        'docker run --name "%s" -e NODE_ENV="production" -e THEEYE_SUPERVISOR_CLIENT_ID="%s" -e THEEYE_SUPERVISOR_CLIENT_SECRET="%s"  -e THEEYE_SUPERVISOR_CLIENT_CUSTOMER="%s"  -e THEEYE_SUPERVISOR_API_URL="%s" -e THEEYE_CLIENT_HOSTNAME="%s" -d interactar/theeye-agent',
        botAgent.customer_name,
        botAgent.client_id,
        botAgent.client_secret,
        botAgent.customer_name,
        app.config.supervisor.url,
        botAgent.customer_name
      )

      botAgent.awsCurl = format(
        '#!/bin/bash \n hostnamectl set-hostname %s-aws \n curl -s "%s" | bash -s "%s" "%s" "%s" "%s"',
        botAgent.customer_name,
        app.config.agent.installer.linux.url,
        botAgent.client_id,
        botAgent.client_secret,
        botAgent.customer_name,
        app.config.supervisor.url
      )

      res.status(200).json(botAgent)
    } catch (err) {
      logger.error(err)
      let message = err.message || 'Internal Server Error'
      let statusCode = err.statusCode || 500
      res.status(statusCode)
      res.json({ message, statusCode })
    }
  })

//  router.post('/launch', () => {
//		let bot_launcher = app.config.integration.bot_launcher
//        
//		let payload = {
//			task: autobot.task_id,
//			task_arguments: [
//				{ order: 0, value: agent.client_id },
//				{ order: 1, value: agent.client_secret },
//				{ order: 2, value: customer_name },
//				{ order: 3, value: sails.config.supervisor.url },
//				{ order: 4, value: customer_name },
//				{ order: 5, value: 'latest' }
//			] 
//		}
//
//"task_arguments":["'${client id}'","'${client secret}'","'${customer}'","'${supervisor url}'","'${client hostname}'","'${agent branch}'","'${volume mount point}'","'${client port}'"]
//
//        // execute integration task
//        supervisor.client_customer = autobot.task_customer
//        supervisor.create({
//          route: autobot.task_exec_path,
//          body: payload,
//          success: job => res.send(200, job),
//          failure: err => res.send(err.statusCode, err)
//        })
//      } 
//    ) 
//  })

  return router
}
