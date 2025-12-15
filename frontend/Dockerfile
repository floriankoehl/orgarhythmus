# STEP 1: Start from NodeJS image
FROM node:20-alpine AS build

# STEP 2: Set the working directory
WORKDIR /app

# STEP 3: Copy dependency files
COPY package*.json ./

# STEP 4: Install all npm dependencies
RUN npm ci --silent

# STEP 5: Copy the rest of your React project
COPY . .

# STEP 6: Build the React project
RUN npm run build

# STEP 7: Start a new stage from the Nginx image
FROM nginx:stable-alpine

# STEP 8: Copy the build output to the Nginx HTML directory
COPY --from=build /app/dist /usr/share/nginx/html

# STEP 9: Copy the Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# STEP 10: Expose the port Nginx is reachable on
EXPOSE 80

# STEP 11: Command to run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
