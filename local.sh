#!/bin/bash

#NODE_ENV=comefa DEBUG=*eye* npx nodemon --ignore ./client ${1} server/

NODE_ENV=dev DEBUG=*eye* npx nodemon --ignore ./client ${1} server/

#NODE_ENV=dev DEBUG=*theeye:log:router* npx nodemon ${1} server/
