# 🚨 Sistema de Segurança - Guia Completo de Integração

**Última Atualização:** 15/02/2026
**Backend API:** `http://localhost:3000/safety`
**Versão:** 1.0.0

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Motivação](#motivação)
3. [Funcionalidades](#funcionalidades)
4. [Endpoints da API](#endpoints-da-api)
5. [Interfaces TypeScript](#interfaces-typescript)
6. [Fluxos de Uso](#fluxos-de-uso)
7. [Exemplos React Native](#exemplos-react-native)
8. [Checklist de Implementação](#checklist-de-implementação)

---

## 🎯 Visão Geral

O **Sistema de Segurança** foi implementado para prevenir acidentes e melhorar a segurança das viagens fluviais, inspirado em tragédias recentes na região de Manaus (Encontro das Águas).

### Componentes Principais

1. **Contatos de Emergência** - Números de socorro (Marinha, Bombeiros, Polícia, SAMU, etc)
2. **Checklist de Segurança** - Verificação obrigatória antes de iniciar viagens
3. **Alertas SOS** - Sistema de emergência para passageiros e capitães

---

## 💡 Motivação

Em fevereiro de 2026, ocorreu um trágico acidente próximo ao Encontro das Águas em Manaus, onde uma lancha naufragou devido a condições climáticas adversas (banzeiro intenso). O acidente resultou em mortes, incluindo crianças, idosos e adultos.

**Medidas implementadas:**
- ✅ Checklist de segurança obrigatório (coletes, extintores, capacidade)
- ✅ Verificação de condições climáticas
- ✅ Acesso rápido a números de emergência
- ✅ Sistema SOS integrado ao GPS
- ✅ Validação de capacidade máxima da embarcação

---

## 🚀 Funcionalidades

### 1. Contatos de Emergência

Lista pública de números de socorro que os usuários podem acessar instantaneamente.

**Serviços Incluídos:**
- 🚢 **Marinha do Brasil** (185) - Emergências marítimas
- 🚢 **Capitania dos Portos** - Fiscalização e segurança
- 🚒 **Bombeiros** (193) - Incêndios e resgates
- 👮 **Polícia** (190) - Emergências policiais
- 🏥 **SAMU** (192) - Emergências médicas
- 🏛️ **Defesa Civil** (199) - Desastres naturais

### 2. Checklist de Segurança

Capitães devem preencher checklist **ANTES** de iniciar a viagem:

- ✅ Coletes salva-vidas disponíveis (quantidade suficiente)
- ✅ Extintor de incêndio verificado
- ✅ Condições climáticas favoráveis
- ✅ Embarcação em boas condições
- ✅ Equipamentos de emergência (rádio, sinalizadores)
- ✅ Luzes de navegação funcionando
- ✅ Capacidade máxima respeitada

### 3. Alertas SOS

Qualquer usuário pode acionar emergência com:

**Tipos de Alerta:**
- 🆘 Emergência Geral
- 🏥 Emergência Médica
- 🔥 Incêndio
- 💧 Vazamento/Naufrágio
- ⚙️ Problema Mecânico
- 🌧️ Condições Climáticas Perigosas
- 💥 Acidente

**Dados Capturados:**
- Localização GPS (latitude/longitude)
- Tipo de emergência
- Descrição do problema
- Viagem associada
- Timestamp

---

## 📡 Endpoints da API

### Contatos de Emergência

```
GET    /safety/emergency-contacts          # Listar contatos (público)
GET    /safety/emergency-contacts?region=Manaus  # Filtrar por região
POST   /safety/emergency-contacts          # Criar contato (admin)
PUT    /safety/emergency-contacts/:id      # Atualizar contato (admin)
POST   /safety/emergency-contacts/seed     # Seed inicial (admin)
```

### Checklist de Segurança

```
POST   /safety/checklists                  # Criar checklist (capitão)
PATCH  /safety/checklists/:id              # Atualizar checklist (capitão)
GET    /safety/checklists/trip/:tripId     # Buscar por viagem
GET    /safety/checklists/trip/:tripId/status  # Verificar se completo
```

### Alertas SOS

```
POST   /safety/sos                         # Criar alerta SOS
GET    /safety/sos/active                  # Listar ativos (admin/capitão)
PATCH  /safety/sos/:id/resolve             # Resolver (admin/capitão)
PATCH  /safety/sos/:id/cancel              # Cancelar (próprio usuário)
GET    /safety/sos/my-alerts               # Meus alertas
```

---

## 🔧 Interfaces TypeScript

### EmergencyContact

```typescript
enum EmergencyServiceType {
  MARINHA = 'marinha',
  BOMBEIROS = 'bombeiros',
  POLICIA = 'policia',
  SAMU = 'samu',
  DEFESA_CIVIL = 'defesa_civil',
  CAPITANIA_PORTOS = 'capitania_portos',
  OUTROS = 'outros',
}

interface EmergencyContact {
  id: string;
  type: EmergencyServiceType;
  name: string;                  // "Corpo de Bombeiros Militar"
  phoneNumber: string;           // "193"
  description: string | null;    // "Incêndios, resgates..."
  region: string | null;         // "Manaus", "Amazonas", "Nacional"
  isActive: boolean;
  priority: number;              // Ordem de exibição (0 = mais importante)
  createdAt: Date;
  updatedAt: Date;
}
```

### SafetyChecklist

```typescript
interface SafetyChecklist {
  id: string;
  tripId: string;
  captainId: string;

  // Itens obrigatórios
  lifeJacketsAvailable: boolean;
  lifeJacketsCount: number | null;
  fireExtinguisherCheck: boolean;
  weatherConditionsOk: boolean;
  weatherCondition: string | null;       // "Ensolarado", "Nublado"
  boatConditionGood: boolean;
  emergencyEquipmentCheck: boolean;
  navigationLightsWorking: boolean;
  maxCapacityRespected: boolean;
  passengersOnBoard: number | null;
  maxCapacity: number | null;

  observations: string | null;
  allItemsChecked: boolean;              // true quando tudo OK
  completedAt: Date | null;
  createdAt: Date;
}
```

### SosAlert

```typescript
enum SosAlertType {
  EMERGENCY = 'emergency',
  MEDICAL = 'medical',
  FIRE = 'fire',
  WATER_LEAK = 'water_leak',
  MECHANICAL = 'mechanical',
  WEATHER = 'weather',
  ACCIDENT = 'accident',
  OTHER = 'other',
}

enum SosAlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  FALSE_ALARM = 'false_alarm',
  CANCELLED = 'cancelled',
}

interface SosAlert {
  id: string;
  userId: string;
  tripId: string | null;
  type: SosAlertType;
  status: SosAlertStatus;
  description: string | null;

  // Localização GPS
  latitude: number | null;
  longitude: number | null;
  location: string | null;              // "Próximo ao Encontro das Águas"

  // Resolução
  resolvedById: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🔄 Fluxos de Uso

### Fluxo 1: Exibir Contatos de Emergência

```
APP STARTUP
    ↓
1. Fetch contatos de emergência
   GET /safety/emergency-contacts?region=Manaus
    ↓
2. Exibir lista de emergência na UI
   - Botão "SOS" no menu principal
   - Ícones por tipo (Marinha, Bombeiros, etc)
   - Click-to-call nos números
    ↓
3. Usuário clica no número
   → Linking.openURL(`tel:${phoneNumber}`)
```

### Fluxo 2: Capitão Cria Checklist (Antes da Viagem)

```
CAPITÃO CRIANDO VIAGEM
    ↓
1. Criar checklist
   POST /safety/checklists { tripId: "uuid" }
    ↓
2. Exibir formulário de checklist
   - Toggle switches para cada item
   - Campos numéricos (coletes, capacidade)
   - Campo de observações
    ↓
3. Capitão marca itens conforme verifica
   PATCH /safety/checklists/:id
   { lifeJacketsAvailable: true, ... }
    ↓
4. Backend valida se todos obrigatórios OK
   → allItemsChecked = true
    ↓
5. Viagem só pode iniciar se checklist completo
   GET /safety/checklists/trip/:tripId/status
   { checklistComplete: true }
```

### Fluxo 3: Passageiro Aciona SOS

```
PASSAGEIRO EM EMERGÊNCIA
    ↓
1. Clica no botão SOS vermelho gigante
    ↓
2. Solicita permissão de localização
   Geolocation.getCurrentPosition()
    ↓
3. Exibe modal de seleção de tipo
   - 🆘 Emergência Geral
   - 🏥 Médica
   - 🔥 Incêndio
   - etc.
    ↓
4. Usuário descreve problema (opcional)
    ↓
5. Criar alerta SOS
   POST /safety/sos {
     tripId: "current-trip-id",
     type: "medical",
     description: "Passageiro com dores no peito",
     latitude: -3.1190,
     longitude: -60.0217
   }
    ↓
6. Backend salva alerta com status ACTIVE
    ↓
7. App exibe confirmação + lista de emergências
   "SOS enviado! Ligue imediatamente:"
   - SAMU: 192
   - Bombeiros: 193
   - Marinha: 185
    ↓
8. Notificação push para admin/capitão
   (a implementar no futuro)
```

### Fluxo 4: Admin Resolve SOS

```
ADMIN/CAPITÃO RECEBE NOTIFICAÇÃO
    ↓
1. Lista alertas ativos
   GET /safety/sos/active
    ↓
2. Exibe mapa com pins de alertas
   - Pin vermelho = emergência ativa
   - Clique mostra detalhes
    ↓
3. Admin resolve alerta
   PATCH /safety/sos/:id/resolve
   {
     status: "resolved",
     notes: "Passageiro atendido pelo SAMU"
   }
    ↓
4. Alerta marcado como RESOLVED
    ↓
5. Usuário que acionou recebe notificação
   (a implementar no futuro)
```

---

## 📱 Exemplos React Native

### 1. Listar Contatos de Emergência

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface EmergencyContact {
  id: string;
  type: string;
  name: string;
  phoneNumber: string;
  description: string | null;
}

const EmergencyContactsScreen = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  useEffect(() => {
    fetch('http://localhost:3000/safety/emergency-contacts?region=Manaus')
      .then(res => res.json())
      .then(data => setContacts(data));
  }, []);

  const callNumber = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'marinha': return 'directions-boat';
      case 'bombeiros': return 'local-fire-department';
      case 'policia': return 'local-police';
      case 'samu': return 'local-hospital';
      default: return 'phone';
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#d32f2f' }}>
        🚨 Contatos de Emergência
      </Text>

      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => callNumber(item.phoneNumber)}
            style={{
              flexDirection: 'row',
              padding: 16,
              borderRadius: 8,
              backgroundColor: '#f5f5f5',
              marginBottom: 12,
              alignItems: 'center',
            }}
          >
            <Icon name={getIcon(item.type)} size={32} color="#d32f2f" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.name}</Text>
              <Text style={{ fontSize: 14, color: '#666' }}>{item.description}</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d32f2f', marginTop: 4 }}>
                📞 {item.phoneNumber}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default EmergencyContactsScreen;
```

### 2. Capitão - Checklist de Segurança

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, TextInput, TouchableOpacity, Alert } from 'react-native';

interface ChecklistItem {
  key: keyof ChecklistData;
  label: string;
  required: boolean;
}

interface ChecklistData {
  lifeJacketsAvailable: boolean;
  lifeJacketsCount: number;
  fireExtinguisherCheck: boolean;
  weatherConditionsOk: boolean;
  weatherCondition: string;
  boatConditionGood: boolean;
  emergencyEquipmentCheck: boolean;
  navigationLightsWorking: boolean;
  maxCapacityRespected: boolean;
  passengersOnBoard: number;
  maxCapacity: number;
  observations: string;
}

const SafetyChecklistScreen = ({ tripId, authToken }: { tripId: string; authToken: string }) => {
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistData>({
    lifeJacketsAvailable: false,
    lifeJacketsCount: 0,
    fireExtinguisherCheck: false,
    weatherConditionsOk: false,
    weatherCondition: '',
    boatConditionGood: false,
    emergencyEquipmentCheck: false,
    navigationLightsWorking: false,
    maxCapacityRespected: false,
    passengersOnBoard: 0,
    maxCapacity: 0,
    observations: '',
  });

  const createChecklist = async () => {
    const res = await fetch('http://localhost:3000/safety/checklists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ tripId }),
    });
    const data = await res.json();
    setChecklistId(data.id);
  };

  const updateChecklist = async () => {
    if (!checklistId) {
      await createChecklist();
      return;
    }

    await fetch(`http://localhost:3000/safety/checklists/${checklistId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(checklist),
    });

    Alert.alert('Sucesso', 'Checklist atualizado!');
  };

  const items: ChecklistItem[] = [
    { key: 'lifeJacketsAvailable', label: '🦺 Coletes salva-vidas disponíveis', required: true },
    { key: 'fireExtinguisherCheck', label: '🧯 Extintor de incêndio verificado', required: true },
    { key: 'weatherConditionsOk', label: '🌤️ Condições climáticas favoráveis', required: true },
    { key: 'boatConditionGood', label: '⛵ Embarcação em boas condições', required: true },
    { key: 'emergencyEquipmentCheck', label: '📻 Equipamentos de emergência OK', required: true },
    { key: 'navigationLightsWorking', label: '💡 Luzes de navegação funcionando', required: true },
    { key: 'maxCapacityRespected', label: '👥 Capacidade máxima respeitada', required: true },
  ];

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        ✅ Checklist de Segurança
      </Text>

      {items.map(item => (
        <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Switch
            value={checklist[item.key] as boolean}
            onValueChange={value => setChecklist({ ...checklist, [item.key]: value })}
          />
          <Text style={{ marginLeft: 12, fontSize: 16, flex: 1 }}>
            {item.label}
            {item.required && <Text style={{ color: 'red' }}> *</Text>}
          </Text>
        </View>
      ))}

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16 }}>Quantidade de Coletes:</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginTop: 8 }}
        keyboardType="number-pad"
        value={String(checklist.lifeJacketsCount)}
        onChangeText={text => setChecklist({ ...checklist, lifeJacketsCount: Number(text) })}
      />

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16 }}>Condição Climática:</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginTop: 8 }}
        placeholder="Ex: Ensolarado, Nublado, Chuva leve"
        value={checklist.weatherCondition}
        onChangeText={text => setChecklist({ ...checklist, weatherCondition: text })}
      />

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16 }}>Passageiros a Bordo:</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginTop: 8 }}
        keyboardType="number-pad"
        value={String(checklist.passengersOnBoard)}
        onChangeText={text => setChecklist({ ...checklist, passengersOnBoard: Number(text) })}
      />

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16 }}>Capacidade Máxima:</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginTop: 8 }}
        keyboardType="number-pad"
        value={String(checklist.maxCapacity)}
        onChangeText={text => setChecklist({ ...checklist, maxCapacity: Number(text) })}
      />

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16 }}>Observações:</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
          minHeight: 100,
          textAlignVertical: 'top',
        }}
        multiline
        placeholder="Observações adicionais..."
        value={checklist.observations}
        onChangeText={text => setChecklist({ ...checklist, observations: text })}
      />

      <TouchableOpacity
        onPress={updateChecklist}
        style={{
          backgroundColor: '#4caf50',
          padding: 16,
          borderRadius: 8,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
          ✅ Salvar Checklist
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default SafetyChecklistScreen;
```

### 3. Botão SOS de Emergência

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

type SosType = 'emergency' | 'medical' | 'fire' | 'water_leak' | 'mechanical' | 'weather' | 'accident';

const SosButton = ({ tripId, authToken }: { tripId?: string; authToken: string }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');

  const triggerSos = async (type: SosType) => {
    // Obter localização GPS
    Geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords;

        const response = await fetch('http://localhost:3000/safety/sos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            tripId,
            type,
            description,
            latitude,
            longitude,
          }),
        });

        if (response.ok) {
          Alert.alert(
            '🚨 SOS ENVIADO!',
            'Seu alerta de emergência foi registrado.\n\nLigue imediatamente:\n\n' +
            '🏥 SAMU: 192\n' +
            '🚒 Bombeiros: 193\n' +
            '🚢 Marinha: 185',
            [{ text: 'OK' }]
          );
          setModalVisible(false);
        }
      },
      error => {
        Alert.alert('Erro', 'Não foi possível obter sua localização');
      }
    );
  };

  return (
    <>
      {/* Botão SOS Gigante */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{
          position: 'absolute',
          bottom: 32,
          right: 32,
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#d32f2f',
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
      >
        <Text style={{ fontSize: 24, color: '#fff', fontWeight: 'bold' }}>SOS</Text>
      </TouchableOpacity>

      {/* Modal de Seleção de Tipo */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#d32f2f' }}>
              🚨 Tipo de Emergência
            </Text>

            {[
              { type: 'emergency', label: '🆘 Emergência Geral', color: '#d32f2f' },
              { type: 'medical', label: '🏥 Emergência Médica', color: '#f44336' },
              { type: 'fire', label: '🔥 Incêndio', color: '#ff5722' },
              { type: 'water_leak', label: '💧 Vazamento/Naufrágio', color: '#2196f3' },
              { type: 'mechanical', label: '⚙️ Problema Mecânico', color: '#9e9e9e' },
              { type: 'weather', label: '🌧️ Condições Climáticas', color: '#607d8b' },
              { type: 'accident', label: '💥 Acidente', color: '#ff9800' },
            ].map(item => (
              <TouchableOpacity
                key={item.type}
                onPress={() => triggerSos(item.type as SosType)}
                style={{
                  backgroundColor: item.color,
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{ padding: 16, borderRadius: 8, backgroundColor: '#f5f5f5', marginTop: 8 }}
            >
              <Text style={{ textAlign: 'center', fontSize: 16 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default SosButton;
```

---

## ✅ Checklist de Implementação

### Backend (✅ Implementado)

- [x] Entidades criadas (EmergencyContact, SafetyChecklist, SosAlert)
- [x] Service com lógica de negócio
- [x] Controller com todos endpoints
- [x] Seed de contatos de emergência padrão
- [x] Validações de permissão (Admin, Capitão)
- [x] Testes HTTP criados

### Frontend (Para App Mobile)

- [ ] **Tela de Contatos de Emergência**
  - [ ] Listar todos os contatos
  - [ ] Click-to-call nos números
  - [ ] Ícones por tipo de serviço
  - [ ] Filtro por região

- [ ] **Tela de Checklist (Capitão)**
  - [ ] Formulário com todos os itens
  - [ ] Validação de campos obrigatórios
  - [ ] Indicador de progresso
  - [ ] Bloqueio de viagem se incompleto

- [ ] **Botão SOS de Emergência**
  - [ ] Botão flutuante vermelho
  - [ ] Modal de seleção de tipo
  - [ ] Captura de GPS
  - [ ] Confirmação visual
  - [ ] Lista de números após acionar

- [ ] **Dashboard Admin (Web)**
  - [ ] Mapa com alertas SOS ativos
  - [ ] Lista de checklists pendentes
  - [ ] Gerenciamento de contatos

- [ ] **Notificações Push**
  - [ ] Notificar admin quando SOS acionado
  - [ ] Notificar usuário quando SOS resolvido

---

## 🔐 Autenticação

Todos os endpoints (exceto `GET /emergency-contacts`) requerem autenticação JWT:

```typescript
headers: {
  'Authorization': `Bearer ${authToken}`
}
```

**Permissões:**
- `GET /emergency-contacts` - **Público** (não requer auth)
- Criar/Atualizar contatos - **Admin**
- Criar/Atualizar checklist - **Capitão** ou **Admin**
- Criar SOS - **Qualquer usuário autenticado**
- Resolver SOS - **Admin** ou **Capitão**
- Cancelar SOS - **Próprio usuário** que criou

---

## 📞 Números de Emergência Padrão (Manaus/AM)

| Serviço | Número | Descrição |
|---------|--------|-----------|
| 🚢 Marinha | **185** | Emergências marítimas/fluviais |
| 🚢 Capitania | **(92) 3622-2500** | Capitania Fluvial da Amazônia |
| 🚒 Bombeiros | **193** | Incêndios, resgates |
| 👮 Polícia | **190** | Emergências policiais |
| 🏥 SAMU | **192** | Emergências médicas |
| 🏛️ Defesa Civil | **199** | Desastres naturais |

---

## 🎨 Cores Recomendadas (Paleta de Emergência)

```
VERMELHO_EMERGENCIA: #d32f2f   // Botão SOS, alertas críticos
LARANJA_ALERTA: #ff9800        // Avisos, checklist incompleto
VERDE_SEGURO: #4caf50          // Checklist completo, tudo OK
AZUL_INFO: #2196f3             // Informações, contatos
CINZA_NEUTRO: #9e9e9e          // Itens desativados
```

---

## 📝 Observações Finais

1. **GPS Obrigatório:** Sempre solicitar permissão de localização antes de acionar SOS
2. **Offline First:** Cache de contatos de emergência para funcionar offline
3. **UX Crítica:** Botão SOS deve ser GIGANTE e VERMELHO, impossível de errar
4. **Confirmação:** Evitar cliques acidentais com modal de confirmação
5. **Accessibility:** Botões grandes, alto contraste, suporte a TalkBack/VoiceOver

---

## 🆘 Suporte

**Dúvidas ou problemas?**
- Backend: `http://localhost:3000/safety`
- Documentação da API: `http://localhost:3000/api-docs` (Swagger)
- Testes: `examples/safety-test.http`

---

**Desenvolvido com ❤️ pela equipe Navegaja**
**Em memória às vítimas do acidente no Encontro das Águas - Manaus/AM**
