FROM public.ecr.aws/amazonlinux/amazonlinux:2

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"
RUN yum install —assumeyes python3 shadow-utils && \
useradd —create-home —shell /bin/bash —gid "${NB_GID}" —uid ${NB_UID} ${NB_USER} && \
yum clean all && \
python3 -m pip install jupyterlab

RUN python3 -m pip install —upgrade pip

RUN python3 -m pip install —upgrade urllib3==1.26.6

USER ${NB_UID}
CMD jupyter lab —ip 0.0.0.0 —port 8888 \
--ServerApp.base_url="/jupyterlab/default" \
--ServerApp.token='' \
--ServerApp.allow_origin='*'