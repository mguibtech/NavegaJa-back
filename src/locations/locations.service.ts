import { Injectable, Logger, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';

export interface CepResponseDto {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  estado: string;
  ddd: string;
  ibge: string;
}

export interface MunicipioDto {
  nome: string;
  codigoIbge: string;
}

export interface ReverseGeocodeDto {
  display: string;
  road: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  // TTLs de cache
  private readonly TTL_CEP        = 3600 * 1000;       // 1h
  private readonly TTL_MUNICIPIOS = 24 * 3600 * 1000;  // 24h
  private readonly TTL_GEOCODE    = 1800 * 1000;        // 30min

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─── ViaCEP ──────────────────────────────────────────────────────────────────

  async getCep(cep: string): Promise<CepResponseDto> {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) {
      throw new BadRequestException('CEP inválido — deve ter 8 dígitos');
    }

    const cacheKey = `cep:${digits}`;
    const cached = await this.cacheManager.get<CepResponseDto>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get(`https://viacep.com.br/ws/${digits}/json/`, {
        timeout: 8000,
      });

      if (data.erro) {
        throw new NotFoundException(`CEP ${digits} não encontrado`);
      }

      const result: CepResponseDto = {
        cep:         data.cep,
        logradouro:  data.logradouro  || '',
        complemento: data.complemento || '',
        bairro:      data.bairro      || '',
        cidade:      data.localidade,
        uf:          data.uf,
        estado:      data.estado,
        ddd:         data.ddd,
        ibge:        data.ibge,
      };

      await this.cacheManager.set(cacheKey, result, this.TTL_CEP);
      return result;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      this.logger.error(`Erro ao consultar ViaCEP para ${digits}: ${err.message}`);
      throw new BadRequestException('Não foi possível consultar o CEP. Tente novamente.');
    }
  }

  // ─── BrasilAPI — Municípios ──────────────────────────────────────────────────

  async getMunicipios(uf: string = 'AM'): Promise<MunicipioDto[]> {
    const ufUpper  = uf.toUpperCase();
    const cacheKey = `municipios:${ufUpper}`;

    const cached = await this.cacheManager.get<MunicipioDto[]>(cacheKey);
    if (cached) return cached;

    this.logger.log(`📍 Buscando municípios de ${ufUpper} na BrasilAPI...`);

    try {
      const { data } = await axios.get(
        `https://brasilapi.com.br/api/ibge/municipios/v1/${ufUpper}?providers=dados-abertos-br,gov,wikipedia`,
        { timeout: 10000 },
      );

      const result: MunicipioDto[] = data.map((m: any) => ({
        nome:        m.nome,
        codigoIbge:  String(m.codigo_ibge),
      }));

      // Ordenar alfabeticamente
      result.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      await this.cacheManager.set(cacheKey, result, this.TTL_MUNICIPIOS);
      this.logger.log(`  → ${result.length} municípios de ${ufUpper} carregados`);
      return result;
    } catch (err) {
      this.logger.error(`Erro ao buscar municípios de ${ufUpper}: ${err.message}`);
      throw new BadRequestException(`Não foi possível obter municípios de ${ufUpper}.`);
    }
  }

  // ─── Nominatim — Reverse Geocoding ──────────────────────────────────────────

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeDto> {
    // Arredondar a 3 casas decimais (~100m) para cache eficiente
    const latR = Math.round(lat * 1000) / 1000;
    const lngR = Math.round(lng * 1000) / 1000;
    const cacheKey = `geocode:reverse:${latR}:${lngR}`;

    const cached = await this.cacheManager.get<ReverseGeocodeDto>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: { lat: latR, lon: lngR, format: 'json', 'accept-language': 'pt-BR' },
        headers: {
          'User-Agent': 'NavegaJa/1.0 (app fluvial Amazônia)',
        },
        timeout: 8000,
      });

      const addr = data.address || {};
      const result: ReverseGeocodeDto = {
        display:   data.display_name || `${lat}, ${lng}`,
        road:      addr.road || addr.waterway || null,
        district:  addr.suburb || addr.neighbourhood || addr.hamlet || null,
        city:      addr.city || addr.town || addr.village || addr.municipality || null,
        state:     addr.state || null,
        country:   addr.country || 'Brasil',
        latitude:  lat,
        longitude: lng,
      };

      await this.cacheManager.set(cacheKey, result, this.TTL_GEOCODE);
      return result;
    } catch (err) {
      this.logger.warn(`⚠️ Nominatim indisponível para ${lat},${lng}: ${err.message}`);
      // Fallback gracioso — retorna coordenadas sem texto
      return {
        display:   `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        road:      null,
        district:  null,
        city:      null,
        state:     null,
        country:   'Brasil',
        latitude:  lat,
        longitude: lng,
      };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Texto curto para exibir no tracking ("Próximo a Iranduba, AM")
   */
  async getLocationLabel(lat: number, lng: number): Promise<string> {
    const geo = await this.reverseGeocode(lat, lng);
    if (geo.city && geo.state) return `Próximo a ${geo.city}, ${geo.state}`;
    if (geo.city)              return geo.city;
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }
}
