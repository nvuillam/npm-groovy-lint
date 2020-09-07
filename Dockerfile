FROM alpine:3.12

COPY . .

RUN apk add --no-cache \
bash=5.0.17-r0 \
nodejs=12.18.3-r0 \
npm=12.18.3-r0 \
openjdk11=11.0.8_p10-r0

RUN npm i -g

ENTRYPOINT ["npm-groovy-lint"]
