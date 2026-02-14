-- CreateTable
CREATE TABLE "CostRate" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "roleId" TEXT,
    "amountPerHour" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostRate_employeeId_validFrom_idx" ON "CostRate"("employeeId", "validFrom");

-- CreateIndex
CREATE INDEX "CostRate_roleId_validFrom_idx" ON "CostRate"("roleId", "validFrom");

-- AddForeignKey
ALTER TABLE "CostRate" ADD CONSTRAINT "CostRate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRate" ADD CONSTRAINT "CostRate_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
