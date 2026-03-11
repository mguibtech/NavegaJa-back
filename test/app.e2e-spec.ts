import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/trips/geocode (GET) returns locations', () => {
    return request(app.getHttpServer())
      .get('/trips/geocode')
      .query({ q: 'ma' })
      .expect(200)
      .expect((res) => {
        if (!Array.isArray(res.body)) {
          throw new Error('Expected response to be an array');
        }
      });
  });
});
