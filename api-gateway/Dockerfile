# Use official Node.js LTS image
FROM node:22

# Set working directory
WORKDIR /usr/src/app

# Copy dependency files first
COPY package*.json ./

# Install only production dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Set environment variable for port
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the gateway
CMD ["node", "index.js"]
