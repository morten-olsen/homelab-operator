#!/bin/bash
flux install --components="source-controller,helm-controller"
kubectl create namespace homelab