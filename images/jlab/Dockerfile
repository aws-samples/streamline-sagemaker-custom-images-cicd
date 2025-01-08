FROM public.ecr.aws/amazonlinux/amazonlinux:2023

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"
COPY jlab/requirements.txt requirements.txt
ENV NODE_VERSION=20.12.2
ENV NVM_DIR=/usr/local/nvm
ENV PYTHONUNBUFFERED=TRUE  
ENV PYTHONDONTWRITEBYTECODE=TRUE  

# Update and install necessary packages
RUN dnf update -y && \
    dnf install -y python3 python3-pip unzip sudo cronie wget shadow-utils tar && \
    dnf clean all && \
    python3 -m pip install --no-cache-dir ipykernel jupyterlab && \
    python3 -m ipykernel install

# Install AWS CLI v2
RUN wget -q "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" && \
    unzip -q awscli-exe-linux-x86_64.zip && \
    ./aws/install && \
    rm -rf aws awscli-exe-linux-x86_64.zip

# Install NVM and Node.js
RUN mkdir -p $NVM_DIR && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use $NODE_VERSION

# Add Node and NPM to PATH
ENV PATH="$NVM_DIR/versions/node/v${NODE_VERSION}/bin:${PATH}"
# Copy and install Python requirements

RUN python3 -m pip install --no-cache-dir -r requirements.txt && \
    rm requirements.txt && \
    useradd --create-home --shell /bin/bash --gid "${NB_GID}" --uid ${NB_UID} ${NB_USER} && \
    echo "${NB_USER} ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers && \
    dnf clean all && \
    rm -rf /var/cache/dnf

WORKDIR /home/${NB_UID}
USER ${NB_UID}

CMD ["jupyter", "lab", "--ip", "0.0.0.0", "--port", "8888", \
     "--ServerApp.base_url=/jupyterlab/default", \
     "--ServerApp.token=''", \
     "--ServerApp.allow_origin='*'"]
