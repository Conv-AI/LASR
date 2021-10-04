FROM node:12
LABEL maintainer="ConvAI"

WORKDIR /LASR

COPY . /LASR

RUN npm install

CMD ["node", "server.js"]
