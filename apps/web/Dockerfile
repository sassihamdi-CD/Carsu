FROM node:20-alpine
WORKDIR /app/apps/web
COPY package.json package-lock.json* /app/apps/web/
RUN npm install --legacy-peer-deps
COPY . /app/apps/web
RUN npm install --legacy-peer-deps
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


