# 📱💻 Guia Completo de Implementação - Frontend Mobile & Web

**Data:** 2026-02-16
**Backend Base:** `http://localhost:3000`

---

## 🎯 O QUE FOI IMPLEMENTADO NO BACKEND

### ✅ Novos Endpoints Disponíveis:

#### **Admin Dashboard**:
- `GET /admin/users` - Listar todos usuários
- `GET /admin/trips` - Listar todas viagens
- `GET /admin/shipments` - Listar todas encomendas
- `GET /admin/dashboard` - Overview geral

#### **Validações de Segurança**:
- ✅ Checklist obrigatório antes de iniciar viagem
- ✅ Validação de clima antes de iniciar viagem
- ✅ Validação de datas (não criar viagem no passado)
- ✅ Validação de capacidade da embarcação
- ✅ Validação de conflitos de horário

---

## 📱 APP MOBILE (React Native / Flutter)

### 1️⃣ **TELA DE LISTAGEM DE VIAGENS**

#### Adicionar Badge de Clima

**Endpoint:**
```http
GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
```

**Implementação:**
```jsx
// React Native Example
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

const TripCard = ({ trip }) => {
  const [weatherSafety, setWeatherSafety] = useState(null);

  useEffect(() => {
    // Buscar clima ao carregar a viagem
    fetch(`http://localhost:3000/weather/navigation-safety?lat=${trip.originLat}&lng=${trip.originLng}`)
      .then(res => res.json())
      .then(data => setWeatherSafety(data))
      .catch(err => console.error('Erro ao buscar clima:', err));
  }, [trip.id]);

  const getWeatherBadge = () => {
    if (!weatherSafety) return null;

    const { safetyScore } = weatherSafety;
    let color, icon, text;

    if (safetyScore >= 70) {
      color = '#4CAF50'; // Verde
      icon = '☀️';
      text = 'Clima Favorável';
    } else if (safetyScore >= 50) {
      color = '#FFA726'; // Laranja
      icon = '⚠️';
      text = 'Clima Moderado';
    } else {
      color = '#F44336'; // Vermelho
      icon = '❌';
      text = 'Clima Perigoso';
    }

    return (
      <View style={{ backgroundColor: color, padding: 8, borderRadius: 5 }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>
          {icon} {text} ({safetyScore}/100)
        </Text>
      </View>
    );
  };

  return (
    <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 12, borderRadius: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
        {trip.origin} → {trip.destination}
      </Text>
      <Text>Partida: {new Date(trip.departureAt).toLocaleString()}</Text>
      <Text>Preço: R$ {trip.price.toFixed(2)}</Text>

      {/* Badge de Clima */}
      {getWeatherBadge()}
    </View>
  );
};

export default TripCard;
```

---

### 2️⃣ **TELA DE DETALHES DA VIAGEM**

#### Mostrar Informações Completas de Clima

**Endpoint:**
```http
GET /weather/current?lat=-3.119&lng=-60.0217&region=Manaus
```

**Implementação:**
```jsx
const TripDetailsScreen = ({ route }) => {
  const { trip } = route.params;
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3000/weather/current?lat=${trip.originLat}&lng=${trip.originLng}&region=${trip.origin}`)
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(err => console.error('Erro ao buscar clima:', err));
  }, []);

  return (
    <ScrollView>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
          {trip.origin} → {trip.destination}
        </Text>

        {/* Informações da Viagem */}
        <View style={{ marginTop: 20 }}>
          <Text>🛥 Capitão: {trip.captain.name}</Text>
          <Text>📅 Partida: {new Date(trip.departureAt).toLocaleString()}</Text>
          <Text>💺 Assentos disponíveis: {trip.availableSeats}/{trip.totalSeats}</Text>
          <Text>💰 Preço: R$ {trip.price.toFixed(2)}</Text>
        </View>

        {/* Card de Clima */}
        {weather && (
          <View style={{ marginTop: 20, backgroundColor: '#E3F2FD', padding: 16, borderRadius: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              🌤 Condições Climáticas
            </Text>
            <Text>🌡 Temperatura: {weather.temperature}°C (Sensação: {weather.feelsLike}°C)</Text>
            <Text>💨 Vento: {weather.windSpeed} km/h ({weather.windDirection})</Text>
            <Text>💧 Umidade: {weather.humidity}%</Text>
            <Text>👁 Visibilidade: {weather.visibility} km</Text>
            <Text style={{ marginTop: 8, fontStyle: 'italic' }}>
              {weather.description}
            </Text>
          </View>
        )}

        {/* Botão de Reservar */}
        <TouchableOpacity
          style={{ backgroundColor: '#2196F3', padding: 16, borderRadius: 10, marginTop: 20 }}
          onPress={() => handleBookTrip(trip.id)}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
            Reservar Viagem
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
```

---

### 3️⃣ **TELA DO CAPITÃO - CRIAR VIAGEM**

#### Validações e Alertas

**Implementação:**
```jsx
const CreateTripScreen = () => {
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    boatId: '',
    departureTime: new Date(),
    arrivalTime: new Date(),
    price: '',
    totalSeats: '',
  });

  const [errors, setErrors] = useState({});

  const handleSubmit = async () => {
    try {
      const response = await fetch('http://localhost:3000/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();

        // Mostrar erro amigável para o usuário
        Alert.alert(
          'Erro ao criar viagem',
          error.message,
          [{ text: 'OK' }]
        );
        return;
      }

      const trip = await response.json();

      Alert.alert(
        '✅ Viagem criada com sucesso!',
        `${trip.origin} → ${trip.destination}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível criar a viagem. Tente novamente.');
    }
  };

  return (
    <ScrollView>
      {/* Formulário de criação de viagem */}
      <TextInput
        placeholder="Origem"
        value={formData.origin}
        onChangeText={(text) => setFormData({ ...formData, origin: text })}
      />
      <TextInput
        placeholder="Destino"
        value={formData.destination}
        onChangeText={(text) => setFormData({ ...formData, destination: text })}
      />
      {/* ... outros campos */}

      <TouchableOpacity onPress={handleSubmit}>
        <Text>Criar Viagem</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
```

**Mensagens de Erro que o Backend Retorna:**
- ✅ "Data de partida deve ser futura"
- ✅ "Data de chegada deve ser posterior à data de partida"
- ✅ "Embarcação não encontrada ou você não é o proprietário"
- ✅ "Total de assentos excede a capacidade da embarcação"
- ✅ "Esta embarcação já possui viagem agendada neste horário"

---

### 4️⃣ **TELA DO CAPITÃO - INICIAR VIAGEM**

#### Validações de Segurança (Checklist + Clima)

**Implementação:**
```jsx
const StartTripScreen = ({ route }) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    // Buscar viagem
    fetchTripDetails();
    // Buscar checklist
    fetchChecklist();
    // Buscar clima
    fetchWeather();
  }, []);

  const fetchChecklist = async () => {
    const res = await fetch(`http://localhost:3000/safety/checklists/trip/${tripId}`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    const data = await res.json();
    setChecklist(data);
  };

  const fetchWeather = async () => {
    const res = await fetch(`http://localhost:3000/weather/navigation-safety?lat=${trip.originLat}&lng=${trip.originLng}`);
    const data = await res.json();
    setWeather(data);
  };

  const handleStartTrip = async () => {
    // Verificar checklist
    if (!checklist || !checklist.isComplete) {
      Alert.alert(
        '⚠️ Checklist Incompleto',
        'Por favor, complete o checklist de segurança antes de iniciar a viagem.',
        [
          { text: 'Cancelar' },
          { text: 'Ir para Checklist', onPress: () => navigation.navigate('Checklist', { tripId }) }
        ]
      );
      return;
    }

    // Verificar clima
    if (weather && weather.safetyScore < 50) {
      Alert.alert(
        '❌ Condições Climáticas Perigosas',
        `Score de segurança: ${weather.safetyScore}/100\n\n` +
        `Riscos: ${weather.risks.join(', ')}\n\n` +
        `Não é recomendado iniciar a viagem no momento.`,
        [
          { text: 'Entendi', style: 'cancel' },
        ]
      );
      return;
    }

    if (weather && weather.safetyScore < 70) {
      Alert.alert(
        '⚠️ Condições Climáticas Moderadas',
        `Score de segurança: ${weather.safetyScore}/100\n\n` +
        `Recomendações: ${weather.recommendations.join(', ')}\n\n` +
        `Deseja continuar mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => startTripConfirmed() },
        ]
      );
      return;
    }

    // Clima OK - iniciar viagem
    startTripConfirmed();
  };

  const startTripConfirmed = async () => {
    try {
      const response = await fetch(`http://localhost:3000/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      if (!response.ok) {
        const error = await response.json();
        Alert.alert('Erro', error.message);
        return;
      }

      Alert.alert(
        '🚤 Viagem Iniciada!',
        'Boa viagem e navegação segura!',
        [{ text: 'OK', onPress: () => navigation.navigate('TripTracking', { tripId }) }]
      );

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível iniciar a viagem.');
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Iniciar Viagem
      </Text>

      {/* Status do Checklist */}
      <View style={{ backgroundColor: checklist?.isComplete ? '#4CAF50' : '#F44336', padding: 16, borderRadius: 10, marginBottom: 16 }}>
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          {checklist?.isComplete ? '✅ Checklist Completo' : '❌ Checklist Incompleto'}
        </Text>
      </View>

      {/* Status do Clima */}
      {weather && (
        <View style={{
          backgroundColor: weather.safetyScore >= 70 ? '#4CAF50' : weather.safetyScore >= 50 ? '#FFA726' : '#F44336',
          padding: 16,
          borderRadius: 10,
          marginBottom: 16
        }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
            🌤 Clima: {weather.safetyScore}/100
          </Text>
          <Text style={{ color: 'white', marginTop: 8 }}>
            {weather.recommendation}
          </Text>
        </View>
      )}

      {/* Botão de Iniciar */}
      <TouchableOpacity
        style={{
          backgroundColor: '#2196F3',
          padding: 16,
          borderRadius: 10,
          opacity: (!checklist?.isComplete || (weather && weather.safetyScore < 50)) ? 0.5 : 1
        }}
        onPress={handleStartTrip}
        disabled={!checklist?.isComplete || (weather && weather.safetyScore < 50)}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
          🚤 Iniciar Viagem
        </Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

### 5️⃣ **RASTREAMENTO DE ENCOMENDAS**

#### Tela de Rastreamento

**Endpoint:**
```http
GET /shipments/track/{trackingCode}
```

**Implementação:**
```jsx
const TrackShipmentScreen = () => {
  const [trackingCode, setTrackingCode] = useState('');
  const [shipment, setShipment] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const handleTrack = async () => {
    try {
      const response = await fetch(`http://localhost:3000/shipments/track/${trackingCode}`);
      const data = await response.json();

      setShipment(data.shipment);
      setTimeline(data.timeline);
    } catch (error) {
      Alert.alert('Erro', 'Código de rastreamento inválido');
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      PENDING: '📦',
      COLLECTED: '✅',
      IN_TRANSIT: '🚤',
      ARRIVED: '🏁',
      DELIVERED: '📬',
      CANCELLED: '❌',
    };
    return icons[status] || '❓';
  };

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Rastrear Encomenda
      </Text>

      {/* Input de Código */}
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 10,
          padding: 12,
          fontSize: 16,
          marginBottom: 16,
        }}
        placeholder="Digite o código de rastreamento"
        value={trackingCode}
        onChangeText={setTrackingCode}
        autoCapitalize="characters"
      />

      <TouchableOpacity
        style={{ backgroundColor: '#2196F3', padding: 16, borderRadius: 10, marginBottom: 20 }}
        onPress={handleTrack}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
          🔍 Rastrear
        </Text>
      </TouchableOpacity>

      {/* Detalhes da Encomenda */}
      {shipment && (
        <View>
          <View style={{ backgroundColor: '#E3F2FD', padding: 16, borderRadius: 10, marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              📦 {shipment.trackingCode}
            </Text>
            <Text>Status: {getStatusIcon(shipment.status)} {shipment.status}</Text>
            <Text>Origem: {shipment.origin}</Text>
            <Text>Destino: {shipment.destination}</Text>
            <Text>Preço: R$ {shipment.totalPrice.toFixed(2)}</Text>
          </View>

          {/* Timeline */}
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            📅 Histórico
          </Text>
          {timeline.map((event, index) => (
            <View key={event.id} style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ width: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 24 }}>{getStatusIcon(event.status)}</Text>
                {index < timeline.length - 1 && (
                  <View style={{ width: 2, flex: 1, backgroundColor: '#2196F3', marginVertical: 4 }} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: 'bold' }}>{event.description}</Text>
                <Text style={{ color: '#666', fontSize: 12 }}>
                  {new Date(event.timestamp).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};
```

---

## 💻 FRONTEND WEB (Dashboard Admin)

### 1️⃣ **PÁGINA DE LISTAGEM DE USUÁRIOS**

**Endpoint:**
```http
GET /admin/users?page=1&limit=20&role=passenger&search=João
Authorization: Bearer {adminToken}
```

**Implementação (React):**
```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    role: '',
    search: '',
  });

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await axios.get(`http://localhost:3000/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      });

      setUsers(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  return (
    <div className="container">
      <h1>Gerenciar Usuários</h1>

      {/* Filtros */}
      <div className="filters">
        <input
          type="text"
          placeholder="Buscar por nome, email ou telefone..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />

        <select
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
        >
          <option value="">Todos os tipos</option>
          <option value="passenger">Passageiros</option>
          <option value="captain">Capitães</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {/* Tabela */}
      <table className="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Telefone</th>
            <th>Role</th>
            <th>Data de Cadastro</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email || '-'}</td>
              <td>{user.phone}</td>
              <td>
                <span className={`badge badge-${user.role}`}>
                  {user.role}
                </span>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
              <td>
                <button onClick={() => handleViewUser(user.id)}>Ver</button>
                <button onClick={() => handleEditUser(user.id)}>Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Paginação */}
      <div className="pagination">
        <button
          disabled={pagination.page === 1}
          onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
        >
          Anterior
        </button>
        <span>Página {pagination.page} de {pagination.totalPages}</span>
        <button
          disabled={pagination.page === pagination.totalPages}
          onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
        >
          Próxima
        </button>
      </div>
    </div>
  );
};

export default UsersPage;
```

**CSS:**
```css
.container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.filters input,
.filters select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.filters input {
  flex: 1;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
}

.table thead {
  background: #2196F3;
  color: white;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.table tbody tr:hover {
  background: #f5f5f5;
}

.badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.badge-passenger {
  background: #E3F2FD;
  color: #1976D2;
}

.badge-captain {
  background: #FFF3E0;
  color: #F57C00;
}

.badge-admin {
  background: #FCE4EC;
  color: #C2185B;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.pagination button {
  padding: 8px 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

### 2️⃣ **DASHBOARD OVERVIEW**

**Endpoint:**
```http
GET /admin/dashboard
Authorization: Bearer {adminToken}
```

**Implementação:**
```jsx
const DashboardPage = () => {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get('http://localhost:3000/admin/dashboard', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      });
      setOverview(response.data);
    } catch (error) {
      console.error('Erro ao buscar dashboard:', error);
    }
  };

  if (!overview) return <div>Carregando...</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Cards de Estatísticas */}
      <div className="stats-grid">
        {/* Usuários */}
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Usuários</h3>
            <p className="stat-number">{overview.users.total}</p>
            <p className="stat-detail">+{overview.users.newToday} hoje</p>
          </div>
        </div>

        {/* Viagens */}
        <div className="stat-card">
          <div className="stat-icon">🚤</div>
          <div className="stat-content">
            <h3>Viagens</h3>
            <p className="stat-number">{overview.trips.total}</p>
            <p className="stat-detail">{overview.trips.inProgress} em andamento</p>
          </div>
        </div>

        {/* Encomendas */}
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>Encomendas</h3>
            <p className="stat-number">{overview.shipments.total}</p>
            <p className="stat-detail">{overview.shipments.inTransit} em trânsito</p>
          </div>
        </div>

        {/* Alertas SOS */}
        <div className="stat-card alert">
          <div className="stat-icon">🆘</div>
          <div className="stat-content">
            <h3>Alertas SOS</h3>
            <p className="stat-number">{overview.sosAlerts.active}</p>
            <p className="stat-detail">Ativos agora</p>
          </div>
        </div>
      </div>

      {/* Receita */}
      <div className="revenue-section">
        <h2>💰 Receita</h2>
        <div className="revenue-grid">
          <div className="revenue-card">
            <h4>Hoje</h4>
            <p className="revenue-amount">R$ {overview.revenue.today.toFixed(2)}</p>
          </div>
          <div className="revenue-card">
            <h4>Esta Semana</h4>
            <p className="revenue-amount">R$ {overview.revenue.thisWeek.toFixed(2)}</p>
          </div>
          <div className="revenue-card">
            <h4>Este Mês</h4>
            <p className="revenue-amount">R$ {overview.revenue.thisMonth.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
```

**CSS:**
```css
.dashboard {
  padding: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-card.alert {
  background: #FFEBEE;
  border-left: 4px solid #F44336;
}

.stat-icon {
  font-size: 48px;
}

.stat-content h3 {
  margin: 0;
  font-size: 14px;
  color: #666;
  text-transform: uppercase;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  margin: 8px 0;
}

.stat-detail {
  font-size: 12px;
  color: #999;
}

.revenue-section {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.revenue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.revenue-card {
  background: #E3F2FD;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.revenue-card h4 {
  margin: 0 0 8px 0;
  color: #1976D2;
  font-size: 14px;
}

.revenue-amount {
  font-size: 24px;
  font-weight: bold;
  color: #1976D2;
  margin: 0;
}
```

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

### **App Mobile:**
- [ ] Adicionar badge de clima nas listagens de viagens
- [ ] Mostrar detalhes de clima na tela de detalhes da viagem
- [ ] Implementar validações de segurança antes de iniciar viagem
- [ ] Criar tela de rastreamento de encomendas
- [ ] Adicionar alertas de clima antes de reservar viagem

### **Frontend Web (Admin):**
- [ ] Implementar página de listagem de usuários
- [ ] Implementar página de listagem de viagens
- [ ] Implementar página de listagem de encomendas
- [ ] Criar dashboard overview com estatísticas
- [ ] Adicionar filtros e paginação em todas as listagens

---

## 🔗 RESUMO DOS ENDPOINTS NOVOS

| Endpoint | Método | Descrição | Acesso |
|----------|--------|-----------|--------|
| `/admin/users` | GET | Listar todos usuários | Admin |
| `/admin/trips` | GET | Listar todas viagens | Admin |
| `/admin/shipments` | GET | Listar todas encomendas | Admin |
| `/admin/dashboard` | GET | Overview geral | Admin |
| `/weather/navigation-safety` | GET | Score de segurança do clima | Público |
| `/weather/current` | GET | Clima atual | Público |

---

## 🚀 PRÓXIMOS PASSOS

1. **Implementar no Mobile:**
   - Começar com badge de clima (mais simples)
   - Depois validações de segurança
   - Por último rastreamento de encomendas

2. **Implementar no Web:**
   - Começar com dashboard overview
   - Depois listagens (usuários, viagens, encomendas)
   - Por último filtros avançados

3. **Testes:**
   - Testar todos os fluxos com usuários reais
   - Validar mensagens de erro
   - Verificar performance

---

**Dúvidas?** Todos os endpoints estão documentados no Swagger: `http://localhost:3000/api/docs` 📚
