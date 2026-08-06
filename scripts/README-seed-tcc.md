# Seed de dados para os testes com usuários (TCC)

Popula o banco com dados realistas do transporte fluvial amazonense, para que o
aplicativo não fique vazio durante as sessões de teste de usabilidade.

## O que é criado

| Item | Quantidade | Detalhe |
|------|-----------|---------|
| Localidades | 24 | 14 municípios do Amazonas + 10 comunidades ribeirinhas reais, todas com `status = confirmed` (aparecem no autocomplete) |
| Capitães | 3 | verificados e com KYC aprovado — podem criar viagens pelo app |
| Embarcações | 5 | 2 recreios, 2 lanchas e 1 voadeira, todas verificadas, com comodidades |
| Contas de teste | 2 | um passageiro e um remetente |
| Viagens | ~830 | 13 rotas reais, agendadas nos próximos 45 dias |

As rotas usam duração e preço compatíveis com a prática local (ex.: Manaus–Parintins,
18 h, R$ 150; Manaus–Manacapuru, 3 h, R$ 45). Recreios de longa distância não saem
todos os dias, e a ocupação varia entre as viagens — o objetivo é que a lista de
resultados pareça real para o participante do teste.

## Credenciais (senha única: `teste123`)

| Perfil | Telefone | E-mail |
|--------|----------|--------|
| Passageiro | 92991000201 | passageiro@navegaja.com |
| Remetente | 92991000202 | remetente@navegaja.com |
| Capitão 1 | 92991000101 | capitao.raimundo@navegaja.com |
| Capitão 2 | 92991000102 | capitao.jose@navegaja.com |
| Capitão 3 | 92991000103 | capitao.antonio@navegaja.com |

## Como executar

**Contra o Railway** (recomendado — não precisa de deploy):

1. No Railway, abra o serviço **Postgres → Connect** e copie a *Public Network* connection URL.
2. No terminal, dentro de `NavegaJa-back`:

```bash
DATABASE_URL="postgresql://postgres:SENHA@HOST.proxy.rlwy.net:PORTA/railway" node scripts/seed-tcc.js
```

No PowerShell (Windows):

```powershell
$env:DATABASE_URL="postgresql://postgres:SENHA@HOST.proxy.rlwy.net:PORTA/railway"
node scripts/seed-tcc.js
```

**Contra o banco local:**

```bash
node --env-file=.env scripts/seed-tcc.js
```

## Reexecução

O script é **idempotente**: pode rodar quantas vezes quiser. As viagens que ele cria
são marcadas com `[SEED-TCC]` no campo `notes` e são apagadas e recriadas a cada
execução — útil para renovar as datas quando as viagens antigas ficarem no passado.

Usuários, embarcações e localidades são atualizados, nunca duplicados.

Para remover apenas as viagens criadas pelo script:

```bash
DATABASE_URL="..." node scripts/seed-tcc.js --limpar
```

## Antes das sessões de teste

Rode o script novamente na véspera. Viagens no passado não aparecem na busca
(`departure_at >= now()`), então rodar de novo garante 45 dias de oferta a partir da data atual.

## Sugestões de busca durante o teste

- **Manaus → Manacapuru** — sai todos os dias, ida às 6h e 13h30 (bom para a Tarefa 1)
- **Manaus → Parintins** — sai em dias ímpares, viagem longa de recreio
- **Manaus → Iranduba** — trajeto curto de voadeira, preço baixo

## Observação técnica

A busca de viagens (`GET /trips`) casa `origin` e `destination` por texto (`LIKE %termo%`,
sem normalização de acento). Por isso os nomes gravados seguem exatamente a grafia da
tabela `src/trips/city-coords.ts` — inclusive os acentos de *Tefé*, *Maués*, *Codajás*
e *Novo Airão*. Alterar esses nomes quebra o casamento com o autocomplete.
