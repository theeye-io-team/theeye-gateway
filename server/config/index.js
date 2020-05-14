
module.exports = {
  app: {
    base_url: 'http://127.0.0.1',
    port: 6080,
    secret: '692fc164a0c06a9fd02575cf17688c9e'
  },
  mongodb: {
    hosts: "127.0.0.1:27017",
    database: "theeye",
    // options are passed directly to the mongo-native driver
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  redis: {
    prefix: 'app_',
    host: '127.0.0.1',
    port: 6379
  },
  models: {
  },
  services: {
    aws: {
      username: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: ''
    },
    authentication: {
      secret: '692fc164a0c06a9fd02575cf17688c9e',
      expires: 3 * (60 * 60), // in seconds
      strategies: {
        // ldapauth: {
        //   provider: 'ActiveDirectory',
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
        //   customerName: '' // default customer name
        // }
      }
    },
    notifications: {
      email: {
        from: 'TheEye.io <support@theeye.io>',
        replyTo: 'Support <support@theeye.io>',
        only_support: false,
        include_support_bcc: false,
        support: [],
        invitation: 'contact@theeye.io',
        transport: {
          type: 'sendmail'
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
        redis: {
          host: '127.0.0.1',
          port: 6379
        }
      }
    }
  },
  supervisor: {
    timeout: 10000,
    client_id: '939e7ad87f616af22325a84b6192ba7974404160',
    client_secret: '4611b7a50f63c2bb259aa72e0b8b54ae54c326c6',
    url: 'http://127.0.0.1:60080',
    port: 60080,
    incoming_secret: '77E0EAF3B83DD7A7A4004602626446EADED31BF794956FC9BBAD051FA5A25038', // supervisor incoming requests secret passphrase
    integrations: {
      autobot: {
        task_id: '5b57a27be79f800c3ff8b52d',
        task_customer: 'demo',
        task_exec_path: '/job/secret/06eb33aaff7a7c3d897311e7e30e0cb0d685a6574b86307032d9cd611ba1fdef?customer=demo'
      }
    }
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
  activateUrl: 'http://127.0.0.1:6080/activate?'
  ///**
  // *
  // * redis options to pass directly to node redis client
  // * https://www.npmjs.com/package/redis
  // *
  // */
  ///**
  // *
  // * google recaptcha
  // *
  // */
  //grecaptcha: {
  //  v2_secret: null,
  //  v3_secret: null,
  //  url: 'https://www.google.com/recaptcha/api/siteverify'
  //},
}
