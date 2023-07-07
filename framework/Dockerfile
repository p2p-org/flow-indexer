FROM --platform=linux/amd64 node:18-alpine 

WORKDIR /usr/src/app

RUN npm install -g nodemon
RUN npm install -g ts-node typescript

COPY . .
RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
