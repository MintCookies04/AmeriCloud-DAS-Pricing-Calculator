-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('Consumable', 'DAS Materials', 'BAT Materials');

-- CreateEnum
CREATE TYPE "LaborRoleName" AS ENUM ('Technician', 'Construction Manager', 'RF-Engineer', 'RF-Technician', 'Project Coordinator', 'Project Manager');

-- CreateEnum
CREATE TYPE "LaborSheet" AS ENUM ('LOE', 'SOW');

-- CreateEnum
CREATE TYPE "PassThroughRateKind" AS ENUM ('PerDiem', 'Lodging', 'Airfare');

-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "description" TEXT NOT NULL,
    "vendor" TEXT,
    "category" "MaterialCategory" NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborTask" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sheet" "LaborSheet" NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minutesPerUnit" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "laborRole" "LaborRoleName" NOT NULL,
    "includedInSubtotal" BOOLEAN NOT NULL DEFAULT true,
    "derivedFromJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRate" (
    "id" TEXT NOT NULL,
    "role" "LaborRoleName" NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewSizeRow" (
    "id" TEXT NOT NULL,
    "technicianCount" INTEGER NOT NULL,
    "cmsNeeded" INTEGER NOT NULL,

    CONSTRAINT "CrewSizeRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborProjectionSettings" (
    "id" TEXT NOT NULL,
    "hoursPerManDay" DOUBLE PRECISION NOT NULL,
    "hoursPerManWeek" DOUBLE PRECISION NOT NULL,
    "stagingMaterialMultiplier" DOUBLE PRECISION NOT NULL,
    "cmPercentOfTechHours" DOUBLE PRECISION NOT NULL,
    "pmPercentOfTechHours" DOUBLE PRECISION NOT NULL,
    "coordinatorPercentOfTechHours" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborProjectionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassThroughRoleRate" (
    "id" TEXT NOT NULL,
    "kind" "PassThroughRateKind" NOT NULL,
    "role" "LaborRoleName" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PassThroughRoleRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "RentalRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftCostRate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SoftCostRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateDefaults" (
    "id" TEXT NOT NULL,
    "laborMarkupPct" DOUBLE PRECISION NOT NULL,
    "passThroughMarkupPct" DOUBLE PRECISION NOT NULL,
    "materialMarkupPct" DOUBLE PRECISION NOT NULL,
    "corporateMarkupPct" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "contingencyPct" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialItem_key_key" ON "MaterialItem"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LaborTask_key_key" ON "LaborTask"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRate_role_key" ON "LaborRate"("role");

-- CreateIndex
CREATE UNIQUE INDEX "CrewSizeRow_technicianCount_key" ON "CrewSizeRow"("technicianCount");

-- CreateIndex
CREATE UNIQUE INDEX "PassThroughRoleRate_kind_role_key" ON "PassThroughRoleRate"("kind", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RentalRate_key_key" ON "RentalRate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SoftCostRate_key_key" ON "SoftCostRate"("key");
