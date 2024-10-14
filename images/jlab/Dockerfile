FROM public.ecr.aws/ubuntu/ubuntu:22.04

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"

RUN apt-get update -y && \
    apt-get upgrade -y && \
    apt-get install -y python3 python3-pip unzip sudo cron curl && \
    apt-get clean all && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir ipykernel jupyterlab && \
    python3 -m ipykernel install

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip -q awscliv2.zip && \
    ./aws/install
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest && \
    node -v

COPY jlab/requirements.txt requirements.txt
RUN pip3 install --upgrade urllib3==1.26.6 && \
    pip3 install --quiet -r requirements.txt

RUN useradd --create-home --shell /bin/bash --gid "${NB_GID}" --uid ${NB_UID} ${NB_USER} && \
    echo "${NB_USER} ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

ENV PYTHONUNBUFFERED=TRUE  
ENV PYTHONDONTWRITEBYTECODE=TRUE  

WORKDIR /home/${NB_UID}
USER ${NB_UID}

CMD jupyter lab --ip 0.0.0.0 --port 8888 \
  --ServerApp.base_url="/jupyterlab/default" \
  --ServerApp.token='' \
  --ServerApp.allow_origin='*'

