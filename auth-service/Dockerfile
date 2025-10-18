# Use official Node.js LTS image
FROM node:22

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the rest of the application
COPY . .

# Set environment variable for PORT
ARG PORT=3001
ENV PORT=${PORT}

# Expose the service port
EXPOSE ${PORT}

# Start the app
CMD ["node", "index.js"]
