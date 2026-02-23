# SEQ05 — Ciclo de Vida Completo da Viagem

## Diagrama de Actividade — Ciclo de Vida de uma Viagem

```mermaid
flowchart TD
  Start([Capitão verificado]) --> A

  A[Capitão cria viagem\nPOST /trips] --> B{Validações}
  B -->|❌ Falha| Err1[400/403/404\ndetalhes do erro]
  B -->|✅ OK| C[status: SCHEDULED\navailableSeats = totalSeats]

  C --> D[Passageiros fazem reservas\nPOST /bookings]
  D --> E{availableSeats > 0?}
  E -->|Esgotado| F[⚠️ Lotado\n400 sem lugares]
  E -->|Disponível| G[Reserva CONFIRMED/PENDING\navailableSeats --]

  C --> H[Capitão preenche Checklist\nPOST /safety/checklists]
  H --> I{allItemsChecked?}
  I -->|❌ Incompleto| J[❌ Não pode iniciar\ncompletar checklist primeiro]
  I -->|✅ Completo| K{Score climático?}
  K -->|< 50| L[❌ BLOQUEADO\nCondições perigosas]
  K -->|50-70| M[⚠️ Aviso de cautela\npermitido]
  K -->|≥ 70| N[✅ Condições favoráveis]

  M --> O
  N --> O

  O[Capitão inicia viagem\nPATCH /trips/:id/status\nstatus: in_progress]
  O --> P[Encomendas COLLECTED\n→ IN_TRANSIT\nautomático]
  O --> Q[Push: ⛵ Viagem começou!\npara todos os passageiros]

  O --> R[Capitão actualiza GPS\nPATCH /trips/:id/location]
  R --> S[Passageiros veem posição\nGET /bookings/:id/tracking]

  O --> T{Evento em viagem?}
  T -->|SOS| U[POST /safety/sos\nalerta activo → admin/capitão]
  T -->|Normal| V[Viagem continua]

  V --> W[Capitão conclui viagem\nstatus: completed]
  U --> W

  W --> X[Push: 🏁 Viagem concluída!\nantes de alterar reservas]
  W --> Y[Reservas CONFIRMED/CHECKED_IN\n→ COMPLETED\nautomático]
  W --> Z[Encomendas IN_TRANSIT\n→ ARRIVED\nautomático]
  W --> AA[Passageiros ganham pontos\n+10 pts cada]
  W --> AB[Passageiros podem avaliar\ncapitão + barco]

  Y --> AC[Capitão entrega encomendas\nOUT_FOR_DELIVERY → DELIVERED]
  AC --> AD[Destinatário valida\ncom código 6 dígitos]

  C --> AE{Cancelar?}
  AE -->|Sem reservas| AF[DELETE /trips/:id\napagado da DB]
  AE -->|Com reservas| AG[status: CANCELLED\npassageiros notificados]
```

---

## Diagrama de Estados — Trip

```mermaid
stateDiagram-v2
  direction LR
  [*] --> SCHEDULED : POST /trips\n(capitão verificado)

  SCHEDULED --> IN_PROGRESS : PATCH status=in_progress\n✅ checklist + clima OK

  SCHEDULED --> CANCELLED : cancelar viagem\n(DELETE ou PATCH status)

  IN_PROGRESS --> COMPLETED : PATCH status=completed\n→ auto: reservas + encomendas

  IN_PROGRESS --> CANCELLED : emergência\n→ push passageiros

  COMPLETED --> [*] : final
  CANCELLED --> [*] : final

  note right of IN_PROGRESS
    GPS actualizado periodicamente
    Encomendas em trânsito
    Passageiros podem tracking
  end note

  note right of COMPLETED
    Passageiros ganham pontos
    Avaliações desbloqueadas
    Encomendas → ARRIVED
  end note
```

---

## Diagrama de Estados — Booking

```mermaid
stateDiagram-v2
  [*] --> PENDING : criar com PIX
  [*] --> CONFIRMED : criar com cash/card

  PENDING --> CONFIRMED : confirmar pagamento\n(capitão/admin)
  PENDING --> CANCELLED : expirado ou cancelado

  CONFIRMED --> CHECKED_IN : capitão faz check-in\n(lê QR code)
  CONFIRMED --> CANCELLED : passageiro cancela\n→ lugares devolvidos

  CHECKED_IN --> COMPLETED : viagem completa\n(automático)

  COMPLETED --> [*]
  CANCELLED --> [*]
```

---

## Timeline de Efeitos Automáticos

```mermaid
timeline
  title Eventos Automáticos no Ciclo de Vida
  SCHEDULED : Reservas aceites
             : Checklist criado pelo capitão
             : GPS disponível
  IN_PROGRESS : Encomendas COLLECTED → IN_TRANSIT
              : Push "Viagem começou" para passageiros
              : GPS tracking activo
  COMPLETED : Push "Viagem concluída" (ANTES de alterar reservas)
            : Reservas CONFIRMED/CHECKED_IN → COMPLETED
            : Encomendas IN_TRANSIT → ARRIVED
            : Passageiros ganham +10 pontos
            : Avaliações desbloqueadas
  CANCELLED : Push "Viagem cancelada" para passageiros
```
