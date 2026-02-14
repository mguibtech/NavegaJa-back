# 📅 Guia de Formato de Data - API NavegaJá

## ❌ **ERRO COMUM:**

```
Error 500: Invalid Date
"sintaxe de entrada é inválida para tipo timestamp"
```

**Causa:** App enviando data em formato incorreto.

---

## ✅ **FORMATO CORRETO:**

### **ISO 8601 - YYYY-MM-DD**

```
2026-02-15
```

**NÃO use:**
- ❌ `15/02/2026` (formato BR)
- ❌ `02-15-2026` (formato US)
- ❌ `15-02-2026`
- ❌ Timestamps (`1739577600000`)
- ❌ Date objects direto

---

## 📱 **NO APP (React Native):**

### **1. Formatar data antes de enviar:**

```typescript
// ✅ CORRETO
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// Uso
const selectedDate = new Date('2026-02-15');
const formattedDate = formatDate(selectedDate); // '2026-02-15'

// Fazer requisição
const response = await api.get('/trips', {
  params: {
    origin: 'Manaus',
    destination: 'Parintins',
    date: formattedDate  // ✅ '2026-02-15'
  }
});
```

---

### **2. Usando date-fns (Recomendado):**

```bash
npm install date-fns
# ou
yarn add date-fns
```

```typescript
import { format } from 'date-fns';

// ✅ MUITO MAIS SIMPLES
const selectedDate = new Date();
const formattedDate = format(selectedDate, 'yyyy-MM-dd');

// Uso na API
const response = await api.get('/trips', {
  params: {
    origin: 'Manaus',
    destination: 'Parintins',
    date: formattedDate  // ✅ '2026-02-15'
  }
});
```

---

### **3. Usando DatePicker:**

```typescript
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

const SearchScreen = () => {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const searchTrips = async () => {
    try {
      // ✅ Formatar antes de enviar
      const formattedDate = format(date, 'yyyy-MM-dd');

      const response = await api.get('/trips', {
        params: {
          origin,
          destination,
          date: formattedDate
        }
      });

      setTrips(response.data);
    } catch (error) {
      if (error.response?.status === 400) {
        Alert.alert('Erro', error.response.data.message);
      }
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={() => setShowPicker(true)}>
        <Text>{format(date, 'dd/MM/yyyy')}</Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          onChange={handleDateChange}
        />
      )}

      <Button title="Buscar" onPress={searchTrips} />
    </View>
  );
};
```

---

## 🔧 **EXEMPLOS DE REQUISIÇÕES:**

### **Correto:**

```http
GET /trips?origin=Manaus&destination=Parintins&date=2026-02-15
```

```javascript
// JavaScript/TypeScript
const response = await fetch(
  'http://localhost:3000/trips?origin=Manaus&destination=Parintins&date=2026-02-15',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

---

### **Incorreto:**

```http
# ❌ Formato brasileiro
GET /trips?date=15/02/2026

# ❌ Formato americano
GET /trips?date=02-15-2026

# ❌ Timestamp
GET /trips?date=1739577600000

# ❌ Objeto Date serializado
GET /trips?date=Thu Feb 15 2026
```

---

## 🛡️ **VALIDAÇÃO NO BACKEND:**

Agora o backend valida a data e retorna erro claro:

```json
{
  "statusCode": 400,
  "message": "Data inválida: \"15/02/2026\". Use o formato YYYY-MM-DD (ex: 2026-02-15)",
  "error": "Bad Request"
}
```

---

## 📋 **CHECKLIST:**

Quando implementar busca por data no app:

- [ ] Usar `date-fns` para formatar datas
- [ ] Sempre formatar como `YYYY-MM-DD` antes de enviar
- [ ] Nunca enviar Date object direto
- [ ] Nunca enviar timestamp
- [ ] Validar data no cliente antes de enviar
- [ ] Tratar erro 400 com mensagem clara
- [ ] Mostrar data formatada para usuário (DD/MM/YYYY)
- [ ] Enviar data formatada para API (YYYY-MM-DD)

---

## 💡 **HELPER FUNCTION PRONTA:**

```typescript
// utils/date.ts

/**
 * Formata Date para o formato aceito pela API (YYYY-MM-DD)
 */
export const toApiDateFormat = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Formata Date para exibição BR (DD/MM/YYYY)
 */
export const toBRDateFormat = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Valida se a string é uma data válida
 */
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

// Uso:
import { toApiDateFormat, toBRDateFormat } from './utils/date';

const date = new Date();

// Para exibir ao usuário
console.log(toBRDateFormat(date)); // "15/02/2026"

// Para enviar à API
api.get('/trips', {
  params: {
    date: toApiDateFormat(date) // "2026-02-15"
  }
});
```

---

## 🎯 **RESUMO:**

| Contexto | Formato | Exemplo |
|----------|---------|---------|
| **API Request** | `YYYY-MM-DD` | `2026-02-15` |
| **Exibição BR** | `DD/MM/YYYY` | `15/02/2026` |
| **DatePicker** | `Date object` | `new Date()` |
| **Backend** | `timestamp` | `2026-02-15T00:00:00Z` |

**Regra de ouro:**
- 📱 **No app:** Mostre `DD/MM/YYYY` para o usuário
- 🌐 **Na API:** Envie `YYYY-MM-DD`

---

## ⚠️ **ERROS COMUNS:**

### **1. Enviar Date object direto:**

```typescript
// ❌ ERRADO
const params = {
  date: new Date()  // Será serializado como string inválida
};

// ✅ CORRETO
const params = {
  date: format(new Date(), 'yyyy-MM-dd')
};
```

### **2. Timezone incorreto:**

```typescript
// ❌ ERRADO
const date = new Date().toISOString(); // "2026-02-15T03:00:00.000Z"

// ✅ CORRETO
const date = format(new Date(), 'yyyy-MM-dd'); // "2026-02-15"
```

### **3. Formato localizado:**

```typescript
// ❌ ERRADO
const date = new Date().toLocaleDateString('pt-BR'); // "15/02/2026"

// ✅ CORRETO
const date = format(new Date(), 'yyyy-MM-dd'); // "2026-02-15"
```

---

**Use `date-fns` e seja feliz!** 🎉

```bash
yarn add date-fns
```
