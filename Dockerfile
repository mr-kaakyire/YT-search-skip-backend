FROM node:20-alpine

WORKDIR /app

ARG GEMINI_API_KEY

ENV GEMINI_API_KEY=$GEMINI_API_KEY

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
