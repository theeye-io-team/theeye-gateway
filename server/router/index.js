const path = require('path')
const StatusRouter = require('./status')
const AuthRouter = require('./auth')
const SocialAuthRouter = require('./auth/social')
const EnterpriseAuthRouter = require('./auth/enterprise')
const SessionRouter = require('./session')
const InboxRouter = require('./inbox')
const BotRouter = require('./bot')
const TokenRouter = require('./token')
const MessageRouter = require('./message')
const RegistrationRouter = require('./registration')
const UserAdminRouter = require('./user/admin')
const UserInternalRouter = require('./user/internal')
const NotificationRouter = require('./notification')
const NotificationAdminRouter = require('./notification/admin')
const MemberRouter = require('./member')
const MemberAdminRouter = require('./member/admin')
const MemberInternalRouter = require('./member/internal')
const CustomerRouter = require('./customer')
const CustomerAdminRouter = require('./customer/admin')
const credentialMiddleware = require ('./credentialMiddleware')
const logger = require('../logger')('router::route')
const CompatibilityRouter = require('./compatibility')
const HelperRouter = require('./helper')

const GatewayRouter = require('./gateway')

class Router {
  constructor (app) {
    this.app = app
    let api = app.api

    const bearerMiddleware = app.service.authentication.middlewares.bearerPassport
    const internalMiddleware = app.service.authentication.middlewares.gatewayPassport

    api.use((req, res, next) => {
      if (/api./.test(req.url)) {
        logger.log('INCOMMING API REQUEST %s %s %j', req.method, req.url, req.headers)
      }
      next()
    })

    api.use('/api/auth', AuthRouter(app))
    api.use('/api/auth/enterprise', internalMiddleware, EnterpriseAuthRouter(app))
    api.use('/api/auth/social', SocialAuthRouter(app))
    api.use('/api/status', StatusRouter(app))
    api.use('/api/registration', RegistrationRouter(app))

    api.use('/helper', bearerMiddleware, HelperRouter(app))
    api.use('/api/bot', bearerMiddleware, BotRouter(app))
    api.use('/api/token', bearerMiddleware, TokenRouter(app))
    api.use('/api/inbox', bearerMiddleware, InboxRouter(app))
    api.use('/api/member', bearerMiddleware, MemberRouter(app))
    api.use('/api/session', bearerMiddleware, SessionRouter(app))
    api.use('/api/message', bearerMiddleware, MessageRouter(app))
    api.use('/api/customer', bearerMiddleware, CustomerRouter(app))
    api.use('/api/admin/user', bearerMiddleware, credentialMiddleware.root(), UserAdminRouter(app))
    api.use('/api/admin/member', bearerMiddleware, credentialMiddleware.root(), MemberAdminRouter(app))
    api.use('/api/admin/customer', bearerMiddleware, credentialMiddleware.root(), CustomerAdminRouter(app))
    api.use('/api/admin/notification', bearerMiddleware, credentialMiddleware.root(), NotificationAdminRouter(app))

    api.use('/api/notification', internalMiddleware, NotificationRouter(app))
    api.use('/api/internal/user', internalMiddleware, UserInternalRouter(app))
    api.use('/api/internal/member', internalMiddleware, MemberInternalRouter(app))

    // compatibilityRoutes
    api.use('/apiv2', bearerMiddleware, GatewayRouter(app))
    api.use('/apiv3', bearerMiddleware, GatewayRouter(app))
    api.use('/', CompatibilityRouter(app))

    // static api route
    const staticRoute = (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
    }
    api.get('/*', staticRoute)
    api.get('/admin/*', staticRoute)
    //api.get('/login', staticRoute)
    //api.get('/tokenlogin', staticRoute)
    //api.get('/logout', staticRoute)
    //api.get('/enterprise', staticRoute)
    //api.get('/dashboard', staticRoute)
    //api.get('/activate', staticRoute)
    //api.get('/register', staticRoute)
    //api.get('/finishregistration', staticRoute)
    //api.get('/passwordreset', staticRoute)
    //api.get('/sociallogin', staticRoute)
    //api.get('/admin/*', staticRoute)
  }
}

module.exports = Router
