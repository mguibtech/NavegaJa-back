-- Atualizar GPS para viagens em andamento
UPDATE trips 
SET 
  "currentLat" = -3.2100,
  "currentLng" = -60.3500,
  notes = 'Navegando pelo Rio Negro - GPS atualizado'
WHERE status = 'in_progress' AND "currentLat" IS NULL;
