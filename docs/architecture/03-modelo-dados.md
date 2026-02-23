# 03 — Modelo de Dados (ERD)

## Diagrama Entidade-Relacionamento

```mermaid
erDiagram
  users {
    uuid id PK
    string name
    string phone UK
    string passwordHash
    enum role "passenger|captain|admin"
    string email
    string resetCode
    datetime resetCodeExpires
    string cpf UK
    string avatarUrl
    decimal rating
    int totalTrips
    int totalPoints
    string level
    string referralCode UK
    boolean isActive
    decimal passengerRating
    string city
    string state
    boolean isVerified
    string licensePhotoUrl
    string certificatePhotoUrl
    string fcmToken
    datetime verifiedAt
    datetime createdAt
    datetime updatedAt
  }

  boats {
    uuid id PK
    uuid ownerId FK
    string name
    string type "lancha|voadeira|balsa|recreio"
    int capacity
    string model
    int year
    string photoUrl
    jsonb amenities
    jsonb photos
    string registrationNum
    boolean isVerified
    jsonb documentPhotos
    string rejectionReason
    decimal rating
    int reviewCount
    datetime verifiedAt
    datetime createdAt
  }

  routes {
    uuid id PK
    string originName
    decimal originLat
    decimal originLng
    string destinationName
    decimal destinationLat
    decimal destinationLng
    decimal distanceKm
    int durationMin
    datetime createdAt
  }

  trips {
    uuid id PK
    uuid captainId FK
    uuid boatId FK
    uuid routeId FK
    string origin
    string destination
    datetime departureAt
    datetime estimatedArrivalAt
    decimal price
    int discount
    decimal cargoPriceKg
    decimal cargoCapacityKg
    decimal availableCargoKg
    int totalSeats
    int availableSeats
    enum status "scheduled|in_progress|completed|cancelled"
    decimal currentLat
    decimal currentLng
    text notes
    datetime createdAt
    datetime updatedAt
  }

  bookings {
    uuid id PK
    uuid passengerId FK
    uuid tripId FK
    int seats
    decimal totalPrice
    enum status "pending|confirmed|checked_in|completed|cancelled"
    string qrCodeCheckin
    string pixQrCode
    string pixQrCodeImage
    datetime pixExpiresAt
    string pixTxid
    string pixKey
    datetime pixPaidAt
    enum paymentMethod "pix|cash|credit_card|debit_card"
    enum paymentStatus "pending|paid|refunded"
    datetime checkedInAt
    datetime createdAt
    datetime updatedAt
  }

  reviews {
    uuid id PK
    uuid reviewerId FK
    uuid tripId FK
    enum reviewType "passenger_to_captain|captain_to_passenger"
    uuid captainId FK
    int captainRating
    text captainComment
    int punctualityRating
    int communicationRating
    uuid boatId FK
    int boatRating
    text boatComment
    array boatPhotos
    int cleanlinessRating
    int comfortRating
    uuid passengerId FK
    int passengerRating
    text passengerComment
    datetime createdAt
  }

  shipments {
    uuid id PK
    uuid senderId FK
    uuid tripId FK
    text description
    decimal weightKg
    decimal length
    decimal width
    decimal height
    array photos
    string recipientName
    string recipientPhone
    text recipientAddress
    decimal totalPrice
    enum paymentMethod "pix|credit_card|debit_card|cash"
    text qrCode
    enum status "pending|paid|collected|in_transit|arrived|out_for_delivery|delivered|cancelled"
    string trackingCode UK
    string validationCode
    string collectionPhotoUrl
    datetime collectedAt
    string deliveryPhotoUrl
    datetime deliveredAt
    datetime createdAt
    datetime updatedAt
  }

  shipment_timeline {
    uuid id PK
    uuid shipmentId FK
    string status
    text description
    string location
    uuid createdBy FK
    datetime createdAt
  }

  shipment_reviews {
    uuid id PK
    uuid shipmentId FK UK
    uuid senderId FK
    int rating
    int deliveryQuality
    int timeliness
    text comment
    datetime createdAt
  }

  cargo_shipments {
    uuid id PK
    uuid senderId FK
    uuid tripId FK
    enum cargoType "motorcycle|car|pickup_truck|rancho|construction|fuel|livestock|electronics|general"
    text description
    int quantity
    decimal estimatedWeightKg
    string dimensions
    string photoUrl
    string receiverName
    string receiverPhone
    decimal totalPrice
    enum status "pending_quote|quoted|confirmed|loaded|in_transit|delivered|cancelled"
    string trackingCode UK
    text notes
    string deliveryPhotoUrl
    datetime deliveredAt
    datetime createdAt
  }

  coupons {
    uuid id PK
    string code UK
    text description
    enum type "percentage|fixed"
    decimal value
    enum applicableTo "trips|shipments|both"
    decimal minPurchase
    decimal maxDiscount
    int usageLimit
    int usageCount
    datetime validFrom
    datetime validUntil
    boolean isActive
    boolean firstPurchaseOnly
    string fromCity
    string toCity
    decimal minWeight
    decimal maxWeight
    datetime createdAt
  }

  promotions {
    uuid id PK
    string title
    text description
    string imageUrl
    string ctaText
    enum ctaAction "search|url|deeplink"
    string ctaValue
    string backgroundColor
    string textColor
    boolean isActive
    int priority
    datetime startDate
    datetime endDate
    uuid couponId FK
    string fromCity
    string toCity
    datetime createdAt
  }

  favorites {
    uuid id PK
    uuid userId FK
    enum type "destination|boat|captain"
    string origin
    string destination
    uuid boatId FK
    uuid captainId FK
    datetime createdAt
  }

  point_transactions {
    uuid id PK
    uuid userId FK
    enum action "booking_completed|shipment_delivered|cargo_delivered|review_created|first_trip_month|referral"
    int points
    text description
    uuid referenceId
    datetime createdAt
  }

  safety_checklists {
    uuid id PK
    uuid tripId FK
    uuid captainId FK
    boolean lifeJacketsAvailable
    int lifeJacketsCount
    boolean fireExtinguisherCheck
    boolean weatherConditionsOk
    string weatherCondition
    boolean boatConditionGood
    boolean emergencyEquipmentCheck
    boolean navigationLightsWorking
    boolean maxCapacityRespected
    int passengersOnBoard
    int maxCapacity
    text observations
    boolean allItemsChecked
    datetime completedAt
    datetime createdAt
  }

  sos_alerts {
    uuid id PK
    uuid userId FK
    uuid tripId FK
    enum type "emergency|medical|fire|water_leak|mechanical|weather|accident|other"
    enum status "active|resolved|false_alarm|cancelled"
    text description
    decimal latitude
    decimal longitude
    string location
    uuid resolvedById FK
    datetime resolvedAt
    text resolutionNotes
    datetime createdAt
  }

  emergency_contacts {
    uuid id PK
    enum type "marinha|bombeiros|policia|samu|defesa_civil|capitania_portos|outros"
    string name
    string phoneNumber
    text description
    string region
    boolean isActive
    int priority
    datetime createdAt
  }

  weather_data {
    uuid id PK
    string region
    decimal latitude
    decimal longitude
    decimal temperature
    decimal feelsLike
    int humidity
    decimal windSpeed
    decimal windGust
    int windDeg
    string condition
    string description
    int cloudiness
    int visibility
    decimal rain
    decimal pressure
    boolean isSafeForNavigation
    text alerts
    datetime recordedAt
  }

  %% RELAÇÕES
  users ||--o{ boats : "owns (ownerId)"
  users ||--o{ trips : "creates (captainId)"
  users ||--o{ bookings : "makes (passengerId)"
  users ||--o{ shipments : "sends (senderId)"
  users ||--o{ cargo_shipments : "sends (senderId)"
  users ||--o{ reviews : "writes (reviewerId)"
  users ||--o{ point_transactions : "earns (userId)"
  users ||--o{ favorites : "has (userId)"
  users ||--o{ sos_alerts : "triggers (userId)"
  users ||--o{ safety_checklists : "fills (captainId)"

  boats ||--o{ trips : "used in (boatId)"
  boats ||--o{ reviews : "reviewed in (boatId)"
  boats ||--o{ favorites : "favorited (boatId)"

  routes ||--o{ trips : "defines (routeId)"

  trips ||--o{ bookings : "has (tripId)"
  trips ||--o{ shipments : "carries (tripId)"
  trips ||--o{ cargo_shipments : "carries (tripId)"
  trips ||--o{ reviews : "generates (tripId)"
  trips ||--o{ safety_checklists : "requires (tripId)"
  trips ||--o{ sos_alerts : "linked to (tripId)"

  shipments ||--o{ shipment_timeline : "tracked in (shipmentId)"
  shipments ||--|| shipment_reviews : "reviewed as (shipmentId)"

  coupons ||--o{ promotions : "linked to (couponId)"
```

---

## Tabelas e Registos Típicos (Seed)

| Tabela | Registos Seed |
|---|---|
| `users` | 4 passageiros + 4 capitães + 1 admin |
| `boats` | 6 embarcações (variados tipos) |
| `routes` | 8 rotas da região de Manaus |
| `trips` | 10 viagens (9 agendadas + 1 em andamento) |
| `bookings` | 5 reservas de demonstração |
| `shipments` | 4 encomendas de demonstração |
| `emergency_contacts` | Contactos reais de Manaus (Marinha, Bombeiros, SAMU...) |

---

## Constraints de Negócio Relevantes

| Constraint | Tabela | Detalhe |
|---|---|---|
| UNIQUE | `users.phone` | Um número por conta |
| UNIQUE | `users.cpf` | Um CPF por conta |
| UNIQUE | `users.referralCode` | Código único de referido |
| UNIQUE | `shipments.trackingCode` | Rastreamento único |
| UNIQUE | `cargo_shipments.trackingCode` | Rastreamento único |
| UNIQUE | `shipment_reviews.shipmentId` | Só uma review por encomenda |
| UNIQUE | `reviews(reviewerId, tripId, reviewType)` | Só uma review por tipo por viagem |
| CHECK | `bookings.seats >= 1` | Mínimo 1 lugar |
| CHECK | `reviews.*Rating BETWEEN 1 AND 5` | Notas de 1 a 5 |
