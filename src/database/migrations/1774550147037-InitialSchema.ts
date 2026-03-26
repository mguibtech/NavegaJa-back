import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1774550147037 implements MigrationInterface {
  name = 'InitialSchema1774550147037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "weather_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "region" character varying(100) NOT NULL, "latitude" numeric(10,7) NOT NULL, "longitude" numeric(10,7) NOT NULL, "temperature" numeric(5,2) NOT NULL, "feels_like" numeric(5,2) NOT NULL, "humidity" integer NOT NULL, "wind_speed" numeric(5,2) NOT NULL, "wind_gust" numeric(5,2), "wind_deg" integer NOT NULL, "condition" character varying(50) NOT NULL, "description" character varying(200) NOT NULL, "icon" character varying(10) NOT NULL, "cloudiness" integer NOT NULL, "visibility" integer NOT NULL, "rain" numeric(7,2), "pressure" numeric(10,2) NOT NULL, "is_safe_for_navigation" boolean NOT NULL DEFAULT true, "alerts" text, "recorded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6ee17d274a88f8036d2aa8ea9d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "routes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "origin_name" character varying(255) NOT NULL, "origin_lat" numeric(10,7) NOT NULL, "origin_lng" numeric(10,7) NOT NULL, "destination_name" character varying(255) NOT NULL, "destination_lat" numeric(10,7) NOT NULL, "destination_lng" numeric(10,7) NOT NULL, "distance_km" numeric(6,1), "duration_min" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_76100511cdfa1d013c859f01d8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('pending', 'confirmed', 'checked_in', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_payment_method_enum" AS ENUM('pix', 'cash', 'credit_card', 'debit_card')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_payment_status_enum" AS ENUM('pending', 'paid', 'refund_pending', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "passenger_id" uuid NOT NULL, "trip_id" uuid NOT NULL, "seat_number" integer, "seats" integer NOT NULL DEFAULT '1', "total_price" numeric(10,2) NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending', "qr_code_checkin" text, "pix_qr_code" text, "pix_qr_code_image" text, "pix_expires_at" TIMESTAMP, "pix_txid" character varying(50), "pix_key" character varying(100), "pix_paid_at" TIMESTAMP, "payment_method" "public"."bookings_payment_method_enum" NOT NULL DEFAULT 'pix', "payment_status" "public"."bookings_payment_status_enum" NOT NULL DEFAULT 'pending', "checked_in_at" TIMESTAMP, "km_redeemed" integer NOT NULL DEFAULT '0', "km_discount" numeric(10,2) NOT NULL DEFAULT '0', "extra_passengers" text, "children_count" integer NOT NULL DEFAULT '0', "children_data" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_payment_method_enum" AS ENUM('pix', 'credit_card', 'debit_card', 'cash')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_paid_by_enum" AS ENUM('sender', 'recipient')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shipments_status_enum" AS ENUM('pending', 'paid', 'collected', 'in_transit', 'arrived', 'out_for_delivery', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender_id" uuid NOT NULL, "trip_id" uuid NOT NULL, "description" text NOT NULL, "weight_kg" numeric(6,2), "length" numeric(6,2), "width" numeric(6,2), "height" numeric(6,2), "photos" text array, "recipient_name" character varying(255) NOT NULL, "recipient_phone" character varying(20) NOT NULL, "recipient_address" text NOT NULL, "total_price" numeric(10,2) NOT NULL, "payment_method" "public"."shipments_payment_method_enum" NOT NULL DEFAULT 'pix', "paid_by" "public"."shipments_paid_by_enum" NOT NULL DEFAULT 'sender', "recipient_user_id" uuid, "qr_code" text, "status" "public"."shipments_status_enum" NOT NULL DEFAULT 'pending', "delivery_photo_url" text, "delivered_at" TIMESTAMP, "tracking_code" character varying(20) NOT NULL, "validation_code" character varying(6) NOT NULL, "collection_photo_url" text, "collected_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_37500a91985b590922c2800f108" UNIQUE ("tracking_code"), CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reviews_review_type_enum" AS ENUM('passenger_to_captain', 'captain_to_passenger')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reviewer_id" uuid NOT NULL, "trip_id" uuid NOT NULL, "review_type" "public"."reviews_review_type_enum" NOT NULL DEFAULT 'passenger_to_captain', "captain_id" uuid, "rating" integer, "comment" text, "punctuality_rating" integer, "communication_rating" integer, "boat_id" uuid, "boat_rating" integer, "boat_comment" text, "boat_photos" text, "cleanliness_rating" integer, "comfort_rating" integer, "passenger_id" uuid, "passenger_rating" integer, "passenger_comment" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9ec9b809fca1099f1a7bb79749d" UNIQUE ("reviewer_id", "trip_id", "review_type"), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cargo_shipments_cargo_type_enum" AS ENUM('motorcycle', 'car', 'pickup_truck', 'rancho', 'construction', 'fuel', 'livestock', 'electronics', 'general')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cargo_shipments_status_enum" AS ENUM('pending_quote', 'quoted', 'confirmed', 'loaded', 'in_transit', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cargo_shipments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender_id" uuid NOT NULL, "trip_id" uuid NOT NULL, "cargo_type" "public"."cargo_shipments_cargo_type_enum" NOT NULL, "description" text NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "estimated_weight_kg" numeric(10,2), "dimensions" character varying(255), "photo_url" text, "receiver_name" character varying(255) NOT NULL, "receiver_phone" character varying(20) NOT NULL, "total_price" numeric(10,2) NOT NULL, "status" "public"."cargo_shipments_status_enum" NOT NULL DEFAULT 'pending_quote', "tracking_code" character varying(20) NOT NULL, "notes" text, "delivery_photo_url" text, "delivered_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_359cf5f9fb6d11e6dcaf9f5cd63" UNIQUE ("tracking_code"), CONSTRAINT "PK_1bf65528d548d4c535491a76b18" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trips_status_enum" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "captain_id" uuid NOT NULL, "boat_id" uuid, "route_id" uuid, "origin" character varying(255) DEFAULT '', "destination" character varying(255) DEFAULT '', "departure_at" TIMESTAMP NOT NULL, "estimated_arrival_at" TIMESTAMP, "price" numeric(10,2) NOT NULL, "discount" integer NOT NULL DEFAULT '0', "cargo_price_kg" numeric(10,2), "cargo_capacity_kg" numeric(10,2), "available_cargo_kg" numeric(10,2), "total_seats" integer NOT NULL, "available_seats" integer NOT NULL, "status" "public"."trips_status_enum" NOT NULL DEFAULT 'scheduled', "origin_lat" numeric(10,7), "origin_lng" numeric(10,7), "current_lat" numeric(10,7), "current_lng" numeric(10,7), "last_location_at" TIMESTAMP, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id")); COMMENT ON COLUMN "trips"."discount" IS 'Desconto em porcentagem (0-100)'; COMMENT ON COLUMN "trips"."cargo_capacity_kg" IS 'Capacidade total de carga em kg'; COMMENT ON COLUMN "trips"."available_cargo_kg" IS 'Carga disponível em kg (atualizada conforme reservas)'`,
    );
    await queryRunner.query(
      `CREATE TABLE "boats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "type" character varying(100) NOT NULL, "capacity" integer NOT NULL, "model" character varying(100), "year" integer, "photo_url" text, "amenities" jsonb NOT NULL DEFAULT '[]', "photos" jsonb NOT NULL DEFAULT '[]', "registration_num" character varying(100), "is_verified" boolean NOT NULL DEFAULT false, "document_photos" jsonb NOT NULL DEFAULT '[]', "rejection_reason" text, "verified_at" TIMESTAMP, "rating" numeric(2,1) NOT NULL DEFAULT '5', "review_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7f192e10b468d99557a0aede7e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."point_transactions_action_enum" AS ENUM('booking_completed', 'shipment_delivered', 'cargo_delivered', 'review_created', 'first_trip_month', 'referral', 'boat_owner_trip_completed', 'boat_owner_passenger_completed', 'boat_owner_shipment_delivered')`,
    );
    await queryRunner.query(
      `CREATE TABLE "point_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "action" "public"."point_transactions_action_enum" NOT NULL, "points" integer NOT NULL, "description" text, "reference_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ceb5185b63f070e23d65509b0a7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('passenger', 'captain', 'admin', 'boat_manager')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_gender_enum" AS ENUM('M', 'F', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_kyc_status_enum" AS ENUM('none', 'pending', 'under_review', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "phone" character varying(20) NOT NULL, "password_hash" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'passenger', "email" character varying(255), "reset_code" character varying(6), "reset_code_expires" TIMESTAMP, "cpf" character varying(14), "avatar_url" text, "gender" "public"."users_gender_enum", "rating" numeric(2,1) NOT NULL DEFAULT '5', "total_trips" integer NOT NULL DEFAULT '0', "total_points" integer NOT NULL DEFAULT '0', "level" character varying(50) NOT NULL DEFAULT 'Marinheiro', "referral_code" character varying(20), "is_active" boolean NOT NULL DEFAULT true, "passenger_rating" numeric(2,1) NOT NULL DEFAULT '5', "city" character varying(100), "state" character varying(2) NOT NULL DEFAULT 'AM', "is_verified" boolean NOT NULL DEFAULT false, "kyc_status" "public"."users_kyc_status_enum" NOT NULL DEFAULT 'none', "license_photo_url" text, "certificate_photo_url" text, "selfie_url" text, "rnaq_number" character varying(30), "verified_at" TIMESTAMP, "rejection_reason" text, "fcm_token" text, "home_community" character varying(150), "home_municipio" character varying(150), "home_lat" numeric(10,7), "home_lng" numeric(10,7), "location_updated_at" TIMESTAMP, "total_km_traveled" integer NOT NULL DEFAULT '0', "redeemable_km" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_230b925048540454c8b4c481e1c" UNIQUE ("cpf"), CONSTRAINT "UQ_ba10055f9ef9690e77cf6445cba" UNIQUE ("referral_code"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "stop_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "trip_id" uuid, "location_name" character varying(255) NOT NULL, "lat" numeric(10,7), "lng" numeric(10,7), "rating" integer NOT NULL, "comment" text, "photos" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_956735b91384dd59097d4a31d9c" PRIMARY KEY ("id")); COMMENT ON COLUMN "stop_reviews"."rating" IS 'Nota de 1 a 5'`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment_timeline" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shipment_id" uuid NOT NULL, "status" character varying(20) NOT NULL, "description" text NOT NULL, "location" character varying(255), "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2822a1fec03a3d41940ebc02b4d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "shipment_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shipment_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "rating" integer NOT NULL, "delivery_quality" integer NOT NULL, "timeliness" integer NOT NULL, "comment" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_76df3c15c51750018f0a9324819" UNIQUE ("shipment_id"), CONSTRAINT "PK_e00b8592d1e7ca8e1aae17394f5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_alerts_type_enum" AS ENUM('general', 'emergency', 'medical', 'fire', 'water_leak', 'mechanical', 'weather', 'accident', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_alerts_status_enum" AS ENUM('active', 'resolved', 'false_alarm', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sos_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "trip_id" uuid, "type" "public"."sos_alerts_type_enum" NOT NULL, "status" "public"."sos_alerts_status_enum" NOT NULL DEFAULT 'active', "description" text, "latitude" numeric(10,7), "longitude" numeric(10,7), "location" character varying(200), "resolved_by_id" uuid, "resolvedAt" TIMESTAMP, "resolutionNotes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5c6f2f5f40ab2224315e007b9c4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "safety_checklists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "captain_id" uuid NOT NULL, "lifeJacketsAvailable" boolean NOT NULL DEFAULT false, "lifeJacketsCount" integer, "fireExtinguisherCheck" boolean NOT NULL DEFAULT false, "weatherConditionsOk" boolean NOT NULL DEFAULT false, "weatherCondition" character varying(100), "boatConditionGood" boolean NOT NULL DEFAULT false, "emergencyEquipmentCheck" boolean NOT NULL DEFAULT false, "navigationLightsWorking" boolean NOT NULL DEFAULT false, "maxCapacityRespected" boolean NOT NULL DEFAULT false, "passengersOnBoard" integer, "maxCapacity" integer, "observations" text, "allItemsChecked" boolean NOT NULL DEFAULT false, "completedAt" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_593c6657e1d3b0e5916c40e1259" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "personal_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "phone" character varying(20) NOT NULL, "linked_user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94f6d2cfdc3ada637cf40e9b9ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."emergency_contacts_type_enum" AS ENUM('marinha', 'bombeiros', 'policia', 'samu', 'defesa_civil', 'capitania_portos', 'outros')`,
    );
    await queryRunner.query(
      `CREATE TABLE "emergency_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."emergency_contacts_type_enum" NOT NULL, "name" character varying(200) NOT NULL, "phoneNumber" character varying(20) NOT NULL, "description" text, "region" character varying(100), "isActive" boolean NOT NULL DEFAULT true, "priority" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8be191845b6fca1c4e5ba5bd7d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_methods_type_enum" AS ENUM('credit_card', 'debit_card')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_methods_brand_enum" AS ENUM('visa', 'mastercard', 'elo', 'hipercard', 'amex', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."payment_methods_type_enum" NOT NULL, "brand" "public"."payment_methods_brand_enum" NOT NULL, "last4" character varying(4) NOT NULL, "holder_name" character varying(255) NOT NULL, "expiry_month" integer NOT NULL, "expiry_year" integer NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "external_id" character varying(255), "external_provider" character varying(50), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_34f9b8c6dfb4ac3559f7e2820d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."community_locations_status_enum" AS ENUM('pending', 'confirmed', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."community_locations_source_enum" AS ENUM('user_suggestion', 'user_home', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "community_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "normalized_name" character varying(150) NOT NULL, "lat" numeric(10,7) NOT NULL, "lng" numeric(10,7) NOT NULL, "municipio" character varying(150), "state" character varying(2) NOT NULL DEFAULT 'AM', "status" "public"."community_locations_status_enum" NOT NULL DEFAULT 'pending', "confirmed_count" integer NOT NULL DEFAULT '1', "source" "public"."community_locations_source_enum" NOT NULL DEFAULT 'user_suggestion', "suggested_by_id" uuid, "rejection_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a1a51b5a65418e01bc66dbdd11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."referrals_status_enum" AS ENUM('pending', 'converted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "referrals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referrer_id" uuid NOT NULL, "referred_id" uuid NOT NULL, "status" "public"."referrals_status_enum" NOT NULL DEFAULT 'pending', "points_awarded" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "converted_at" TIMESTAMP, CONSTRAINT "UQ_507a2818bf5524662b068c2e81c" UNIQUE ("referred_id"), CONSTRAINT "PK_ea9980e34f738b6252817326c08" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_507a2818bf5524662b068c2e81" ON "referrals" ("referred_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."km_transactions_type_enum" AS ENUM('earned', 'redeemed', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "km_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "km" integer NOT NULL, "type" "public"."km_transactions_type_enum" NOT NULL, "description" text NOT NULL, "reference_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_933825b0c669bd6ca81057448b9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."favorites_type_enum" AS ENUM('destination', 'boat', 'captain')`,
    );
    await queryRunner.query(
      `CREATE TABLE "favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."favorites_type_enum" NOT NULL, "origin" character varying(255), "destination" character varying(255), "boat_id" uuid, "captain_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_change_requests_document_type_enum" AS ENUM('SELFIE', 'LICENCA_NAVEGACAO', 'CERTIFICADO_SEGURANCA')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_change_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_change_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "document_type" "public"."document_change_requests_document_type_enum" NOT NULL, "current_document_url" text, "new_document_url" text NOT NULL, "status" "public"."document_change_requests_status_enum" NOT NULL DEFAULT 'PENDING', "rejection_reason" text, "reviewed_at" TIMESTAMP, "reviewed_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_38d60b93c5a1f1215445972edc9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_832b309fe683771540488a4cd7" ON "document_change_requests" ("user_id", "document_type", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."coupons_type_enum" AS ENUM('percentage', 'fixed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."coupons_applicable_to_enum" AS ENUM('trips', 'shipments', 'both')`,
    );
    await queryRunner.query(
      `CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(50) NOT NULL, "description" text, "type" "public"."coupons_type_enum" NOT NULL, "value" numeric(10,2) NOT NULL, "applicable_to" "public"."coupons_applicable_to_enum" NOT NULL DEFAULT 'both', "min_purchase" numeric(10,2), "max_discount" numeric(10,2), "usage_limit" integer, "usage_count" integer NOT NULL DEFAULT '0', "valid_from" TIMESTAMP, "valid_until" TIMESTAMP, "is_active" boolean NOT NULL DEFAULT true, "first_purchase_only" boolean NOT NULL DEFAULT false, "from_city" character varying(100), "to_city" character varying(100), "min_weight" numeric(6,2), "max_weight" numeric(6,2), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id")); COMMENT ON COLUMN "coupons"."applicable_to" IS 'Define se o cupom vale para viagens, encomendas ou ambos'; COMMENT ON COLUMN "coupons"."from_city" IS 'Filtro: cidade de origem (null = todas)'; COMMENT ON COLUMN "coupons"."to_city" IS 'Filtro: cidade de destino (null = todas)'; COMMENT ON COLUMN "coupons"."min_weight" IS 'Peso mínimo em kg para encomendas (null = sem mínimo)'; COMMENT ON COLUMN "coupons"."max_weight" IS 'Peso máximo em kg para encomendas (null = sem máximo)'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."promotions_cta_action_enum" AS ENUM('search', 'url', 'deeplink')`,
    );
    await queryRunner.query(
      `CREATE TABLE "promotions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(100) NOT NULL, "description" text NOT NULL, "image_url" character varying(500) NOT NULL, "cta_text" character varying(50), "cta_action" "public"."promotions_cta_action_enum", "cta_value" character varying(500), "background_color" character varying(20) DEFAULT '#FF6B35', "text_color" character varying(20) DEFAULT '#FFFFFF', "is_active" boolean NOT NULL DEFAULT true, "priority" integer NOT NULL DEFAULT '0', "start_date" TIMESTAMP, "end_date" TIMESTAMP, "coupon_id" uuid, "from_city" character varying(100), "to_city" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_380cecbbe3ac11f0e5a7c452c34" PRIMARY KEY ("id")); COMMENT ON COLUMN "promotions"."priority" IS 'Maior prioridade aparece primeiro'; COMMENT ON COLUMN "promotions"."from_city" IS 'Filtro: cidade de origem (opcional)'; COMMENT ON COLUMN "promotions"."to_city" IS 'Filtro: cidade de destino (opcional)'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_senderrole_enum" AS ENUM('captain', 'passenger')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "senderRole" "public"."chat_messages_senderrole_enum" NOT NULL, "content" text NOT NULL, "read_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_81eba089f810c972e8c4dee15b" ON "chat_messages" ("booking_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "boat_staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "boat_id" uuid NOT NULL, "position" character varying(100), "can_create_trips" boolean NOT NULL DEFAULT true, "can_confirm_payments" boolean NOT NULL DEFAULT true, "can_manage_shipments" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d20173c7924685db31d0ebf9c85" UNIQUE ("user_id", "boat_id"), CONSTRAINT "PK_9dc15737333506e224c51d26c26" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_1a764d454e20296cfa277d8742e" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_45fa98a28a6944e39d8a5754bd1" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_e2b989dd89274f77ff534862b30" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" ADD CONSTRAINT "FK_6317b46931f99efe79ad9b31491" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_92e950a2513a79bb3fab273c92e" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_362e169dcc383ce7bb4ddf021ff" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_cdbab1a6c710ee3911b0d83ea9b" FOREIGN KEY ("captain_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_b7d143e7ceb1cad286c2cf4a19a" FOREIGN KEY ("boat_id") REFERENCES "boats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_2f0de2a3632d6babb15a64ceebe" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargo_shipments" ADD CONSTRAINT "FK_745b4d2357cb45f3e5a4fe81cd3" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargo_shipments" ADD CONSTRAINT "FK_eba2cbf9d15fcbc6603ecc61149" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_9162f098f37002b09e70693d50e" FOREIGN KEY ("captain_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_a645f117e4c98b1f7e69479e85c" FOREIGN KEY ("boat_id") REFERENCES "boats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_e49dbbd9991c9b7baec9779e7ce" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boats" ADD CONSTRAINT "FK_0a8a5682120f03a57ccdf66b3ad" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "point_transactions" ADD CONSTRAINT "FK_56702c8b9e89190347707b75552" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stop_reviews" ADD CONSTRAINT "FK_3f52544e8a7b6d6a9d8573b9ef5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stop_reviews" ADD CONSTRAINT "FK_fc52dbea20a49763dbdc2651d51" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_timeline" ADD CONSTRAINT "FK_062c6c9b0eda9ad46c76e3c167e" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_timeline" ADD CONSTRAINT "FK_c7891c502505acd7d9cec26a241" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_reviews" ADD CONSTRAINT "FK_76df3c15c51750018f0a9324819" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_reviews" ADD CONSTRAINT "FK_15f1176f3cf050054b221a00319" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_alerts" ADD CONSTRAINT "FK_7a5209ca217c11fd1c5767d1450" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_alerts" ADD CONSTRAINT "FK_e32aa1b510ad63954b2c3993917" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_alerts" ADD CONSTRAINT "FK_8fb9e9660ae23cbde1b0d6239ca" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "safety_checklists" ADD CONSTRAINT "FK_fe5f8473e0e35deca4529489d18" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "safety_checklists" ADD CONSTRAINT "FK_cd6e4600fb1441bae854c98395e" FOREIGN KEY ("captain_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "personal_contacts" ADD CONSTRAINT "FK_036813a9864f2aff10449947398" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" ADD CONSTRAINT "FK_d7d7fb15569674aaadcfbc0428c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "community_locations" ADD CONSTRAINT "FK_9b0dfcfa977ad7e2523c16b7383" FOREIGN KEY ("suggested_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "referrals" ADD CONSTRAINT "FK_18af9fcaffac6d6d3b28130e149" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "referrals" ADD CONSTRAINT "FK_507a2818bf5524662b068c2e81c" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "km_transactions" ADD CONSTRAINT "FK_285da0f600e3b02e8c6d99f8dcd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_f5209239e7623fe537668465d05" FOREIGN KEY ("boat_id") REFERENCES "boats"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_875c86c88cd57b70dbaabca7580" FOREIGN KEY ("captain_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_change_requests" ADD CONSTRAINT "FK_82a8a34c0593b4fc4151f424249" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_change_requests" ADD CONSTRAINT "FK_850e6905d05402cbd42f8659d8c" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "promotions" ADD CONSTRAINT "FK_cc56ca2cb8b0499dfeed9c47a73" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_81eba089f810c972e8c4dee15b8" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_9e5fc47ecb06d4d7b84633b1718" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boat_staff" ADD CONSTRAINT "FK_5ceea3e22d7637564e2b1252816" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boat_staff" ADD CONSTRAINT "FK_f5215017d0eaa4328266a765454" FOREIGN KEY ("boat_id") REFERENCES "boats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "boat_staff" DROP CONSTRAINT "FK_f5215017d0eaa4328266a765454"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boat_staff" DROP CONSTRAINT "FK_5ceea3e22d7637564e2b1252816"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_9e5fc47ecb06d4d7b84633b1718"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_81eba089f810c972e8c4dee15b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "promotions" DROP CONSTRAINT "FK_cc56ca2cb8b0499dfeed9c47a73"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_change_requests" DROP CONSTRAINT "FK_850e6905d05402cbd42f8659d8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_change_requests" DROP CONSTRAINT "FK_82a8a34c0593b4fc4151f424249"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_875c86c88cd57b70dbaabca7580"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_f5209239e7623fe537668465d05"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593"`,
    );
    await queryRunner.query(
      `ALTER TABLE "km_transactions" DROP CONSTRAINT "FK_285da0f600e3b02e8c6d99f8dcd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "referrals" DROP CONSTRAINT "FK_507a2818bf5524662b068c2e81c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "referrals" DROP CONSTRAINT "FK_18af9fcaffac6d6d3b28130e149"`,
    );
    await queryRunner.query(
      `ALTER TABLE "community_locations" DROP CONSTRAINT "FK_9b0dfcfa977ad7e2523c16b7383"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" DROP CONSTRAINT "FK_d7d7fb15569674aaadcfbc0428c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "personal_contacts" DROP CONSTRAINT "FK_036813a9864f2aff10449947398"`,
    );
    await queryRunner.query(
      `ALTER TABLE "safety_checklists" DROP CONSTRAINT "FK_cd6e4600fb1441bae854c98395e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "safety_checklists" DROP CONSTRAINT "FK_fe5f8473e0e35deca4529489d18"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_alerts" DROP CONSTRAINT "FK_8fb9e9660ae23cbde1b0d6239ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_alerts" DROP CONSTRAINT "FK_e32aa1b510ad63954b2c3993917"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_alerts" DROP CONSTRAINT "FK_7a5209ca217c11fd1c5767d1450"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_reviews" DROP CONSTRAINT "FK_15f1176f3cf050054b221a00319"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_reviews" DROP CONSTRAINT "FK_76df3c15c51750018f0a9324819"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_timeline" DROP CONSTRAINT "FK_c7891c502505acd7d9cec26a241"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipment_timeline" DROP CONSTRAINT "FK_062c6c9b0eda9ad46c76e3c167e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stop_reviews" DROP CONSTRAINT "FK_fc52dbea20a49763dbdc2651d51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stop_reviews" DROP CONSTRAINT "FK_3f52544e8a7b6d6a9d8573b9ef5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "point_transactions" DROP CONSTRAINT "FK_56702c8b9e89190347707b75552"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boats" DROP CONSTRAINT "FK_0a8a5682120f03a57ccdf66b3ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_e49dbbd9991c9b7baec9779e7ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_a645f117e4c98b1f7e69479e85c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_9162f098f37002b09e70693d50e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargo_shipments" DROP CONSTRAINT "FK_eba2cbf9d15fcbc6603ecc61149"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargo_shipments" DROP CONSTRAINT "FK_745b4d2357cb45f3e5a4fe81cd3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_2f0de2a3632d6babb15a64ceebe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_b7d143e7ceb1cad286c2cf4a19a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_cdbab1a6c710ee3911b0d83ea9b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_362e169dcc383ce7bb4ddf021ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_92e950a2513a79bb3fab273c92e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP CONSTRAINT "FK_6317b46931f99efe79ad9b31491"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipments" DROP CONSTRAINT "FK_e2b989dd89274f77ff534862b30"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_45fa98a28a6944e39d8a5754bd1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_1a764d454e20296cfa277d8742e"`,
    );
    await queryRunner.query(`DROP TABLE "boat_staff"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_81eba089f810c972e8c4dee15b"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(
      `DROP TYPE "public"."chat_messages_senderrole_enum"`,
    );
    await queryRunner.query(`DROP TABLE "promotions"`);
    await queryRunner.query(`DROP TYPE "public"."promotions_cta_action_enum"`);
    await queryRunner.query(`DROP TABLE "coupons"`);
    await queryRunner.query(`DROP TYPE "public"."coupons_applicable_to_enum"`);
    await queryRunner.query(`DROP TYPE "public"."coupons_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_832b309fe683771540488a4cd7"`,
    );
    await queryRunner.query(`DROP TABLE "document_change_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."document_change_requests_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."document_change_requests_document_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(`DROP TYPE "public"."favorites_type_enum"`);
    await queryRunner.query(`DROP TABLE "km_transactions"`);
    await queryRunner.query(`DROP TYPE "public"."km_transactions_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_507a2818bf5524662b068c2e81"`,
    );
    await queryRunner.query(`DROP TABLE "referrals"`);
    await queryRunner.query(`DROP TYPE "public"."referrals_status_enum"`);
    await queryRunner.query(`DROP TABLE "community_locations"`);
    await queryRunner.query(
      `DROP TYPE "public"."community_locations_source_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."community_locations_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "payment_methods"`);
    await queryRunner.query(`DROP TYPE "public"."payment_methods_brand_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_methods_type_enum"`);
    await queryRunner.query(`DROP TABLE "emergency_contacts"`);
    await queryRunner.query(
      `DROP TYPE "public"."emergency_contacts_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "personal_contacts"`);
    await queryRunner.query(`DROP TABLE "safety_checklists"`);
    await queryRunner.query(`DROP TABLE "sos_alerts"`);
    await queryRunner.query(`DROP TYPE "public"."sos_alerts_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."sos_alerts_type_enum"`);
    await queryRunner.query(`DROP TABLE "shipment_reviews"`);
    await queryRunner.query(`DROP TABLE "shipment_timeline"`);
    await queryRunner.query(`DROP TABLE "stop_reviews"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_kyc_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_gender_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "point_transactions"`);
    await queryRunner.query(
      `DROP TYPE "public"."point_transactions_action_enum"`,
    );
    await queryRunner.query(`DROP TABLE "boats"`);
    await queryRunner.query(`DROP TABLE "trips"`);
    await queryRunner.query(`DROP TYPE "public"."trips_status_enum"`);
    await queryRunner.query(`DROP TABLE "cargo_shipments"`);
    await queryRunner.query(`DROP TYPE "public"."cargo_shipments_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."cargo_shipments_cargo_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TYPE "public"."reviews_review_type_enum"`);
    await queryRunner.query(`DROP TABLE "shipments"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shipments_paid_by_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."shipments_payment_method_enum"`,
    );
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(
      `DROP TYPE "public"."bookings_payment_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."bookings_payment_method_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "routes"`);
    await queryRunner.query(`DROP TABLE "weather_data"`);
  }
}
