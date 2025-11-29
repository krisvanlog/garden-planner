FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Expose port 80
EXPOSE 80

# Start the server
CMD ["npm", "start"]
