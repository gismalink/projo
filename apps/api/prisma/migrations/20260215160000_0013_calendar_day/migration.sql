-- CreateTable
CREATE TABLE "CalendarDay" (
    "date" DATE NOT NULL,
    "isWeekend" BOOLEAN NOT NULL,
    "isHoliday" BOOLEAN NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL,
    "holidayName" TEXT,
    "sourceYear" INTEGER NOT NULL,
    "sourceSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "CalendarYearSync" (
    "year" INTEGER NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarYearSync_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE INDEX "CalendarDay_sourceYear_idx" ON "CalendarDay"("sourceYear");

-- CreateIndex
CREATE INDEX "CalendarDay_isHoliday_isWorkingDay_idx" ON "CalendarDay"("isHoliday", "isWorkingDay");
