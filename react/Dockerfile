FROM node:12.18.1-alpine3.10

WORKDIR /app/react

#enable hot-reloading
ENV CHOKIDAR_USEPOLLING=true

COPY ./package.json .
RUN npm install 

CMD ["npm", "start"] 