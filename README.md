
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

## Development

to navigate web client in local environment, clone theeye web https://github.com/theeye-io/web into the client directory. 

statics files will be served in localhost:6080
