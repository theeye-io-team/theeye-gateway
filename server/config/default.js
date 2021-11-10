const baseUrl = 'http://127.0.0.1:6080'
module.exports = {
  app: {
    base_url: baseUrl,
    port: 6080,
    secret: '692fc164a0c06a9fd02575cf17688c9e',
    supportEmail: 'info@theeye.io'
  },
  mongodb: {
    hosts: "localhost:27017",
    database: "theeye",
    // options are passed directly to the mongo-native driver
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  //
  // redis options to pass directly to node redis client
  //
  // https://www.npmjs.com/package/redis
  //
  redis: {
    host: '127.0.0.1',
    port: 6379
  },
  models: {
  },
  integration: {
    bot_launcher: {
      url: 'http://127.0.0.1:60080/job/secret/d1ef702640e8a6bdaf56e452af4425727fc3750a15d26645d2ed0a4ad1f4bf9f?customer=demo&task=5eea8228aa74880dfcba2e25'
    }
  },
  services: {
		aws: {
			username: '',
			accessKeyId: '',
			secretAccessKey: '',
			region: ''
		},
    registration: {
      enabled: false,
      notifyUs: true,
      finishUrl: baseUrl + '/finishregistration?',
      activateUrl: baseUrl + '/activate?',
      passwordResetUrl: baseUrl + '/passwordreset?'
    },
    authentication: {
      secret: '692fc164a0c06a9fd02575cf17688c9e',
      expires: 3 * (60 * 60), // in seconds
      localBypass: false,
      strategies: {
        // ldapauth: {
        //   defaultGroup: 'theeye_users',
        //   defaultCustomerName: 'ldap', // default customer name
        //   provider: 'ldap',
        //   usernameField: 'username',
        //   passReqToCallback: true,
        //   server: {
        //     url: '',
        //     bindDN: '',
        //     bindCredentials: '',
        //     searchBase: 'cn=Users,dc=theeye,dc=local',
        //     searchAttributes: ['objectSid', 'name', 'mail', 'sAMAccountName', 'memberOf'],
        //     searchFilter: '(sAMAccountName={{username}})'
        //   },
        //   fields: {
        //     id: 'sAMAccountName',
        //     name: 'name',
        //     username: 'sAMAccountName',
        //     email: 'mail',
        //     groups: 'memberOf'
        //   },
        // },
        google: {
          name: 'Google',
          options: {
            protocol: 'oauth2',
            clientID : '212014499186-msvd283en9ltde098rq3romo2blkpr80.apps.googleusercontent.com',
            clientSecret : '_RmCygMFw5-IHQ4y7x09Ez0m',
            callbackURL: 'http://localhost:6080/api/auth/social/google/callback',
            scope : ['profile', 'email']
          }
        },
        googlemobile: {
          name: 'GoogleMobile',
          options: {
            protocol: 'oauth2',
            clientID: '',
            scopes : ['profile', 'email']
          }
        }
      }
    },
    notifications: {
      email: {
        from: '%customer% TheEye.io <support@theeye.io>',
        replyTo: 'Support <support@theeye.io>',
        only_support: false,
        include_support_bcc: false,
        support: [ 'facugon@theeye.io' ],
        invitation: 'contact@theeye.io',
        transport: {
          type: 'sendmail'
        },
        /**
         *
         * global messages
         *
         */
        message: {
          activation: {
            enabled: true
          },
          customerInvitation: {
            enabled: true
          },
          invitation: {
            enabled: true
          },
          passwordRecover: {
            enabled: true
          },
          registration: {
            enabled: true
          }
        }
      },
      push: {
        debug: false,
        debug_filename: '/tmp/theeye-push-dump.log',
        push_notifications: {
          android: '',
          ios: ''
        }
      },
      sockets: {
      },
      messages: {
      }
    }
  },
  supervisor: {
    timeout: 10000,
    client_id: '939e7ad87f616af22325a84b6192ba7974404160',
    client_secret: '4611b7a50f63c2bb259aa72e0b8b54ae54c326c6',
    url: 'http://127.0.0.1:60080',
    public_url: 'http://127.0.0.1:60080'
    //port: 60080,
    secret: '77E0EAF3B83DD7A7A4004602626446EADED31BF794956FC9BBAD051FA5A25038', // supervisor incoming requests secret passphrase
  },
  agent: {
    binary: {
      windows: {
        url: 'https://s3.amazonaws.com/theeye.agent/theEyeInstallerx64.exe',
        name: 'theEyeInstallerx64.exe'
      }
    },
    installer: {
      linux: {
        url: 'https://s3.amazonaws.com/theeye.agent/linux/setup.sh',
      },
      windows: {
        url: 'https://s3.amazonaws.com/theeye.agent/windows/agent-installer.ps1'
      }
    }
  },
  ///**
  // *
  // * google recaptcha
  // *
  // */
  grecaptcha: {
    enabled: false,
    v2_secret: '',
    url: 'https://www.google.com/recaptcha/api/siteverify'
  }
}
