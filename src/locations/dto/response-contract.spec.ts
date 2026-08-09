import 'reflect-metadata';
import { LocationSuggestionResponseDto } from './location-suggestion-response.dto';
import { ReverseGeocodeResponseDto } from './reverse-geocode-response.dto';

/**
 * Estes testes existem por causa de um defeito reportado por um testador em
 * Tapauá: o app lia `label`, `cidade` e `uf` numa resposta que sempre falou
 * `display`, `city` e `state`. Como TypeScript aceita `undefined` de campo
 * inexistente, nada quebrou — o app apenas gravou a coordenada como nome da
 * comunidade durante meses.
 *
 * Renomear um campo aqui é mudança de contrato e quebra clientes já
 * publicados. Se um destes testes falhar, versione o endpoint ou atualize o
 * app junto — não ajuste o teste sozinho.
 */
function apiPropertyNames(target: new () => object): string[] {
  const properties: string[] =
    (Reflect.getMetadata(
      'swagger/apiModelPropertiesArray',
      target.prototype,
    ) as string[]) ?? [];

  // O Nest guarda os nomes prefixados com ':'
  return properties.map((name) => name.replace(/^:/, '')).sort();
}

describe('contrato das respostas de location', () => {
  it('mantem os nomes de campo do reverse-geocode', () => {
    expect(apiPropertyNames(ReverseGeocodeResponseDto)).toEqual([
      'city',
      'country',
      'display',
      'district',
      'latitude',
      'longitude',
      'road',
      'state',
    ]);
  });

  it('mantem os nomes de campo das sugestoes de localidade', () => {
    expect(apiPropertyNames(LocationSuggestionResponseDto)).toEqual([
      'lat',
      'lng',
      'municipio',
      'name',
      'source',
    ]);
  });

  it('expoe os campos ao Swagger, e nao apenas ao TypeScript', () => {
    // A interface antiga era invisível para o OpenAPI: o schema saía vazio e
    // o exemplo escrito à mão era a única fonte de verdade. Se esta asserção
    // falhar, alguém voltou a declarar o retorno como interface.
    expect(apiPropertyNames(ReverseGeocodeResponseDto).length).toBeGreaterThan(
      0,
    );
    expect(
      apiPropertyNames(LocationSuggestionResponseDto).length,
    ).toBeGreaterThan(0);
  });
});
