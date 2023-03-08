FROM node:16
LABEL maintainers.main="Facundo Gonzalez <facugon@theeye.io>"

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

ARG APP_VERSION
ENV APP_VERSION $APP_VERSION

RUN echo "APP_VERSION=$APP_VERSION"; echo "NODE_ENV=$NODE_ENV";

ENV destDir /src/theeye/gateway

RUN mkdir -p ${destDir}
WORKDIR ${destDir}
COPY . ${destDir}

RUN cd ${destDir}; npm install

EXPOSE 6080

CMD ["npm","run","start"]
