FROM alpine

COPY . .

RUN apk add --update --no-cache \
    bash \
    nodejs \
    npm \
    openjdk11

RUN npm i -g

ENTRYPOINT ["npm-groovy-lint"]
