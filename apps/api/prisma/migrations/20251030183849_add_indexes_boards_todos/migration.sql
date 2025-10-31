-- CreateIndex
CREATE INDEX "Board_tenantId_createdAt_idx" ON "Board"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Todo_tenantId_boardId_status_idx" ON "Todo"("tenantId", "boardId", "status");
