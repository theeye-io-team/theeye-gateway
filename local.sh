#!/bin/bash

#NODE_ENV=comefa DEBUG=*eye* npx nodemon --ignore ./client ${1} server/
if [ -z "${DEBUG}" ]; then
  export DEBUG="*eye*err*"
fi

if [ -z "${NODE_ENV}" ]; then
  export NODE_ENV="dev"
fi

npx nodemon --ignore ./client ${1} server/

#NODE_ENV=dev DEBUG=*theeye:log:router* npx nodemon ${1} server/
