#!/bin/bash
VERSION=$(grep -m1 version package.json | awk -F: '{ print $2 }' | sed 's/[", ]//g')
PACKAGENAME=$(grep -m1 name package.json | awk -F: '{ print $2 }' | sed 's/[", ]//g')
ARCH=amd64
user=deploy-user
remote=cec-pkgs.austin.ibm.com
echo "Removing old package : ${PACKAGENAME}_${VERSION}_${ARCH}.deb, if any"
ssh ${user}@${remote} rm  /home/${user}/apps/${PACKAGENAME}_${VERSION}_${ARCH}.deb
echo "cleaning Freight Cache"
ssh ${user}@${remote} rm /var/cache/freight/dists/xenial/.refs/main/${PACKAGENAME}_${VERSION}_${ARCH}.deb
ssh ${user}@${remote} rm /var/cache/freight/pool/xenial/main/d/${PACKAGENAME}/${PACKAGENAME}_${VERSION}_${ARCH}.deb
echo "copying the new package to repo"
scp dist/${PACKAGENAME}_${VERSION}_${ARCH}.deb ${user}@${remote}:~/apps
echo "Building Freight cache"
ssh ${user}@${remote} freight add  /home/${user}/apps/${PACKAGENAME}_${VERSION}_${ARCH}.deb apt/xenial
ssh ${user}@${remote} freight cache -p /home/${user}/gpg-passphrase