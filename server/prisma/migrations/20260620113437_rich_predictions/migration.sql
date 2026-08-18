-- AlterTable
ALTER TABLE "prediction_cells" ADD COLUMN     "blockage_rate" INTEGER,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "dominant_violation" VARCHAR(80),
ADD COLUMN     "forecast_date_24h" DATE,
ADD COLUMN     "forecast_date_48h" DATE,
ADD COLUMN     "hotspot_code" VARCHAR(12),
ADD COLUMN     "location" VARCHAR(120),
ADD COLUMN     "pred_48h" INTEGER,
ADD COLUMN     "risk_score" INTEGER,
ADD COLUMN     "z_score" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "prediction_runs" ADD COLUMN     "original_filename" VARCHAR(255),
ADD COLUMN     "rows_in" INTEGER,
ADD COLUMN     "uploaded_by" TEXT;

-- CreateTable
CREATE TABLE "run_analytics" (
    "run_id" TEXT NOT NULL,
    "dashboard" JSONB NOT NULL,
    "hotspots" JSONB NOT NULL,
    "stations" JSONB NOT NULL,
    "officers" JSONB NOT NULL,
    "violations" JSONB NOT NULL,
    "vehicles" JSONB NOT NULL,
    "timeseries" JSONB NOT NULL,
    "funnel" JSONB NOT NULL,
    "edi" JSONB NOT NULL,
    "activity" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_analytics_pkey" PRIMARY KEY ("run_id")
);

-- AddForeignKey
ALTER TABLE "run_analytics" ADD CONSTRAINT "run_analytics_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "prediction_runs"("run_id") ON DELETE RESTRICT ON UPDATE CASCADE;
