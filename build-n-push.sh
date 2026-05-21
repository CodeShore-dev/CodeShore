#/bin.bash
set -x
read -p 'Repo: ' REPO
read -p 'Tag: ' TAG
docker build -t dev-registry.xycloud.org/cwd/$REPO-frontend:$TAG . -f Dockerfile --build-arg PROXY=http://172.17.9.13:3128 --build-arg VER=$TAG --build-arg REPO=$REPO
docker push dev-registry.xycloud.org/cwd/$REPO-frontend:$TAG
set +x
