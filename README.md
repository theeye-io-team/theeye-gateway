
# The Gate

This repo contains

```

https://github.com/theeye-io/api_gateway
|
+-- client/ # development. web static assets dist
   |
   +-- empty
+-- package.json
+-- package-lock.json
+-- task-definition.json #AWS CI
+-- buildspec.yml #AWS CI

+-- server/
    |
    +--app.js
    +--config/
    +--index.js
    +--logger.js
    +--models/
    +--router/
    +--services/


```


to start the API

`DEBUG=*eye* node  server/`

## AWS CI


## Development

to navigate web client in local environment, clone theeye web https://github.com/theeye-io/web into the client directory. 

statics files will be served at localhost:6080

### Start development

`DEBUG=*eye* node server/`


### Generate JWT RS256 keys

[https://gist.github.com/ygotthilf/baa58da5c3dd1f69fae9]()

ssh-keygen -t rsa -b 1024 -m PEM -f jwtRS256.key
# Don't add passphrase
openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
cat jwtRS256.key
cat jwtRS256.key.pub
