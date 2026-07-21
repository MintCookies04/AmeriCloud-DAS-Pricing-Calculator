/*
  Warnings:

  - Added the required column `rawWageRate` to the `LaborRate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LaborRate" ADD COLUMN     "rawWageRate" DOUBLE PRECISION NOT NULL;
