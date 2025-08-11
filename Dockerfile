
# Use a Node.js 20 base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Declare GEMINI_API_KEY as a build argument that can be passed to the build process
ARG GEMINI_API_KEY

# Set GEMINI_API_KEY as an environment variable inside the container
# This makes it available to your application at runtime.
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Copy package.json and package-lock.json to the container
COPY package.json package-lock.json ./

# Install dependencies, skipping dev dependencies
RUN npm ci --only=production

# Copy the rest of your application code
COPY . .

# Expose the port your application listens on
EXPOSE 3000

# Define the command to run your application when the container starts
CMD ["npm", "start"]
