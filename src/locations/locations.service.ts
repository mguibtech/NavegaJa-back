import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import {
  CommunityLocation,
  CommunityLocationSource,
  CommunityLocationStatus,
} from './community-location.entity';
import { SuggestLocationDto } from './dto/suggest-location.dto';
import { ReverseGeocodeResponseDto } from './dto/reverse-geocode-response.dto';
import { LocationSuggestionResponseDto } from './dto/location-suggestion-response.dto';
import { AMAZON_CITY_SUGGESTIONS } from '../trips/city-coords';
import { normalizeLocationText } from './location-text';

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

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  estado?: string;
  ddd?: string;
  ibge?: string;
  erro?: boolean;
}

interface BrasilApiMunicipioResponse {
  nome: string;
  codigo_ibge: number | string;
}

export interface MunicipioDto {
  nome: string;
  codigoIbge: string;
}

interface NominatimAddress {
  road?: string;
  waterway?: string;
  suburb?: string;
  neighbourhood?: string;
  hamlet?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  country?: string;
}

interface NominatimReverseResponse {
  display_name?: string;
  address?: NominatimAddress;
}

/**
 * O formato agora é declarado em dto/reverse-geocode-response.dto.ts, como
 * classe com @ApiProperty, para que saia no schema do OpenAPI e possa gerar o
 * tipo do lado do app. Este alias mantém o nome que o service já usava.
 */
export type ReverseGeocodeDto = ReverseGeocodeResponseDto;

/** Raio em km para considerar duas sugestões como o mesmo ponto */
const DEDUP_RADIUS_KM = 2;

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeRequiredString = (value?: string): string => value?.trim() ?? '';

/** Normaliza nome para deduplicação: minúsculas, sem acento */
function normalizeName(name: string): string {
  return normalizeLocationText(name);
}

/** Distância em km (Haversine simplificado) */
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Declarado em dto/location-suggestion-response.dto.ts pelo mesmo motivo do
 * reverse-geocode: o contrato precisa sair no schema do OpenAPI.
 */
export type LocationSuggestion = LocationSuggestionResponseDto;

type RankedLocationSuggestion = LocationSuggestion & {
  normalizedName: string;
};

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  // TTLs de cache
  private readonly TTL_CEP = 3600 * 1000; // 1h
  private readonly TTL_MUNICIPIOS = 24 * 3600 * 1000; // 24h
  private readonly TTL_GEOCODE = 1800 * 1000; // 30min

  constructor(
    @InjectRepository(CommunityLocation)
    private communityRepo: Repository<CommunityLocation>,
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
      const { data } = await axios.get<ViaCepResponse>(
        `https://viacep.com.br/ws/${digits}/json/`,
        {
          timeout: 8000,
        },
      );

      if (data.erro) {
        throw new NotFoundException(`CEP ${digits} não encontrado`);
      }

      const result: CepResponseDto = {
        cep: normalizeRequiredString(data.cep) || digits,
        logradouro: normalizeRequiredString(data.logradouro),
        complemento: normalizeRequiredString(data.complemento),
        bairro: normalizeRequiredString(data.bairro),
        cidade: normalizeRequiredString(data.localidade),
        uf: normalizeRequiredString(data.uf),
        estado: normalizeRequiredString(data.estado),
        ddd: normalizeRequiredString(data.ddd),
        ibge: normalizeRequiredString(data.ibge),
      };

      await this.cacheManager.set(cacheKey, result, this.TTL_CEP);
      return result;
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      )
        throw err;
      this.logger.error(
        `Erro ao consultar ViaCEP para ${digits}: ${formatError(err)}`,
      );
      throw new BadRequestException(
        'Não foi possível consultar o CEP. Tente novamente.',
      );
    }
  }

  // ─── BrasilAPI — Municípios ──────────────────────────────────────────────────

  async getMunicipios(uf: string = 'AM'): Promise<MunicipioDto[]> {
    const ufUpper = uf.toUpperCase();
    const cacheKey = `municipios:${ufUpper}`;

    const cached = await this.cacheManager.get<MunicipioDto[]>(cacheKey);
    if (cached) return cached;

    this.logger.log(`📍 Buscando municípios de ${ufUpper} na BrasilAPI...`);

    try {
      const { data } = await axios.get<BrasilApiMunicipioResponse[]>(
        `https://brasilapi.com.br/api/ibge/municipios/v1/${ufUpper}?providers=dados-abertos-br,gov,wikipedia`,
        { timeout: 10000 },
      );

      const result: MunicipioDto[] = data.map((m) => ({
        nome: m.nome,
        codigoIbge: String(m.codigo_ibge),
      }));

      // Ordenar alfabeticamente
      result.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      await this.cacheManager.set(cacheKey, result, this.TTL_MUNICIPIOS);
      this.logger.log(
        `  → ${result.length} municípios de ${ufUpper} carregados`,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Erro ao buscar municípios de ${ufUpper}: ${formatError(err)}`,
      );
      throw new BadRequestException(
        `Não foi possível obter municípios de ${ufUpper}.`,
      );
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
      const { data } = await axios.get<NominatimReverseResponse>(
        'https://nominatim.openstreetmap.org/reverse',
        {
          params: {
            lat: latR,
            lon: lngR,
            format: 'json',
            'accept-language': 'pt-BR',
          },
          headers: {
            'User-Agent': 'NavegaJa/1.0 (app fluvial Amazônia)',
          },
          timeout: 8000,
        },
      );

      const addr = data.address || {};
      const result: ReverseGeocodeDto = {
        display: data.display_name || `${lat}, ${lng}`,
        road: addr.road || addr.waterway || null,
        district: addr.suburb || addr.neighbourhood || addr.hamlet || null,
        city:
          addr.city || addr.town || addr.village || addr.municipality || null,
        state: addr.state || null,
        country: addr.country || 'Brasil',
        latitude: lat,
        longitude: lng,
      };

      await this.cacheManager.set(cacheKey, result, this.TTL_GEOCODE);
      return result;
    } catch (err) {
      this.logger.warn(
        `⚠️ Nominatim indisponível para ${lat},${lng}: ${formatError(err)}`,
      );
      // Fallback gracioso — retorna coordenadas sem texto
      return {
        display: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        road: null,
        district: null,
        city: null,
        state: null,
        country: 'Brasil',
        latitude: lat,
        longitude: lng,
      };
    }
  }

  // ─── Comunidades ribeirinhas ─────────────────────────────────────────────────

  /**
   * Sugere uma nova comunidade. Se já existir ponto próximo (< 2km) ou mesmo
   * nome normalizado, incrementa confirmedCount. Ao atingir 2 → auto-confirma.
   */
  async suggestCommunity(
    dto: SuggestLocationDto,
    userId: string,
    source: CommunityLocationSource = CommunityLocationSource.USER_SUGGESTION,
  ): Promise<CommunityLocation> {
    const normalized = normalizeName(dto.name);

    // Buscar candidatos por nome OU por proximidade geográfica (bounding box ~2km ≈ 0.018°)
    const DELTA = 0.018;
    const existingByName = await this.communityRepo.find({
      where: {
        normalizedName: normalized,
        status: Not(CommunityLocationStatus.REJECTED),
      },
    });
    const existingByProximity = await this.communityRepo
      .createQueryBuilder('cl')
      .where('cl.status != :rejected', {
        rejected: CommunityLocationStatus.REJECTED,
      })
      .andWhere('cl.lat BETWEEN :latMin AND :latMax', {
        latMin: dto.lat - DELTA,
        latMax: dto.lat + DELTA,
      })
      .andWhere('cl.lng BETWEEN :lngMin AND :lngMax', {
        lngMin: dto.lng - DELTA,
        lngMax: dto.lng + DELTA,
      })
      .getMany();

    // Unir os dois conjuntos (sem duplicatas) e filtrar pelo raio exacto
    const candidates = [...existingByName];
    for (const e of existingByProximity) {
      if (!candidates.find((c) => c.id === e.id)) candidates.push(e);
    }

    // Verificar também por proximidade geográfica
    const nearby = candidates.find(
      (e) =>
        distanceKm(Number(e.lat), Number(e.lng), dto.lat, dto.lng) <
        DEDUP_RADIUS_KM,
    );

    if (nearby) {
      nearby.confirmedCount += 1;
      if (
        nearby.confirmedCount >= 2 &&
        nearby.status === CommunityLocationStatus.PENDING
      ) {
        nearby.status = CommunityLocationStatus.CONFIRMED;
        this.logger.log(
          `Auto-confirmado: "${nearby.name}" (${nearby.confirmedCount} sugestões)`,
        );
      }
      return this.communityRepo.save(nearby);
    }

    // Nova sugestão
    const entry = this.communityRepo.create({
      name: dto.name.trim(),
      normalizedName: normalized,
      lat: dto.lat,
      lng: dto.lng,
      municipio: dto.municipio || null,
      state: dto.state || 'AM',
      status: CommunityLocationStatus.PENDING,
      confirmedCount: 1,
      source,
      suggestedById: userId,
    });

    return this.communityRepo.save(entry);
  }

  /**
   * Busca unificada: lookup table estática + comunidades confirmadas na BD.
   * Retorna até 5 resultados ordenados por relevância.
   */
  async searchLocations(
    query: string,
    lat?: number,
    lng?: number,
  ): Promise<LocationSuggestion[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    const qNorm = normalizeName(q);
    const results: RankedLocationSuggestion[] = [];

    // 1. Lookup table estática (city-coords.ts)
    for (const city of AMAZON_CITY_SUGGESTIONS) {
      if (
        city.normalizedName.includes(qNorm) ||
        qNorm.includes(city.normalizedName)
      ) {
        this.pushUniqueSuggestion(results, {
          name: city.displayName,
          lat: city.lat,
          lng: city.lng,
          municipio: null,
          source: 'lookup',
          normalizedName: city.normalizedName,
        });
      }
      if (results.filter((item) => item.source === 'lookup').length >= 3) break;
    }

    // 2. Comunidades confirmadas na BD
    const dbResults = await this.communityRepo.find({
      where: {
        status: CommunityLocationStatus.CONFIRMED,
        normalizedName: ILike(`%${qNorm}%`),
      },
      order: { confirmedCount: 'DESC' },
      take: 5,
    });

    for (const c of dbResults) {
      this.pushUniqueSuggestion(results, {
        name: c.name,
        lat: Number(c.lat),
        lng: Number(c.lng),
        municipio: c.municipio,
        source: 'community',
        normalizedName: normalizeName(c.name),
      });
    }

    // Ordenar por proximidade se coords fornecidas
    if (lat !== undefined && lng !== undefined) {
      results.sort(
        (a, b) =>
          distanceKm(lat, lng, a.lat, a.lng) -
          distanceKm(lat, lng, b.lat, b.lng),
      );
    }

    return results.slice(0, 5).map((result) => ({
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      municipio: result.municipio,
      source: result.source,
    }));
  }

  /** Aprovar sugestão manualmente (admin) */
  async approveLocation(id: string): Promise<CommunityLocation> {
    const loc = await this.communityRepo.findOneOrFail({ where: { id } });
    loc.status = CommunityLocationStatus.CONFIRMED;
    return this.communityRepo.save(loc);
  }

  /** Rejeitar sugestão (admin) */
  async rejectLocation(
    id: string,
    reason?: string,
  ): Promise<CommunityLocation> {
    const loc = await this.communityRepo.findOneOrFail({ where: { id } });
    loc.status = CommunityLocationStatus.REJECTED;
    loc.rejectionReason = reason || null;
    return this.communityRepo.save(loc);
  }

  /** Listagem para o painel admin */
  async listForAdmin(
    status?: CommunityLocationStatus,
  ): Promise<CommunityLocation[]> {
    return this.communityRepo.find({
      where: status ? { status } : undefined,
      relations: ['suggestedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Busca uma comunidade confirmada por nome normalizado — usada no TripsService */
  async findConfirmedByName(
    name: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const normalized = normalizeName(name);
    const loc = await this.communityRepo.findOne({
      where: {
        normalizedName: normalized,
        status: CommunityLocationStatus.CONFIRMED,
      },
    });
    if (loc) return { lat: Number(loc.lat), lng: Number(loc.lng) };

    // Fuzzy: contém
    const fuzzy = await this.communityRepo.findOne({
      where: {
        normalizedName: ILike(`%${normalized}%`),
        status: CommunityLocationStatus.CONFIRMED,
      },
      order: { confirmedCount: 'DESC' },
    });
    return fuzzy ? { lat: Number(fuzzy.lat), lng: Number(fuzzy.lng) } : null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Texto curto para exibir no tracking ("Próximo a Iranduba, AM")
   */
  async getLocationLabel(lat: number, lng: number): Promise<string> {
    const geo = await this.reverseGeocode(lat, lng);
    if (geo.city && geo.state) return `Próximo a ${geo.city}, ${geo.state}`;
    if (geo.city) return geo.city;
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }

  private pushUniqueSuggestion(
    results: RankedLocationSuggestion[],
    candidate: RankedLocationSuggestion,
  ): void {
    const alreadyExists = results.some((existing) =>
      this.areEquivalentSuggestions(existing, candidate),
    );

    if (!alreadyExists) {
      results.push(candidate);
    }
  }

  private areEquivalentSuggestions(
    left: RankedLocationSuggestion,
    right: RankedLocationSuggestion,
  ): boolean {
    const distance = distanceKm(left.lat, left.lng, right.lat, right.lng);

    if (distance < 1) {
      return true;
    }

    return (
      left.normalizedName === right.normalizedName && distance < DEDUP_RADIUS_KM
    );
  }
}
