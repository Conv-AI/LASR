# ConvAI Live Speech Recognition

## Commands

Run `$ npm install` then `$ node server.js`

## Running the service as a Docker container :
### 1. Building the Docker image :
 Run `sudo docker build -t lasr_image . `
### 2. Running the Docker image in the container :
 Run `sudo docker run -p 8009:8009 --name lasr_container -d lasr_image` 
### 3. go to `https://localhost:8009/`