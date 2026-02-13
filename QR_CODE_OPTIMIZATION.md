# 📱 Otimização de QR Code - NavegaJá

## ❌ **Problema Anterior:**

```typescript
// Backend gerava IMAGEM em base64 (10.000+ caracteres)
qrCode: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." // ❌ ENORME!
```

**Problemas:**
- QR code com 10.000+ caracteres
- Lento para transferir
- Impossível escanear (dados demais)
- Desperdiçava largura de banda

---

## ✅ **Solução Otimizada:**

```typescript
// Backend envia apenas DADOS COMPACTOS (~45 caracteres)
qrCode: "NVGJ-a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6" // ✅ COMPACTO!
```

**Vantagens:**
- ✅ QR code com ~45 caracteres (220x menor!)
- ✅ Rápido para transferir
- ✅ Fácil de escanear
- ✅ Economiza banda

---

## 🎯 **Formato do QR Code:**

```
NVGJ-{bookingId}
```

**Exemplo:**
```
NVGJ-a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6
```

**Onde:**
- `NVGJ` = Prefixo NavegaJá (identificação da empresa)
- `{bookingId}` = UUID da reserva (para validação)

---

## 💻 **Como Usar no App (React Native):**

### **1. Gerar Imagem QR a partir dos dados:**

```typescript
import QRCode from 'react-native-qrcode-svg';

const TicketScreen = ({ route }) => {
  const { booking } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seu QR Code</Text>

      {/* Gerar QR Code a partir dos dados compactos */}
      <QRCode
        value={booking.qrCode}  // ✅ "NVGJ-{id}" (compacto!)
        size={200}
        backgroundColor="white"
        color="black"
      />

      <Text style={styles.code}>{booking.qrCode}</Text>
    </View>
  );
};
```

---

### **2. Scanner de QR Code (Validação):**

```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';

const ScannerScreen = () => {
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    // data = "NVGJ-a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6"

    if (!data.startsWith('NVGJ-')) {
      Alert.alert('QR Code Inválido', 'Este não é um QR code do NavegaJá');
      return;
    }

    const bookingId = data.replace('NVGJ-', '');

    try {
      // Validar no backend
      const response = await api.post(`/bookings/${bookingId}/checkin`);

      if (response.data.bookingStatus === 'checked_in') {
        Alert.alert('✅ Check-in Realizado!', 'Passageiro pode embarcar');
      }
    } catch (error) {
      Alert.alert('❌ Erro', 'QR Code inválido ou reserva não encontrada');
    }
  };

  if (hasPermission === null) {
    return <Text>Solicitando permissão da câmera...</Text>;
  }

  if (hasPermission === false) {
    return <Text>Sem acesso à câmera</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.overlay}>
        <Text style={styles.instruction}>
          Aponte para o QR Code do passageiro
        </Text>
      </View>
    </View>
  );
};
```

---

## 🔧 **Endpoint de Validação (Backend):**

```typescript
// bookings.controller.ts
@Post(':id/checkin')
async checkin(@Param('id') id: string) {
  return this.bookingsService.checkin(id);
}

// bookings.service.ts
async checkin(bookingId: string) {
  const booking = await this.bookingsRepo.findOne({
    where: { id: bookingId },
    relations: ['trip', 'passenger']
  });

  if (!booking) {
    throw new NotFoundException('Reserva não encontrada');
  }

  if (booking.status === BookingStatus.CHECKED_IN) {
    return {
      message: 'Passageiro já fez check-in',
      bookingStatus: booking.status,
      passenger: booking.passenger.name
    };
  }

  if (booking.status === BookingStatus.CANCELLED) {
    throw new BadRequestException('Reserva cancelada');
  }

  booking.status = BookingStatus.CHECKED_IN;
  await this.bookingsRepo.save(booking);

  return {
    message: 'Check-in realizado com sucesso',
    bookingStatus: booking.status,
    passenger: booking.passenger.name,
    trip: {
      origin: booking.trip.origin,
      destination: booking.trip.destination,
      departureAt: booking.trip.departureAt
    }
  };
}
```

---

## 📊 **Comparação de Tamanho:**

| Método | Tamanho | Exemplo |
|--------|---------|---------|
| **Anterior (Base64)** | ~10.000 chars | `data:image/png;base64,iVBORw0KG...` |
| **Otimizado (ID)** | ~45 chars | `NVGJ-a1b2c3d4-e5f6-7g8h...` |
| **Redução** | **220x menor!** | 🚀 |

---

## 🎨 **UI Exemplo (Ticket Screen):**

```typescript
import QRCode from 'react-native-qrcode-svg';

const TicketCard = ({ booking }) => {
  return (
    <View style={styles.ticket}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="boat" size={32} color="#4CAF50" />
        <Text style={styles.title}>Passagem NavegaJá</Text>
      </View>

      {/* Trip Info */}
      <View style={styles.tripInfo}>
        <Text style={styles.route}>
          {booking.trip.origin} → {booking.trip.destination}
        </Text>
        <Text style={styles.date}>
          {format(new Date(booking.trip.departureAt), 'dd/MM/yyyy HH:mm')}
        </Text>
        <Text style={styles.passenger}>
          Passageiro: {booking.passenger.name}
        </Text>
        <Text style={styles.seat}>
          Assento: {booking.seatNumber || 'Livre'}
        </Text>
      </View>

      {/* QR Code */}
      <View style={styles.qrContainer}>
        <QRCode
          value={booking.qrCode}  // ✅ Dados compactos
          size={180}
          backgroundColor="white"
          color="black"
          logo={require('../assets/logo.png')}
          logoSize={40}
        />
      </View>

      {/* Code Text */}
      <Text style={styles.codeText}>{booking.qrCode}</Text>

      {/* Instructions */}
      <Text style={styles.instructions}>
        Apresente este QR Code no embarque
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12
  },
  tripInfo: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 16,
    marginBottom: 24
  },
  route: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  passenger: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  seat: {
    fontSize: 14,
    color: '#666'
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16
  },
  codeText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 16
  },
  instructions: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666'
  }
});
```

---

## 🔐 **Segurança:**

### **Validação no Backend:**

```typescript
// Validar formato
if (!qrCode.match(/^NVGJ-[0-9a-f-]{36}$/)) {
  throw new BadRequestException('QR Code inválido');
}

// Extrair booking ID
const bookingId = qrCode.replace('NVGJ-', '');

// Buscar e validar reserva
const booking = await this.bookingsRepo.findOne({
  where: { id: bookingId }
});

if (!booking) {
  throw new NotFoundException('Reserva não encontrada');
}

// Validar status, data, etc.
```

---

## ✅ **Checklist de Migração:**

### **Backend:**
- [x] Remover geração de imagem base64
- [x] Gerar dados compactos (`NVGJ-{id}`)
- [x] Remover import do `qrcode`
- [x] Atualizar testes

### **App:**
- [ ] Usar `react-native-qrcode-svg` para gerar imagem
- [ ] Passar `booking.qrCode` diretamente (não precisa JSON.parse)
- [ ] Implementar scanner com validação
- [ ] Testar limite de caracteres (deve ser ~45 agora)

---

## 📦 **Dependências do App:**

```bash
# Gerar QR Code
npm install react-native-qrcode-svg react-native-svg

# Scanner QR Code (Expo)
expo install expo-barcode-scanner

# Scanner QR Code (React Native puro)
npm install react-native-camera
```

---

## 🧪 **Testando:**

```typescript
// Exemplo de dados retornados
{
  "id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
  "qrCode": "NVGJ-a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",  // ✅ 45 chars
  "status": "confirmed",
  "trip": { ... }
}
```

---

## 💡 **Próximos Passos (Opcional):**

### **1. Adicionar Timestamp para Expiração:**

```typescript
// Formato: NVGJ-{bookingId}-{timestamp}
qrCode = `NVGJ-${booking.id}-${Date.now()}`;

// Validar expiração (ex: 5 minutos)
const timestamp = parseInt(qrCode.split('-').pop());
const age = Date.now() - timestamp;
if (age > 5 * 60 * 1000) {
  throw new Error('QR Code expirado');
}
```

### **2. Adicionar Checksum para Validação:**

```typescript
import crypto from 'crypto';

const checksum = crypto
  .createHash('md5')
  .update(`${booking.id}-${secretKey}`)
  .digest('hex')
  .substring(0, 8);

qrCode = `NVGJ-${booking.id}-${checksum}`;
```

---

**QR Code agora é 220x menor e muito mais rápido!** 🚀
