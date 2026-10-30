FROM nodered/node-red:5.0.1-debian

USER root
WORKDIR /data

COPY nodered/package.json /data/package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY nodered/settings.js /data/settings.js
COPY nodered/flows.json /data/flows.json
COPY nodered/lib /data/lib
COPY public /data/public

RUN mkdir -p /data/public/uploads /data/runtime \
    && chown -R node-red:node-red /data

USER node-red
WORKDIR /usr/src/node-red
ENV FLOWS=flows.json
