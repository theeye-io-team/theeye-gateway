const express = require('express')
const mongoose = require('mongoose')
const format = require('util').format
const logger = require('../logger')('router:bot')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/agent',
    async (req, res, next) => {
      try {
        const session = req.session

        let agentMember = await app.models.member.findOne({
          credential: 'agent',
          customer_id: mongoose.Types.ObjectId(session.customer_id)
        })

        if (!agentMember && !agentMember.user_id) { res.status(500).json({ message: "Error getting agent credentials." }) }

        let agentPassport = await app.models.passport.findOne({
          protocol: 'local',
          user_id: mongoose.Types.ObjectId(agentMember.user_id)
        })

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

        return res.status(200).json({ user: botAgent })
      } catch (err) {
        logger.error(err)
        res.status(500).json({ message:'Error getting agent credentials.' })
      }

    }
  )

  return router
}
