/**
 * Lookup table de coordenadas das principais cidades e municípios do Amazonas.
 * Usada para geocodificar origin/destination de viagens fluviais.
 */
export const AMAZON_CITY_COORDS: Record<string, { lat: number; lng: number }> =
  {
    // ── Manaus e entorno ──────────────────────────────────────────────────────
    manaus: { lat: -3.119, lng: -60.0217 },
    iranduba: { lat: -3.2826, lng: -60.1957 },
    manacapuru: { lat: -3.2999, lng: -60.6203 },
    'novo airao': { lat: -2.6167, lng: -60.9333 },
    'novo airão': { lat: -2.6167, lng: -60.9333 },
    careiro: { lat: -3.7333, lng: -60.4167 },
    'careiro da varzea': { lat: -3.7333, lng: -60.4167 },
    'careiro da várzea': { lat: -3.7333, lng: -60.4167 },
    autazes: { lat: -3.5779, lng: -59.1299 },
    anama: { lat: -3.5833, lng: -61.3667 },
    anamã: { lat: -3.5833, lng: -61.3667 },

    // ── Rio Solimões / corredor oeste ─────────────────────────────────────────
    anori: { lat: -3.7667, lng: -61.65 },
    alvaraes: { lat: -3.2167, lng: -64.8 },
    alvarães: { lat: -3.2167, lng: -64.8 },
    tefe: { lat: -3.35, lng: -64.7167 },
    tefé: { lat: -3.35, lng: -64.7167 },
    uarini: { lat: -2.9833, lng: -65.1333 },
    coari: { lat: -4.0833, lng: -63.1333 },
    codajas: { lat: -3.8333, lng: -62.1 },
    codajás: { lat: -3.8333, lng: -62.1 },
    anamari: { lat: -3.7, lng: -61.5 },
    caapiranga: { lat: -3.3333, lng: -61.2 },
    jutai: { lat: -2.75, lng: -66.7833 },
    jutaí: { lat: -2.75, lng: -66.7833 },
    'fonte boa': { lat: -2.5, lng: -66.0833 },
    tonyamais: { lat: -2.75, lng: -67.0 },
    amatura: { lat: -3.3667, lng: -68.25 },
    'sao paulo de olivenca': { lat: -3.45, lng: -68.9167 },
    'são paulo de olivença': { lat: -3.45, lng: -68.9167 },
    tabatinga: { lat: -4.25, lng: -69.9333 },
    'benjamin constant': { lat: -4.3833, lng: -70.0333 },

    // ── Rio Amazonas / corredor leste ─────────────────────────────────────────
    itacoatiara: { lat: -3.143, lng: -58.4444 },
    parintins: { lat: -2.6287, lng: -56.7358 },
    barreirinha: { lat: -2.7833, lng: -57.0667 },
    maues: { lat: -3.3833, lng: -57.7167 },
    maués: { lat: -3.3833, lng: -57.7167 },
    'nova olinda do norte': { lat: -3.8833, lng: -59.0833 },
    urucara: { lat: -2.5333, lng: -57.75 },
    urucurituba: { lat: -2.7, lng: -57.75 },
    silves: { lat: -2.8333, lng: -58.2 },
    'sao sebastiao do uatuma': { lat: -2.55, lng: -57.8833 },
    'são sebastião do uatumã': { lat: -2.55, lng: -57.8833 },
    'boa vista do ramos': { lat: -2.9833, lng: -57.5667 },
    nhamunda: { lat: -2.1833, lng: -56.7167 },
    oriximina: { lat: -1.7667, lng: -55.8667 },
    obidos: { lat: -1.9, lng: -55.5167 },
    óbidos: { lat: -1.9, lng: -55.5167 },
    santarem: { lat: -2.4419, lng: -54.7082 },
    santarém: { lat: -2.4419, lng: -54.7082 },

    // ── Rio Negro / norte ─────────────────────────────────────────────────────
    barcelos: { lat: -0.9769, lng: -62.9239 },
    'santa isabel do rio negro': { lat: 0.4167, lng: -65.0167 },
    'sao gabriel da cachoeira': { lat: -0.1306, lng: -67.0878 },
    'são gabriel da cachoeira': { lat: -0.1306, lng: -67.0878 },
    'presidente figueiredo': { lat: -2.0167, lng: -60.0167 },

    // ── Rio Madeira / sul ─────────────────────────────────────────────────────
    manicore: { lat: -5.8167, lng: -61.3 },
    humaita: { lat: -7.5, lng: -63.0167 },
    humaitá: { lat: -7.5, lng: -63.0167 },
    borba: { lat: -4.3833, lng: -59.5833 },
    'novo aripuana': { lat: -5.1167, lng: -60.3833 },
    'novo aripuanã': { lat: -5.1167, lng: -60.3833 },
    apui: { lat: -7.1833, lng: -59.8667 },
    apuí: { lat: -7.1833, lng: -59.8667 },

    // ── Roraima / extremo norte ───────────────────────────────────────────────
    'boa vista': { lat: 2.8038, lng: -60.6731 },
    caracarai: { lat: 1.8167, lng: -61.1333 },
  };

/**
 * Normaliza o nome da cidade para lookup (minúsculas, sem espaços extras).
 * Retorna coordenadas ou null se não encontrado.
 */
export function geocodeCity(
  cityName: string,
): { lat: number; lng: number } | null {
  if (!cityName) return null;
  const key = cityName.trim().toLowerCase();
  if (AMAZON_CITY_COORDS[key]) return AMAZON_CITY_COORDS[key];

  // Tentativa fuzzy: verificar se a string começa com o nome conhecido
  for (const [name, coords] of Object.entries(AMAZON_CITY_COORDS)) {
    if (key.startsWith(name) || name.startsWith(key)) return coords;
  }
  return null;
}
