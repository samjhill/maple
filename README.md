# maple

Syncs a given folder to distributed cloud storage for cheap & resilient storage

## Setup

```
npm install
```

## Run

pass SOURCE as an environment variable. This is the folder you want to store in the cloud. I recommend you run it as a cronjob:

```
crontab -e
```

add a new line:

```
*/15 * * * * SOURCE=/Users/sam.hill/Documents/opensource/maple/bin/exampleData node index.js
```

This will run every 15 minutes.