#!/usr/bin/env bash

IMAGE_TAG=${IMAGE_TAG:-latest}
IMAGE_REPOSITORY=${IMAGE_REPOSITORY:-quay.io/evanshortiss/shipwars-game-server}

rm -rf /tmp/upload
rm -rf node_modules/
rm -rf build/

if ! command -v podman &> /dev/null
then
    s2i build -c . -e HUSKY_SKIP_HOOKS=1 registry.access.redhat.com/ubi8/nodejs-14 ${IMAGE_REPOSITORY}:${IMAGE_TAG}
else
    s2i build -e HUSKY_SKIP_HOOKS=1 -c . --as-dockerfile /tmp/Dockerfile.generated registry.access.redhat.com/ubi8/nodejs-14 
    podman build /tmp -f /tmp/Dockerfile.generated -t ${IMAGE_REPOSITORY}:${IMAGE_TAG}
fi