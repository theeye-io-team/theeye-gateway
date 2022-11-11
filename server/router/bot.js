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

  router.get('/installer', async (req, res, next) => {
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

      const botAgent = {
        customer_name: agentMember.customer_name,
        client_id: agentPassport.identifier,
        client_secret: agentPassport.tokens.refresh_token,
        downloads: app.config.downloads.agent
      }

      res.status(200).json(botAgent)
    } catch (err) {
      next(err)
    }
  })

  router.get('/credentials', async (req, res, next) => {
    try {
      const session = req.session

      const agentMember = await app.models.member.findOne({
        credential: CredentialsConstants.AGENT,
        customer_id: session.customer_id
      })

      if (!agentMember || !agentMember.user_id) {
        throw new ServerError('Credentials Not Available.')
      }

      const agentPassport = await app.models.passport.findOne({
        protocol: PassportConstants.PROTOCOL_LOCAL,
        user_id: agentMember.user_id
      })

      if (!agentPassport || (!agentMember && !agentMember.user_id)) {
        throw new ServerError('Credentials Not Available.')
      }

      const botAgent = {
        supervisor: {
          api_url: app.config.supervisor.url,
          client_id: agentPassport.identifier,
          client_secret: agentPassport.tokens.refresh_token,
          client_customer: agentMember.customer_name,
          client_hostname: agentMember.customer_name,
        }
      }

      res.json(botAgent)
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
