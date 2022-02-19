# **ConvAI Live Speech Recognition**

ConvAI Live Speech Recogniton provides real time transcriptions for users using AI models trained on custom data that suits the business needs of its users.

&nbsp;

How to set-up ConvAI LASR
=========================

**1.** Clone this repository
-----------------------------

```
$ git clone https://github.com/Conv-AI/LASR.git

$ cd LASR
```

&nbsp;

**2.** Configuring parameters for the service
---------------------------------------------
You can specify the port to start the application on in the ```env.txt``` file, present in the folder. By default it is set to 8009.

> Note: Do not over-ride the ip address for the ConvAI servers

&nbsp;

**3.** Download the docker image
--------------------------------
```
$ docker pull convai/lasr

$ docker run -p 8009:8009 --name lasr_container -d convai/lasr
```
Visit `https://localhost:8009/`

&nbsp;

**4.** Build a dockerimage from the Dockerfile and run
------------------------------------------------------
```
$ docker build -t lasr_image .

$ docker run -p 8009:8009 --name lasr_container -d lasr_image
```
Visit `https://localhost:8009/`

&nbsp;

**5.** Setup a conda environment for the task
---------------------------------------------
```
$ conda create -n convai-lasr nodejs

$ conda activate convai-lasr

$ npm install

$ node server.js
```
Visit `https://localhost:8009/`
