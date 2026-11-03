ARG BASE_IMAGE=node:22-bookworm-slim
FROM ${BASE_IMAGE}
USER root
RUN apt-get update && apt-get install -y openssh-server tmux && rm -rf /var/lib/apt/lists/*
# Disposable credentials: this image must only run on an internal test network.
RUN mkdir -p /run/sshd && ssh-keygen -A && echo 'root:sessions-e2e-disposable' | chpasswd
CMD ["/usr/sbin/sshd", "-D", "-e", "-o", "PermitRootLogin=yes", "-o", "PasswordAuthentication=yes", "-o", "UsePAM=no"]
