# 🔧 Quick Fix - Erro de Schema Shipments

## 🐛 Problema

```
QueryFailedError: a coluna "recipient_name" da relação "shipments" contém valores nulos
```

**Causa:** Registros antigos na tabela `shipments` sem os campos obrigatórios `recipientName`, `recipientPhone`, `recipientAddress`.

---

## ✅ Solução Rápida (3 opções)

### Opção 1: Via pgAdmin / DBeaver (RECOMENDADO)

1. Abra **pgAdmin** ou **DBeaver**
2. Conecte no banco `navegaja`
3. Execute este SQL:

```sql
-- Deletar dados antigos (desenvolvimento)
BEGIN;

DELETE FROM shipment_reviews;
DELETE FROM shipment_timeline;
DELETE FROM shipments;

COMMIT;
```

4. Reinicie o servidor: `yarn start:dev`

---

### Opção 2: Via Command Line (se tiver psql no PATH)

```bash
# Windows (PowerShell)
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d navegaja -c "BEGIN; DELETE FROM shipment_reviews; DELETE FROM shipment_timeline; DELETE FROM shipments; COMMIT;"

# Ou procure o psql.exe e execute:
# Geralmente está em: C:\Program Files\PostgreSQL\[versão]\bin\psql.exe

# Depois
yarn start:dev
```

---

### Opção 3: Dropar e Recriar Tabelas (último recurso)

Se as opções acima não funcionarem:

1. Abra pgAdmin/DBeaver
2. Execute:

```sql
DROP TABLE IF EXISTS shipment_reviews CASCADE;
DROP TABLE IF EXISTS shipment_timeline CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
```

3. Reinicie o servidor: `yarn start:dev`
   (TypeORM vai recriar as tabelas automaticamente)

---

## 🎯 Depois de Resolver

Teste se funcionou:

```bash
# Iniciar servidor
yarn start:dev

# Deve aparecer:
# [Nest] Application successfully started ✅
```

---

## 📊 Verificar Situação Atual (Opcional)

Antes de deletar, você pode ver quantos registros tem:

```sql
-- Ver total de shipments
SELECT COUNT(*) FROM shipments;

-- Ver registros problemáticos
SELECT
  id,
  tracking_code,
  recipient_name,
  recipient_phone,
  recipient_address
FROM shipments
WHERE recipient_name IS NULL
   OR recipient_phone IS NULL
   OR recipient_address IS NULL;
```

---

## ⚠️ Importante

- **Desenvolvimento:** Pode deletar sem problemas (dados de teste)
- **Produção:** Use migration para popular valores default nos registros antigos

```sql
-- Para produção (se tiver dados importantes):
UPDATE shipments
SET
  recipient_name = COALESCE(recipient_name, 'Destinatário não informado'),
  recipient_phone = COALESCE(recipient_phone, '00000000000'),
  recipient_address = COALESCE(recipient_address, 'Endereço não informado')
WHERE recipient_name IS NULL
   OR recipient_phone IS NULL
   OR recipient_address IS NULL;
```

---

**Escolha a Opção 1 e execute no pgAdmin!** 🚀
