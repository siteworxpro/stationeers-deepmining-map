# Stationeers Deep Mining Map

Live version at
https://aproposmath.github.io/stationeers-deepmining-map

forked from
https://github.com/aproposmath/stationeers-deepmining-map

### improvements
Updated to use vite and add docker support.
Code updated to typeScript.

Running Stationeers Deep Mining Map in Docker
```shell
docker run --rm -p 8080:80 siteworxpro/stationeers-deepmining-map:latest
```

You can access the application at: [http://localhost:8080](http://localhost:8080)

![Deep Mining Map Screenshot](docs/map.png)

### Running Locally

To run the Stationeers Deep Mining Map locally, follow these steps:

```bash
git clone https://github.com/aproposmath/stationeers-deepmining-map.git
cd stationeers-deepmining-map/js
nvm install && nvm use
npm i && npm run dev
``` 