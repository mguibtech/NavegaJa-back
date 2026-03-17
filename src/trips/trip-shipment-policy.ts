import { Trip } from './trip.entity';

type TripShipmentPolicySource = Pick<
  Trip,
  'cargoPriceKg' | 'cargoCapacityKg' | 'availableCargoKg'
>;

export type TripShipmentPolicy = {
  acceptsShipments: boolean;
  shipmentPricePerKg: number | null;
  shipmentCapacityKg: number | null;
  availableShipmentCapacityKg: number | null;
};

export function normalizeCargoPriceKg(
  cargoPriceKg: number | string | null | undefined,
): number | null {
  if (cargoPriceKg === null || cargoPriceKg === undefined) {
    return null;
  }

  const normalized = Number(cargoPriceKg);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

export function tripAcceptsShipments(trip: TripShipmentPolicySource): boolean {
  return normalizeCargoPriceKg(trip.cargoPriceKg) !== null;
}

export function getTripShipmentPolicy(
  trip: TripShipmentPolicySource,
): TripShipmentPolicy {
  const shipmentPricePerKg = normalizeCargoPriceKg(trip.cargoPriceKg);

  return {
    acceptsShipments: shipmentPricePerKg !== null,
    shipmentPricePerKg,
    shipmentCapacityKg:
      trip.cargoCapacityKg === null || trip.cargoCapacityKg === undefined
        ? null
        : Number(trip.cargoCapacityKg),
    availableShipmentCapacityKg:
      trip.availableCargoKg === null || trip.availableCargoKg === undefined
        ? null
        : Number(trip.availableCargoKg),
  };
}
