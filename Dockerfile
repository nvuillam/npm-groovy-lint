FROM alpine:3.7

COPY . .

RUN apk add --no-cache \
bash=latest \
nodejs=latest \
npm=latest \
openjdk11=latest

RUN npm i -g

ENTRYPOINT ["npm-groovy-lint"]
