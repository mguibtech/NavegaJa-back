# 🌦️ Como Obter API Key GRÁTIS do OpenWeatherMap

## 📋 Resumo

- **Serviço:** OpenWeatherMap API
- **Custo:** GRATUITO
- **Limite:** 1.000 chamadas/dia (suficiente para ~20.000 usuários com cache de 30min)
- **Upgrade:** Se precisar mais, plano pago $40/mês = 100.000 chamadas/dia

---

## 🚀 Passo a Passo (5 minutos)

### 1️⃣ Criar Conta Gratuita

1. Acesse: **https://openweathermap.org/api**
2. Clique em **"Sign Up"** (canto superior direito)
3. Preencha:
   - Username (ex: navegaja_dev)
   - Email (seu email real)
   - Password (senha segura)
4. Marque **"I am 16 years old and over"**
5. Marque **"I agree with Privacy Policy..."**
6. Marque **"I am not a robot"** (reCAPTCHA)
7. Clique **"Create Account"**

### 2️⃣ Confirmar Email

1. Abra seu email
2. Procure por **"noreply@openweathermap.org"**
3. Assunto: **"OpenWeather - Please confirm your email"**
4. Clique no link de confirmação

### 3️⃣ Copiar API Key

1. Faça login em: **https://home.openweathermap.org**
2. Vá para: **"API keys"** (menu lateral)
3. Você verá uma chave já criada (Default)
4. Copie a chave (parece com: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

   **⚠️ ATENÇÃO:** A chave leva ~10-15 minutos para ativar!

### 4️⃣ Configurar no Backend

1. Abra o arquivo `.env` do backend
2. Localize a linha:
   ```env
   OPENWEATHER_API_KEY=TEMP_KEY_PRECISA_CADASTRAR
   ```
3. Substitua por:
   ```env
   OPENWEATHER_API_KEY=sua-chave-aqui
   ```
4. Salve o arquivo

### 5️⃣ Reiniciar Backend

```bash
# Parar backend (Ctrl+C)
# Iniciar novamente
yarn start:dev
```

### 6️⃣ Testar API

```bash
# Teste simples - clima de Manaus
GET http://localhost:3000/weather/region/manaus

# Se retornar dados do clima = FUNCIONOU! ✅
# Se retornar erro 401 = API key inválida (aguarde ativação)
# Se retornar erro 500 = API key não configurada
```

---

## 🔍 Verificar se API Key Está Ativa

### Método 1: Teste Direto na OpenWeatherMap

```bash
# Substitua YOUR_API_KEY pela sua chave
curl "https://api.openweathermap.org/data/2.5/weather?q=Manaus&appid=YOUR_API_KEY"

# Resposta esperada: JSON com dados do clima
# Se erro 401: aguarde mais alguns minutos
```

### Método 2: Painel OpenWeatherMap

1. Acesse: **https://home.openweathermap.org/api_keys**
2. Veja o status da chave:
   - **Active** = Pronta para usar ✅
   - **Activating** = Aguarde ~10 min ⏳

---

## 📊 Limites do Plano FREE

| Métrica | Limite FREE |
|---------|-------------|
| Chamadas/dia | 1.000 |
| Chamadas/minuto | 60 |
| Clima atual | ✅ Sim |
| Previsão 5 dias | ✅ Sim |
| Alertas | ✅ Sim |
| Histórico | ❌ Não (plano pago) |

### Com Cache de 30 Minutos

- 1 usuário consulta = 1 chamada armazenada 30min
- 100 usuários consultam mesma região em 30min = 1 chamada
- **Capacidade estimada:** ~20.000 usuários/dia

---

## 🆙 Quando Fazer Upgrade?

Se você ver no console:

```
❌ OpenWeather API Error: 429 Too Many Requests
```

Significa que atingiu 1.000 chamadas/dia. Opções:

1. **Aumentar cache:** 30min → 1h (economiza chamadas)
2. **Upgrade para pago:** $40/mês = 100.000 chamadas/dia

**Link para upgrade:** https://openweathermap.org/price

---

## 🧪 Endpoints Disponíveis (Backend)

### Clima Atual

```http
GET /weather/current?lat=-3.119&lng=-60.0217&region=Manaus
GET /weather/region/manaus
GET /weather/region/parintins
```

### Previsão 5 Dias

```http
GET /weather/forecast?lat=-3.119&lng=-60.0217&region=Manaus
```

### Avaliação de Segurança

```http
GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
```

### Regiões Disponíveis

```http
GET /weather/regions
```

### Integração com Safety (Capitão)

```http
GET /safety/weather-suggestion?lat=-3.119&lng=-60.0217
GET /safety/weather-safety?lat=-3.119&lng=-60.0217
```

---

## 🐛 Problemas Comuns

### Erro: "API key não configurada"

**Solução:**
1. Verifique se adicionou `OPENWEATHER_API_KEY` no `.env`
2. Reinicie o backend

### Erro: 401 Unauthorized

**Solução:**
1. API key ainda está ativando (aguarde 10-15 min)
2. Verifique se copiou a chave correta (sem espaços)

### Erro: "Não foi possível obter dados meteorológicos"

**Solução:**
1. Verifique conexão com internet
2. Teste API key diretamente: https://api.openweathermap.org/data/2.5/weather?q=Manaus&appid=SUA_KEY

### Cache Não Funciona

**Solução:**
1. Cache está funcionando se chamadas subsequentes forem rápidas (~50ms)
2. Logs devem mostrar: `✅ Cache hit: weather:current:...`

---

## 📚 Documentação Oficial

- API Docs: https://openweathermap.org/api
- FAQ: https://openweathermap.org/faq
- Status: https://status.openweathermap.org

---

## ✅ Checklist Final

- [ ] Conta criada no OpenWeatherMap
- [ ] Email confirmado
- [ ] API key copiada
- [ ] Variável `OPENWEATHER_API_KEY` no `.env`
- [ ] Backend reiniciado
- [ ] Teste `GET /weather/region/manaus` funcionando
- [ ] Cache funcionando (segunda chamada rápida)

---

**🎉 Tudo pronto! Agora o backend tem clima em tempo real GRATUITO!**
