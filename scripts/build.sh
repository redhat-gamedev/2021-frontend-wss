#!/usr/bin/env bash

IMAGE_TAG=${IMAGE_TAG:-latest}
IMAGE_REPOSITORY=${IMAGE_REPOSITORY:-quay.io/evanshortiss/shipwars-game-server}

rm -rf node_modules/
rm -rf build/

s2i build -e HUSKY_SKIP_HOOKS=1 -c . registry.access.redhat.com/ubi8/nodejs-14 ${IMAGE_REPOSITORY}:${IMAGE_TAG}
