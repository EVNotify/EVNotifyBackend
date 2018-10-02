# Contributing Guideline

#### Introduction

Contributing to _EVNotifyBackend_ is very easy and especially very appreciated.
Even as a non-developer it's easy to help making this project even better.

#### Types of contribution
First of all, there are different types of Contribution that can be made.
- Have you found a bug? Create an issue here on GitHub. Please follow the Issue Guideline there and fill out as many information as possible.
- Do you have a great idea or a suggestion? Great! All you need to do is, create an issue and explain your idea or suggestion.
- You are a developer? Or you found a spelling mistake and want to correct it? Perfect! Feel free to improve and fix the code of this project and create a Pull Request, so your changes can be merged.
- You are just interested on how this works? Experiment with it? Or you want to create your own environment, so EVNotify can work on your local server? For this and for the previous point, you'll need to setup your own backend on your machine. It's really easy.

#### Prerequisites
In order to be able to run your own server, you'll need to have some things setup already, before to proceed. Ensure that you've met the requirements, before you proceed.
It is recommended to use Linux - but other environments will also work.
So, what do you need - beside a computer / server with some OS running on it?
- A text-editor (just saying ;))
- Current version of NodeJS and NPM
- Git

#### Restrictions
The complete source code is available open source here, but out of the box your local server will be restricted to basic functions only. You also need to consider a few things, when you want to run your own EVNotify Backend Server.
- Your machine / server needs to be up, when you need it (24/7)
- You have to take care of backups by yourself
- You have to take care of keeping everything up-to-date - this means, your OS, packages and - the source code from this repository by itself. At the end I'll explain, how you can do this easily.
- You may need to have your own domain - and a HTTPS certificate running on it - to encrypt the traffic that receives and sends out of the server. It's possible to run the server in HTTP mode, but that's not recommended.
- Out of the box, you'll not be able to send notifications - to enable that feature, you'll need to provide some options in a config file that will be explained later. Keep in mind, that based on your needs, you need to register for some services, which may require some installation or other things (e.g. mail server, Telegram Bot Token, ..)
- Out of the box, your server will not automatically track uncaught exceptions or analyze the usage. To be able to do so, you'll need to specify them in the config file, which will be explained later, as mentioned previously.

#### First-time-setup
So, now we will setup the Backend for EVNotify. This step is required only once.

#### NOTE: Currently ALL modules and functions are handled in v2 branch and directory!
This is required to ensure compatibility with v1.

1. Open a terminal and clone this repository or clone your own forked copy (the latter is recommended, if you want to contribute with code later). You can do so with: `git clone https://github.com/GPlay97/EVNotifyBackend` (the URL needs to be adjusted, if you want to clone your forked version).
2. Change in this directoy with `cd EVNotifyBackend/v2`.
3. Type in `npm install` to automatically install all dependencies that are required for EVNotifyBackend.
4. Almost done. You'll now have to create your database. On Linux you can execute `./createEnv.sh` to automatically do this. If you encounter some "access denied" error, take a look at the fresh generated _srv_config.json_ file and adjust the credentials for the database. Try it again.
If it's not working automatically or if you are not on a linux based machine, copy the _srv_config.template.json_ file to _srv_config.json_. Adjust the values for your needs. Open MySQL either on your terminal or on a graphical user inerface. Run `CREATE DATABASE evnotify;` (you can name the dabase like you want - but keep in mind to pass it into the config file).
Now import the MySQL database structure with `mysql evnotify < modules/db/db_template.sql`. Or manually copy the content of the file and execute it within your graphical user interface for MySQL.
5. That's it. Now it's time to see, if everything was setup correctly. Start the server with `node index.js`. If you want to debug it, you pass the `--inspect` parameter with. It should print something like `Server is running on port XXXX`.
6. That's it. Congratulations! Your server is now up and running!

#### Optional configuration to avoid restrictions
As mentioned earlier, only the basic things, that don't need further setup, will work on initial setup. However, if you want to use all possibilites of EVNotify, such as notifications, there are some steps left. Why? Because in order to be able to send mails, you'll need to specify your mail provider credentials (this can be either the ones from your hosting provider or your personal mail), to send and retrieve messages from Telegram, you'll need to setup a Bot Token, and so on.

Here are optional keys, which can be specified within the _srv_config.json_ file. Please read the documentation of external services, how to register for a service (e.g Telegram Bot or Rollbar).

###### HTTPS
- `HTTPS_PORT` - required for HTTPS
- `CHAIN_PATH` - path to HTTPS chain file
- `PRIVATE_KEY_PATH` - path to HTTPS private key file
- `CERTIFICATE_PATH` - path to HTTPS certificate file
###### Mail
- `MAIL_SERVICE` - mail service provider (see nodemailer docs for supported ones)
- `MAIL_USER` - the mail user
- `MAIL_PASSWORD` - the password of the mail user
- `MAIL_ADRESS` - the mail adress
###### Telegram
- `TELEGRAM_TOKEN` - the token of the Telegram Bot
###### Firebase (for Push notifications)
- `FIREBASE_FILE` - file to the secret key for firebase authentication
- `FIREBASE_URL` - url of firebase project
###### Rollbar (automated error tracking)
- `ROLLBAR_TOKEN` - the token of your Rollbar project
###### Moesif (automated API traffic and usage analyzation)
- `MOESIF_TOKEN` - the token of your Moesif project
###### GoingElectric (for stations finder)
- `GE_API_URL` - the URL to the GoingElectric API (currently _https://api.goingelectric.de_)
- `GE_API_KEY` - the key for the GoingElectric API (Format: `?key=XXXX`)
