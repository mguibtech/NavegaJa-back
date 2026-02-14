# Cenários de Teste - Validação de Cupons

## 📋 Matriz de Testes

### Legenda
- ✅ Deve aceitar
- ❌ Deve rejeitar
- 🔄 Deve converter/ajustar

---

## 1. Testes de Código do Cupom

| # | Input | Esperado | Resultado |
|---|-------|----------|-----------|
| 1.1 | `VERAO2026` | ✅ Aceita | Cupom válido |
| 1.2 | `verao2026` | 🔄 Converte para `VERAO2026` | Cupom válido |
| 1.3 | `  VERAO2026  ` | 🔄 Remove espaços | Cupom válido |
| 1.4 | `FAKE123` | ❌ Rejeita | "Cupom não encontrado" |
| 1.5 | `` (vazio) | ❌ Rejeita | Botão desabilitado |
| 1.6 | `ABC` | ❌ Rejeita | "Cupom não encontrado" |
| 1.7 | `VERAO 2026` | 🔄 Remove espaço | Cupom válido |

---

## 2. Testes de Período de Validade

### Setup
```
Hoje: 2026-02-15
Cupom A: validFrom: 2026-01-01, validUntil: 2026-03-31
Cupom B: validFrom: 2026-03-01, validUntil: 2026-03-31
Cupom C: validFrom: 2025-12-01, validUntil: 2026-01-31
```

| # | Cupom | Data Atual | Esperado | Mensagem |
|---|-------|------------|----------|----------|
| 2.1 | A | 2026-02-15 | ✅ Válido | Desconto aplicado |
| 2.2 | B | 2026-02-15 | ❌ Inválido | "Cupom ainda não é válido" |
| 2.3 | C | 2026-02-15 | ❌ Inválido | "Cupom expirado" |

---

## 3. Testes de Limite de Uso

### Setup
```
Cupom A: usageLimit: 100, usageCount: 50  → OK
Cupom B: usageLimit: 100, usageCount: 100 → Esgotado
Cupom C: usageLimit: null                  → Ilimitado
```

| # | Cupom | Esperado | Mensagem |
|---|-------|----------|----------|
| 3.1 | A | ✅ Válido | Desconto aplicado |
| 3.2 | B | ❌ Inválido | "Cupom esgotado" |
| 3.3 | C | ✅ Válido | Desconto aplicado |

---

## 4. Testes de Valor Mínimo

### Setup
```
Cupom: minPurchase: 50
Viagem: R$ 100 (1 passagem)
```

| # | Quantity | Total | Esperado | Mensagem |
|---|----------|-------|----------|----------|
| 4.1 | 1 | R$ 100 | ✅ Válido | Desconto aplicado |
| 4.2 | 1 (viagem R$ 30) | R$ 30 | ❌ Inválido | "Valor mínimo: R$ 50,00" |
| 4.3 | 2 (viagem R$ 30) | R$ 60 | ✅ Válido | Desconto aplicado |

---

## 5. Testes de Filtros de Rota

### Setup
```
Cupom A: fromCity: null, toCity: null
Cupom B: fromCity: "Manaus", toCity: "Beruri"
Cupom C: fromCity: "Manaus", toCity: null
Cupom D: fromCity: null, toCity: "Beruri"
```

| # | Cupom | Viagem | Esperado | Mensagem |
|---|-------|--------|----------|----------|
| 5.1 | A | Manaus → Beruri | ✅ Válido | Aceita qualquer rota |
| 5.2 | A | Manaus → Manacapuru | ✅ Válido | Aceita qualquer rota |
| 5.3 | B | Manaus → Beruri | ✅ Válido | Rota correta |
| 5.4 | B | Manaus → Manacapuru | ❌ Inválido | "Só vale para viagens indo para Beruri" |
| 5.5 | B | Beruri → Manaus | ❌ Inválido | "Só vale para viagens saindo de Manaus" |
| 5.6 | C | Manaus → Beruri | ✅ Válido | Origem correta |
| 5.7 | C | Manaus → Manacapuru | ✅ Válido | Origem correta |
| 5.8 | C | Beruri → Manaus | ❌ Inválido | "Só vale para viagens saindo de Manaus" |
| 5.9 | D | Manaus → Beruri | ✅ Válido | Destino correto |
| 5.10 | D | Beruri → Manaus | ❌ Inválido | "Só vale para viagens indo para Beruri" |

---

## 6. Testes de Cálculo de Desconto

### 6.1. Desconto Percentual (20%)

| # | Preço Original | Quantity | Total | Desconto | Preço Final |
|---|----------------|----------|-------|----------|-------------|
| 6.1.1 | R$ 100 | 1 | R$ 100 | R$ 20 | R$ 80 |
| 6.1.2 | R$ 100 | 2 | R$ 200 | R$ 40 | R$ 160 |
| 6.1.3 | R$ 55,50 | 1 | R$ 55,50 | R$ 11,10 | R$ 44,40 |

### 6.2. Desconto Fixo (R$ 15)

| # | Preço Original | Quantity | Total | Desconto | Preço Final |
|---|----------------|----------|-------|----------|-------------|
| 6.2.1 | R$ 100 | 1 | R$ 100 | R$ 15 | R$ 85 |
| 6.2.2 | R$ 100 | 2 | R$ 200 | R$ 15 | R$ 185 |
| 6.2.3 | R$ 20 | 1 | R$ 20 | R$ 15 | R$ 5 |

### 6.3. Desconto com Limite Máximo

**Setup:** `type: percentage, value: 20, maxDiscount: 30`

| # | Preço Original | Desconto Calculado | Desconto Aplicado | Preço Final |
|---|----------------|-------------------|-------------------|-------------|
| 6.3.1 | R$ 100 | R$ 20 | R$ 20 | R$ 80 |
| 6.3.2 | R$ 200 | R$ 40 | **R$ 30** (máx) | R$ 170 |
| 6.3.3 | R$ 500 | R$ 100 | **R$ 30** (máx) | R$ 470 |

---

## 7. Testes de Estado Ativo/Inativo

| # | isActive | Esperado | Mensagem |
|---|----------|----------|----------|
| 7.1 | `true` | ✅ Válido | Desconto aplicado |
| 7.2 | `false` | ❌ Inválido | "Cupom inativo" |

---

## 8. Testes de Erros de Rede

| # | Cenário | Response | UI Esperada |
|---|---------|----------|-------------|
| 8.1 | Sem conexão | Network Error | "Verifique sua conexão e tente novamente" |
| 8.2 | Timeout (>10s) | Timeout | "Tempo esgotado. Tente novamente" |
| 8.3 | Servidor fora (500) | 500 Internal | "Erro no servidor. Tente em instantes" |
| 8.4 | Viagem não existe | 404 Not Found | "Viagem não encontrada" |
| 8.5 | Campos inválidos | 400 Bad Request | Mensagem de validação |

---

## 9. Testes de UX

### 9.1. Loading States

| # | Ação | Estado | UI Esperada |
|---|------|--------|-------------|
| 9.1.1 | Digitar código | `NOT_VALIDATED` | Input habilitado, botão "Aplicar" |
| 9.1.2 | Clicar "Aplicar" | `VALIDATING` | Loading spinner, input desabilitado |
| 9.1.3 | Resposta OK | `VALID` | Badge verde, desconto mostrado |
| 9.1.4 | Resposta erro | `INVALID` | Borda vermelha, mensagem de erro |

### 9.2. Interações

| # | Ação | Resultado Esperado |
|---|------|-------------------|
| 9.2.1 | Digitar código válido → Aplicar | Desconto aplicado, input bloqueado |
| 9.2.2 | Clicar "✕" (remover) | Cupom removido, preço volta ao normal |
| 9.2.3 | Aplicar cupom → Voltar → Avançar | Cupom ainda aplicado |
| 9.2.4 | Mudar quantidade de passagens | Recalcular desconto |

---

## 10. Testes E2E (Fluxo Completo)

### Cenário 1: Aplicar Cupom com Sucesso
```
1. Abrir app
2. Selecionar viagem Manaus → Beruri (R$ 100, 1 passagem)
3. Ir para checkout
4. Digitar "VERAO2026" no campo de cupom
5. Clicar "Aplicar"
6. ✅ Verificar: Desconto R$ 20 aplicado
7. ✅ Verificar: Total R$ 80
8. ✅ Verificar: Badge "VERAO2026" visível
9. Clicar "Confirmar compra"
10. ✅ Verificar: Booking criado com couponCode
```

### Cenário 2: Cupom Expirado
```
1. Abrir app
2. Selecionar viagem
3. Ir para checkout
4. Digitar "NATAL2025"
5. Clicar "Aplicar"
6. ✅ Verificar: Erro "Cupom expirado"
7. ✅ Verificar: Input com borda vermelha
8. ✅ Verificar: Preço não alterado
```

### Cenário 3: Valor Mínimo Não Atingido
```
1. Selecionar viagem R$ 30
2. Digitar "VERAO2026" (minPurchase: R$ 50)
3. Clicar "Aplicar"
4. ✅ Verificar: Erro "Valor mínimo: R$ 50,00"
5. Adicionar mais 1 passagem (total R$ 60)
6. Clicar "Aplicar" novamente
7. ✅ Verificar: Desconto aplicado
```

### Cenário 4: Rota Não Permitida
```
1. Selecionar viagem Manaus → Manacapuru
2. Digitar "BERURI15" (só vale Manaus → Beruri)
3. Clicar "Aplicar"
4. ✅ Verificar: Erro "Só vale para viagens indo para Beruri"
5. Voltar e selecionar Manaus → Beruri
6. Digitar "BERURI15" novamente
7. ✅ Verificar: Desconto R$ 15 aplicado
```

### Cenário 5: Remover Cupom
```
1. Aplicar cupom "VERAO2026"
2. ✅ Verificar: Desconto R$ 20, total R$ 80
3. Clicar "✕" (remover)
4. ✅ Verificar: Cupom removido
5. ✅ Verificar: Preço volta para R$ 100
6. ✅ Verificar: Input limpo e habilitado
```

---

## 11. Testes de Performance

| # | Métrica | Esperado |
|---|---------|----------|
| 11.1 | Tempo de validação | < 2 segundos |
| 11.2 | Tentativas simultâneas | Cancelar requisição anterior |
| 11.3 | Cache de cupons ativos | Atualizar a cada 5 min |
| 11.4 | Retry automático | Máximo 3 tentativas |

---

## 12. Testes de Acessibilidade

| # | Critério | Verificação |
|---|----------|-------------|
| 12.1 | Labels de input | Input tem label "Cupom de desconto" |
| 12.2 | Mensagens de erro | Screen reader lê erro em voz alta |
| 12.3 | Botão desabilitado | Indicação visual + aria-disabled |
| 12.4 | Contraste | Textos têm contraste mínimo WCAG AA |

---

## 13. Automação (Detox/Appium)

```typescript
describe('Validação de Cupom', () => {
  it('deve aplicar cupom válido', async () => {
    // Ir para checkout
    await element(by.id('checkout-button')).tap();

    // Digitar cupom
    await element(by.id('coupon-input')).typeText('VERAO2026');
    await element(by.id('apply-coupon-button')).tap();

    // Verificar desconto
    await waitFor(element(by.id('discount-badge')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('final-price'))).toHaveText('R$ 80,00');
  });

  it('deve mostrar erro para cupom inválido', async () => {
    await element(by.id('coupon-input')).typeText('FAKE123');
    await element(by.id('apply-coupon-button')).tap();

    await waitFor(element(by.id('coupon-error')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('coupon-error')))
      .toHaveText('Cupom não encontrado');
  });
});
```

---

## 14. Casos de Borda

| # | Cenário | Esperado |
|---|---------|----------|
| 14.1 | Aplicar mesmo cupom 2x | Ignorar segunda tentativa |
| 14.2 | Aplicar cupom → Mudar viagem | Revalidar cupom |
| 14.3 | Desconto > Preço | Preço mínimo R$ 0 |
| 14.4 | Cupom com caracteres especiais | Aceitar apenas alfanuméricos |
| 14.5 | 50 cupons ativos | Mostrar apenas primeiros 10 |

---

## ✅ Checklist Completo de QA

### Funcional
- [ ] Todos os cenários de validação passam
- [ ] Cálculos de desconto corretos
- [ ] Mensagens de erro claras
- [ ] Estados visuais corretos

### Performance
- [ ] Validação < 2s
- [ ] App não trava durante validação
- [ ] Memória não vaza

### UX
- [ ] Loading states claros
- [ ] Feedback imediato
- [ ] Possível remover cupom
- [ ] Possível tentar novamente após erro

### Acessibilidade
- [ ] Screen readers funcionam
- [ ] Contraste adequado
- [ ] Navegação por teclado (web)

### Compatibilidade
- [ ] iOS 14+
- [ ] Android 8+
- [ ] Diferentes tamanhos de tela
- [ ] Modo escuro (se aplicável)

### Segurança
- [ ] Cupons validados no backend
- [ ] Não é possível burlar validação
- [ ] HTTPS obrigatório

---

## 📊 Relatório de Bugs (Template)

```markdown
**Título:** [BUG] Cupom válido sendo rejeitado

**Passos para Reproduzir:**
1. Abrir app
2. Selecionar viagem Manaus → Beruri (R$ 100)
3. Digitar cupom "VERAO2026"
4. Clicar "Aplicar"

**Resultado Esperado:**
Desconto de R$ 20 aplicado, total R$ 80

**Resultado Obtido:**
Erro: "Cupom não encontrado"

**Ambiente:**
- App: v1.2.3
- Device: iPhone 13 Pro, iOS 16.5
- API: v2.0.1

**Logs:**
```json
{
  "request": { "code": "VERAO2026", "tripId": "...", "quantity": 1 },
  "response": { "valid": false, "message": "Cupom não encontrado" }
}
```

**Screenshots:**
[Anexar]
```

---

## 🎯 Critérios de Aceitação

Para considerar a feature **pronta para produção**:

✅ Taxa de sucesso > 95%
✅ Tempo médio < 2s
✅ 0 bugs críticos
✅ 100% cobertura de testes unitários
✅ Todos os cenários E2E passando
✅ Aprovação em code review
✅ Aprovação em QA
✅ Documentação completa
