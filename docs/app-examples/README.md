# 📱 Exemplos para o App React Native

Estes arquivos são **exemplos de implementação** para o app móvel NavegaJá (React Native).

⚠️ **NÃO são parte do backend!** São apenas referência para implementação no app.

## 📂 Arquivos:

### Componentes React Native:
- **`PromotionBanner.tsx.example`** - Componente de banner de promoção
  - Renderiza imagem, título, descrição e botão CTA
  - Lida com 3 tipos de ação: search, url, deeplink

- **`HomeScreen-with-promotions.tsx.example`** - Exemplo de HomeScreen
  - Como integrar promoções na tela inicial
  - Como buscar do endpoint `/promotions/active`
  - Como renderizar lista de banners

### Services:
- **`api-service-example.ts.example`** - Configuração de API com Axios
  - Configuração base do axios
  - Funções para buscar promoções
  - Funções para validar cupons
  - Funções para buscar/calcular preços de viagens

⚠️ **Nota:** Arquivos têm extensão `.example` para evitar erros de compilação no backend TypeScript. Remova `.example` ao copiar para seu projeto React Native.

## 🚀 Como Usar:

### 1. Copiar arquivos para seu projeto React Native:
```bash
# Remova a extensão .example e copie para a estrutura do seu app:
cp PromotionBanner.tsx.example /seu-app/src/components/PromotionBanner.tsx
cp HomeScreen-with-promotions.tsx.example /seu-app/src/screens/HomeScreen.tsx
cp api-service-example.ts.example /seu-app/src/services/api.ts
```

### 2. Instalar dependências necessárias:
```bash
npm install axios react-native-gesture-handler @react-navigation/native
```

### 3. Ajustar imports:
- Ajuste paths de imports conforme sua estrutura
- Configure URL da API (development vs production)

### 4. Implementar handlers de navegação:
- Configure `navigation.navigate` conforme suas rotas
- Implemente deeplinks se necessário

## 📖 Documentação:

Para entender o fluxo completo, veja os guias no diretório raiz:
- `../PROMOTIONS_FLOW.md` - Fluxo detalhado
- `../PROMOTIONS_QUICK_START.md` - Guia rápido
- `../PROMOTIONS_GUIDE.md` - Documentação completa
- `../DISCOUNT_SYSTEM.md` - Sistema de descontos

## ✅ Status:

- ✅ Backend implementado e funcionando
- ✅ Endpoint `/promotions/active` disponível
- ✅ 2 promoções de exemplo criadas
- ⏳ Aguardando implementação no app React Native

## 🎯 Próximos Passos:

1. Copiar componentes para o app
2. Ajustar imports e navegação
3. Testar clique em promoção → navegação funciona
4. Adicionar analytics/tracking
5. Customizar estilos conforme design do app
