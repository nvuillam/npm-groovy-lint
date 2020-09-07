FROM alpine:3.7

COPY . .

RUN apk add --no-cache \
bash=5 \
nodejs=14 \
npm=6 \
openjdk11=11

RUN npm i -g

ENTRYPOINT ["npm-groovy-lint"]
