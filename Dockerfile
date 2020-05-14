FROM node:10

MAINTAINER Facundo Gonzalez <facugon@theeye.io>

ENV workdir /src/theeye/gateway
RUN mkdir -p ${workdir}
COPY . ${workdir}

RUN cd ${workdir}; npm install

EXPOSE 8080

CMD ["node","/src/theeye/gateway/server"]
