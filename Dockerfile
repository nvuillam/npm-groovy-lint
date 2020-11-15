FROM alpine:3.12

COPY . .

RUN apk add --no-cache bash nodejs npm openjdk11

RUN npm i -g

ENTRYPOINT ["npm-groovy-lint"]
