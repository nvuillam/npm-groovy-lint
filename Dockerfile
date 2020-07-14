FROM alpine:3.12@sha256:a15790640a6690aa1730c38cf0a440e2aa44aaca9b0e8931a9f2b0d7cc90fd65

ARG VERSION

RUN apk add --update \
    bash \
    dos2unix \
    nodejs \
    npm \
    openjdk8

RUN npm i -g npm-groovy-lint@$VERSION

ENTRYPOINT "npm-groovy-lint"
