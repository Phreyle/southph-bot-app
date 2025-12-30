# Node.js LTS
FROM node:20-alpine

# App directory inside container
WORKDIR /home/container

# Copy dependency files first (layer caching)
COPY package*.json ./

# Install only production deps
RUN npm install --production

# Copy the rest of the bot
COPY . .

# Run the bot
CMD ["node", "app.js"]
