#!/bin/bash

#NODE_ENV=comefa DEBUG=*eye* npx nodemon --ignore ./client ${1} server/

THEEYE_CONFIG_ENCRYPTED="true" \
THEEYE_CONFIG_ENCRYPTED_FILENAME=$PWD/server/config/dev.json.enc \
THEEYE_CONFIG_ENCRYPTED_SECRET="7d571e7a5e4d9375cf5ec6360247ee018648efe1eccba5894ee6659db626b5dd" \
THEEYE_CONFIG_ENCRYPTED_ALGORITHM="aes-256-ctr" \
THEEYE_CONFIG_ENCRYPTED_IV="6c888d53cd9e5d32d4a428777e6a35e0" \
DEBUG=*eye* NODE_ENV=dev \
npx nodemon --ignore ./client ${1} server/


#NODE_ENV=dev DEBUG=*theeye:log:router* npx nodemon ${1} server/
