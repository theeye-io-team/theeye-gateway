const express = require('express')
const mongoose = require('mongoose')
const format = require('util').format
const logger = require('../logger')('router:bot')
const ensureCredentialMiddleware = require ('./credentialMiddleware')
const { ClientError, ServerError } = require('../errors')
const CredentialsConstants = require('../constants/credentials')
const PassportConstants = require('../constants/passport')
const got = require('got')

module.exports = (app) => {
  const router = express.Router()

  router.get('/credentials', async (req, res, next) => {
    try {
      const session = req.session

      let agentMember = await app.models.member.findOne({
        credential: CredentialsConstants.AGENT,
        customer_id: session.customer_id
      })

      if (!agentMember || !agentMember.user_id) {
        throw new ServerError('Bot Agent Not Available.')
      }

      let agentPassport = await app.models.passport.findOne({
        protocol: PassportConstants.PROTOCOL_LOCAL,
        user_id: agentMember.user_id
      })

      if (!agentPassport || (!agentMember && !agentMember.user_id)) {
        throw new ServerError('Bot Agent Credentials Not Available.')
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
        app.config.supervisor.public_url
      )

      botAgent.windowsCurl = format(
        'powershell -command "& {&"Invoke-WebRequest" -uri "%s" -outFile agent-installer.ps1}" && powershell.exe -ExecutionPolicy ByPass -File agent-installer.ps1 "%s" "%s" "%s" "%s"',
        app.config.agent.installer.windows.url,
        botAgent.client_id,
        botAgent.client_secret,
        botAgent.customer_name,
        app.config.supervisor.public_url
      )

      botAgent.dockerCurl = format(
        'docker run --name "%s" -e NODE_ENV="production" -e THEEYE_SUPERVISOR_CLIENT_ID="%s" -e THEEYE_SUPERVISOR_CLIENT_SECRET="%s"  -e THEEYE_SUPERVISOR_CLIENT_CUSTOMER="%s"  -e THEEYE_SUPERVISOR_API_URL="%s" -e THEEYE_CLIENT_HOSTNAME="%s" -d interactar/theeye-agent',
        botAgent.customer_name,
        botAgent.client_id,
        botAgent.client_secret,
        botAgent.customer_name,
        app.config.supervisor.public_url,
        botAgent.customer_name
      )

      botAgent.awsCurl = format(
        '#!/bin/bash \n hostnamectl set-hostname %s-aws \n curl -s "%s" | bash -s "%s" "%s" "%s" "%s"',
        botAgent.customer_name,
        app.config.agent.installer.linux.url,
        botAgent.client_id,
        botAgent.client_secret,
        botAgent.customer_name,
        app.config.supervisor.public_url
      )

      res.status(200).json(botAgent)
    } catch (err) {
      next(err)
    }
  })

  router.post('/launcher', ensureCredentialMiddleware.root(), async (req, res, next) => {
    try {
      const bot_launcher = app.config.integration.bot_launcher
      const session = req.session

      let agentMember = await app.models.member.findOne({
        credential: CredentialsConstants.AGENT,
        customer_id: session.customer_id
      })

      if (!agentMember || !agentMember.user_id) {
        throw new ServerError('Bot Agent Not Available.')
      }

      let agentPassport = await app.models.passport.findOne({
        protocol: PassportConstants.PROTOCOL_LOCAL,
        user_id: agentMember.user_id
      })

      if (!agentPassport) {
        throw new ServerError('Bot Agent Credentials Not Available.')
      }

      let payload = {
        task_arguments: [
          agentPassport.identifier, // client id
          agentPassport.tokens.refresh_token, // client secret
          agentMember.customer_name, // customer name
          app.config.supervisor.url,
          agentMember.customer_name, // hostname
          req.body.branch || 'latest', // branch or tag
          req.body.mount || `/mnt/theeye/${agentMember.customer_name}_agent`,
          req.body.port || '6000'
        ]
      }

      let response = await got.post(bot_launcher.url, {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })

      res.status(200).send({})
      // execute integration task
    } catch (err) {
      next(err)
    }
  })

  return router
}
