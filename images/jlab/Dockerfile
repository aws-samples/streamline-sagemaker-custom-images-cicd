# Use multi-stage build
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 as builder

# Set ARGs and ENVs together
ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"
ENV PYTHONUNBUFFERED=TRUE
ENV PYTHONDONTWRITEBYTECODE=TRUE

# Combine all dnf operations and cleanup in a single layer
RUN dnf update -y && \
    dnf install -y \
    python3 \
    python3-pip \
    unzip \
    sudo \
    cronie \
    wget \
    shadow-utils \
    tar \
    nodejs \
    npm && \
    dnf clean all && \
    rm -rf /var/cache/dnf

# Combine pip installations and cleanup
COPY jlab/requirements.txt /tmp/requirements.txt
RUN python3 -m pip install --no-cache-dir ipykernel jupyterlab && \
    python3 -m pip install --no-cache-dir -r /tmp/requirements.txt && \
    python3 -m ipykernel install && \
    rm -f /tmp/requirements.txt

# Combine AWS CLI installation steps
RUN wget -q "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" && \
    unzip -q awscli-exe-linux-x86_64.zip && \
    ./aws/install && \
    rm -rf aws awscli-exe-linux-x86_64.zip && \
    npm install -g npm@latest && \
    dnf remove -y unzip && \
    dnf clean all

# Create user and set permissions in one layer
RUN useradd --create-home --shell /bin/bash --gid "${NB_GID}" --uid ${NB_UID} ${NB_USER} && \
    echo "${NB_USER} ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Set working directory and user
WORKDIR /home/${NB_UID}
USER ${NB_UID}

# Set the default command
CMD ["jupyter", "lab", "--ip", "0.0.0.0", "--port", "8888", \
     "--ServerApp.base_url=/jupyterlab/default", \
     "--ServerApp.token=''", \
     "--ServerApp.allow_origin='*'"]
