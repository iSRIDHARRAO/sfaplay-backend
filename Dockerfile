FROM node:18-alpine


WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 5000

RUN npm install sequelize-cli -y

CMD npx sequelize-cli db:migrate && node server.js

