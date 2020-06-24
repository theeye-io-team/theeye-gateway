
# TheEye Api Gateway

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
