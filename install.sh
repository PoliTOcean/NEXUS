#!/bin/bash

python3 -m venv venv
source ./venv/bin/activate
venv/bin/pip install --no-warn-script-location -r 'requirements.txt'
cd ./static
npm install
cd ..