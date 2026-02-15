heres how to setup lightlink (https://lightlink.space for demo)

# Step 1

```
pnpm install
```

install modules

# Step 2

create and edit a .env file in the root directory with these properties

ADMIN_PASSCODE:{passcode here}

DISCORD_WEBHOOK_URL:{url here} (optional)

# Step 3

```
pnpm start
```

run the server

# Step 4

visit http://localhost:1100

not the right port? change it in the **src/index.js** directory

# Step 5 (optional)

when first ran, and the .env has the vapid keys and stuff, change the vapid email, or go into profiles/server.js and change it there before first run

# .env Check

your .env file should in the end look like this

```
ADMIN_PASSWORD={password here}
DISCORD_WEBHOOK_URL={url here} (optional)
VAPID_PUBLIC_KEY={key here} (auto generated)
VAPID_PRIVATE_KEY={key here} (auto generated)
VAPID_EMAIL={email here} (auto generated)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmailuser
SMTP_PASS=yourgmailpass
```

if you do not have the admin password, the admin features WILL be disabled (and might be hackable idk) so make sure to set the ADMIN_PASSWORD in the .env file

in order to get 2 step verification working with smtp, you need to generate an app password from your google account, and place it in the .env file replacing yourgmailpass. and your google user should be your gmail email, like lightlink.noreply@gmail.com (what we use here at lightlink)

in order to create a google app password, go to 

https://myaccount.google.com/apppasswords

then create an app name, it can be whatever you want it doesnt matter. when you create it, you will get your app password. copy it and paste it into the .env file replacing yourgmailpass.


**i didnt do much research into app passwords, so i dont know if its a complete security risk or not (if your .env gets exposed), but it should be fine, and it does work, so its all up to you**

to create a discord webhook (any webhook will work, but a discord webhook is reccomended) you need to create a new discord server, and then go to any channel and click on the settings button to edit the channel. go to the integrations section on the side, then create a webhook. copy the webhook url and paste it into the .env file putting it after the equal sign after the discord_webhook_url. 

# Tip

admin panel will be at localhost:(port)/profiles/admin.html

# Notice

the database in profiles, the .env, and the node_modules do not save by default. to change this in your own github repo, change the .gitignore to not ignore these items (database [profiles/data.json] and .env is not reccomended to be shown publicly as it may store user info, admin controls, and discord webhooks if configured.)

any errors report to **.yzycoin.** on discord or go to https://github.com/lightight/lightlink/issues

# License

We use the APGL-3.0 License

This provides **NO WARRANTY** to you and **NO LIABILITY** to us.

ok bye now and email me if u have problems <contact@lightlink.space>