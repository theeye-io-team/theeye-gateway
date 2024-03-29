const { join } = require('path')
module.exports = {
  "app": {
    "base_url": "http://localhost:6080",
    "port": 6080,
    //"secret": "692fc164a0c06a9fd02575cf17688c9e",
    "secret": "aff9e66f88d1341b6182d7dce48b882b5898c533",
    "supportEmail": "info@theeye.io"
  },
  "mongodb": {
    "hosts": "localhost:27017",
    "database": "theeye",
    "options": {
      "useNewUrlParser": true,
      "useUnifiedTopology": true
    }
  },
  "redis": {
    "url":"redis://127.0.0.1:6379/3"
  },
  "models": {},
  "integration": {
    "bot_launcher": {
      "url": "http://127.0.0.1:60080/job/secret/d1ef702640e8a6bdaf56e452af4425727fc3750a15d26645d2ed0a4ad1f4bf9f?customer=demo&task=5eea8228aa74880dfcba2e25"
    }
  },
  "boilerplates": {
    "repo": "https://raw.githubusercontent.com/theeye-io-team/theeye-boilerplates/main/"
  },
  "services": {
    "registration": {
      "enabled": true,
      "notifyUs": true,
      "finishUrl": "http://localhost:6080/finishregistration?",
      "activateUrl": "http://localhost:6080/activate?",
      "passwordResetUrl": "http://localhost:6080/passwordreset?"
    },
    "authentication": {
      //"rs256": {
      //  // this is only for dev. use pure JSON and absolute path in prod to be able to Encrypt the configuration
      //  "pub": join(__dirname, "jwtRS256.key.pub"),
      //  "priv": join(__dirname, "jwtRS256.key")
      //},
      "secret": "2c1000c295ae613b031d3466db34ef021a5ae064", // hmac
      "jwt_verify": {
        "enable_check": true,
        "reject_login": true,
        "expired_notify": true
      },
      "expires": 86400,
      "localBypass": true,
      //"cookie": {
      //  "domain": "localhost",
      //  "sameSite": "lax",
      //  "expire": 86400,
      //  "httpOnly": true,
      //  "secure": true,
      //  "signed": true
      //},
      "strategies": {
        "ldapauth": {
          "defaultGroup": "theeye_users",
          "defaultCustomerName": "ldap",
          "provider": "ldap",
          "server": {
            "url": "ldap://127.0.0.1:10389",
            "bindDN": "cn=admin,dc=planetexpress,dc=com",
            "bindCredentials": "GoodNewsEveryone",
            "searchBase": "ou=people,dc=planetexpress,dc=com",
            "searchAttributes": [
              "uid",
              "cn",
              "mail",
              "objectClass"
            ],
            "searchFilter": "(uid={{username}})"
          },
          "fields": {
            "id": "uid",
            "name": "cn",
            "username": "uid",
            "email": "mail",
            "groups": "objectClass"
          }
        },
        "google": {
          "name": "Google",
          "options": {
            "protocol": "oauth2",
            "clientID": "212014499186-msvd283en9ltde098rq3romo2blkpr80.apps.googleusercontent.com",
            "clientSecret": "_RmCygMFw5-IHQ4y7x09Ez0m",
            "callbackURL": "http://localhost:6080/api/auth/social/google/callback",
            "scope": [
              "profile",
              "email"
            ]
          }
        },
        "googlemobile": {
          "name": "GoogleMobile",
          "options": {
            "protocol": "oauth2",
            "clientID": "",
            "scopes": [
              "profile",
              "email"
            ]
          }
        }
      }
    },
    "notifications": {
      "email": {
        "from": "%customer% TheEye.io <support@theeye.io>",
        "replyTo": "Support <support@theeye.io>",
        "only_support": false,
        "include_support_bcc": false,
        "support": [],
        "invitation": "contact@theeye.io",
        "transport": {
          "type": "smtp",
          "options": {
            "port": 6025,
            "secure": false,
            "ignoreTLS": true
          }
        },
        "message": {
          "activation": {
            "enabled": true
          },
          "customerInvitation": {
            "enabled": true
          },
          "invitation": {
            "enabled": true
          },
          "passwordRecover": {
            "enabled": true
          },
          "registration": {
            "enabled": true
          }
        }
      },
      "push": {
        "debug": false,
        "debug_filename": "/tmp/theeye-push-dump.log",
        "push_notifications": {
          "android": "",
          "ios": ""
        }
      },
      "sockets": {},
      "messages": {}
    }
  },
  "supervisor": {
    "timeout": 10000,
    "client_id": "939e7ad87f616af22325a84b6192ba7974404160",
    "client_secret": "4611b7a50f63c2bb259aa72e0b8b54ae54c326c6",
    "url": "http://localhost:60080",
    "public_url": "http://localhost:60080",
    "port": 60080,
  },
  "agent": {
    "binary": {
      "windows": {
        "url": "https://s3.amazonaws.com/theeye.agent/theEyeInstallerx64.exe",
        "name": "theEyeInstallerx64.exe"
      }
    },
    "installer": {
      "linux": {
        "url": "https://s3.amazonaws.com/theeye.agent/linux/setup.sh"
      },
      "windows": {
        "url": "https://s3.amazonaws.com/theeye.agent/windows/agent-installer.ps1",
        "schtask_url": "https://s3.amazonaws.com/theeye.agent/windows/agent-installer-schtask.ps1"
      }
    }
  },
  "downloads": {
    "agent": {
      "base_url": "http://localhost:6080/downloads",
      "linux_binary": "/linux/theeye-agent64.tar.gz",
      "linux_installer": "/linux/setup.sh",
      "windows_binary": "/windows/theeye-agent.zip",
      "windows_installer": "/windows/agent-installer.ps1",
      "windows_schtask_installer":"/windows/agent-installer-schtask.ps1",
      "docker_image": "/docker/theeye-agent.tar"
    }
  },
  "grecaptcha": {
    "enabled": false,
    "v2_secret": "",
    "url": "https://www.google.com/recaptcha/api/siteverify"
  }
}
