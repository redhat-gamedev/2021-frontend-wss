DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

docker build -f Dockerfile.dev . -t shipwars-game-server
docker run --rm \
-e CLUSTER_NAME="Local" -e HUSKY_SKIP_HOOKS=1 -p 8181:8181 \
-v "$(pwd)/src/:/usr/src/app/src/" --name=shipwars-game-server shipwars-game-server
