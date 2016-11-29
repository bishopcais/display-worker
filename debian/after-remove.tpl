#!/bin/bash

# Delete the link to the binary
rm -f '/usr/local/bin/<%= executable %>'
rm '/etc/systemd/system/display-worker.service'
