module.exports = {
  "openapi": "3.0.0",
  "info": {
    "version": "0.0.0",
    "title": "Gateway",
    "description": "TheEye Gateway API",
    "license": {
      "name": "MIT",
      "url": "https://opensource.org/licenses/MIT"
    }
  },
  "schemes": ["http"],
  "consumes": ["application/json"],
  "produces": ["application/json"],
  "host": "localhost:6080",
  "basePath": "/api",
  "components": {
    "securitySchemes": {
      "basicAuth": {
        "type": "http",
        "scheme": "basic"
      },
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    },
    "responses": {
      "UnauthorizedError": {
        "description": "Authentication information is missing or invalid",
        "headers": {
          "WWW_Authenticate": {
            "schema": {
              "type": "string"
            }
          }
        }
      }
    }
  },
  "tags": [
    { "name": "auth" },
    { "name": "enterprice auth" },
    { "name": "public auth" },
    { "name": "notification" },
    { "name": "registration" },
    { "name": "status" },
    { "name": "bot" },
    { "name": "token" },
    { "name": "inbox" },
    { "name": "member" },
    { "name": "session" },
    { "name": "message" },
    { "name": "customer" },
    { "name": "admin customer" },
    { "name": "admin member" },
    { "name": "admin notification" }
  ],
  "paths": {
    "/auth/login": {
      "post": {
        "security": [{
          "basicAuth": []
        }],
        "tags": ["auth"],
        "summary": "basic authentication using username/email and password",
        "responses": {
          "200": {
            "description": "OK"
          },
          "401": {
            "$ref": "#/components/responses/UnauthorizedError"
          }
        }
      }
    },
    "/auth/login/local": {
      "post": {
        "tags": ["auth"],
        "security": [{
          "basicAuth": []
        }],
        "summary": "basic authentication using username/email and password",
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/auth/password/recover": {
      "post": {
        "tags": ["auth"],
        "summary": "request password recovery link",
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/auth/password/recoververify": {
      "get": {
        "tags": ["auth"],
        "summary": "request password recovery link",
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "definitions": {
    "accessToken": {
      "properties": {
        "access_token": {
          "type": "string"
        },
        "credential": {
          "type": "string"
        }
      }
    },
    "credentials": {
      "properties": {
        "username": {
          "type": "string"
        },
        "password": {
          "type": "string"
        }
      }
    }
  }
}
