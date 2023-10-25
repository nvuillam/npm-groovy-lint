FROM alpine:3.18.4
WORKDIR /

ARG NPM_GROOVY_LINT_VERSION='latest'

# hadolint ignore=DL3018
RUN apk add --no-cache bash nodejs npm openjdk11 \
    && npm install npm-groovy-lint@${NPM_GROOVY_LINT_VERSION} -g

LABEL maintainer="Nicolas Vuillamy <nicolas.vuillamy@gmail.com>" \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$BUILD_REVISION \
      org.opencontainers.image.version=$BUILD_VERSION \
      org.opencontainers.image.authors="Nicolas Vuillamy <nicolas.vuillamy@gmail.com>" \
      org.opencontainers.image.url="https://github.com/nvuillam/npm-groovy-lint" \
      org.opencontainers.image.source="https://github.com/nvuillam/npm-groovy-lint" \
      org.opencontainers.image.documentation="https://nvuillam.github.io/npm-groovy-lint/" \
      org.opencontainers.image.vendor="Nicolas Vuillamy" \
      org.opencontainers.image.description="Analyze and fix your Groovy and Jenkinsfiles"

ENTRYPOINT ["npm-groovy-lint"]
