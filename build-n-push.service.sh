#/bin.bash
set -x
read -p 'Repo: ' REPO
read -p 'Tag: ' TAG
docker build -t dev-registry.xycloud.org/cwd/$REPO:$TAG . -f Dockerfile.service --build-arg http_proxy=http://172.17.9.13:3128 --build-arg https_proxy=http://172.17.9.13:3128 --build-arg VER=$TAG --build-arg REPO=$REPO
docker push dev-registry.xycloud.org/cwd/$REPO:$TAG
set +x
