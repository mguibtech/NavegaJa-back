import { DataSource } from 'typeorm';
import { Promotion, CtaAction } from '../src/coupons/promotion.entity';

async function createSamplePromotions() {
  // Configuração do banco (ajuste conforme necessário)
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'navegaja',
    entities: [Promotion],
    synchronize: false,
  });

  try {
    console.log('🔌 Conectando ao banco de dados...');
    await dataSource.initialize();
    console.log('✅ Conectado com sucesso!\n');

    const promotionsRepo = dataSource.getRepository(Promotion);

    // Criar Promoção 1: Carnaval 2026
    const promo1 = promotionsRepo.create({
      title: 'Carnaval 2026 🎭',
      description: 'Aproveite descontos especiais para viajar no Carnaval! Garanta já sua passagem.',
      imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=600&fit=crop',
      ctaText: 'Ver Viagens',
      ctaAction: CtaAction.SEARCH,
      ctaValue: 'Manaus-Parintins',
      backgroundColor: '#FF6B35',
      textColor: '#FFFFFF',
      isActive: true,
      priority: 100,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-03-01'),
    });

    // Criar Promoção 2: Nova Rota Express
    const promo2 = promotionsRepo.create({
      title: 'Nova Rota Express 🚤',
      description: 'Estreia da nossa linha Manaus-Santarém! Reserve com desconto de inauguração.',
      imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&h=600&fit=crop',
      ctaText: 'Reserve Agora',
      ctaAction: CtaAction.SEARCH,
      ctaValue: 'Manaus-Santarém',
      backgroundColor: '#2E86AB',
      textColor: '#FFFFFF',
      isActive: true,
      priority: 90,
      startDate: new Date(),
      endDate: new Date('2026-12-31'),
    });

    console.log('💾 Salvando promoções no banco...');
    await promotionsRepo.save([promo1, promo2]);

    console.log('✅ Promoções criadas com sucesso!\n');

    // Listar promoções criadas
    const all = await promotionsRepo.find({ order: { priority: 'DESC' } });
    console.log(`📊 Total de promoções no banco: ${all.length}\n`);

    all.forEach(p => {
      console.log(`  ${p.priority} - ${p.title}`);
      console.log(`     ID: ${p.id}`);
      console.log(`     CTA: ${p.ctaText || 'N/A'} (${p.ctaAction || 'N/A'})`);
      console.log(`     Ativa: ${p.isActive ? '✅' : '❌'}\n`);
    });

    await dataSource.destroy();
    console.log('🎉 Concluído!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

createSamplePromotions();
