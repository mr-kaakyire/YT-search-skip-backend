FROM nginx:alpine

# Create directories for SSL certificates
RUN mkdir -p /etc/ssl/certs/
RUN mkdir -p /etc/ssl/private/

#copy the nginx.conf file to the nginx container
COPY conf/nginx.conf /etc/nginx/nginx.conf

# Expose HTTPS port
EXPOSE 443

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]