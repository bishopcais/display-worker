#!/bin/bash
VERSION=$(grep -m1 version package.json | awk -F: '{ print $2 }' | sed 's/[", ]//g')
PACKAGENAME=$(grep -m1 name package.json | awk -F: '{ print $2 }' | sed 's/[", ]//g')
ARCH=amd64
user=deploy-user
remote=cec-pkgs.austin.ibm.com
scp dist/${PACKAGENAME}_${VERSION}_${ARCH}.deb ${user}@${remote}:~/apps
ssh ${user}@${remote} freight add  /home/${user}/apps/${PACKAGENAME}_${VERSION}_${ARCH}.deb apt/xenial
ssh ${user}@${remote} freight cache -p /home/${user}/gpg-passphrase