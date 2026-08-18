-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'officer');

-- CreateEnum
CREATE TYPE "PredictionWindow" AS ENUM ('24hr', '48hr');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('pending', 'active', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('assignment', 'reminder', 'system');

-- CreateEnum
CREATE TYPE "CongestionSeverity" AS ENUM ('none', 'low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('draft', 'submitted');

-- CreateTable
CREATE TABLE "registration_requests" (
    "request_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "police_station" VARCHAR(150) NOT NULL,
    "avatar_url" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "police_station" VARCHAR(150) NOT NULL,
    "avatar_url" TEXT,
    "username" VARCHAR(100) NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'officer',
    "push_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_runs" (
    "run_id" TEXT NOT NULL,
    "csv_path" TEXT NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "prediction_window" "PredictionWindow" NOT NULL DEFAULT '24hr',
    "h3_resolution" SMALLINT NOT NULL DEFAULT 8,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "prediction_cells" (
    "cell_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "h3_index" VARCHAR(20) NOT NULL,
    "h3_resolution" SMALLINT NOT NULL,
    "prediction_window" "PredictionWindow" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "predicted_violations" INTEGER,
    "predicted_tickets" INTEGER,
    "dominant_vehicle_type" VARCHAR(50),
    "congestion_score" DOUBLE PRECISION,
    "impact_score" DOUBLE PRECISION,
    "double_violation" BOOLEAN,
    "blockage_relation_type" VARCHAR(50),
    "risk_level" "RiskLevel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_cells_pkey" PRIMARY KEY ("cell_id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cell_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "time_limit" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'pending',
    "notified_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "field_validations" (
    "validation_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "cell_id" TEXT NOT NULL,
    "has_congestion" BOOLEAN NOT NULL,
    "congestion_severity" "CongestionSeverity",
    "dominant_vehicle_type" VARCHAR(50),
    "vehicle_count_approx" INTEGER,
    "notes" TEXT,
    "photo_url" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_validations_pkey" PRIMARY KEY ("validation_id")
);

-- CreateTable
CREATE TABLE "model_feedback_batches" (
    "batch_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "total_validations" INTEGER NOT NULL,
    "true_positives" INTEGER NOT NULL,
    "false_positives" INTEGER NOT NULL,
    "false_negatives" INTEGER NOT NULL,
    "accuracy_score" DOUBLE PRECISION NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_feedback_batches_pkey" PRIMARY KEY ("batch_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_requests_email_key" ON "registration_requests"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_request_id_key" ON "users"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "prediction_cells_h3_index_idx" ON "prediction_cells"("h3_index");

-- CreateIndex
CREATE INDEX "prediction_cells_run_id_idx" ON "prediction_cells"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_validations_assignment_id_key" ON "field_validations"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "model_feedback_batches_month_key" ON "model_feedback_batches"("month");

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "registration_requests"("request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_cells" ADD CONSTRAINT "prediction_cells_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "prediction_runs"("run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "prediction_cells"("cell_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "prediction_runs"("run_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_validations" ADD CONSTRAINT "field_validations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_validations" ADD CONSTRAINT "field_validations_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_validations" ADD CONSTRAINT "field_validations_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "prediction_cells"("cell_id") ON DELETE RESTRICT ON UPDATE CASCADE;
