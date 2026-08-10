#!/bin/sh
#
# Ajusta o dono do volume antes de largar o privilégio de root.
#
# O Dockerfile cria /app/uploads com dono `app`, mas isso vale só para a
# imagem. Em produção o Railway monta um volume por cima desse caminho, e o
# ponto de montagem pertence a root — a permissão que o build ajustou fica
# escondida embaixo. O processo, rodando como `app`, não consegue nem criar
# subpasta ali.
#
# O sintoma é desproporcional à causa: o multer monta o diskStorage no
# carregamento do módulo, então o EACCES estoura durante o import e derruba a
# aplicação inteira, em loop, mesmo que ninguém vá enviar foto nenhuma.
#
# Este script roda como root só o tempo de acertar o dono, e então executa a
# aplicação como `app`. Precisa acontecer a cada boot: o volume é remontado
# toda vez, e um chown feito no build não sobrevive.

set -e

mkdir -p /app/uploads
chown -R app:app /app/uploads

exec su-exec app "$@"
