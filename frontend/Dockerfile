# STEP 1: Start from NodeJS image
FROM node:20-alpine

# STEP 2: Set the working directory
WORKDIR /app

# STEP 3: Copy dependency files
COPY package*.json ./

# STEP 4: Install all npm dependencies
RUN npm install

# STEP 5: Copy the rest of your React project
COPY . .

# STEP 6: Set environment variable so Vite binds to all IPs
ENV HOST=0.0.0.0

# STEP 7: Tell Docker which port we’ll use
EXPOSE 5173

# STEP 8: Command to start your React dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
