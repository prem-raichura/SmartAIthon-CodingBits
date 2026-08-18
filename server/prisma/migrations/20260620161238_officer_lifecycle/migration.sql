-- CreateEnum
CREATE TYPE "OfficerAvailability" AS ENUM ('available', 'on_task', 'off_duty');

-- CreateEnum
CREATE TYPE "UnassignStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "AssignmentStatus" ADD VALUE 'cancelled';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'alert';

-- AlterTable
ALTER TABLE "field_validations" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "opinion" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "availability" "OfficerAvailability" NOT NULL DEFAULT 'available',
ADD COLUMN     "last_lat" DOUBLE PRECISION,
ADD COLUMN     "last_lon" DOUBLE PRECISION,
ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(40),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_pings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distance_m" DOUBLE PRECISION,
    "in_range" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unassign_requests" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "UnassignStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "unassign_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stations_name_key" ON "stations"("name");

-- CreateIndex
CREATE INDEX "location_pings_user_id_idx" ON "location_pings"("user_id");

-- CreateIndex
CREATE INDEX "location_pings_assignment_id_idx" ON "location_pings"("assignment_id");

-- CreateIndex
CREATE INDEX "unassign_requests_status_idx" ON "unassign_requests"("status");

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unassign_requests" ADD CONSTRAINT "unassign_requests_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unassign_requests" ADD CONSTRAINT "unassign_requests_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
