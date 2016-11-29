#!/bin/bash

# Link to the binary
ln -sf '/opt/<%= executable %>/<%= executable %>' '/usr/local/bin/<%= executable %>'
mkdir -p /etc/celio/
cp '/opt/<%= executable %>/cog-sample.json' '/etc/celio/display-worker-settings.json'
cp '/opt/<%= executable %>/display-worker.service' '/etc/systemd/system/'
