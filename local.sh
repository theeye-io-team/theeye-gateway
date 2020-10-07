#!/bin/bash

NODE_ENV=dev DEBUG=*eye* npx nodemon ${1} server/
#NODE_ENV=dev DEBUG=*theeye:log:router* npx nodemon ${1} server/
