import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Limpa os `home_community` que guardaram uma coordenada em vez do nome do
 * lugar.
 *
 * O seletor de mapa do app lia `label` de uma resposta que sempre falou
 * `display`, então o rótulo chegava `undefined` e o app caía num fallback que
 * montava a própria coordenada como texto. O resultado ficava gravado no
 * cadastro — um testador em Tapauá viu "Comunidade / localidade:
 * -5.62707, -63.18461".
 *
 * O app já foi corrigido e não grava mais isso. Aqui removemos o que ficou.
 *
 * Só apaga o que casa com o formato de coordenada (opcionalmente com sinal,
 * dígitos, ponto, vírgula, espaço). Nome de comunidade legítimo não casa com
 * esse padrão, então nenhum dado bom é perdido. `home_lat` e `home_lng` são
 * preservados: o ponto no mapa continua válido e é o que os capitães usam
 * para encontrar a pessoa — o que estava errado era só o nome.
 */
export class ClearCoordinateHomeCommunity1786320000000
  implements MigrationInterface
{
  name = 'ClearCoordinateHomeCommunity1786320000000';

  private static readonly COORDINATE_PATTERN =
    '^\\s*-?\\d{1,3}[.,]\\d+\\s*,\\s*-?\\d{1,3}[.,]\\d+\\s*$';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const affected: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM "users" WHERE "home_community" ~ $1`,
      [ClearCoordinateHomeCommunity1786320000000.COORDINATE_PATTERN],
    );

    await queryRunner.query(
      `UPDATE "users" SET "home_community" = NULL WHERE "home_community" ~ $1`,
      [ClearCoordinateHomeCommunity1786320000000.COORDINATE_PATTERN],
    );

    // Fica no log do deploy: se o número for alto, vale avisar os usuários
    // afetados para renomearem a localidade no perfil.
    console.log(
      `[ClearCoordinateHomeCommunity] home_community limpos: ${affected[0]?.count ?? '0'}`,
    );
  }

  public async down(): Promise<void> {
    // Sem volta: o valor anterior era a coordenada, que continua disponível em
    // home_lat/home_lng. Recriar o texto seria reintroduzir o defeito.
  }
}
