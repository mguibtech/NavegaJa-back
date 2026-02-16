import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Entidade para armazenar histórico de dados meteorológicos
 * Útil para análises e relatórios de segurança
 */
@Entity('weather_data')
export class WeatherData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  region: string; // Ex: "Manaus", "Parintins", "Santarém"

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  temperature: number; // Temperatura em °C

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'feels_like' })
  feelsLike: number; // Sensação térmica

  @Column({ type: 'int' })
  humidity: number; // Umidade em %

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'wind_speed' })
  windSpeed: number; // Velocidade do vento em m/s

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'wind_gust', nullable: true })
  windGust: number | null; // Rajadas de vento

  @Column({ type: 'int', name: 'wind_deg' })
  windDeg: number; // Direção do vento em graus

  @Column({ type: 'varchar', length: 50 })
  condition: string; // Ex: "Ensolarado", "Nublado", "Chuva"

  @Column({ type: 'varchar', length: 200 })
  description: string; // Descrição detalhada

  @Column({ type: 'varchar', length: 10 })
  icon: string; // Código do ícone (01d, 02n, etc)

  @Column({ type: 'int' })
  cloudiness: number; // Nebulosidade em %

  @Column({ type: 'int' })
  visibility: number; // Visibilidade em metros

  @Column({ type: 'decimal', precision: 7, scale: 2, nullable: true })
  rain: number | null; // Chuva na última hora (mm)

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pressure: number; // Pressão atmosférica em hPa

  @Column({ type: 'boolean', name: 'is_safe_for_navigation', default: true })
  isSafeForNavigation: boolean; // Calculado: clima seguro para navegação?

  @Column({ type: 'text', nullable: true })
  alerts: string | null; // JSON com alertas meteorológicos

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;
}
