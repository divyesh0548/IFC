FROM node:20 AS build

WORKDIR /app 

COPY package.json .

RUN npm install --omit=dev

COPY . .

EXPOSE 3000 

CMD ["npm","start"]